import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
    generateReferralCode,
    getReferralCode,
    getReferralAnalytics,
    createReferral,
    getGlobalReferralStats,
} from "../services/referralService.js";

const router = express.Router();

router.use(authenticateToken);

// GET /referrals/code — get user's referral code
router.get("/code", async (req, res) => {
    try {
        const code = await getReferralCode(req.user.userId);
        res.json({ success: true, code: code.code });
    } catch (error) {
        console.error("[Referral Code]", error);
        res.status(500).json({ success: false, message: "Failed to get referral code" });
    }
});

// POST /referrals/code/generate — regenerate referral code
router.post("/code/generate", async (req, res) => {
    try {
        const code = await generateReferralCode(req.user.userId);
        res.json({ success: true, code: code.code });
    } catch (error) {
        console.error("[Referral Generate]", error);
        res.status(500).json({ success: false, message: "Failed to generate code" });
    }
});

// POST /referrals/use — use a referral code (when registering)
router.post("/use", async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ success: false, message: "Referral code is required" });
        }
        const result = await createReferral(code, {
            userId: req.user.userId,
            email: req.user.email,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });
        res.json({ success: true, message: "Referral recorded" });
    } catch (error) {
        console.error("[Referral Use]", error);
        res.status(400).json({ success: false, message: error.message || "Failed to use referral code" });
    }
});

// GET /referrals/analytics — get user's referral analytics
router.get("/analytics", async (req, res) => {
    try {
        const analytics = await getReferralAnalytics(req.user.userId);
        res.json({ success: true, analytics });
    } catch (error) {
        console.error("[Referral Analytics]", error);
        res.status(500).json({ success: false, message: "Failed to get analytics" });
    }
});

// GET /referrals/global-stats — global referral stats (admin)
router.get("/global-stats", async (req, res) => {
    try {
        const stats = await getGlobalReferralStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error("[Referral Global Stats]", error);
        res.status(500).json({ success: false, message: "Failed to get global stats" });
    }
});

export default router;