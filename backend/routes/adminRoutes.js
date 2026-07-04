import express from "express";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Report } from "../models/Report.js";
import { AdminLog } from "../models/AdminLog.js";
import { Announcement } from "../models/Announcement.js";
import { Payment } from "../models/Payment.js";
import { authenticateToken } from "../middleware/auth.js";
import { loadUser, authorize } from "../middleware/rbac.js";

const router = express.Router();

// All admin routes require authentication + user load + admin role
router.use(authenticateToken, loadUser);

// ────────────────────────────────────────────────────────────────────────
// SUPER ADMIN INITIALIZATION — runs on first startup
// Reads SUPER_ADMIN_EMAIL from env, and if no super_admin exists, promotes
// ────────────────────────────────────────────────────────────────────────
const initializeSuperAdmin = async () => {
    try {
        const superEmail = process.env.SUPER_ADMIN_EMAIL;
        if (!superEmail) {
            console.warn("[Admin] SUPER_ADMIN_EMAIL not set in environment. No super_admin promoted.");
            return;
        }

        const existingSuper = await User.findOne({ role: "super_admin" });
        if (existingSuper) {
            console.log(`[Admin] Super admin already exists: ${existingSuper.email}`);
            return;
        }

        const user = await User.findOne({ email: superEmail.toLowerCase().trim() });
        if (!user) {
            console.warn(`[Admin] No user found with email ${superEmail}. Create an account first, then set SUPER_ADMIN_EMAIL.`);
            return;
        }

        user.role = "super_admin";
        user.isAdmin = true;
        await user.save();
        console.log(`[Admin] ✅ Promoted ${superEmail} to super_admin`);
    } catch (err) {
        console.error("[Admin] Failed to initialize super admin:", err.message);
    }
};

// Run on import
initializeSuperAdmin();

// ── Helper: log admin actions ───────────────────────────────────────────
const logAction = async (adminId, action, targetType = "other", targetId = null, details = {}, req = null) => {
    try {
        const log = new AdminLog({
            admin: adminId,
            action,
            targetType,
            targetId,
            details,
            ipAddress: req?.ip || req?.headers?.["x-forwarded-for"] || null,
            userAgent: req?.headers?.["user-agent"] || null,
        });
        await log.save();
    } catch (err) {
        console.error("[AdminLog] Failed to log action:", err.message);
    }
};

// ============================================================================
// DASHBOARD STATISTICS
// ============================================================================
router.get("/dashboard", authorize("moderator", "admin", "super_admin"), async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            totalMembers,
            newUsersToday,
            activeUsers30d,
            bannedUsers,
            premiumUsers,
            pendingReports,
            totalMatches,
            totalMessages,
            onlineUsersCount,
        ] = await Promise.all([
            User.countDocuments({ deletedAt: { $exists: false } }),
            User.countDocuments({ isMember: true, deletedAt: { $exists: false } }),
            User.countDocuments({ createdAt: { $gte: todayStart }, deletedAt: { $exists: false } }),
            User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo }, deletedAt: { $exists: false } }),
            User.countDocuments({ isBanned: true }),
            User.countDocuments({ isPremium: true }),
            Report.countDocuments({ status: "pending" }),
            mongoose.model("Match")?.countDocuments?.() || 0,
            mongoose.model("Message")?.countDocuments?.() || 0,
            global.onlineUsers?.size || 0,
        ]);

        // Revenue stats (last 30 days)
        let revenue30d = 0;
        let totalRevenue = 0;
        try {
            const payments = await Payment.find({
                status: "completed",
                createdAt: { $gte: thirtyDaysAgo },
            });
            revenue30d = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

            const allPayments = await Payment.find({ status: "completed" });
            totalRevenue = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        } catch (e) {
            // Payment model might not exist yet
        }

        await logAction(req.user.userId, "view_dashboard", "system", null, {}, req);

        return res.json({
            success: true,
            stats: {
                totalUsers,
                totalMembers,
                newUsersToday,
                activeUsers30d,
                bannedUsers,
                premiumUsers,
                pendingReports,
                totalMatches,
                totalMessages,
                onlineUsers: onlineUsersCount,
                revenue30d,
                totalRevenue,
            },
        });
    } catch (err) {
        console.error("[Admin Dashboard]", err);
        return res.status(500).json({ success: false, message: "Failed to fetch dashboard stats." });
    }
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

