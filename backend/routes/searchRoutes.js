import express from "express";
import mongoose from "mongoose";
import { authenticateToken } from "../middleware/auth.js";
import { User } from "../models/User.js";

const router = express.Router();

const dbOk = () => mongoose.connection.readyState === 1;

// ─── GET /search ───────────────────────────────────────────────────────────────
router.get("/", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const {
            q, // search query
            page = 1,
            limit = 20,
        } = req.query;

        if (!q || String(q).trim().length < 2) {
            return res.status(400).json({ success: false, message: "Search query must be at least 2 characters" });
        }

        const query = String(q).trim();
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

        // Search across multiple fields
        const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

        const filter = {
            _id: { $ne: req.user.userId },
            isActive: true,
            isBanned: false,
            emailVerified: true,
            isMember: true,
            $or: [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { username: searchRegex },
                { occupation: searchRegex },
                { education: searchRegex },
                { interests: searchRegex },
                { city: searchRegex },
                { country: searchRegex },
                { aboutMe: searchRegex },
            ],
        };

        const [users, total] = await Promise.all([
            User.find(filter)
                .select("firstName lastName username profilePicture age city country occupation education interests aboutMe isPremium isVerified lastLogin")
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .sort({ lastLogin: -1 })
                .lean(),
            User.countDocuments(filter),
        ]);

        res.json({
            success: true,
            users,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    } catch (err) {
        console.error("[Search]", err);
        res.status(500).json({ success: false, message: "Search failed" });
    }
});

export default router;