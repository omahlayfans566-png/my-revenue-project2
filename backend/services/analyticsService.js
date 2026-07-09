/**
 * Analytics Service - Phase 14: Complete Analytics Dashboard
 * Tracks DAU, MAU, registrations, matches, messages, revenue, retention, etc.
 */
import { User } from "../models/User.js";
import { Match } from "../models/Match.js";
import { Message } from "../models/Message.js";
import { Story } from "../models/Story.js";
import { Payment } from "../models/Payment.js";
import { Subscription } from "../models/Subscription.js";
import { Coin } from "../models/Coin.js";
import { Gift } from "../models/Gift.js";
import { ActivityLog } from "../models/ActivityLog.js";

// ─── Helper: Date Ranges ─────────────────────────────────────────────────────
const today = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
};

const monthsAgo = (n) => {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    d.setHours(0, 0, 0, 0);
    return d;
};

// ─── Get Complete Analytics ──────────────────────────────────────────────────
export const getCompleteAnalytics = async () => {
    const now = new Date();
    const todayStart = today();
    const monthStart = daysAgo(30);
    const weekStart = daysAgo(7);

    const [
        totalUsers,
        newToday,
        newThisWeek,
        newThisMonth,
        dau,
        mau,
        totalMatches,
        matchesToday,
        matchesThisWeek,
        totalMessages,
        messagesToday,
        totalStories,
        storiesToday,
        activeUsers,
        premiumUsers,
    ] = await Promise.all([
        User.countDocuments({ isBanned: false }),
        User.countDocuments({ createdAt: { $gte: todayStart } }),
        User.countDocuments({ createdAt: { $gte: weekStart } }),
        User.countDocuments({ createdAt: { $gte: monthStart } }),
        User.countDocuments({ lastSeen: { $gte: daysAgo(1) } }),
        User.countDocuments({ lastSeen: { $gte: monthStart } }),
        Match.countDocuments({ status: "matched" }),
        Match.countDocuments({ matchedAt: { $gte: todayStart }, status: "matched" }),
        Match.countDocuments({ matchedAt: { $gte: weekStart }, status: "matched" }),
        Message.countDocuments({ isDeleted: false }),
        Message.countDocuments({ createdAt: { $gte: todayStart } }),
        Story.countDocuments({ isDeleted: false }),
        Story.countDocuments({ createdAt: { $gte: todayStart } }),
        User.countDocuments({ lastSeen: { $gte: daysAgo(7) } }),
        User.countDocuments({ isPremium: true }),
    ]);

    // Revenue analytics
    const revenueData = await Payment.aggregate([
        { $match: { status: "completed", createdAt: { $gte: monthsAgo(12) } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                total: { $sum: "$amount" },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Coin purchases
    const coinPurchases = await Coin.aggregate([
        { $match: { type: "purchase", createdAt: { $gte: monthsAgo(12) } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                total: { $sum: "$amount" },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Gift purchases
    const giftPurchases = await Gift.aggregate([
        { $match: { createdAt: { $gte: monthsAgo(12) } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Subscription analytics
    const subscriptions = await Subscription.aggregate([
        { $match: { createdAt: { $gte: monthsAgo(12) } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                count: { $sum: 1 },
                revenue: { $sum: "$amount" },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // User retention (users active in consecutive months)
    const retention = await getUserRetention();

    // Churn rate
    const churnedLastMonth = await User.countDocuments({
        isActive: true,
        lastSeen: { $lt: monthsAgo(1) },
        createdAt: { $lt: monthsAgo(1) },
    });
    const activeLastMonth = await User.countDocuments({
        lastSeen: { $gte: monthsAgo(2), $lt: monthsAgo(1) },
    });
    const churnRate = activeLastMonth > 0 ? (churnedLastMonth / activeLastMonth) * 100 : 0;

    // Top countries
    const topCountries = await User.aggregate([
        { $match: { country: { $ne: null, $ne: "" } } },
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
    ]);

    // Top cities
    const topCities = await User.aggregate([
        { $match: { city: { $ne: null, $ne: "" } } },
        { $group: { _id: "$city", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
    ]);

    // Device usage (from user agents in sessions)
    const deviceUsage = await ActivityLog.aggregate([
        { $match: { action: "login", createdAt: { $gte: daysAgo(30) } } },
        {
            $group: {
                _id: "$metadata.deviceType",
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1 } },
    ]);

    // Peak activity times (hourly distribution)
    const peakHours = await Message.aggregate([
        { $match: { createdAt: { $gte: daysAgo(7) } } },
        {
            $group: {
                _id: { $hour: "$createdAt" },
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1 } },
    ]);

    // Engagement score calculation
    const engagementRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

    // Growth rate
    const lastMonthUsers = await User.countDocuments({ createdAt: { $lt: monthStart } });
    const growthRate = lastMonthUsers > 0 ? ((totalUsers - lastMonthUsers) / lastMonthUsers) * 100 : 0;

    return {
        overview: {
            totalUsers,
            newToday,
            newThisWeek,
            newThisMonth,
            dau,
            mau,
            totalMatches,
            matchesToday,
            matchesThisWeek,
            totalMessages,
            messagesToday,
            totalStories,
            storiesToday,
            activeUsers,
            premiumUsers,
            engagementRate: Math.round(engagementRate * 100) / 100,
            growthRate: Math.round(growthRate * 100) / 100,
        },
        revenue: {
            monthly: revenueData,
            coinPurchases,
            giftPurchases,
            subscriptions,
            totalRevenue: revenueData.reduce((sum, r) => sum + r.total, 0),
        },
        retention: {
            weekly: retention.weekly,
            monthly: retention.monthly,
            churnRate: Math.round(churnRate * 100) / 100,
        },
        demographics: {
            topCountries,
            topCities,
            deviceUsage,
        },
        engagement: {
            peakHours: peakHours.slice(0, 10),
            avgMessagesPerUser: totalUsers > 0 ? Math.round(totalMessages / totalUsers) : 0,
            avgMatchesPerUser: totalUsers > 0 ? Math.round(totalMatches / totalUsers) : 0,
        },
    };
};

// ─── User Retention Calculation ──────────────────────────────────────────────
const getUserRetention = async () => {
    const weeklyRetention = [];
    const monthlyRetention = [];

    // Weekly retention for last 8 weeks
    for (let i = 0; i < 8; i++) {
        const weekStart = daysAgo((i + 1) * 7);
        const weekEnd = daysAgo(i * 7);
        const usersInWeek = await User.countDocuments({
            createdAt: { $gte: weekStart, $lt: weekEnd },
        });
        const retained = await User.countDocuments({
            createdAt: { $gte: weekStart, $lt: weekEnd },
            lastSeen: { $gte: daysAgo(7) },
        });
        weeklyRetention.push({
            week: `Week ${i + 1}`,
            total: usersInWeek,
            retained,
            rate: usersInWeek > 0 ? Math.round((retained / usersInWeek) * 10000) / 100 : 0,
        });
    }

    // Monthly retention for last 6 months
    for (let i = 0; i < 6; i++) {
        const monthStart = monthsAgo(i + 1);
        const monthEnd = monthsAgo(i);
        const usersInMonth = await User.countDocuments({
            createdAt: { $gte: monthStart, $lt: monthEnd },
        });
        const retained = await User.countDocuments({
            createdAt: { $gte: monthStart, $lt: monthEnd },
            lastSeen: { $gte: monthsAgo(1) },
        });
        monthlyRetention.push({
            month: `${monthStart.toLocaleString("default", { month: "short" })}`,
            total: usersInMonth,
            retained,
            rate: usersInMonth > 0 ? Math.round((retained / usersInMonth) * 10000) / 100 : 0,
        });
    }

    return { weekly: weeklyRetention, monthly: monthlyRetention };
};

// ─── Get Dashboard Stats (lightweight) ───────────────────────────────────────
export const getDashboardStats = async () => {
    const todayStart = today();

    const [
        totalUsers,
        newUsersToday,
        todayMatches,
        todayMessages,
        onlineNow,
        premiumCount,
    ] = await Promise.all([
        User.countDocuments({ isBanned: false }),
        User.countDocuments({ createdAt: { $gte: todayStart } }),
        Match.countDocuments({ matchedAt: { $gte: todayStart }, status: "matched" }),
        Message.countDocuments({ createdAt: { $gte: todayStart } }),
        User.countDocuments({ lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) } }),
        User.countDocuments({ isPremium: true }),
    ]);

    const revenue = await Payment.aggregate([
        { $match: { status: "completed", createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    return {
        totalUsers,
        newUsersToday,
        todayMatches,
        todayMessages,
        onlineNow,
        premiumCount,
        todayRevenue: revenue[0]?.total || 0,
        totalRevenue: (await Payment.aggregate([
            { $match: { status: "completed" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]))[0]?.total || 0,
    };
};

export default {
    getCompleteAnalytics,
    getDashboardStats,
};