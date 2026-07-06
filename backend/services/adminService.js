/**
 * Admin Service — Business logic for admin operations
 * Separated from routes for cleaner code and reusability
 */
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Report } from "../models/Report.js";
import { AdminLog } from "../models/AdminLog.js";
import { Message } from "../models/Message.js";
import { Payment } from "../models/Payment.js";
import { Subscription } from "../models/Subscription.js";
import { Notification } from "../models/Notification.js";
import { Announcement } from "../models/Announcement.js";
import { createNotification } from "./notificationService.js";

// ─── Logging helper ────────────────────────────────────────────────────────────
export const logAction = async (adminId, action, targetType = "other", targetId = null, details = {}, req = null) => {
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

// ─── Dashboard Statistics ──────────────────────────────────────────────────────
export const getDashboardStats = async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
        totalUsers, totalMembers, newUsersToday, newUsersWeek, newUsersMonth,
        activeUsers7d, activeUsers30d, bannedUsers, suspendedUsers,
        premiumUsers, pendingReports, totalMatches, totalMessages,
        onlineUsersCount, deletedUsers,
    ] = await Promise.all([
        User.countDocuments({ deletedAt: { $exists: false } }),
        User.countDocuments({ isMember: true, deletedAt: { $exists: false } }),
        User.countDocuments({ createdAt: { $gte: todayStart }, deletedAt: { $exists: false } }),
        User.countDocuments({ createdAt: { $gte: startOfWeek }, deletedAt: { $exists: false } }),
        User.countDocuments({ createdAt: { $gte: startOfMonth }, deletedAt: { $exists: false } }),
        User.countDocuments({ lastLogin: { $gte: sevenDaysAgo }, deletedAt: { $exists: false } }),
        User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo }, deletedAt: { $exists: false } }),
        User.countDocuments({ isBanned: true }),
        User.countDocuments({ suspendedAt: { $exists: true }, deletedAt: { $exists: false } }),
        User.countDocuments({ isPremium: true }),
        Report.countDocuments({ status: "pending" }),
        mongoose?.model("Match")?.countDocuments?.() || 0,
        mongoose?.model("Message")?.countDocuments?.() || 0,
        global.onlineUsers?.size || 0,
        User.countDocuments({ deletedAt: { $exists: true } }),
    ]);

    // Revenue stats
    let revenueToday = 0, revenueWeek = 0, revenueMonth = 0, revenue30d = 0, totalRevenue = 0;
    try {
        const [todayPayments, weekPayments, monthPayments, thirtyPayments, allPayments] = await Promise.all([
            Payment.find({ status: "completed", createdAt: { $gte: todayStart } }),
            Payment.find({ status: "completed", createdAt: { $gte: startOfWeek } }),
            Payment.find({ status: "completed", createdAt: { $gte: startOfMonth } }),
            Payment.find({ status: "completed", createdAt: { $gte: thirtyDaysAgo } }),
            Payment.find({ status: "completed" }),
        ]);
        revenueToday = todayPayments.reduce((s, p) => s + (p.amount || 0), 0);
        revenueWeek = weekPayments.reduce((s, p) => s + (p.amount || 0), 0);
        revenueMonth = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
        revenue30d = thirtyPayments.reduce((s, p) => s + (p.amount || 0), 0);
        totalRevenue = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
    } catch (e) { /* Payment model might not exist */ }

    return {
        totalUsers, totalMembers, newUsersToday, newUsersWeek, newUsersMonth,
        activeUsers7d, activeUsers30d, bannedUsers, suspendedUsers,
        premiumUsers, pendingReports, totalMatches, totalMessages,
        onlineUsers: onlineUsersCount, deletedUsers,
        revenueToday, revenueWeek, revenueMonth, revenue30d, totalRevenue,
    };
};