// GET /admin/users — list all users with search & pagination
router.get("/users", authorize("moderator", "admin", "super_admin"), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = "",
            role,
            status,
            sort = "-createdAt",
        } = req.query;

        const query = { deletedAt: { $exists: false } };

        // Search by name, email, or username
        if (search) {
            const searchRegex = new RegExp(search, "i");
            query.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { email: searchRegex },
                { username: searchRegex },
            ];
        }

        if (role) query.role = role;
        if (status === "banned") query.isBanned = true;
        if (status === "active") query.isBanned = false;
        if (status === "premium") query.isPremium = true;
        if (status === "suspended") query.suspendedAt = { $exists: true };

        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select("-password -refreshTokens -verificationToken -verificationTokenExpires -passwordResetToken -passwordResetExpires")
            .sort(sort)
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        return res.json({
            success: true,
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (err) {
        console.error("[Admin Users]", err);
        return res.status(500).json({ success: false, message: "Failed to fetch users." });
    }
});

// GET /admin/users/:id — get single user details
router.get("/users/:id", authorize("moderator", "admin", "super_admin"), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }

        const user = await User.findById(req.params.id)
            .select("-password -refreshTokens -verificationToken -verificationTokenExpires -passwordResetToken -passwordResetExpires");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Get report count for this user
        const reportCount = await Report.countDocuments({ reportedUser: req.params.id });

        return res.json({
            success: true,
            user: { ...user.toObject(), reportCount },
        });
    } catch (err) {
        console.error("[Admin User Detail]", err);
        return res.status(500).json({ success: false, message: "Failed to fetch user." });
    }
});

// PATCH /admin/users/:id/role — change user role (super_admin only)
router.patch("/users/:id/role", authorize("super_admin"), async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ["user", "moderator", "admin", "super_admin"];

        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: "Invalid role." });
        }

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }

        const targetUser = await User.findById(req.params.id);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Cannot demote yourself from super_admin
        if (req.params.id === req.user.userId && role !== "super_admin") {
            return res.status(400).json({ success: false, message: "You cannot demote yourself." });
        }

        const oldRole = targetUser.role;
        targetUser.role = role;
        targetUser.isAdmin = ["admin", "super_admin"].includes(role);
        await targetUser.save();

        await logAction(
            req.user.userId,
            "change_user_role",
            "user",
            targetUser._id,
            { oldRole, newRole: role, targetEmail: targetUser.email },
            req
        );

        return res.json({
            success: true,
            message: `User role updated to ${role}.`,
            user: {
                _id: targetUser._id,
                email: targetUser.email,
                role: targetUser.role,
                isAdmin: targetUser.isAdmin,
            },
        });
    } catch (err) {
        console.error("[Admin Change Role]", err);
        return res.status(500).json({ success: false, message: "Failed to update role." });
    }
});

// POST /admin/users/:id/suspend — suspend a user (admin+)
router.post("/users/:id/suspend", authorize("admin", "super_admin"), async (req, res) => {
    try {
        const { reason, durationHours = 24 } = req.body;

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Cannot suspend super_admin or higher role
        if (user.role === "super_admin") {
            return res.status(403).json({ success: false, message: "Cannot suspend a super admin." });
        }

        user.suspendedAt = new Date();
        user.suspendedBy = req.user.userId;
        user.suspensionReason = reason || "No reason provided.";
        user.suspensionEnds = new Date(Date.now() + durationHours * 60 * 60 * 1000);
        await user.save();

        await logAction(
            req.user.userId,
            "suspend_user",
            "user",
            user._id,
            { reason, durationHours, targetEmail: user.email },
            req
        );

        return res.json({
            success: true,
            message: `User suspended for ${durationHours} hours.`,
        });
    } catch (err) {
        console.error("[Admin Suspend]", err);
        return res.status(500).json({ success: false, message: "Failed to suspend user." });
    }
});

