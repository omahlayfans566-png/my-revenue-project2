import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Report } from "../models/Report.js";
import {
    checkForFakeProfile,
    checkForDuplicateAccounts,
    REPORT_CATEGORIES,
    SAFETY_TIPS,
} from "../services/safetyService.js";

const router = express.Router();
router.use(authenticateToken);

// GET /safety/categories — get report categories
router.get("/categories", (req, res) => {
    res.json({ success: true, categories: REPORT_CATEGORIES });
});

// GET /safety/tips — get safety tips
router.get("/tips", (req, res) => {
    res.json({ success: true, tips: SAFETY_TIPS });
});

// POST /safety/report — report a user with category
router.post("/report", async (req, res) => {
    try {
        const { reportedUserId, category, description } = req.body;
        if (!reportedUserId || !category) {
            return res.status(400).json({ success: false, message: "Reported user and category are required" });
        }
        if (req.user.userId === reportedUserId) {
            return res.status(400).json({ success: false, message: "You cannot report yourself" });
        }

        const target = await User.findById(reportedUserId);
        if (!target) return res.status(404).json({ success: false, message: "User not found" });

        // Create report
        const report = new Report({
            reporter: req.user.userId,
            reportedUser: reportedUserId,
            category,
            description: description || "",
            status: "pending",
        });
        await report.save();

        // Update user report count
        if (!target.reported.map(r => r.toString()).includes(req.user.userId)) {
            target.reported.push(req.user.userId);
            target.reportCount = (target.reportCount || 0) + 1;
        }

        // Auto-flag if threshold reached
        if (target.reportCount >= 3 && !target.flaggedForReview) {
            target.flaggedForReview = true;
        }
        await target.save();

        res.json({ success: true, message: "Report submitted. Our team will review it." });
    } catch (error) {
        console.error("[Safety Report]", error);
        res.status(500).json({ success: false, message: "Failed to submit report" });
    }
});

// POST /safety/check-fake — check if current user's profile looks fake
router.post("/check-fake", async (req, res) => {
    try {
        const result = await checkForFakeProfile(req.user.userId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Safety Check Fake]", error);
        res.status(500).json({ success: false, message: "Failed to check profile" });
    }
});

// POST /safety/check-duplicates — check for duplicate accounts
router.post("/check-duplicates", async (req, res) => {
    try {
        const result = await checkForDuplicateAccounts(req.user.userId);
        res.json({ success: true, hasDuplicates: result.hasDuplicates, duplicateCount: result.duplicates.length });
    } catch (error) {
        console.error("[Safety Check Duplicates]", error);
        res.status(500).json({ success: false, message: "Failed to check duplicates" });
    }
});

// POST /safety/block/:userId — block a user
router.post("/block/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (!user.blocked.includes(userId)) {
            user.blocked.push(userId);
            await user.save();
        }

        res.json({ success: true, message: "User blocked" });
    } catch (error) {
        console.error("[Safety Block]", error);
        res.status(500).json({ success: false, message: "Failed to block user" });
    }
});

// POST /safety/unblock/:userId — unblock a user
router.post("/unblock/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.blocked = user.blocked.filter(id => id.toString() !== userId);
        await user.save();

        res.json({ success: true, message: "User unblocked" });
    } catch (error) {
        console.error("[Safety Unblock]", error);
        res.status(500).json({ success: false, message: "Failed to unblock user" });
    }
});

// GET /safety/blocked — get blocked users
router.get("/blocked", async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .populate("blocked", "firstName lastName profilePicture username");
        res.json({ success: true, blocked: user?.blocked || [] });
    } catch (error) {
        console.error("[Safety Blocked]", error);
        res.status(500).json({ success: false, message: "Failed to fetch blocked users" });
    }
});

export default router;