// ─── User Analytics (daily/weekly/monthly) ─────────────────────────────────────
export const getUserAnalytics = async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Daily registrations (last 90 days)
    const dailyRegistrations = await User.aggregate([
        { $match: { createdAt: { $gte: ninetyDaysAgo }, deletedAt: { $exists: false } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    // Weekly registrations
    const weeklyRegistrations = await User.aggregate([
        { $match: { createdAt: { $gte: ninetyDaysAgo }, deletedAt: { $exists: false } } },
        { $group: { _id: { isoWeek: { $isoWeek: "$createdAt" }, year: { $isoWeekYear: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.isoWeek": 1 } },
    ]);

    // Monthly registrations
    const monthlyRegistrations = await User.aggregate([
        { $match: { createdAt: { $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) }, deletedAt: { $exists: false } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    // Daily active users (last 30 days)
    const dailyActive = await User.aggregate([
        { $match: { lastLogin: { $gte: thirtyDaysAgo }, deletedAt: { $exists: false } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$lastLogin" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    // Users by role
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

    // Premium vs free
    const premiumCount = await User.countDocuments({ isPremium: true, deletedAt: { $exists: false } });
    const freeCount = await User.countDocuments({ isPremium: { $ne: true }, deletedAt: { $exists: false } });

    // Report trends (last 30 days)
    const reportsByDay = await Report.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    // Message stats
    const totalMessagesSent = await Message.countDocuments({ isDeleted: false });
    const messagesToday = await Message.countDocuments({ createdAt: { $gte: todayStart }, isDeleted: false });

    return {
        dailyRegistrations, weeklyRegistrations, monthlyRegistrations,
        dailyActive, usersByRole, usersByCountry, usersByGender,
        premiumVsFree: { premium: premiumCount, free: freeCount },
        reportsByDay, totalMessagesSent, messagesToday,
    };
};

// ─── Revenue Analytics ─────────────────────────────────────────────────────────
export const getRevenueAnalytics = async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Daily revenue (last 30 days)
    const dailyRevenue = await Payment.aggregate([
        { $match: { status: "completed", createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    // Monthly revenue (last 12 months)
    const monthlyRevenue = await Payment.aggregate([
        { $match: { status: "completed", createdAt: { $gte: startOfYear } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    // Revenue by plan
    const revenueByPlan = await Payment.aggregate([
        { $match: { status: "completed", plan: { $ne: null } } },
        { $group: { _id: "$plan", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    // Revenue by payment method
    const revenueByMethod = await Payment.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: "$paymentMethod", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    // Total revenue
    const totalResult = await Payment.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    // Revenue this month vs last month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonthRev, lastMonthRev] = await Promise.all([
        Payment.aggregate([
            { $match: { status: "completed", createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ]),
        Payment.aggregate([
            { $match: { status: "completed", createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ]),
    ]);

    // Refund stats
    const refundStats = await Payment.aggregate([
        { $match: { status: "refunded" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    return {
        dailyRevenue,
        monthlyRevenue,
        revenueByPlan,
        revenueByMethod,
        totals: totalResult[0] || { total: 0, count: 0 },
        thisMonth: thisMonthRev[0] || { total: 0, count: 0 },
        lastMonth: lastMonthRev[0] || { total: 0, count: 0 },
        refunds: refundStats[0] || { total: 0, count: 0 },
    };
};

// ─── Chat Moderation ───────────────────────────────────────────────────────────
export const getChatMessages = async ({ page = 1, limit = 50, search = "", userId = "" } = {}) => {
    const query = { isDeleted: false };
    if (userId) query.$or = [{ fromUserId: userId }, { toUserId: userId }];
    if (search) {
        query.content = { $regex: search, $options: "i" };
    }

    const total = await Message.countDocuments(query);
    const messages = await Message.find(query)
        .populate("fromUserId", "firstName lastName email username profilePicture")
        .populate("toUserId", "firstName lastName email username profilePicture")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit);

    return { messages, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const moderateMessage = async (messageId, action, adminId, reason = "") => {
    const message = await Message.findById(messageId);
    if (!message) throw new Error("Message not found");

    if (action === "delete") {
        message.isDeleted = true;
        await message.save();
        await logAction(adminId, "delete_message", "content", messageId, { fromUserId: message.fromUserId, reason }, null);
    } else if (action === "warn") {
        // Create a notification to the sender
        await createNotification({
            userId: message.fromUserId,
            type: "system",
            title: "⚠️ Message Warning",
            message: reason || "Your message was flagged for violating community guidelines.",
            metadata: { messageId, moderatedBy: adminId },
        });
        await logAction(adminId, "warn_message", "content", messageId, { fromUserId: message.fromUserId, reason }, null);
    }

    return message;
};

// ─── Image Moderation ──────────────────────────────────────────────────────────
export const getFlaggedPhotos = async ({ page = 1, limit = 20 } = {}) => {
    // Find users with photos who have been reported or flagged
    const query = {
        photos: { $exists: true, $ne: [] },
        $or: [
            { reportCount: { $gte: 1 } },
            { flaggedForReview: true },
        ],
        deletedAt: { $exists: false },
    };

    const total = await User.countDocuments(query);
    const users = await User.find(query)
        .select("firstName lastName email username profilePicture photos reportCount flaggedForReview isBanned createdAt")
        .sort("-reportCount")
        .skip((page - 1) * limit)
        .limit(limit);

    return { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const moderatePhoto = async (userId, photoIndex, action, adminId, reason = "") => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    if (action === "remove" && photoIndex >= 0 && photoIndex < user.photos.length) {
        const removedPhoto = user.photos[photoIndex];
        user.photos.splice(photoIndex, 1);
        if (user.profilePicture === removedPhoto) {
            user.profilePicture = user.photos[0] || "";
        }
        await user.save();
        await logAction(adminId, "remove_photo", "user", userId, { photoIndex, reason, targetEmail: user.email }, null);
    } else if (action === "flag_all") {
        user.flaggedForReview = true;
        await user.save();
        await logAction(adminId, "flag_photos", "user", userId, { reason, targetEmail: user.email }, null);
    }

    return user;
};

// ─── Push Notifications ────────────────────────────────────────────────────────
export const sendPushNotification = async ({ title, message, audience = "all", targetUsers = [], sentBy }) => {
    const results = { sent: 0, failed: 0 };

    let users = [];
    if (audience === "all") {
        users = await User.find({ deletedAt: { $exists: false } }).select("_id");
    } else if (audience === "premium") {
        users = await User.find({ isPremium: true, deletedAt: { $exists: false } }).select("_id");
    } else if (audience === "free") {
        users = await User.find({ isPremium: { $ne: true }, deletedAt: { $exists: false } }).select("_id");
    } else if (audience === "specific_users" && targetUsers.length > 0) {
        users = targetUsers.map(id => ({ _id: id }));
    }

    for (const user of users) {
        try {
            await createNotification({
                userId: user._id,
                type: "system",
                title: title || "📢 Announcement",
                message,
                metadata: { sentBy, type: "admin_push" },
            });
            results.sent++;
        } catch {
            results.failed++;
        }
    }

    return results;
};

// ─── Permission System ─────────────────────────────────────────────────────────
export const PERMISSIONS = {
    // User management
    VIEW_USERS: "view_users",
    EDIT_USERS: "edit_users",
    DELETE_USERS: "delete_users",
    BAN_USERS: "ban_users",
    SUSPEND_USERS: "suspend_users",
    VERIFY_USERS: "verify_users",
    // Reports
    VIEW_REPORTS: "view_reports",
    MANAGE_REPORTS: "manage_reports",
    // Moderation
    MODERATE_CHAT: "moderate_chat",
    MODERATE_IMAGES: "moderate_images",
    MODERATE_PROFILES: "moderate_profiles",
    // Announcements
    SEND_ANNOUNCEMENTS: "send_announcements",
    SEND_PUSH: "send_push",
    // Premium
    MANAGE_PREMIUM: "manage_premium",
    // Analytics
    VIEW_ANALYTICS: "view_analytics",
    VIEW_REVENUE: "view_revenue",
    // Admin
    MANAGE_ROLES: "manage_roles",
    VIEW_LOGS: "view_logs",
    MANAGE_SETTINGS: "manage_settings",
};

// Default permission sets for each role
export const ROLE_PERMISSIONS = {
    super_admin: Object.values(PERMISSIONS),
    admin: [
        PERMISSIONS.VIEW_USERS, PERMISSIONS.EDIT_USERS, PERMISSIONS.DELETE_USERS,
        PERMISSIONS.BAN_USERS, PERMISSIONS.SUSPEND_USERS, PERMISSIONS.VERIFY_USERS,
        PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_REPORTS,
        PERMISSIONS.MODERATE_CHAT, PERMISSIONS.MODERATE_IMAGES, PERMISSIONS.MODERATE_PROFILES,
        PERMISSIONS.SEND_ANNOUNCEMENTS, PERMISSIONS.SEND_PUSH,
        PERMISSIONS.MANAGE_PREMIUM,
        PERMISSIONS.VIEW_ANALYTICS, PERMISSIONS.VIEW_REVENUE,
        PERMISSIONS.VIEW_LOGS,
    ],
    moderator: [
        PERMISSIONS.VIEW_USERS,
        PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_REPORTS,
        PERMISSIONS.MODERATE_CHAT, PERMISSIONS.MODERATE_IMAGES, PERMISSIONS.MODERATE_PROFILES,
        PERMISSIONS.VIEW_LOGS,
    ],
    user: [],
};

export const checkPermission = (role, permission) => {
    const perms = ROLE_PERMISSIONS[role] || [];
    return perms.includes(permission);
};

export const getRolePermissions = (role) => {
    return ROLE_PERMISSIONS[role] || [];
};

export const updateRolePermissions = async (role, permissions) => {
    // This would update a custom permissions config in DB
    // For now, we update the in-memory map
    if (ROLE_PERMISSIONS[role] !== undefined) {
        ROLE_PERMISSIONS[role] = permissions;
    }
    return ROLE_PERMISSIONS;
};