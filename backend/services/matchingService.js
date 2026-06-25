import { User } from "../models/User.js";
import { Match } from "../models/Match.js";

const GENDER_MAP = { men: ["male"], women: ["female"], both: ["male", "female", "other"] };

// ── Helper: base discovery query for a user ────────────────────────────────────
const baseQuery = (user) => {
    const genders = GENDER_MAP[user.lookingFor] || ["male", "female", "other"];
    const q = {
        _id: { $ne: user._id },
        emailVerified: true,
        isBanned: false,
        flaggedForReview: { $ne: true },
        "privacySettings.profileVisible": { $ne: false },
        gender: { $in: genders },
        blocked: { $nin: [user._id] },
    };
    // Age filter
    if (user.minAge && user.maxAge) q.age = { $gte: user.minAge, $lte: user.maxAge };
    // Country filter
    if (user.preferredCountry && user.preferredCountry !== "Anywhere in Africa") {
        q.country = user.preferredCountry;
    }
    // Distance bounding box
    if (user.latitude && user.longitude && user.preferredDistance) {
        const DELTA = { within_10km: 0.09, within_50km: 0.45 }[user.preferredDistance];
        if (DELTA) {
            q.latitude = { $gte: user.latitude - DELTA, $lte: user.latitude + DELTA };
            q.longitude = { $gte: user.longitude - DELTA, $lte: user.longitude + DELTA };
        }
    }
    return q;
};

// Public shape to return for a candidate
const shape = (c, score) => ({
    _id: c._id,
    firstName: c.firstName,
    lastName: c.lastName,
    profilePicture: c.profilePicture,
    photos: c.photos || [],
    age: c.age,
    city: c.city,
    country: c.country,
    occupation: c.occupation,
    aboutMe: c.aboutMe,
    interests: c.interests || [],
    relationshipGoal: c.relationshipGoal,
    religion: c.religion,
    education: c.education,
    languages: c.languages || [],
    profileCompletion: c.profileCompletion,
    isPremium: c.isPremium,
    isVerified: c.isMember && c.emailVerified,
    lastLogin: c.lastLogin,
    memberSince: c.memberSince,
    compatibilityScore: score ? Math.min(99, Math.round(score)) : undefined,
});

// ── Main suggestions (recommended / for-you feed) ─────────────────────────────
export const getMatchSuggestions = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");

    const q = baseQuery(user);

    // Exclude already-acted-on users
    const acted = await Match.find({
        userId,
        status: { $in: ["liked", "matched", "rejected", "blocked", "superliked"] },
    }).select("matchedUserId").lean();
    const actedIds = new Set(acted.map(m => m.matchedUserId.toString()));

    const candidates = await User.find(q).limit(100).lean();

    const scored = candidates
        .filter(c => !actedIds.has(c._id.toString()))
        .map(c => ({ c, score: scoreCompatibility(user, c) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored.map(({ c, score }) => shape(c, score));
};

// ── Recently joined (last 7 days) ─────────────────────────────────────────────
export const getRecentlyJoined = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];
    const q = { ...baseQuery(user), createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } };
    const users = await User.find(q).sort({ createdAt: -1 }).limit(limit).lean();
    return users.map(c => shape(c));
};

// ── Recently active (last 24 h) ───────────────────────────────────────────────
export const getRecentlyActive = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];
    const q = { ...baseQuery(user), lastLogin: { $gte: new Date(Date.now() - 24 * 3600000) } };
    const users = await User.find(q).sort({ lastLogin: -1 }).limit(limit).lean();
    return users.map(c => shape(c));
};

// ── Nearby (within ~50 km) ────────────────────────────────────────────────────
export const getNearby = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user || !user.latitude || !user.longitude) return [];
    const DELTA = 0.45; // ~50 km
    const q = {
        ...baseQuery(user),
        latitude: { $gte: user.latitude - DELTA, $lte: user.latitude + DELTA },
        longitude: { $gte: user.longitude - DELTA, $lte: user.longitude + DELTA },
    };
    const users = await User.find(q).limit(limit).lean();
    return users.map(c => shape(c));
};

// ── Compatibility score ────────────────────────────────────────────────────────
const scoreCompatibility = (user, c) => {
    let s = 50;
    const shared = (user.interests || []).filter(i => (c.interests || []).includes(i)).length;
    s += Math.min(40, shared * 8);
    const ageDiff = Math.abs((user.age || 25) - (c.age || 25));
    s += Math.max(0, 10 - ageDiff * 1.2);
    if (user.relationshipGoal && user.relationshipGoal === c.relationshipGoal) s += 20;
    if (user.religion && user.religion === c.religion) s += 12;
    if (user.wantsChildren && user.wantsChildren === c.wantsChildren) s += 10;
    if (user.smoking && user.smoking === c.smoking) s += 5;
    if (user.drinking && user.drinking === c.drinking) s += 5;
    s += Math.round((c.profileCompletion || 0) * 0.08);
    if (c.isPremium) s += 5;
    const days = c.memberSince
        ? (Date.now() - new Date(c.memberSince).getTime()) / 86400000
        : 999;
    if (days < 7) s += 8;
    return s;
};

export const calculateCompatibility = (u1, u2) =>
    Math.min(100, Math.max(0, Math.round(scoreCompatibility(u1, u2))));