// POST /admin/users/:id/unsuspend — unsuspend a user
router.post("/users/:id/unsuspend", authorize("admin", "super_admin"), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        user.suspendedAt = undefined;
        user.suspendedBy = undefined;
        user.suspensionReason = undefined;
        user.suspensionEnds = undefined;
        await user.save();

        await logAction(req.user.userId, "unsuspend_user", "user", user._id, { targetEmail: user.email }, req);

        return res.json({ success: true, message: "User unsuspended." });
    } catch (err) {
        console.error("[Admin Unsuspend]", err);
        return res.status(500).json({ success: false, message: "Failed to unsuspend user." });
    }
});

// POST /admin/users/:id/ban — ban a user (admin+)
router.post("/users/:id/ban", authorize("admin", "super_admin"), async (req, res) => {
    try {
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (user.role === "super_admin") {
            return res.status(403).json({ success: false, message: "Cannot ban a super admin." });
        }

        user.isBanned = true;
        user.bannedAt = new Date();
        user.bannedBy = req.user.userId;
        user.banReason = reason || "No reason provided.";
        await user.save();

        await logAction(
            req.user.userId,
            "ban_user",
            "user",
            user._id,
            { reason, targetEmail: user.email },
            req
        );

        return res.json({ success: true, message: "User banned." });
    } catch (err) {
        console.error("[Admin Ban]", err);
        return res.status(500).json({ success: false, message: "Failed to ban user." });
    }
});

// POST /admin/users/:id/unban — unban a user
router.post("/users/:id/unban", authorize("admin", "super_admin"), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        user.isBanned = false;
        user.bannedAt = undefined;
        user.bannedBy = undefined;
        user.banReason = undefined;
        await user.save();

        await logAction(req.user.userId, "unban_user", "user", user._id, { targetEmail: user.email }, req);

        return res.json({ success: true, message: "User unbanned." });
    } catch (err) {
        console.error("[Admin Unban]", err);
        return res.status(500).json({ success: false, message: "Failed to unban user." });
    }
});

// DELETE /admin/users/:id — delete (soft-delete) a user account (admin+)
router.delete("/users/:id", authorize("admin", "super_admin"), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (user.role === "super_admin" && req.params.id !== req.user.userId) {
            return res.status(403).json({ success: false, message: "Cannot delete another super admin." });
        }

        // Soft delete
        user.deletedAt = new Date();
        user.deletedBy = req.user.userId;
        user.isActive = false;
        await user.save();

        await logAction(
            req.user.userId,
            "delete_user",
            "user",
            user._id,
            { targetEmail: user.email },
            req
        );

        return res.json({ success: true, message: "User account deleted." });
    } catch (err) {
        console.error("[Admin Delete User]", err);
        return res.status(500).json({ success: false, message: "Failed to delete user." });
    }
});

// ============================================================================
// REPORT MANAGEMENT
// ============================================================================

