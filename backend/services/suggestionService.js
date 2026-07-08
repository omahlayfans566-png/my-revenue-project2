/**
 * suggestionService.js
 *
 * Dedicated service for the "Suggested for You" feature.
 * Provides real-time recommendation logic with proper exclusions,
 * caching, and Socket.IO integration.
 */

import { User } from "../models/User.js";
import { Match } from "../models/Match.js";
import { cache } from "./cacheService.js";

// ── Cache key prefix ───────────────────────────────────────────────────────────
const SUGGESTIONS_CACHE_PREFIX = "suggestions:";

// ── Hard exclusions — users who must NEVER appear in suggestions ───────────────
const buildExclusionQuery = (userId, user) => ({
    _id: { $ne: user._id },
    isBanned: { $ne: true },
    deletedAt: { $exists: false },
    isActive: true,
    emailVerified: true,
    flaggedForReview: { $ne: true },
    blocked: { $nin: [user._id] },
    "privacySettings.profileVisible": { $ne: false },
});

// ── Soft preference filters ────────────────────────────────────────────────────
const buildPreferenceFilters = (user) => {
    const filters = {};

    if (user.lookingFor && user.lookingFor !== "both") {
        const GENDER_MAP = { men: "male", women: "female" };
        const targetGender = GENDER_MAP[user.lookingFor];
        if (targetGender) {
            filters.gender = { $in: [targetGender, null, undefined, ""] };
        }
    }

    if (user.minAge && user.maxAge && user.minAge < user.maxAge) {
        filters.$or = [
            { age: { $gte: user.minAge, $lte: user.maxAge } },
            { age: { $exists: false } },
            { age: null },
        ];
    }

    if (
        user.preferredCountry &&
        user.preferredCountry !== "Anywhere in Africa" &&
        user.preferredCountry.trim() !== ""
    ) {
        filters.country = user.preferredCountry;
    }

    return filters;
};

// ── Public shape for suggestion cards ──────────────────────────────────────────
const shapeSuggestion = (user, compatibilityScore) => ({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    profilePicture: user.profilePicture,
    age: user.age,
    city: user.city,
    country: user.country,
    occupation: user.occupation,
    compatibilityScore: compatibilityScore
        ? Math.min(99, Math.round(compatibilityScore))
        : undefined,
    isVerified: user.emailVerified === true,
    isPremium: user.isPremium || false,
    interests: user.interests || [],
});

// ── Compatibility scoring ──────────────────────────────────────────────────────
const scoreCompatibility = (user, candidate) => {
    let score = 50;

    const shared = (user.interests || []).filter(
        (i) => (candidate.interests || []).includes(i)
    ).length;
    score += Math.min(40, shared * 8);

    if (user.age && candidate.age) {
        const ageDiff = Math.abs(user.age - candidate.age);
        score += Math.max(0, 10 - ageDiff * 1.2);
    }

    if (
        user.relationshipGoal &&
        user.relationshipGoal === candidate.relationshipGoal
    ) {
        score += 20;
    }

    if (user.religion && user.religion === candidate.religion) {
        score += 12;
    }

    if (
        user.wantsChildren &&
        user.wantsChildren === candidate.wantsChildren
    ) {
        score += 10;
    }

    if (user.smoking && user.smoking === candidate.smoking) score += 5;
    if (user.drinking && user.drinking === candidate.drinking) score += 5;

    score += Math.round((candidate.profileCompletion || 0) * 0.08);
    if (candidate.isPremium) score += 5;

    if (candidate.memberSince) {
        const days =
            (Date.now() - new Date(candidate.memberSince).getTime()) / 86400000;
        if (days < 7) score += 8;
    }

    return score;
};

// ── Get users already acted on (liked, passed, blocked, matched) ───────────────
const getActedOnUserIds = async (userId) => {
    const acted = await Match.find({
        userId,
        status: {
            $in: ["liked", "matched", "rejected", "blocked", "superliked"],
        },
    })
        .select("matchedUserId")
        .lean();
    return new Set(acted.map((m) => m.matchedUserId.toString()));
};

// ── Get users who acted on the current user (blocked the current user) ─────────
const getBlockedByUserIds = async (user) => {
    // Users who have the current user in their blocked list
    const blockers = await User.find({
        blocked: user._id,
    })
        .select("_id")
        .lean();
    return new Set(blockers.map((b) => b._id.toString()));
};

// ── Main: Fetch fresh suggestions ──────────────────────────────────────────────
export const getSuggestions = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");

    const base = buildExclusionQuery(userId, user);
    const soft = buildPreferenceFilters(user);

    // Merge queries properly
    const query = { ...base };
    if (soft.$or) {
        query.$and = [{ $or: soft.$or }];
        delete soft.$or;
    }
    Object.assign(query, soft);

    // Get users already acted on
    const actedIds = await getActedOnUserIds(userId);

    // Get users who blocked the current user
    const blockerIds = await getBlockedByUserIds(user);

    // Combine all exclusion sets
    const allExcludedIds = new Set([...actedIds, ...blockerIds]);

    // Fetch candidates
    const candidates = await User.find(query)
        .sort({ profileCompletion: -1, lastLogin: -1 })
        .limit(Math.max(limit * 5, 100))
        .lean();

    // Score, filter exclusions, and return top matches
    const scored = candidates
        .filter((c) => !allExcludedIds.has(c._id.toString()))
        .map((c) => ({
            user: c,
            score: scoreCompatibility(user, c),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored.map(({ user: c, score }) => shapeSuggestion(c, score));
};

// ── Cached version ─────────────────────────────────────────────────────────────
export const getCachedSuggestions = async (userId, limit = 20) => {
    const cacheKey = `${SUGGESTIONS_CACHE_PREFIX}${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const suggestions = await getSuggestions(userId, limit);
    cache.set(cacheKey, suggestions, 60); // 60-second TTL
    return suggestions;
};

// ── Invalidate suggestions cache for ALL users ─────────────────────────────────
export const invalidateAllSuggestionsCache = () => {
    cache.clearPattern(`${SUGGESTIONS_CACHE_PREFIX}*`);
};

// ── Invalidate suggestions cache for SPECIFIC users ────────────────────────────
export const invalidateUserSuggestionsCache = (userId) => {
    cache.delete(`${SUGGESTIONS_CACHE_PREFIX}${userId}`);
};

// ── Broadcast to all connected clients that suggestions may have changed ───────
export const broadcastSuggestionsUpdate = (eventType = "suggestions_updated") => {
    if (global.io) {
        global.io.emit(eventType, {
            timestamp: new Date().toISOString(),
            type: eventType,
        });
        console.log(`[SuggestionService] Broadcast: ${eventType}`);
    }
};

// ── Combined: Invalidate cache + broadcast to all clients ──────────────────────
export const notifySuggestionsChanged = () => {
    invalidateAllSuggestionsCache();
    broadcastSuggestionsUpdate("suggestions_updated");
};

export default {
    getSuggestions,
    getCachedSuggestions,
    invalidateAllSuggestionsCache,
    invalidateUserSuggestionsCache,
    broadcastSuggestionsUpdate,
    notifySuggestionsChanged,
};