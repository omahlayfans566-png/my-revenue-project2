import express from "express";
import { Match } from "../models/Match.js";
import { User } from "../models/User.js";
import { authenticateToken } from "../middleware/auth.js";
import {
    getMatchSuggestions,
    getRecentlyJoined,
    getRecentlyActive,
    getNearby,
    calculateCompatibility,
} from "../services/matchingService.js";
import { createNotification } from "../services/notificationService.js";

const router = express.Router();

// ── GET /suggestions  (recommended for-you feed) ──────────────────────────────
router.get("/suggestions", authenticateToken, async (req, res) => {
    try {
        const suggestions = await getMatchSuggestions(req.user.userId);
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
        const users = await getRecentlyActive(req.user.userId);
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /nearby ───────────────────────────────────────────────────────────────
router.get("/nearby", authenticateToken, async (req, res) => {
    try {
        const users = await getNearby(req.user.userId);
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

// ── POST /like ────────────────────────────────────────────────────────────────
router.post("/like", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { likedUserId } = req.body;

        if (!likedUserId) return res.status(400).json({ success: false, message: "likedUserId is required" });
        if (userId === likedUserId) return res.status(400).json({ success: false, message: "Cannot like yourself" });

        const likedUser = await User.findById(likedUserId);
        if (!likedUser) return res.status(404).json({ success: false, message: "User not found" });

        let match = await Match.findOne({ userId, matchedUserId: likedUserId });
        if (!match) {
            match = new Match({ userId, matchedUserId: likedUserId, userLiked: true, userLikedAt: new Date(), status: "liked" });
        } else {
            match.userLiked = true;
            match.userLikedAt = new Date();
            match.status = "liked";
        }

        // Check mutual like
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

        // Emit real-time notification if socket available
        if (global.io && match.status !== "matched") {
            global.io.to(likedUserId).emit("new_like", { from: userId });
        }
        if (global.io && match.status === "matched") {
            global.io.to(likedUserId).emit("new_match", { with: userId });
            global.io.to(userId).emit("new_match", { with: likedUserId });
        }

        // Create notification for match or like
        if (match.status === "matched") {
            const liker = await User.findById(userId).select("firstName").lean();
            const liked = await User.findById(likedUserId).select("firstName").lean();
            // Notify both users of the match
            createNotification({
                userId,
                type: "match",
                title: "It's a Match! 💕",
                message: `You matched with ${liked?.firstName || "someone"}!`,
                referenceId: likedUserId,
                referenceModel: "User",
                icon: "💞",
            }).catch(() => {});
            createNotification({
                userId: likedUserId,
                type: "match",
                title: "It's a Match! 💕",
                message: `You matched with ${liker?.firstName || "someone"}!`,
                referenceId: userId,
                referenceModel: "User",
                icon: "💞",
            }).catch(() => {});
        } else {
            createNotification({
                userId: likedUserId,
                type: "like",
                title: "New Like",
                message: `Someone liked your profile!`,
                referenceId: userId,
                referenceModel: "User",
                icon: "❤️",
                metadata: { fromUserId: userId },
            }).catch(() => {});
        }

        res.json({
            success: true,
            isMatch: match.status === "matched",
            message: match.status === "matched" ? "It's a match! 💕" : "Like sent!",
            match,
        });
    } catch (err) {
        console.error("[Like]", err);
        res.status(500).json({ success: false, message: "Failed to like user" });
    }
});

// ── POST /superlike ───────────────────────────────────────────────────────────
router.post("/superlike", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { likedUserId } = req.body;

        if (!likedUserId) return res.status(400).json({ success: false, message: "likedUserId is required" });
        if (userId === likedUserId) return res.status(400).json({ success: false, message: "Cannot super-like yourself" });

        let match = await Match.findOne({ userId, matchedUserId: likedUserId });
        if (!match) {
            match = new Match({ userId, matchedUserId: likedUserId, userLiked: true, userLikedAt: new Date(), status: "superliked" });
        } else {
            match.userLiked = true;
            match.userLikedAt = new Date();
            match.status = "superliked";
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
        }

        // Create notification for super like or match
        if (match.status === "matched") {
            const liker = await User.findById(userId).select("firstName").lean();
            const liked = await User.findById(likedUserId).select("firstName").lean();
            createNotification({
                userId,
                type: "match",
                title: "It's a Match! 💕",
                message: `You matched with ${liked?.firstName || "someone"}!`,
                referenceId: likedUserId,
                referenceModel: "User",
                icon: "💞",
            }).catch(() => {});
            createNotification({
                userId: likedUserId,
                type: "match",
                title: "It's a Match! 💕",
                message: `You matched with ${liker?.firstName || "someone"}!`,
                referenceId: userId,
                referenceModel: "User",
                icon: "💞",
            }).catch(() => {});
        } else {
            createNotification({
                userId: likedUserId,
                type: "like",
                title: "Super Like! ⭐",
                message: `Someone super liked your profile!`,
                referenceId: userId,
                referenceModel: "User",
                icon: "⭐",
                metadata: { fromUserId: userId, isSuperLike: true },
            }).catch(() => {});
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
        res.status(500).json({ success: false, message: "Failed to super-like" });
    }
});

// ── POST /pass ────────────────────────────────────────────────────────────────
router.post("/pass", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { passedUserId } = req.body;
        if (!passedUserId) return res.status(400).json({ success: false, message: "passedUserId is required" });

        let match = await Match.findOne({ userId, matchedUserId: passedUserId });
        if (!match) {
            match = new Match({ userId, matchedUserId: passedUserId, status: "rejected" });
        } else {
            match.status = "rejected";
        }
        await match.save();
        res.json({ success: true, message: "Passed" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to pass" });
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
