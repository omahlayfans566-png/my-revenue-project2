import express from "express";
import mongoose from "mongoose";
import { Match } from "../models/Match.js";
import { User } from "../models/User.js";
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

// ── GET /suggestions  (recommended for-you feed) ──────────────────────────────
router.get("/suggestions", authenticateToken, async (req, res) => {
    try {
        // Use the new suggestion service with proper exclusions
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
// Online = active in last 15 minutes (via socket tracking on server)
router.get("/online", authenticateToken, async (_req, res) => {
    try {
        // The socket service populates onlineUsers — fallback to recently-active if not available
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

// ── Helper: check daily like limit ─────────────────────────────────────────────
const checkDailyLikeLimit = async (userId) => {
    const user = await User.findById(userId).select("isPremium premiumTier premiumExpires");
    if (!user) return { allowed: false, message: "User not found" };

    // Premium users have unlimited likes
    if (user.isPremium && user.premiumExpires && new Date(user.premiumExpires) > new Date()) {
        return { allowed: true };
    }

    // Free users: limit to 10 likes per day
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayLikes = await Match.countDocuments({
        userId,
        userLiked: true,
        createdAt: { $gte: todayStart },
    });

    const FREE_DAILY_LIMIT = 10;
    if (todayLikes >= FREE_DAILY_LIMIT) {
        return { allowed: false, message: `Daily like limit reached (${FREE_DAILY_LIMIT}). Upgrade to Premium for unlimited likes.` };
    }

    return { allowed: true };
};

// ── Helper: check daily super like limit ───────────────────────────────────────
const checkDailySuperLikeLimit = async (userId) => {
    const user = await User.findById(userId).select("isPremium premiumTier premiumExpires");
    if (!user) return { allowed: false, message: "User not found" };

    // Premium limits: Basic=5, Gold=10, Platinum=unlimited
    let maxSuperLikes = 1; // free default
    if (user.isPremium && user.premiumExpires && new Date(user.premiumExpires) > new Date()) {
        if (user.premiumTier === "platinum") return { allowed: true }; // unlimited
        if (user.premiumTier === "gold") maxSuperLikes = 10;
        else if (user.premiumTier === "basic") maxSuperLikes = 5;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todaySuperLikes = await Match.countDocuments({
        userId,
        status: "superliked",
        createdAt: { $gte: todayStart },
    });

    if (todaySuperLikes >= maxSuperLikes) {
        return { allowed: false, message: `Daily super like limit reached (${maxSuperLikes}). Upgrade to Premium for more.` };
    }

    return { allowed: true };
};

// ── POST /like ────────────────────────────────────────────────────────────────
router.post("/like", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { likedUserId } = req.body;

        // ── Validation ──────────────────────────────────────────────────────────
        if (!likedUserId) {
            return res.status(400).json({ success: false, message: "likedUserId is required" });
        }
        if (!isValidObjectId(likedUserId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID format" });
        }

        // FIX: Compare ObjectIds using .toString() — direct === comparison always fails
        if (userId.toString() === likedUserId.toString()) {
            return res.status(400).json({ success: false, message: "Cannot like yourself" });
        }

        // Check daily like limit
        const limitCheck = await checkDailyLikeLimit(userId);
        if (!limitCheck.allowed) {
            return res.status(429).json({ success: false, message: limitCheck.message });
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
            // If previously passed/rejected, update to liked
            existingMatch.userLiked = true;
            existingMatch.userLikedAt = new Date();
            existingMatch.status = "liked";
        }

        // ── Create or update match record ───────────────────────────────────────
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
            // Emit like status update so UI can update in real-time
            global.io.to(userId).emit("like_status", {
                targetUserId: likedUserId,
                liked: true,
                isMatch: match.status === "matched",
            });
        }

        // Notify that suggestions may have changed
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
            // Non-critical — don't fail the like for a notification error
        }

        res.json({
            success: true,
            isMatch: match.status === "matched",
            message: match.status === "matched" ? "It's a match! 💕" : "Like sent!",
            match,
        });
    } catch (err) {
        console.error("[Like]", err);
        // Duplicate key — the record already exists (race condition)
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
        // Mongoose CastError — invalid ObjectId
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

        // ── Validation ──────────────────────────────────────────────────────────
        if (!likedUserId) {
            return res.status(400).json({ success: false, message: "likedUserId is required" });
        }
        if (!isValidObjectId(likedUserId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID format" });
        }

        // FIX: Compare ObjectIds using .toString()
        if (userId.toString() === likedUserId.toString()) {
            return res.status(400).json({ success: false, message: "Cannot super-like yourself" });
        }

        // Check daily super like limit
        const limitCheck = await checkDailySuperLikeLimit(userId);
        if (!limitCheck.allowed) {
            return res.status(429).json({ success: false, message: limitCheck.message });
        }

        // ── Check for existing match record ─────────────────────────────────────
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

        // ── Emit real-time socket events ────────────────────────────────────────
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

        // Notify that suggestions may have changed
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

        // Notify that suggestions may have changed after passing
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
        const matches = await Match.find({
            $or: [{ userId, status: "matched" }, { matchedUserId: userId, status: "matched" }],
        }).populate("matchedUserId userId", "-password -verificationToken -refreshTokens");

        const formatted = matches.map(m => ({
            _id: m._id,
            user: m.userId._id?.toString() === userId ? m.matchedUserId : m.userId,
            matchedAt: m.matchedAt,
            messagesSent: m.messagesSent || 0,
            lastMessageAt: m.lastMessageAt,
        }));

        res.json({ success: true, matches: formatted });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch matches" });
    }
});

// ── GET /likes-received ───────────────────────────────────────────────────────
router.get("/likes-received", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const likes = await Match.find({
            matchedUserId: userId,
            userLiked: true,
            status: { $in: ["liked", "superliked"] },
        }).populate("userId", "-password -verificationToken -refreshTokens");

        res.json({
            success: true,
            likes: likes.map(l => ({
                _id: l._id,
                from: l.userId,
                likedAt: l.userLikedAt,
                isSuperLike: l.status === "superliked",
            })),
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch likes" });
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

        // Remove the match relationship
        await Match.deleteMany({
            $or: [
                { userId, matchedUserId: unmatchedUserId, status: "matched" },
                { userId: unmatchedUserId, matchedUserId: userId, status: "matched" },
            ],
        });

        // Notify that suggestions may have changed after unmatching
        notifySuggestionsChanged();

        res.json({
            success: true,
            message: "Unmatched successfully",
        });
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

        if (!user.blocked.map(String).includes(blockedUserId)) {
            user.blocked.push(blockedUserId);
            await user.save();
        }

        // Mark any match as blocked
        await Match.updateMany(
            { $or: [{ userId, matchedUserId: blockedUserId }, { userId: blockedUserId, matchedUserId: userId }] },
            { status: "blocked" }
        );

        // Notify that suggestions may have changed after blocking
        notifySuggestionsChanged();

        res.json({ success: true, message: "User blocked" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to block user" });
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