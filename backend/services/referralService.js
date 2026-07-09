/**
 * Referral Service — Referral code generation, tracking, and rewards
 */
import crypto from "crypto";
import { Referral, ReferralCode } from "../models/Referral.js";
import { User } from "../models/User.js";
import { addCoins } from "./coinService.js";

const REFERRAL_REWARD = 1; // 1 coin per 2 referrals
const REFERRAL_THRESHOLD = 2; // 2 referrals needed for reward

// ─── Code Generation ───────────────────────────────────────────────────────────

export const generateReferralCode = async (userId) => {
    // Check if code already exists
    let existing = await ReferralCode.findOne({ userId });
    if (existing) return existing;

    // Generate unique code
    let code;
    let isUnique = false;
    while (!isUnique) {
        const user = await User.findById(userId);
        const prefix = (user?.firstName || "USER").substring(0, 3).toUpperCase();
        const random = crypto.randomBytes(3).toString("hex").toUpperCase();
        code = `${prefix}${random}`;

        const exists = await ReferralCode.findOne({ code });
        if (!exists) isUnique = true;
    }

    const referralCode = new ReferralCode({ userId, code });
    await referralCode.save();
    return referralCode;
};

export const getReferralCode = async (userId) => {
    let code = await ReferralCode.findOne({ userId });
    if (!code) {
        code = await generateReferralCode(userId);
    }
    return code;
};

export const getReferralByCode = async (code) => {
    return ReferralCode.findOne({ code: code.toUpperCase() });
};

// ─── Referral Tracking ─────────────────────────────────────────────────────────

export const createReferral = async (referrerCode, referredData) => {
    const { email, phone, ipAddress, userAgent } = referredData;

    const code = await getReferralByCode(referrerCode);
    if (!code) throw new Error("Invalid referral code");

    // Prevent self-referral
    if (code.userId.toString() === referredData.userId) {
        throw new Error("Cannot refer yourself");
    }

    // Check if already referred
    const existing = await Referral.findOne({
        referrerId: code.userId,
        $or: [
            { email: email?.toLowerCase() },
            { phone },
        ],
    });
    if (existing) throw new Error("Already referred");

    const referral = new Referral({
        referrerId: code.userId,
        referralCode: code.code,
        email: email?.toLowerCase(),
        phone,
        status: "invited",
        ipAddress,
        userAgent,
    });
    await referral.save();

    return referral;
};

export const completeReferral = async (userId) => {
    // Find referral by email or phone
    const user = await User.findById(userId);
    if (!user) return;

    const referral = await Referral.findOne({
        $or: [
            { email: user.email?.toLowerCase() },
            { phone: user.phone },
        ],
        status: "invited",
    });

    if (!referral) return;

    referral.status = "joined";
    referral.referredUserId = userId;
    referral.joinedAt = new Date();
    await referral.save();

    // Update referrer's code stats
    const code = await ReferralCode.findOne({ code: referral.referralCode });
    if (code) {
        code.totalReferrals += 1;
        code.successfulReferrals += 1;
        await code.save();

        // Check if threshold reached for reward
        if (code.successfulReferrals % REFERRAL_THRESHOLD === 0) {
            await rewardReferrer(code.userId, code);
        }
    }

    return referral;
};

export const rewardReferrer = async (referrerId, code) => {
    try {
        const { wallet, transaction } = await addCoins(
            referrerId,
            REFERRAL_REWARD,
            "referral",
            `Reward for ${REFERRAL_THRESHOLD} successful referrals!`,
            { referralCode: code.code }
        );

        // Mark referrals as rewarded
        await Referral.updateMany(
            {
                referrerId,
                status: "joined",
                rewardGiven: false,
            },
            {
                status: "rewarded",
                rewardGiven: true,
                rewardAmount: REFERRAL_REWARD,
                completedAt: new Date(),
            }
        );

        code.totalRewards += REFERRAL_REWARD;
        await code.save();

        // Notify
        try {
            const { createNotification } = await import("./notificationService.js");
            await createNotification({
                userId: referrerId,
                type: "referral",
                title: "Referral Reward! 🎉",
                message: `You earned ${REFERRAL_REWARD} coin for ${REFERRAL_THRESHOLD} successful referrals!`,
                metadata: { reward: REFERRAL_REWARD, totalReferrals: code.successfulReferrals },
            }).catch(() => {});
        } catch (e) { /* silent */ }

        return { wallet, transaction };
    } catch (e) {
        console.error("[Referral] Reward error:", e.message);
    }
};

// ─── Analytics ─────────────────────────────────────────────────────────────────

export const getReferralAnalytics = async (userId) => {
    const code = await getReferralCode(userId);
    const referrals = await Referral.find({ referrerId: userId }).sort({ createdAt: -1 });

    const stats = {
        code: code.code,
        totalReferrals: code.totalReferrals,
        successfulReferrals: code.successfulReferrals,
        totalRewards: code.totalRewards,
        pendingInvites: referrals.filter(r => r.status === "invited").length,
        joinedUsers: referrals.filter(r => r.status === "joined" || r.status === "rewarded").length,
        recentReferrals: referrals.slice(0, 10),
    };

    return stats;
};

export const getGlobalReferralStats = async () => {
    const [totalReferrals, totalRewards, topReferrers] = await Promise.all([
        Referral.countDocuments(),
        ReferralCode.aggregate([
            { $group: { _id: null, total: { $sum: "$totalRewards" } } },
        ]),
        ReferralCode.find()
            .populate("userId", "firstName lastName profilePicture")
            .sort({ successfulReferrals: -1 })
            .limit(10),
    ]);

    return {
        totalReferrals,
        totalRewards: totalRewards[0]?.total || 0,
        topReferrers,
    };
};