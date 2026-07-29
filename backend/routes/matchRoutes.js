import express from "express";
import mongoose from "mongoose";
import { Match } from "../models/Match.js";
import { User } from "../models/User.js";
import { Report } from "../models/Report.js";
import { authenticateToken } from "../middleware/auth.js";
import {
    getRecentlyJoined,
    getMostActiveUsers,
    getNearbyUsers,
    calculateCompatibility,
} from "../services/matchingService.js";
import { getSuggestions as getFreshSuggestions, notifySuggestionsChanged } from "../services/suggestionService.js";
import { createNotification } from "../services/notificationService.js";

const router = express.Router();

// ── Helper: validate MongoDB ObjectId ──────────────────────────────────────────
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── Admin check helper ─────────────────────────────────────────────────────────
const isAdminUser = async (userId) => {
    const user = await User.findById(userId).select("role isAdmin").lean();
    return user?.role === "admin" || user?.isAdmin === true;
};

// ── Premium check ──────────────────────────────────────────────────────────────
const canViewLikes = async (userId) => {
    const user = await User.findById(userId).select("isPremium premiumTier premiumExpires role isAdmin").lean();
    // Admin bypass
    if (user?.role === "admin" || user?.isAdmin === true) return true;
    // Premium check
    if (user?.isPremium && user?.premiumExpires && new Date(user.premiumExpires) > new Date()) return true;
    return false;
};