// GET /admin/reports — list all reports
router.get("/reports", authorize("moderator", "admin", "super_admin"), async (req, res) => {
    try {
        const { page = 1, limit = 20, status = "pending", sort = "-createdAt" } = req.query;

        const query = {};
        if (status && status !== "all") query.status = status;

        const total = await Report.countDocuments(query);
        const reports = await Report.find(query)
            .populate("reporter", "firstName lastName email username profilePicture")
            .populate("reportedUser", "firstName lastName email username profilePicture")
            .populate("reviewedBy", "firstName lastName email")
            .sort(sort)
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        return res.json({
            success: true,
            reports,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (err) {
        console.error("[Admin Reports]", err);
        return res.status(500).json({ success: false, message: "Failed to fetch reports." });
    }
});

// PATCH /admin/reports/:id — review/dismiss/take action on a report
router.patch("/reports/:id", authorize("moderator", "admin", "super_admin"), async (req, res) => {
    try {
        const { status, actionTaken, adminNotes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid report ID." });
        }

        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ success: false, message: "Report not found." });
        }

        report.status = status || report.status;
        report.reviewedBy = req.user.userId;
        report.reviewedAt = new Date();
        if (actionTaken) report.actionTaken = actionTaken;
        if (adminNotes !== undefined) report.adminNotes = adminNotes;
        await report.save();

        // If action is ban, ban the reported user
        if (actionTaken === "ban") {
            const reportedUser = await User.findById(report.reportedUser);
            if (reportedUser && reportedUser.role !== "super_admin") {
                reportedUser.isBanned = true;
                reportedUser.bannedAt = new Date();
                reportedUser.bannedBy = req.user.userId;
                reportedUser.banReason = adminNotes || "Violated community guidelines.";
                await reportedUser.save();
            }
        }

        await logAction(
            req.user.userId,
            "review_report",
            "report",
            report._id,
            { status, actionTaken, reportedUserId: report.reportedUser.toString() },
            req
        );

        return res.json({ success: true, message: "Report updated.", report });
    } catch (err) {
        console.error("[Admin Report Review]", err);
        return res.status(500).json({ success: false, message: "Failed to update report." });
    }
});

// ============================================================================
// ANNOUNCEMENTS
// ============================================================================

// POST /admin/announcements — create & send announcement
router.post("/announcements", authorize("admin", "super_admin"), async (req, res) => {
    try {
        const { title, content, type = "info", audience = "all", targetUsers = [], status = "sent" } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, message: "Title and content are required." });
        }

        const announcement = new Announcement({
            title,
            content,
            type,
            audience,
            targetUsers: audience === "specific_users" ? targetUsers : [],
            sentBy: req.user.userId,
            sentAt: status === "sent" ? new Date() : null,
            status,
        });
        await announcement.save();

        await logAction(
            req.user.userId,
            "create_announcement",
            "announcement",
            announcement._id,
            { title, audience, status },
            req
        );

        return res.status(201).json({ success: true, message: "Announcement created.", announcement });
    } catch (err) {
        console.error("[Admin Announcement]", err);
        return res.status(500).json({ success: false, message: "Failed to create announcement." });
    }
});

// GET /admin/announcements — list announcements
router.get("/announcements", authorize("moderator", "admin", "super_admin"), async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const query = {};
        if (status) query.status = status;

        const total = await Announcement.countDocuments(query);
        const announcements = await Announcement.find(query)
            .populate("sentBy", "firstName lastName email")
            .sort("-createdAt")
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        return res.json({ success: true, announcements, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
        console.error("[Admin Announcements List]", err);
        return res.status(500).json({ success: false, message: "Failed to fetch announcements." });
    }
});

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

