/**
 * Matching Routes - Phase 8: Daily Matching
 */
import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
    getDailyRecommendations,
    getSuggestedMatches,
    getNearbyUsers,
    getTrendingProfiles,
    getRecentlyJoined,
    getMostActiveUsers,
    getPersonalizedRecommendations,
    getMatchScoreExplanation,
} from "../services/matchingService.js";

const router = express.Router();

// GET /api/matching/recommendations - Daily recommendations
router.get("/recommendations", authenticateToken, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const recommendations = await getDailyRecommendations(req.user.userId, parseInt(limit));
        res.json({ success: true, recommendations });
    } catch (error) {
        console.error("[Matching Recommendations]", error);
        res.status(500).json({ success: false, message: "Failed to get recommendations" });
    }
});

// GET /api/matching/suggested - Suggested matches
router.get("/suggested", authenticateToken, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const suggestions = await getSuggestedMatches(req.user.userId, parseInt(limit));
        res.json({ success: true, suggestions });
    } catch (error) {
        console.error("[Matching Suggested]", error);
        res.status(500).json({ success: false, message: "Failed to get suggestions" });
    }
});

// GET /api/matching/nearby - Nearby users
router.get("/nearby", authenticateToken, async (req, res) => {
    try {
        const { maxDistance = 50, limit = 20 } = req.query;
        const nearby = await getNearbyUsers(req.user.userId, parseInt(maxDistance), parseInt(limit));
        res.json({ success: true, nearby });
    } catch (error) {
        console.error("[Matching Nearby]", error);
        res.status(500).json({ success: false, message: "Failed to get nearby users" });
    }
});

// GET /api/matching/trending - Trending profiles
router.get("/trending", authenticateToken, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const trending = await getTrendingProfiles(req.user.userId, parseInt(limit));
        res.json({ success: true, trending });
    } catch (error) {
        console.error("[Matching Trending]", error);
        res.status(500).json({ success: false, message: "Failed to get trending profiles" });
    }
});

// GET /api/matching/recently-joined - Recently joined users
router.get("/recently-joined", authenticateToken, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const recent = await getRecentlyJoined(req.user.userId, parseInt(limit));
        res.json({ success: true, recent });
    } catch (error) {
        console.error("[Matching Recently Joined]", error);
        res.status(500).json({ success: false, message: "Failed to get recently joined" });
    }
});

// GET /api/matching/most-active - Most active users
router.get("/most-active", authenticateToken, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const active = await getMostActiveUsers(req.user.userId, parseInt(limit));
        res.json({ success: true, active });
    } catch (error) {
        console.error("[Matching Most Active]", error);
        res.status(500).json({ success: false, message: "Failed to get active users" });
    }
});

// GET /api/matching/personalized - Personalized recommendations
router.get("/personalized", authenticateToken, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const personalized = await getPersonalizedRecommendations(req.user.userId, parseInt(limit));
        res.json({ success: true, personalized });
    } catch (error) {
        console.error("[Matching Personalized]", error);
        res.status(500).json({ success: false, message: "Failed to get personalized recommendations" });
    }
});

// GET /api/matching/compatibility/:targetUserId - Match score explanation
router.get("/compatibility/:targetUserId", authenticateToken, async (req, res) => {
    try {
        const { targetUserId } = req.params;
        const result = await getMatchScoreExplanation(req.user.userId, targetUserId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Matching Compatibility]", error);
        res.status(500).json({ success: false, message: "Failed to get compatibility score" });
    }
});

export default router;