// ── GET /suggestions  (recommended for-you feed) ──────────────────────────────
router.get("/suggestions", authenticateToken, async (req, res) => {
    try {
        const suggestions = await getFreshSuggestions(req.user.userId);
        res.json({ success: true, suggestions });
    } catch (err) {
        console.error("[Suggestions]", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /recently-joined ──────────────────────────────────────────────────────
router.get("/recently-joined", authenticateToken, async (req, res) => {
    try {
        const users = await getRecentlyJoined(req.user.userId);
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /recently-active ──────────────────────────────────────────────────────
router.get("/recently-active", authenticateToken, async (req, res) => {
    try {
        const users = await getMostActiveUsers(req.user.userId);
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /nearby ───────────────────────────────────────────────────────────────
router.get("/nearby", authenticateToken, async (req, res) => {
    try {
        const users = await getNearbyUsers(req.user.userId);
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /online ───────────────────────────────────────────────────────────────
router.get("/online", authenticateToken, async (_req, res) => {
    try {
        const onlineIds = global.onlineUsers ? Array.from(global.onlineUsers.keys()) : [];
        const users = onlineIds.length > 0
            ? await User.find({ _id: { $in: onlineIds }, emailVerified: true, isBanned: false })
                .select("-password -verificationToken -refreshTokens").limit(30).lean()
            : await User.find({ lastLogin: { $gte: new Date(Date.now() - 15 * 60000) }, emailVerified: true, isBanned: false })
                .select("-password -verificationToken -refreshTokens").limit(30).lean();
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /like ────────────────────────────────────────────────────────────────
router.post("/like", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { likedUserId } = req.body;

        if (!likedUserId) {
            return res.status(400).json({ success: false, message: "likedUserId is required" });
        }
        if (!isValidObjectId(likedUserId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID format" });
        }
        if (userId.toString() === likedUserId.toString()) {
            return res.status(400).json({ success: false, message: "Cannot like yourself" });
        }

        // Verify target user exists
        const likedUser = await User.findById(likedUserId);
        if (!likedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // ── Check for existing match record (prevent duplicate likes) ────────────
        const existingMatch = await Match.findOne({ userId, matchedUserId: likedUserId });
        if (existingMatch) {
            if (existingMatch.userLiked || existingMatch.status === "liked" || existingMatch.status === "superliked") {
                return res.status(409).json({
                    success: false,
                    message: "You have already liked this user",
                    alreadyLiked: true,
                });
            }
            existingMatch.userLiked = true;
            existingMatch.userLikedAt = new Date();
            existingMatch.status = "liked";
        }

        let match;
        if (existingMatch) {
            match = existingMatch;
        } else {
            match = new Match({
                userId,
                matchedUserId: likedUserId,
                userLiked: true,
                userLikedAt: new Date(),
                status: "liked",
            });
        }

        // ── Check mutual like ───────────────────────────────────────────────────
        const reverse = await Match.findOne({ userId: likedUserId, matchedUserId: userId });
        if (reverse && (reverse.userLiked || reverse.status === "superliked")) {
            match.status = "matched";
            match.matchedAt = new Date();
            if (reverse.status !== "matched") {
                reverse.status = "matched";
                reverse.matchedAt = new Date();
                await reverse.save();
            }
        }

        await match.save();

        // ── Emit real-time socket events ────────────────────────────────────────
        if (global.io) {
            if (match.status === "matched") {
                global.io.to(likedUserId).emit("new_match", { with: userId });
                global.io.to(userId).emit("new_match", { with: likedUserId });
            } else {
                global.io.to(likedUserId).emit("new_like", { from: userId });
            }
            global.io.to(userId).emit("like_status", {
                targetUserId: likedUserId,
                liked: true,
                isMatch: match.status === "matched",
            });
        }

        notifySuggestionsChanged();

        // ── Create notifications ────────────────────────────────────────────────
        try {
            if (match.status === "matched") {
                const [liker, liked] = await Promise.all([
                    User.findById(userId).select("firstName").lean(),
                    User.findById(likedUserId).select("firstName").lean(),
                ]);
                await Promise.allSettled([
                    createNotification({
                        userId,
                        type: "match",
                        title: "It's a Match! 💕",
                        message: `You matched with ${liked?.firstName || "someone"}!`,
                        referenceId: likedUserId,
                        referenceModel: "User",
                        icon: "💞",
                    }),
                    createNotification({
                        userId: likedUserId,
                        type: "match",
                        title: "It's a Match! 💕",
                        message: `You matched with ${liker?.firstName || "someone"}!`,
                        referenceId: userId,
                        referenceModel: "User",
                        icon: "💞",
                    }),
                ]);
            } else {
                await createNotification({
                    userId: likedUserId,
                    type: "like",
                    title: "New Like",
                    message: `Someone liked your profile!`,
                    referenceId: userId,
                    referenceModel: "User",
                    icon: "❤️",
                    metadata: { fromUserId: userId },
                });
            }
        } catch (notifErr) {
            console.error("[Like] Notification error:", notifErr.message);
        }

        res.json({
            success: true,
            isMatch: match.status === "matched",
            message: match.status === "matched" ? "It's a match! 💕" : "Like sent!",
            match,
        });
    } catch (err) {
        console.error("[Like]", err);
        if (err.code === 11000) {
            try {
                const existing = await Match.findOne({ userId: req.user.userId, matchedUserId: req.body.likedUserId });
                if (existing) {
                    const isMatch = existing.status === "matched";
                    return res.status(409).json({
                        success: false,
                        message: isMatch ? "Already matched!" : "Already liked!",
                        alreadyLiked: true,
                        isMatch,
                    });
                }
            } catch { /* fall through */ }
            return res.status(409).json({ success: false, message: "Already liked this user", alreadyLiked: true });
        }
        if (err.name === "CastError") {
            return res.status(400).json({ success: false, message: "Invalid user ID format" });
        }
        res.status(500).json({ success: false, message: err.message || "Failed to like user. Please try again." });
    }
});

// ── POST /superlike ───────────────────────────────────────────────────────────
router.post("/superlike", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { likedUserId } = req.body;

        if (!likedUserId) {
            return res.status(400).json({ success: false, message: "likedUserId is required" });
        }
        if (!isValidObjectId(likedUserId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID format" });
        }
        if (userId.toString() === likedUserId.toString()) {
            return res.status(400).json({ success: false, message: "Cannot super-like yourself" });
        }

        const existingMatch = await Match.findOne({ userId, matchedUserId: likedUserId });
        if (existingMatch) {
            if (existingMatch.userLiked || existingMatch.status === "liked" || existingMatch.status === "superliked") {
                return res.status(409).json({
                    success: false,
                    message: "You have already liked this user",
                    alreadyLiked: true,
                });
            }
            existingMatch.userLiked = true;
            existingMatch.userLikedAt = new Date();
            existingMatch.status = "superliked";
        }

        let match;
        if (existingMatch) {
            match = existingMatch;
        } else {
            match = new Match({
                userId,
                matchedUserId: likedUserId,
                userLiked: true,
                userLikedAt: new Date(),
                status: "superliked",
            });
        }

        const reverse = await Match.findOne({ userId: likedUserId, matchedUserId: userId });
        if (reverse && (reverse.userLiked || reverse.status === "superliked")) {
            match.status = "matched";
            match.matchedAt = new Date();
            if (reverse.status !== "matched") {
                reverse.status = "matched";
                reverse.matchedAt = new Date();
                await reverse.save();
            }
        }

        await match.save();

        if (global.io) {
            global.io.to(likedUserId).emit("super_like", { from: userId });
            if (match.status === "matched") {
                global.io.to(likedUserId).emit("new_match", { with: userId });
                global.io.to(userId).emit("new_match", { with: likedUserId });
            }
            global.io.to(userId).emit("like_status", {
                targetUserId: likedUserId,
                liked: true,
                isMatch: match.status === "matched",
                isSuperLike: true,
            });
        }

        notifySuggestionsChanged();

        try {
            if (match.status === "matched") {
                const [liker, liked] = await Promise.all([
                    User.findById(userId).select("firstName").lean(),
                    User.findById(likedUserId).select("firstName").lean(),
                ]);
                await Promise.allSettled([
                    createNotification({
                        userId,
                        type: "match",
                        title: "It's a Match! 💕",
                        message: `You matched with ${liked?.firstName || "someone"}!`,
                        referenceId: likedUserId,
                        referenceModel: "User",
                        icon: "💞",
                    }),
                    createNotification({
                        userId: likedUserId,
                        type: "match",
                        title: "It's a Match! 💕",
                        message: `You matched with ${liker?.firstName || "someone"}!`,
                        referenceId: userId,
                        referenceModel: "User",
                        icon: "💞",
                    }),
                ]);
            } else {
                await createNotification({
                    userId: likedUserId,
                    type: "like",
                    title: "Super Like! ⭐",
                    message: `Someone super liked your profile!`,
                    referenceId: userId,
                    referenceModel: "User",
                    icon: "⭐",
                    metadata: { fromUserId: userId, isSuperLike: true },
                });
            }
        } catch (notifErr) {
            console.error("[SuperLike] Notification error:", notifErr.message);
        }

        res.json({
            success: true,
            isMatch: match.status === "matched",
            message: match.status === "matched" ? "It's a match! 💕" : "Super Like sent! ⭐",
            superLike: true,
            match,
        });
    } catch (err) {
        console.error("[SuperLike]", err);
        if (err.code === 11000) {
            try {
                const existing = await Match.findOne({ userId: req.user.userId, matchedUserId: req.body.likedUserId });
                if (existing) {
                    const isMatch = existing.status === "matched";
                    return res.status(409).json({
                        success: false,
                        message: isMatch ? "Already matched!" : "Already liked!",
                        alreadyLiked: true,
                        isMatch,
                        superLike: true,
                    });
                }
            } catch { /* fall through */ }
            return res.status(409).json({ success: false, message: "Already liked this user", alreadyLiked: true, superLike: true });
        }
        if (err.name === "CastError") {
            return res.status(400).json({ success: false, message: "Invalid user ID format" });
        }
        res.status(500).json({ success: false, message: err.message || "Failed to super-like. Please try again." });
    }
});

// ── POST /pass ────────────────────────────────────────────────────────────────
router.post("/pass", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { passedUserId } = req.body;
        if (!passedUserId) return res.status(400).json({ success: false, message: "passedUserId is required" });
        if (!isValidObjectId(passedUserId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID format" });
        }

        let match = await Match.findOne({ userId, matchedUserId: passedUserId });
        if (!match) {
            match = new Match({ userId, matchedUserId: passedUserId, status: "rejected" });
        } else {
            match.status = "rejected";
        }
        await match.save();

        notifySuggestionsChanged();

        res.json({ success: true, message: "Passed" });
    } catch (err) {
        console.error("[Pass]", err);
        if (err.code === 11000) {
            return res.json({ success: true, message: "Already passed" });
        }
        if (err.name === "CastError") {
            return res.status(400).json({ success: false, message: "Invalid user ID format" });
        }
        res.status(500).json({ success: false, message: err.message || "Failed to pass" });
    }
});

// ── GET /my-matches ───────────────────────────────────────────────────────────
router.get("/my-matches", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const matches = await Match.find({
            $or: [{ userId, status: "matched" }, { matchedUserId: userId, status: "matched" }],
        })
        .sort({ matchedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("matchedUserId userId", "-password -verificationToken -refreshTokens");

        const total = await Match.countDocuments({
            $or: [{ userId, status: "matched" }, { matchedUserId: userId, status: "matched" }],
        });

        const formatted = matches.map(m => ({
            _id: m._id,
            user: m.userId._id?.toString() === userId ? m.matchedUserId : m.userId,
            matchedAt: m.matchedAt,
            messagesSent: m.messagesSent || 0,
            lastMessageAt: m.lastMessageAt,
        }));

        res.json({ success: true, matches: formatted, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("[My Matches]", err);
        res.status(500).json({ success: false, message: "Failed to fetch matches" });
    }
});

// ── GET /matches/count ─────────────────────────────────────────────────────────
router.get("/matches/count", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const count = await Match.countDocuments({
            $or: [{ userId, status: "matched" }, { matchedUserId: userId, status: "matched" }],
        });
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to get match count" });
    }
});

// ── GET /likes-received ───────────────────────────────────────────────────────
router.get("/likes-received", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const isPremium = await canViewLikes(userId);

        const likes = await Match.find({
            matchedUserId: userId,
            userLiked: true,
            status: { $in: ["liked", "superliked"] },
        })
        .sort({ userLikedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "-password -verificationToken -refreshTokens");

        const total = await Match.countDocuments({
            matchedUserId: userId,
            userLiked: true,
            status: { $in: ["liked", "superliked"] },
        });

        // For non-premium users, send blurred data
        const formatted = likes.map(l => ({
            _id: l._id,
            from: isPremium ? l.userId : {
                _id: l.userId?._id,
                isBlurred: true,
            },
            likedAt: l.userLikedAt,
            isSuperLike: l.status === "superliked",
            isPremiumView: isPremium,
        }));

        res.json({
            success: true,
            likes: formatted,
            total,
            page,
            pages: Math.ceil(total / limit),
            isPremiumView: isPremium,
        });
    } catch (err) {
        console.error("[Likes Received]", err);
        res.status(500).json({ success: false, message: "Failed to fetch likes" });
    }
});

// ── GET /likes/count ───────────────────────────────────────────────────────────
router.get("/likes/count", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const count = await Match.countDocuments({
            matchedUserId: userId,
            userLiked: true,
            status: { $in: ["liked", "superliked"] },
        });
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to get likes count" });
    }
});

// ── GET /likes-received/:userId/profile (premium - view liker's full profile) ──
router.get("/likes-received/:likerId/profile", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { likerId } = req.params;

        if (!isValidObjectId(likerId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }

        // Verify they actually liked the current user
        const likeExists = await Match.findOne({
            userId: likerId,
            matchedUserId: userId,
            userLiked: true,
            status: { $in: ["liked", "superliked"] },
        });

        if (!likeExists) {
            return res.status(404).json({ success: false, message: "Like not found" });
        }

        const canView = await canViewLikes(userId);
        if (!canView) {
            return res.status(403).json({ success: false, message: "Premium subscription required to view profiles" });
        }

        const userProfile = await User.findById(likerId)
            .select("-password -verificationToken -refreshTokens -twoFactorSecret")
            .lean();

        if (!userProfile) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, profile: userProfile });
    } catch (err) {
        console.error("[View Liker Profile]", err);
        res.status(500).json({ success: false, message: "Failed to load profile" });
    }
});

// ── POST /like-back ────────────────────────────────────────────────────────────
router.post("/like-back", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { likedUserId } = req.body;

        if (!likedUserId) {
            return res.status(400).json({ success: false, message: "likedUserId is required" });
        }

        const canView = await canViewLikes(userId);
        if (!canView) {
            return res.status(403).json({ success: false, message: "Premium subscription required to like back" });
        }

        // Verify they liked you first
        const theirLike = await Match.findOne({
            userId: likedUserId,
            matchedUserId: userId,
            userLiked: true,
            status: { $in: ["liked", "superliked"] },
        });

        if (!theirLike) {
            return res.status(404).json({ success: false, message: "This user hasn't liked you" });
        }

        // Create match
        let myMatch = await Match.findOne({ userId, matchedUserId: likedUserId });
        if (myMatch) {
            if (myMatch.status === "matched") {
                return res.json({ success: true, isMatch: true, message: "Already matched!" });
            }
            myMatch.userLiked = true;
            myMatch.userLikedAt = new Date();
            myMatch.status = "matched";
            myMatch.matchedAt = new Date();
        } else {
            myMatch = new Match({
                userId,
                matchedUserId: likedUserId,
                userLiked: true,
                userLikedAt: new Date(),
                status: "matched",
                matchedAt: new Date(),
            });
        }

        // Update their record
        if (theirLike.status !== "matched") {
            theirLike.status = "matched";
            theirLike.matchedAt = new Date();
            await theirLike.save();
        }

        await myMatch.save();

        if (global.io) {
            global.io.to(likedUserId).emit("new_match", { with: userId });
            global.io.to(userId).emit("new_match", { with: likedUserId });
        }

        // Notifications
        try {
            const [me, them] = await Promise.all([
                User.findById(userId).select("firstName").lean(),
                User.findById(likedUserId).select("firstName").lean(),
            ]);
            await Promise.allSettled([
                createNotification({
                    userId,
                    type: "match",
                    title: "It's a Match! 💕",
                    message: `You matched with ${them?.firstName || "someone"}!`,
                    referenceId: likedUserId,
                    referenceModel: "User",
                    icon: "💞",
                }),
                createNotification({
                    userId: likedUserId,
                    type: "match",
                    title: "It's a Match! 💕",
                    message: `You matched with ${me?.firstName || "someone"}!`,
                    referenceId: userId,
                    referenceModel: "User",
                    icon: "💞",
                }),
            ]);
        } catch { /* silent */ }

        res.json({ success: true, isMatch: true, message: "It's a match! 💕" });
    } catch (err) {
        console.error("[Like Back]", err);
        res.status(500).json({ success: false, message: "Failed to like back" });
    }
});

// ── POST /unmatch ─────────────────────────────────────────────────────────────
router.post("/unmatch", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { unmatchedUserId } = req.body;

        if (!unmatchedUserId) {
            return res.status(400).json({ success: false, message: "unmatchedUserId is required" });
        }

        await Match.deleteMany({
            $or: [
                { userId, matchedUserId: unmatchedUserId, status: "matched" },
                { userId: unmatchedUserId, matchedUserId: userId, status: "matched" },
            ],
        });

        notifySuggestionsChanged();

        if (global.io) {
            global.io.to(unmatchedUserId).emit("removed_match", { with: userId });
        }

        res.json({ success: true, message: "Unmatched successfully" });
    } catch (err) {
        console.error("[Unmatch]", err);
        res.status(500).json({ success: false, message: "Failed to unmatch" });
    }
});

// ── POST /block ───────────────────────────────────────────────────────────────
router.post("/block", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { blockedUserId } = req.body;
        if (!blockedUserId) return res.status(400).json({ success: false, message: "blockedUserId is required" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (!user.blocked) user.blocked = [];
        if (!user.blocked.map(String).includes(blockedUserId)) {
            user.blocked.push(blockedUserId);
            await user.save();
        }

        await Match.updateMany(
            { $or: [{ userId, matchedUserId: blockedUserId }, { userId: blockedUserId, matchedUserId: userId }] },
            { status: "blocked" }
        );

        notifySuggestionsChanged();

        if (global.io) {
            global.io.to(blockedUserId).emit("blocked_by", { by: userId });
        }

        res.json({ success: true, message: "User blocked" });
    } catch (err) {
        console.error("[Block]", err);
        res.status(500).json({ success: false, message: "Failed to block user" });
    }
});

// ── POST /report ──────────────────────────────────────────────────────────────
router.post("/report", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { reportedUserId, reason, description } = req.body;

        if (!reportedUserId || !reason) {
            return res.status(400).json({ success: false, message: "reportedUserId and reason are required" });
        }

        // Check for duplicate report
        const existingReport = await Report.findOne({
            reportedBy: userId,
            reportedUser: reportedUserId,
        });

        if (existingReport) {
            return res.status(409).json({ success: false, message: "You have already reported this user" });
        }

        const report = new Report({
            reportedBy: userId,
            reportedUser: reportedUserId,
            category: reason,
            description: description || "",
        });

        await report.save();

        res.json({ success: true, message: "User reported successfully. We will review this." });
    } catch (err) {
        console.error("[Report]", err);
        res.status(500).json({ success: false, message: "Failed to submit report" });
    }
});

// ── GET /compatibility/:userId ────────────────────────────────────────────────
router.get("/compatibility/:userId", authenticateToken, async (req, res) => {
    try {
        const [me, them] = await Promise.all([
            User.findById(req.user.userId).lean(),
            User.findById(req.params.userId).lean(),
        ]);
        if (!me || !them) return res.status(404).json({ success: false, message: "User not found" });
        res.json({ success: true, score: calculateCompatibility(me, them) });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to calculate compatibility" });
    }
});

// ── GET /count ────────────────────────────────────────────────────────────────
router.get("/count", async (_req, res) => {
    try {
        const count = await User.countDocuments({ emailVerified: true, isBanned: false });
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;