// GET /admin/subscriptions — list all premium subscriptions
router.get("/subscriptions", authorize("admin", "super_admin"), async (req, res) => {
    try {
        const { page = 1, limit = 20, tier, sort = "-createdAt" } = req.query;

        const query = { isPremium: true, deletedAt: { $exists: false } };
        if (tier) query.premiumTier = tier;

        const total = await User.countDocuments(query);
        const subscriptions = await User.find(query)
            .select("firstName lastName email username premiumTier premiumExpires isPremium createdAt stripeCustomerId")
            .sort(sort)
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        return res.json({
            success: true,
            subscriptions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (err) {
        console.error("[Admin Subscriptions]", err);
        return res.status(500).json({ success: false, message: "Failed to fetch subscriptions." });
    }
});

// POST /admin/users/:id/grant-premium — manually grant premium to a user
router.post("/users/:id/grant-premium", authorize("admin", "super_admin"), async (req, res) => {
    try {
        const { tier = "gold", durationDays = 30 } = req.body;
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        user.isPremium = true;
        user.premiumTier = tier;
        user.premiumExpires = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        await user.save();

        await logAction(req.user.userId, "grant_premium", "user", user._id, { tier, durationDays, targetEmail: user.email }, req);
        return res.json({ success: true, message: `Premium ${tier} granted for ${durationDays} days.` });
    } catch (err) {
        console.error("[Admin Grant Premium]", err);
        return res.status(500).json({ success: false, message: "Failed to grant premium." });
    }
});

// POST /admin/users/:id/revoke-premium — remove premium from a user
router.post("/users/:id/revoke-premium", authorize("admin", "super_admin"), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        user.isPremium = false;
        user.premiumTier = "basic";
        user.premiumExpires = undefined;
        await user.save();

        await logAction(req.user.userId, "revoke_premium", "user", user._id, { targetEmail: user.email }, req);
        return res.json({ success: true, message: "Premium revoked." });
    } catch (err) {
        console.error("[Admin Revoke Premium]", err);
        return res.status(500).json({ success: false, message: "Failed to revoke premium." });
    }
});

// POST /admin/users/:id/force-logout — invalidate all sessions for a user
router.post("/users/:id/force-logout", authorize("admin", "super_admin"), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        // Clear all refresh tokens — all sessions become invalid
        user.refreshTokens = [];
        await user.save();

        await logAction(req.user.userId, "force_logout", "user", user._id, { targetEmail: user.email }, req);
        return res.json({ success: true, message: "User has been logged out from all devices." });
    } catch (err) {
        console.error("[Admin Force Logout]", err);
        return res.status(500).json({ success: false, message: "Failed to force logout." });
    }
});

// POST /admin/users/:id/verify — manually verify a user's email
router.post("/users/:id/verify", authorize("admin", "super_admin"), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        user.emailVerified = true;
        if (!user.isMember) {
            user.isMember = true;
            user.memberSince = user.memberSince || new Date();
            user.isActive = true;
            user.onboardingComplete = true;
        }
        await user.save();

        await logAction(req.user.userId, "manual_verify", "user", user._id, { targetEmail: user.email }, req);
        return res.json({ success: true, message: "User email verified manually." });
    } catch (err) {
        console.error("[Admin Manual Verify]", err);
        return res.status(500).json({ success: false, message: "Failed to verify user." });
    }
});

// POST /admin/users/:id/reset-password — send a password reset email to user
router.post("/users/:id/reset-password", authorize("admin", "super_admin"), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        const crypto = await import("crypto");
        const resetToken = crypto.randomBytes(32).toString("hex");
        user.passwordResetToken = resetToken;
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();

        // Send the reset email
        const { sendPasswordResetEmail } = await import("../services/emailService.js");
        await sendPasswordResetEmail(user.email, resetToken).catch(err =>
            console.error("[Admin Reset Password] Email error:", err.message)
        );

        await logAction(req.user.userId, "send_password_reset", "user", user._id, { targetEmail: user.email }, req);
        return res.json({ success: true, message: "Password reset email sent." });
    } catch (err) {
        console.error("[Admin Reset Password]", err);
        return res.status(500).json({ success: false, message: "Failed to send reset email." });
    }
});

// PATCH /admin/users/:id — edit user information
router.patch("/users/:id", authorize("admin", "super_admin"), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        // Fields admins are allowed to edit
        const allowed = [
            "firstName", "lastName", "phone", "city", "country", "state",
            "occupation", "aboutMe", "religion", "relationshipGoal",
            "isActive", "profileCompletion",
        ];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        Object.assign(user, updates);
        await user.save();

        await logAction(req.user.userId, "edit_user", "user", user._id, { fields: Object.keys(updates), targetEmail: user.email }, req);
        return res.json({ success: true, message: "User updated.", user });
    } catch (err) {
        console.error("[Admin Edit User]", err);
        return res.status(500).json({ success: false, message: "Failed to update user." });
    }
});

