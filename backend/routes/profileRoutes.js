import express from "express";
import { User } from "../models/User.js";
import { authenticateToken } from "../middleware/auth.js";
import { computeProfileCompletion } from "../services/onboardingService.js";
import { notifySuggestionsChanged } from "../services/suggestionService.js";

const router = express.Router();

const PUBLIC_FIELDS = "-password -verificationToken -verificationTokenExpires -refreshTokens -passwordResetToken -passwordResetExpires";

// ── GET /  (Members directory — MUST come before /:userId) ───────────────────
router.get("/", async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            gender,
            minAge,
            maxAge,
            country,
            interests,
            lookingFor,
            relationshipGoal,
        } = req.query;

        // Only show fully onboarded, active, non-banned, verified members
        const query = {
            isMember: true,
            isActive: true,
            isBanned: false,
            emailVerified: true,
            "privacySettings.profileVisible": { $ne: false },
        };

        if (gender) query.gender = gender;
        if (lookingFor) query.lookingFor = lookingFor;
        if (country) query.country = country;
        if (relationshipGoal) query.relationshipGoal = relationshipGoal;

        if (minAge || maxAge) {
            query.age = {};
            if (minAge) query.age.$gte = parseInt(minAge);
            if (maxAge) query.age.$lte = parseInt(maxAge);
        }

        if (interests) {
            const list = Array.isArray(interests) ? interests : interests.split(",");
            query.interests = { $in: list };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await User.countDocuments(query);
        const users = await User
            .find(query)
            .select(PUBLIC_FIELDS)
            .sort({ memberSince: -1, profileCompletion: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            success: true,
            users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        console.error("[Members]", error);
        res.status(500).json({ success: false, message: "Failed to fetch members" });
    }
});

// ── GET /:userId ──────────────────────────────────────────────────────────────
router.get("/:userId", async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select(PUBLIC_FIELDS);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.json({ success: true, user });
    } catch (error) {
        console.error("[Profile GET]", error);
        res.status(500).json({ success: false, message: "Failed to fetch profile" });
    }
});

// ── PUT /:userId  (update own profile) ───────────────────────────────────────
router.put("/:userId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        if (req.user.userId !== userId) {
            return res.status(403).json({ success: false, message: "You can only update your own profile" });
        }

        const updates = { ...req.body };

        // Guard: never allow these to be changed via this route
        const forbidden = ["password", "email", "username", "verificationToken",
            "isMember", "emailVerified", "isBanned", "reportCount", "flaggedForReview"];
        forbidden.forEach(k => delete updates[k]);

        // Strip empty strings from enum fields — sending "" fails Mongoose validation.
        // An empty string means "user didn't select anything", so we simply omit it.
        const ENUM_FIELDS = ["gender", "lookingFor", "education", "smoking",
            "drinking", "hasChildren", "wantsChildren", "religionImportance",
            "zodiacSign", "personalityType", "pets", "lifestyle"];
        ENUM_FIELDS.forEach(k => {
            if (updates[k] === "" || updates[k] === null || updates[k] === undefined) {
                delete updates[k];
            }
        });

        // Also strip other empty strings so we don't overwrite existing data with ""
        Object.keys(updates).forEach(k => {
            if (updates[k] === "") delete updates[k];
        });

        if (updates.dateOfBirth) {
            updates.age = new Date().getFullYear() - new Date(updates.dateOfBirth).getFullYear();
        }

        // Recompute profile completion after update
        const mergedUser = await User.findById(userId);
        if (!mergedUser) return res.status(404).json({ success: false, message: "User not found" });

        Object.assign(mergedUser, updates);
        mergedUser.profileCompletion = computeProfileCompletion(mergedUser);
        await mergedUser.save();

        // Return the full user document minus sensitive fields so the frontend
        // can refresh sessionStorage with all profile data intact.
        const PUB = "-password -verificationToken -verificationTokenExpires -passwordResetToken -passwordResetExpires -refreshTokens";
        const updated = await User.findById(userId).select(PUB).lean();

        // Notify all clients that a profile was updated
        try {
            notifySuggestionsChanged();
        } catch (e) { /* silent */ }

        res.json({
            success: true,
            message: "Profile updated",
            user: updated,
        });
    } catch (error) {
        console.error("[Profile PUT]", error);
        res.status(500).json({ success: false, message: "Failed to update profile", detail: error.message });
    }
});

// ── POST /:userId/photo ───────────────────────────────────────────────────────
router.post("/:userId/photo", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        if (req.user.userId !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const { photoUrl } = req.body;
        if (!photoUrl) return res.status(400).json({ success: false, message: "photoUrl is required" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.photos = user.photos || [];
        if (!user.photos.includes(photoUrl)) user.photos.push(photoUrl);
        if (!user.profilePicture) user.profilePicture = photoUrl;

        // Recompute completion (adding a photo may increase score)
        user.profileCompletion = computeProfileCompletion(user);
        await user.save();

        // Notify all clients that a profile photo was uploaded
        try {
            notifySuggestionsChanged();
        } catch (e) { /* silent */ }

        res.json({ success: true, message: "Photo added", photos: user.photos, profilePicture: user.profilePicture });
    } catch (error) {
        console.error("[Photo]", error);
        res.status(500).json({ success: false, message: "Photo upload failed" });
    }
});

// ── POST /:userId/report ──────────────────────────────────────────────────────
router.post("/:userId/report", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const reporterId = req.user.userId;
        const { reason = "unspecified" } = req.body;

        if (reporterId === userId) {
            return res.status(400).json({ success: false, message: "You cannot report yourself" });
        }

        const [reporter, target] = await Promise.all([
            User.findById(reporterId),
            User.findById(userId),
        ]);

        if (!target) return res.status(404).json({ success: false, message: "User not found" });
        if (!reporter) return res.status(404).json({ success: false, message: "Reporter not found" });

        // Prevent duplicate reports from same user
        if (!target.reported.map(String).includes(reporterId)) {
            target.reported.push(reporterId);
            target.reportCount = (target.reportCount || 0) + 1;
        }

        // Auto-flag and deactivate if report threshold reached
        const AUTO_FLAG_THRESHOLD = 3;
        if (target.reportCount >= AUTO_FLAG_THRESHOLD && !target.flaggedForReview) {
            target.flaggedForReview = true;
            target.isActive = false;
            console.warn(`[Report] User ${target._id} auto-flagged — ${target.reportCount} reports. Reason: ${reason}`);
        }

        await target.save();

        res.json({ success: true, message: "Report submitted. Our team will review it." });
    } catch (error) {
        console.error("[Report]", error);
        res.status(500).json({ success: false, message: "Report failed" });
    }
});

// ── PUT /:userId/privacy ──────────────────────────────────────────────────────
router.put("/:userId/privacy", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        if (req.user.userId !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const allowed = ["showOnlineStatus", "showLastSeen", "showLocation",
            "showAge", "profileVisible", "showInSearch", "allowMessageFrom"];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[`privacySettings.${key}`] = req.body[key];
        }

        const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true }).select(PUBLIC_FIELDS);
        res.json({ success: true, message: "Privacy settings updated", privacySettings: user.privacySettings });
    } catch (error) {
        console.error("[Privacy]", error);
        res.status(500).json({ success: false, message: "Failed to update privacy settings" });
    }
});

export default router;
