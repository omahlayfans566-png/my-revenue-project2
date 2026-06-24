import express from "express";
import { Match } from "../models/Match.js";
import { User } from "../models/User.js";
import { authenticateToken } from "../middleware/auth.js";
import {
    getMatchSuggestions,
    calculateCompatibility,
} from "../services/matchingService.js";

const router = express.Router();

// GET: Get Match Suggestions
router.get("/suggestions", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        const suggestions = await getMatchSuggestions(userId);

        res.json({
            success: true,
            suggestions,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// POST: Like a User
router.post("/like", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { likedUserId } = req.body;

        if (!likedUserId) {
            return res.status(400).json({
                success: false,
                message: "Liked user ID is required",
            });
        }

        if (userId === likedUserId) {
            return res.status(400).json({
                success: false,
                message: "You cannot like yourself",
            });
        }

        // Check if user exists
        const likedUser = await User.findById(likedUserId);

        if (!likedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if already liked
        let match = await Match.findOne({
            userId,
            matchedUserId: likedUserId,
        });

        if (!match) {
            match = new Match({
                userId,
                matchedUserId: likedUserId,
                userLiked: true,
                userLikedAt: new Date(),
                status: "liked",
            });
        } else {
            match.userLiked = true;
            match.userLikedAt = new Date();
        }

        // Check for mutual like (match)
        const reverseMatch = await Match.findOne({
            userId: likedUserId,
            matchedUserId: userId,
        });

        if (reverseMatch && reverseMatch.userLiked) {
            match.status = "matched";
            match.matchedAt = new Date();
        }

        await match.save();

        res.json({
            success: true,
            message: match.status === "matched" ? "It's a match! 💕" : "Like sent!",
            match,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to like user",
        });
    }
});

// POST: Pass/Reject a User
router.post("/pass", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { passedUserId } = req.body;

        if (!passedUserId) {
            return res.status(400).json({
                success: false,
                message: "Passed user ID is required",
            });
        }

        let match = await Match.findOne({
            userId,
            matchedUserId: passedUserId,
        });

        if (!match) {
            match = new Match({
                userId,
                matchedUserId: passedUserId,
                status: "rejected",
            });
        } else {
            match.status = "rejected";
        }

        await match.save();

        res.json({
            success: true,
            message: "Profile passed",
            match,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to pass user",
        });
    }
});

// GET: Get User Matches
router.get("/my-matches", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        const matches = await Match.find({
            $or: [
                { userId, status: "matched" },
                { matchedUserId: userId, status: "matched" },
            ],
        }).populate("matchedUserId userId", "-password");

        // Format response
        const formattedMatches = matches.map((match) => ({
            _id: match._id,
            user:
                match.userId.toString() === userId
                    ? match.matchedUserId
                    : match.userId,
            matchedAt: match.matchedAt,
            messagesSent: match.messagesSent || 0,
            lastMessageAt: match.lastMessageAt,
        }));

        res.json({
            success: true,
            matches: formattedMatches,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch matches",
        });
    }
});

// GET: Get Likes Received
router.get("/likes-received", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        const likes = await Match.find({
            matchedUserId: userId,
            userLiked: true,
            status: { $ne: "matched" },
        }).populate("userId", "-password -verificationToken");

        const formattedLikes = likes.map((like) => ({
            _id: like._id,
            from: like.userId,
            likedAt: like.userLikedAt,
        }));

        res.json({
            success: true,
            likes: formattedLikes,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch likes",
        });
    }
});

// POST: Block User
router.post("/block", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { blockedUserId } = req.body;

        if (!blockedUserId) {
            return res.status(400).json({
                success: false,
                message: "Blocked user ID is required",
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (!user.blocked) {
            user.blocked = [];
        }

        if (!user.blocked.includes(blockedUserId)) {
            user.blocked.push(blockedUserId);
            await user.save();
        }

        res.json({
            success: true,
            message: "User blocked",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to block user",
        });
    }
});

// POST: Report User
router.post("/report/:userId", authenticateToken, async (req, res) => {
    // Delegate to profileRoutes logic — kept here for convenience
    // (the full implementation lives in profileRoutes.js)
    res.redirect(307, `/api/profile/${req.params.userId}/report`);
});

// GET: Member count (for homepage stats)
router.get("/count", async (_req, res) => {
    try {
        const count = await User.countDocuments({ isMember: true, isActive: true, isBanned: false });
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
