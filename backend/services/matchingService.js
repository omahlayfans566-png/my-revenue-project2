/**
 * matchingService.js
 *
 * Discovery and compatibility logic.
 *
 * Design principles:
 *  - Hard exclusions: self, banned users, blocked users, soft-deleted users
 *  - Soft exclusions: prefer users with gender/age matching the current user's
 *    preferences, but NEVER exclude solely because a field is missing or null.
 *  - All feed tabs (For You, New, Active, Nearby, Online) must return results
 *    even when users have incomplete profiles.
 */

import { User } from "../models/User.js";
import { Match } from "../models/Match.js";

// ── Hard base query — minimal safe exclusions only ────────────────────────────
// Applied to EVERY discovery query. Only excludes users who must never appear:
//   • The current user themselves
//   • Banned users
//   • Soft-deleted users
//   • Users who explicitly blocked the current user
//   • Users flagged for review
//   • Users who set profileVisible = false
const hardBase = (user) => ({
    _id: { $ne: user._id },
    isBanned: { $ne: true },
    deletedAt: { $exists: false },
    flaggedForReview: { $ne: true },
    blocked: { $nin: [user._id] },
    "privacySettings.profileVisible": { $ne: false },
});

// ── Soft preference filters (applied only when current user has the field) ────
// These improve match quality but never reduce the pool to zero.
const softFilters = (user) => {
    const filters = {};

    // Gender preference: only filter if the current user set lookingFor
    // AND the candidate has a gender field set. Skip silently if missing.
    if (user.lookingFor && user.lookingFor !== "both") {
        const GENDER_MAP = { men: "male", women: "female" };
        const targetGender = GENDER_MAP[user.lookingFor];
        if (targetGender) {
            // Use $in to also include users with no gender set (they appear for everyone)
            filters.gender = { $in: [targetGender, null, undefined, ""] };
        }
    }

    // Age filter: only when both minAge and maxAge are set on the current user
    // and are sensible values
    if (user.minAge && user.maxAge && user.minAge < user.maxAge) {
        // Also include users with no age set ($exists: false handles missing)
        filters.$or = [
            { age: { $gte: user.minAge, $lte: user.maxAge } },
            { age: { $exists: false } },
            { age: null },
        ];
    }

    // Country preference: only when explicitly set (not "Anywhere in Africa")
    if (
        user.preferredCountry &&
        user.preferredCountry !== "Anywhere in Africa" &&
        user.preferredCountry.trim() !== ""
    ) {
        filters.country = user.preferredCountry;
    }

    return filters;
};

// ── Public shape ──────────────────────────────────────────────────────────────
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
    isVerified: c.emailVerified === true,
    lastLogin: c.lastLogin,
    memberSince: c.memberSince,
    compatibilityScore: score ? Math.min(99, Math.round(score)) : undefined,
});

// ── Log helper ────────────────────────────────────────────────────────────────
const logDiscovery = (label, query, count) => {
    console.log(
        `[Discovery] ${label} | query: ${JSON.stringify(query)} | returned: ${count} users`
    );
};