// ============================================================================
// ACTIVITY LOGS
// ============================================================================

// GET /admin/logs — system activity logs
router.get("/logs", authorize("admin", "super_admin"), async (req, res) => {
    try {
        const { page = 1, limit = 50, action, targetType, adminId } = req.query;

        const query = {};
        if (action) query.action = action;
        if (targetType) query.targetType = targetType;
        if (adminId) query.admin = adminId;

        const total = await AdminLog.countDocuments(query);
        const logs = await AdminLog.find(query)
            .populate("admin", "firstName lastName email username")
            .sort("-createdAt")
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        return res.json({
            success: true,
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (err) {
        console.error("[Admin Logs]", err);
        return res.status(500).json({ success: false, message: "Failed to fetch logs." });
    }
});

// ============================================================================
// CONTENT MODERATION
// ============================================================================

// GET /admin/flagged-content — list flagged users (high report count)
router.get("/flagged-content", authorize("moderator", "admin", "super_admin"), async (req, res) => {
    try {
        const { page = 1, limit = 20, minReports = 3 } = req.query;

        const query = {
            $or: [
                { reportCount: { $gte: parseInt(minReports) } },
                { flaggedForReview: true },
            ],
            deletedAt: { $exists: false },
        };

        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select("firstName lastName email username profilePicture reportCount flaggedForReview isBanned isActive createdAt")
            .sort("-reportCount")
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        return res.json({
            success: true,
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (err) {
        console.error("[Admin Flagged Content]", err);
        return res.status(500).json({ success: false, message: "Failed to fetch flagged content." });
    }
});

// PATCH /admin/flagged-content/:id — clear flag or mark as reviewed
router.patch("/flagged-content/:id", authorize("moderator", "admin", "super_admin"), async (req, res) => {
    try {
        const { flaggedForReview, clearReports } = req.body;

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (flaggedForReview !== undefined) user.flaggedForReview = flaggedForReview;
        if (clearReports) {
            user.reportCount = 0;
            user.flaggedForReview = false;
        }
        await user.save();

        await logAction(
            req.user.userId,
            "moderate_content",
            "user",
            user._id,
            { flaggedForReview, clearReports, targetEmail: user.email },
            req
        );

        return res.json({ success: true, message: "Content moderation updated." });
    } catch (err) {
        console.error("[Admin Moderate Content]", err);
        return res.status(500).json({ success: false, message: "Failed to update moderation." });
    }
});

// ============================================================================
// ANALYTICS
// ============================================================================

// GET /admin/analytics — detailed analytics data
router.get("/analytics", authorize("admin", "super_admin"), async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // User growth over last 30 days (by day)
        const userGrowth = await User.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo }, deletedAt: { $exists: false } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);

        // Registrations by role
        const usersByRole = await User.aggregate([
            { $match: { deletedAt: { $exists: false } } },
            { $group: { _id: "$role", count: { $sum: 1 } } },
        ]);

        // Users by country (top 10)
        const usersByCountry = await User.aggregate([
            { $match: { country: { $ne: null, $ne: "" }, deletedAt: { $exists: false } } },
            { $group: { _id: "$country", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        // Gender distribution
        const usersByGender = await User.aggregate([
            { $match: { gender: { $ne: null }, deletedAt: { $exists: false } } },
            { $group: { _id: "$gender", count: { $sum: 1 } } },
        ]);

        // Report trends
        const reportsByDay = await Report.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);

        return res.json({
            success: true,
            analytics: {
                userGrowth,
                usersByRole,
                usersByCountry,
                usersByGender,
                reportsByDay,
            },
        });
    } catch (err) {
        console.error("[Admin Analytics]", err);
        return res.status(500).json({ success: false, message: "Failed to fetch analytics." });
    }
});

export default router;