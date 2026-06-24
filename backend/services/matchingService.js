import { User } from "../models/User.js";
import { Match } from "../models/Match.js";

// Map lookingFor value → gender values to query
const LOOKING_FOR_GENDER_MAP = {
    men: ["male"],
    women: ["female"],
    both: ["male", "female", "other"],
};

/**
 * Return up to 10 scored, filtered suggestions for a given user.
 * Only fully onboarded (isMember=true), active, non-banned members are shown.
 */
export const getMatchSuggestions = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // ── Base query ────────────────────────────────────────────────────────────
    const genders = LOOKING_FOR_GENDER_MAP[user.lookingFor] || ["male", "female", "other"];

    const query = {
        _id: { $ne: userId },
        isMember: true,
        isActive: true,
        isBanned: false,
        emailVerified: true,
        flaggedForReview: { $ne: true },
        "privacySettings.profileVisible": { $ne: false },
        gender: { $in: genders },
        // Also exclude users who have blocked the current user
        blocked: { $nin: [userId] },
    };

    // ── Age range ─────────────────────────────────────────────────────────────
    if (user.minAge && user.maxAge) {
        query.age = { $gte: user.minAge, $lte: user.maxAge };
    }

    // ── Country filter ────────────────────────────────────────────────────────
    if (user.preferredCountry && user.preferredCountry !== "Anywhere in Africa") {
        query.country = user.preferredCountry;
    }

    // ── Distance filter (bounding-box approximation) ──────────────────────────
    if (user.latitude && user.longitude && user.preferredDistance) {
        const DELTA = { within_10km: 0.09, within_50km: 0.45, within_country: null }[user.preferredDistance];
        if (DELTA) {
            query.latitude = { $gte: user.latitude - DELTA, $lte: user.latitude + DELTA };
            query.longitude = { $gte: user.longitude - DELTA, $lte: user.longitude + DELTA };
        }
    }

    // ── Fetch candidates ──────────────────────────────────────────────────────
    const candidates = await User.find(query).limit(80).lean();

    // ── Get already-acted-on user IDs ─────────────────────────────────────────
    const acted = await Match.find({
        userId,
        status: { $in: ["liked", "matched", "rejected", "blocked"] },
    }).select("matchedUserId").lean();
    const actedIds = new Set(acted.map(m => m.matchedUserId.toString()));

    // ── Score each candidate ──────────────────────────────────────────────────
    const scored = candidates
        .filter(c => !actedIds.has(c._id.toString()))
        .map(c => ({ candidate: c, score: scoreCompatibility(user, c) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    return scored.map(({ candidate: c, score }) => ({
        _id: c._id,
        firstName: c.firstName,
        lastName: c.lastName,
        profilePicture: c.profilePicture,
        age: c.age,
        city: c.city,
        country: c.country,
        occupation: c.occupation,
        aboutMe: c.aboutMe,
        interests: c.interests,
        relationshipGoal: c.relationshipGoal,
        profileCompletion: c.profileCompletion,
        isPremium: c.isPremium,
        memberSince: c.memberSince,
        compatibilityScore: Math.min(99, Math.round(score)),
    }));
};

/**
 * Score two user objects for compatibility (0–100+).
 * Higher = better match. Used for sorting suggestions.
 */
const scoreCompatibility = (user, candidate) => {
    let score = 50; // base

    // Common interests (+8 per shared, max +40)
    const sharedInterests = (user.interests || [])
        .filter(i => (candidate.interests || []).includes(i)).length;
    score += Math.min(40, sharedInterests * 8);

    // Age proximity (+10 if within 3 years, linear decay)
    const ageDiff = Math.abs((user.age || 25) - (candidate.age || 25));
    score += Math.max(0, 10 - ageDiff * 1.2);

    // Relationship goal match (+20)
    if (user.relationshipGoal && user.relationshipGoal === candidate.relationshipGoal) score += 20;

    // Religion match (+12)
    if (user.religion && user.religion === candidate.religion) score += 12;

    // Children preferences (+10)
    if (user.wantsChildren && user.wantsChildren === candidate.wantsChildren) score += 10;

    // Lifestyle (+5 each)
    if (user.smoking && user.smoking === candidate.smoking) score += 5;
    if (user.drinking && user.drinking === candidate.drinking) score += 5;

    // Profile quality boost (completed profiles are more attractive)
    const pct = candidate.profileCompletion || 0;
    score += Math.round(pct * 0.08); // up to +8 for 100% completion

    // Premium boost (+5)
    if (candidate.isPremium) score += 5;

    // Recency boost: new members get a small initial boost
    const daysSinceJoin = candidate.memberSince
        ? (Date.now() - new Date(candidate.memberSince).getTime()) / 86_400_000
        : 999;
    if (daysSinceJoin < 7) score += 8;

    return score;
};

/**
 * Public compatibility score between two full user objects (0–100).
 * Exposed for API use (e.g. profile view).
 */
export const calculateCompatibility = (user1, user2) => {
    const raw = scoreCompatibility(user1, user2);
    return Math.min(100, Math.max(0, Math.round(raw)));
};
