import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Story } from "../models/Story.js";
import { VoiceIntroduction } from "../models/VoiceIntroduction.js";
import {
    calculateProfileCompletion,
    recordProfileView,
    getProfileVisitors,
    getProfileViewCount,
    getWhoLikedMe,
    generateProfileSuggestions,
    generateIcebreakers,
    getSmartRecommendations,
    getDailyPicks,
    getUsersByDistance,
    getUsersByHeight,
    getVerificationBadge,
    getBlockList,
    unblockUser,
    boostProfile,
    getBoostStatus,
    toggleIncognitoMode,
    getIncognitoStatus,
    analyzeFakeProfile,
} from "../services/advancedFeaturesService.js";

const router = express.Router();

// ─── PROFILE COMPLETION ────────────────────────────────────────────────────
router.get("/profile-completion", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).lean();
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const score = calculateProfileCompletion(user);
        res.json({ success: true, score, total: 100 });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PROFILE VISITORS ──────────────────────────────────────────────────────
router.get("/visitors", authenticateToken, async (req, res) => {
    try {
        const { limit = 20, page = 1 } = req.query;
        const result = await getProfileVisitors(req.user.userId, parseInt(limit), parseInt(page));
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get("/visitors/count", authenticateToken, async (req, res) => {
    try {
        const count = await getProfileViewCount(req.user.userId);
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Record a profile view (called when someone views a profile)
router.post("/record-view", authenticateToken, async (req, res) => {
    try {
        const { profileOwnerId } = req.body;
        if (!profileOwnerId) return res.status(400).json({ success: false, message: "profileOwnerId is required" });
        if (req.user.userId === profileOwnerId) return res.status(400).json({ success: false, message: "Cannot view your own profile" });

        await recordProfileView(req.user.userId, profileOwnerId);
        res.json({ success: true, message: "View recorded" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── WHO LIKED ME ──────────────────────────────────────────────────────────
router.get("/who-liked-me", authenticateToken, async (req, res) => {
    try {
        const { limit = 20, page = 1 } = req.query;
        const result = await getWhoLikedMe(req.user.userId, parseInt(limit), parseInt(page));
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── AI PROFILE SUGGESTIONS ────────────────────────────────────────────────
router.get("/profile-suggestions", authenticateToken, async (req, res) => {
    try {
        const suggestions = await generateProfileSuggestions(req.user.userId);
        res.json({ success: true, suggestions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── AI ICEBREAKERS ────────────────────────────────────────────────────────
router.get("/icebreakers/:targetUserId", authenticateToken, async (req, res) => {
    try {
        const icebreakers = await generateIcebreakers(req.user.userId, req.params.targetUserId);
        res.json({ success: true, icebreakers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── SMART RECOMMENDATIONS ─────────────────────────────────────────────────
router.get("/smart-recommendations", authenticateToken, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const recommendations = await getSmartRecommendations(req.user.userId, parseInt(limit));
        res.json({ success: true, recommendations });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── DAILY PICKS ──────────────────────────────────────────────────────────
router.get("/daily-picks", authenticateToken, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const picks = await getDailyPicks(req.user.userId, parseInt(limit));
        res.json({ success: true, picks });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── DISTANCE FILTER ──────────────────────────────────────────────────────
router.get("/by-distance", authenticateToken, async (req, res) => {
    try {
        const { maxDistance = 50, limit = 20 } = req.query;
        const users = await getUsersByDistance(req.user.userId, parseInt(maxDistance), parseInt(limit));
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── HEIGHT FILTER ────────────────────────────────────────────────────────
router.get("/by-height", authenticateToken, async (req, res) => {
    try {
        const { minHeight = 100, maxHeight = 250, limit = 20 } = req.query;
        const users = await getUsersByHeight(req.user.userId, parseInt(minHeight), parseInt(maxHeight), parseInt(limit));
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── VERIFICATION BADGE ────────────────────────────────────────────────────
router.get("/verification-badge", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).lean();
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const badges = getVerificationBadge(user);
        res.json({ success: true, badges });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get("/verification-badge/:userId", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).lean();
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const badges = getVerificationBadge(user);
        res.json({ success: true, badges });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── BLOCK LIST ──────────────────────────────────────────────────────────
router.get("/block-list", authenticateToken, async (req, res) => {
    try {
        const { limit = 20, page = 1 } = req.query;
        const result = await getBlockList(req.user.userId, parseInt(limit), parseInt(page));
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/unblock", authenticateToken, async (req, res) => {
    try {
        const { blockedUserId } = req.body;
        if (!blockedUserId) return res.status(400).json({ success: false, message: "blockedUserId is required" });

        await unblockUser(req.user.userId, blockedUserId);
        res.json({ success: true, message: "User unblocked" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── BOOST PROFILE ────────────────────────────────────────────────────────
router.post("/boost", authenticateToken, async (req, res) => {
    try {
        const { durationHours = 1 } = req.body;
        const result = await boostProfile(req.user.userId, durationHours);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get("/boost-status", authenticateToken, async (req, res) => {
    try {
        const status = await getBoostStatus(req.user.userId);
        res.json({ success: true, ...status });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── INCOGNITO MODE ──────────────────────────────────────────────────────
router.post("/incognito", authenticateToken, async (req, res) => {
    try {
        const { enabled } = req.body;
        const result = await toggleIncognitoMode(req.user.userId, enabled);
        res.json({ success: true, isEnabled: result.isEnabled, message: enabled ? "Incognito mode enabled" : "Incognito mode disabled" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get("/incognito-status", authenticateToken, async (req, res) => {
    try {
        const status = await getIncognitoStatus(req.user.userId);
        res.json({ success: true, ...status });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── FAKE PROFILE DETECTION ──────────────────────────────────────────────
router.get("/fake-profile-analysis/:userId", authenticateToken, async (req, res) => {
    try {
        const analysis = await analyzeFakeProfile(req.params.userId);
        res.json({ success: true, ...analysis });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── STORIES ──────────────────────────────────────────────────────────────
router.post("/stories", authenticateToken, async (req, res) => {
    try {
        const { mediaUrl, mediaType, caption, backgroundColor, textColor } = req.body;
        if (!mediaUrl) return res.status(400).json({ success: false, message: "mediaUrl is required" });

        const story = new Story({
            userId: req.user.userId,
            mediaUrl,
            mediaType: mediaType || "image",
            caption,
            backgroundColor,
            textColor,
        });
        await story.save();

        // Notify followers about new story
        if (global.io) {
            global.io.emit("new_story", {
                userId: req.user.userId,
                storyId: story._id,
            });
        }

        res.status(201).json({ success: true, story });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get("/stories", authenticateToken, async (req, res) => {
    try {
        const stories = await Story.find({
            isActive: true,
            expiresAt: { $gt: new Date() },
        })
            .sort({ createdAt: -1 })
            .populate("userId", "firstName lastName profilePicture")
            .lean();

        // Group stories by user
        const grouped = {};
        for (const story of stories) {
            const uid = story.userId._id.toString();
            if (!grouped[uid]) {
                grouped[uid] = {
                    user: story.userId,
                    stories: [],
                };
            }
            grouped[uid].stories.push(story);
        }

        res.json({ success: true, stories: Object.values(grouped) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get("/stories/my", authenticateToken, async (req, res) => {
    try {
        const stories = await Story.find({
            userId: req.user.userId,
            isActive: true,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 }).lean();

        res.json({ success: true, stories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/stories/:storyId/view", authenticateToken, async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ success: false, message: "Story not found" });

        // Add viewer if not already viewed
        const alreadyViewed = story.viewers.some(
            v => v.userId.toString() === req.user.userId
        );
        if (!alreadyViewed) {
            story.viewers.push({ userId: req.user.userId });
            await story.save();
        }

        res.json({ success: true, message: "Story viewed" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete("/stories/:storyId", authenticateToken, async (req, res) => {
    try {
        const story = await Story.findOneAndDelete({
            _id: req.params.storyId,
            userId: req.user.userId,
        });
        if (!story) return res.status(404).json({ success: false, message: "Story not found" });

        res.json({ success: true, message: "Story deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── VOICE INTRODUCTION ──────────────────────────────────────────────────
router.post("/voice-introduction", authenticateToken, async (req, res) => {
    try {
        const { audioUrl, duration, transcription } = req.body;
        if (!audioUrl) return res.status(400).json({ success: false, message: "audioUrl is required" });

        const voice = await VoiceIntroduction.findOneAndUpdate(
            { userId: req.user.userId },
            { audioUrl, duration, transcription, isActive: true },
            { upsert: true, new: true }
        );

        res.json({ success: true, voice });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get("/voice-introduction", authenticateToken, async (req, res) => {
    try {
        const voice = await VoiceIntroduction.findOne({ userId: req.user.userId, isActive: true }).lean();
        res.json({ success: true, voice });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get("/voice-introduction/:userId", authenticateToken, async (req, res) => {
    try {
        const voice = await VoiceIntroduction.findOne({ userId: req.params.userId, isActive: true }).lean();
        res.json({ success: true, voice });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete("/voice-introduction", authenticateToken, async (req, res) => {
    try {
        await VoiceIntroduction.findOneAndUpdate(
            { userId: req.user.userId },
            { isActive: false }
        );
        res.json({ success: true, message: "Voice introduction removed" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── UPDATE HEIGHT ────────────────────────────────────────────────────────
router.put("/height", authenticateToken, async (req, res) => {
    try {
        const { height } = req.body;
        if (!height || height < 50 || height > 300) {
            return res.status(400).json({ success: false, message: "Invalid height (50-300 cm)" });
        }

        await User.findByIdAndUpdate(req.user.userId, { height });
        res.json({ success: true, message: "Height updated", height });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;