// ── Main suggestions (For You feed) ──────────────────────────────────────────
export const getMatchSuggestions = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");

    const base = hardBase(user);
    const soft = softFilters(user);

    // Merge: $or from soft filters needs special handling to not override hard base $or
    const query = { ...base };
    if (soft.$or) {
        query.$and = [{ $or: soft.$or }];
        delete soft.$or;
    }
    Object.assign(query, soft);

    // Exclude profiles already acted on (liked/passed/blocked)
    const acted = await Match.find({
        userId,
        status: { $in: ["liked", "matched", "rejected", "blocked", "superliked"] },
    }).select("matchedUserId").lean();
    const actedIds = new Set(acted.map(m => m.matchedUserId.toString()));

    const candidates = await User.find(query)
        .sort({ profileCompletion: -1, lastLogin: -1 })
        .limit(Math.max(limit * 5, 100))
        .lean();

    logDiscovery("suggestions", query, candidates.length);

    const scored = candidates
        .filter(c => !actedIds.has(c._id.toString()))
        .map(c => ({ c, score: scoreCompatibility(user, c) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    console.log(`[Discovery] suggestions after acted-on filter: ${scored.length}`);

    return scored.map(({ c, score }) => shape(c, score));
};

// ── Recently joined (last 30 days — widened from 7 days) ─────────────────────
export const getRecentlyJoined = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    // Widen to 30 days so small test databases always have results
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const query = {
        ...hardBase(user),
        createdAt: { $gte: thirtyDaysAgo },
    };

    const users = await User.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

    logDiscovery("recently-joined", query, users.length);

    // If still empty, return all non-excluded users (no date restriction)
    if (users.length === 0) {
        const fallback = await User.find(hardBase(user))
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        console.log(`[Discovery] recently-joined fallback: ${fallback.length} users`);
        return fallback.map(c => shape(c));
    }

    return users.map(c => shape(c));
};

// ── Recently active (last 7 days — widened from 24 h) ─────────────────────────
export const getRecentlyActive = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    // Widen to 7 days so small test databases always have results
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const query = {
        ...hardBase(user),
        lastLogin: { $gte: sevenDaysAgo },
    };

    const users = await User.find(query)
        .sort({ lastLogin: -1 })
        .limit(limit)
        .lean();

    logDiscovery("recently-active", query, users.length);

    // Fallback: all non-excluded users sorted by lastLogin
    if (users.length === 0) {
        const fallback = await User.find(hardBase(user))
            .sort({ lastLogin: -1, createdAt: -1 })
            .limit(limit)
            .lean();
        console.log(`[Discovery] recently-active fallback: ${fallback.length} users`);
        return fallback.map(c => shape(c));
    }

    return users.map(c => shape(c));
};

// ── Nearby ────────────────────────────────────────────────────────────────────
export const getNearby = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    // If no location data, fall back to same country, then all users
    if (!user.latitude || !user.longitude) {
        if (user.country) {
            const countryUsers = await User.find({
                ...hardBase(user),
                country: user.country,
            }).limit(limit).lean();
            if (countryUsers.length > 0) return countryUsers.map(c => shape(c));
        }
        // Final fallback: everyone
        const fallback = await User.find(hardBase(user)).limit(limit).lean();
        return fallback.map(c => shape(c));
    }

    const DELTA = 0.45; // ~50 km
    const query = {
        ...hardBase(user),
        latitude: { $gte: user.latitude - DELTA, $lte: user.latitude + DELTA },
        longitude: { $gte: user.longitude - DELTA, $lte: user.longitude + DELTA },
    };

    const users = await User.find(query).limit(limit).lean();
    logDiscovery("nearby", query, users.length);

    // Fallback to same-country if no one nearby
    if (users.length === 0 && user.country) {
        const countryFallback = await User.find({
            ...hardBase(user),
            country: user.country,
        }).limit(limit).lean();
        return countryFallback.map(c => shape(c));
    }

    return users.map(c => shape(c));
};

// ── Compatibility scoring ─────────────────────────────────────────────────────
const scoreCompatibility = (user, c) => {
    let s = 50;
    const shared = (user.interests || []).filter(i => (c.interests || []).includes(i)).length;
    s += Math.min(40, shared * 8);
    if (user.age && c.age) {
        const ageDiff = Math.abs(user.age - c.age);
        s += Math.max(0, 10 - ageDiff * 1.2);
    }
    if (user.relationshipGoal && user.relationshipGoal === c.relationshipGoal) s += 20;
    if (user.religion && user.religion === c.religion) s += 12;
    if (user.wantsChildren && user.wantsChildren === c.wantsChildren) s += 10;
    if (user.smoking && user.smoking === c.smoking) s += 5;
    if (user.drinking && user.drinking === c.drinking) s += 5;
    s += Math.round((c.profileCompletion || 0) * 0.08);
    if (c.isPremium) s += 5;
    if (c.memberSince) {
        const days = (Date.now() - new Date(c.memberSince).getTime()) / 86400000;
        if (days < 7) s += 8;
    }
    return s;
};

export const calculateCompatibility = (u1, u2) =>
    Math.min(100, Math.max(0, Math.round(scoreCompatibility(u1, u2))));
