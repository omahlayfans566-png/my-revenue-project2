/**
 * Matching Service - Phase 8: Daily Matching
 * Smart compatibility engine, daily recommendations, trending, nearby, etc.
 */
import { User } from "../models/User.js";
import { Match } from "../models/Match.js";
import { ProfileView } from "../models/ProfileView.js";

// ─── Compatibility Score Calculation ──────────────────────────────────────────
export const calculateCompatibility = (user1, user2) => {
    let score = 0;
    const reasons = [];

    // Age compatibility (20 points)
    if (user1.age && user2.age) {
        const ageDiff = Math.abs(user1.age - user2.age);
        if (ageDiff <= 3) { score += 20; reasons.push("Great age match"); }
        else if (ageDiff <= 7) { score += 15; reasons.push("Good age match"); }
        else if (ageDiff <= 12) { score += 8; reasons.push("Decent age match"); }
        else { score += 2; }
    }

    // Location compatibility (15 points)
    if (user1.country && user2.country) {
        if (user1.country === user2.country) {
            score += 10;
            reasons.push("Same country");
            if (user1.city && user2.city && user1.city === user2.city) {
                score += 5;
                reasons.push("Same city");
            }
        }
    }

    // Interest overlap (25 points)
    if (user1.interests?.length && user2.interests?.length) {
        const common = user1.interests.filter(i => user2.interests.includes(i));
        const maxPossible = Math.max(user1.interests.length, user2.interests.length);
        const overlapRatio = common.length / maxPossible;
        score += Math.round(overlapRatio * 25);
        if (common.length > 0) reasons.push(`${common.length} shared interests`);
    }

    // Relationship goal alignment (15 points)
    if (user1.relationshipGoal && user2.relationshipGoal) {
        if (user1.relationshipGoal === user2.relationshipGoal) {
            score += 15;
            reasons.push("Same relationship goal");
        }
    }

    // Lifestyle compatibility (15 points)
    if (user1.lifestyle && user2.lifestyle) {
        if (user1.lifestyle === user2.lifestyle) {
            score += 8;
            reasons.push("Similar lifestyle");
        }
    }
    if (user1.smoking && user2.smoking) {
        if (user1.smoking === user2.smoking) {
            score += 4;
            reasons.push("Same smoking preference");
        }
    }
    if (user1.drinking && user2.drinking) {
        if (user1.drinking === user2.drinking) {
            score += 3;
            reasons.push("Same drinking preference");
        }
    }

    // Education compatibility (5 points)
    if (user1.education && user2.education) {
        if (user1.education === user2.education) {
            score += 5;
            reasons.push("Similar education level");
        }
    }

    // Religion compatibility (5 points)
    if (user1.religion && user2.religion) {
        if (user1.religion === user2.religion) {
            score += 5;
            reasons.push("Same religion");
        }
    }

    return { score: Math.min(100, score), reasons };
};

// ─── Get Daily Recommendations ────────────────────────────────────────────────
export const getDailyRecommendations = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    // Get already interacted users
    const interactions = await Match.find({
        $or: [{ userId }, { matchedUserId: userId }],
    }).lean();
    const interactedIds = new Set();
    interactions.forEach(i => {
        interactedIds.add(i.userId.toString());
        interactedIds.add(i.matchedUserId.toString());
    });

    // Find potential matches
    const query = {
        _id: { $nin: [userId, ...Array.from(interactedIds)] },
        isActive: true,
        isBanned: false,
        emailVerified: true,
        isMember: true,
        profileCompletion: { $gte: 50 },
    };

    // Gender preference
    if (user.lookingFor === "men") query.gender = "male";
    else if (user.lookingFor === "women") query.gender = "female";
    else if (user.lookingFor === "both") query.gender = { $in: ["male", "female"] };

    // Age preference
    if (user.minAge || user.maxAge) {
        query.age = {};
        if (user.minAge) query.age.$gte = user.minAge;
        if (user.maxAge) query.age.$lte = user.maxAge;
    }

    const candidates = await User.find(query)
        .select("-password -refreshTokens -verificationToken -twoFactorSecret")
        .limit(100)
        .lean();

    // Score and sort
    const scored = candidates.map(c => {
        const { score, reasons } = calculateCompatibility(user, c);
        return { ...c, compatibilityScore: score, compatibilityReasons: reasons };
    });

    scored.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    return scored.slice(0, limit);
};

// ─── Get Suggested Matches ────────────────────────────────────────────────────
export const getSuggestedMatches = async (userId, limit = 10) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    const recommendations = await getDailyRecommendations(userId, limit * 3);

    // Boost users with similar interests
    if (user.interests?.length) {
        recommendations.sort((a, b) => {
            const aCommon = a.interests?.filter(i => user.interests.includes(i)).length || 0;
            const bCommon = b.interests?.filter(i => user.interests.includes(i)).length || 0;
            return bCommon - aCommon || b.compatibilityScore - a.compatibilityScore;
        });
    }

    return recommendations.slice(0, limit);
};

// ─── Get Nearby Users ─────────────────────────────────────────────────────────
export const getNearbyUsers = async (userId, maxDistanceKm = 50, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user || !user.latitude || !user.longitude) return [];

    const interactions = await Match.find({
        $or: [{ userId }, { matchedUserId: userId }],
    }).lean();
    const interactedIds = new Set();
    interactions.forEach(i => {
        interactedIds.add(i.userId.toString());
        interactedIds.add(i.matchedUserId.toString());
    });

    // Approximate: 1 degree latitude ≈ 111km
    const latRange = maxDistanceKm / 111;
    const lonRange = maxDistanceKm / (111 * Math.cos(user.latitude * Math.PI / 180));

    const nearby = await User.find({
        _id: { $nin: [userId, ...Array.from(interactedIds)] },
        isActive: true,
        isBanned: false,
        isMember: true,
        latitude: { $gte: user.latitude - latRange, $lte: user.latitude + latRange },
        longitude: { $gte: user.longitude - lonRange, $lte: user.longitude + lonRange },
    })
        .select("-password -refreshTokens -verificationToken -twoFactorSecret")
        .limit(limit)
        .lean();

    // Calculate actual distances
    return nearby.map(u => {
        const { score, reasons } = calculateCompatibility(user, u);
        const dist = getDistance(user.latitude, user.longitude, u.latitude, u.longitude);
        return { ...u, distance: Math.round(dist), compatibilityScore: score, compatibilityReasons: reasons };
    }).sort((a, b) => a.distance - b.distance);
};

// ─── Get Trending Profiles ────────────────────────────────────────────────────
export const getTrendingProfiles = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    const interactions = await Match.find({
        $or: [{ userId }, { matchedUserId: userId }],
    }).lean();
    const interactedIds = new Set();
    interactions.forEach(i => {
        interactedIds.add(i.userId.toString());
        interactedIds.add(i.matchedUserId.toString());
    });

    // Trending = most profile views in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const trendingIds = await ProfileView.aggregate([
        { $match: { viewedAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: "$viewedUserId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit * 2 },
    ]);

    const ids = trendingIds.map(t => t._id).filter(id => !interactedIds.has(id.toString()) && id.toString() !== userId);
    const users = await User.find({ _id: { $in: ids } })
        .select("-password -refreshTokens -verificationToken -twoFactorSecret")
        .lean();

    return users.map(u => {
        const { score, reasons } = calculateCompatibility(user, u);
        return { ...u, compatibilityScore: score, compatibilityReasons: reasons };
    }).slice(0, limit);
};

// ─── Get Recently Joined ──────────────────────────────────────────────────────
export const getRecentlyJoined = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    const interactions = await Match.find({
        $or: [{ userId }, { matchedUserId: userId }],
    }).lean();
    const interactedIds = new Set();
    interactions.forEach(i => {
        interactedIds.add(i.userId.toString());
        interactedIds.add(i.matchedUserId.toString());
    });

    const recent = await User.find({
        _id: { $nin: [userId, ...Array.from(interactedIds)] },
        isActive: true,
        isBanned: false,
        isMember: true,
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("-password -refreshTokens -verificationToken -twoFactorSecret")
        .lean();

    return recent.map(u => {
        const { score, reasons } = calculateCompatibility(user, u);
        return { ...u, compatibilityScore: score, compatibilityReasons: reasons };
    });
};

// ─── Get Most Active Users ────────────────────────────────────────────────────
export const getMostActiveUsers = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    const interactions = await Match.find({
        $or: [{ userId }, { matchedUserId: userId }],
    }).lean();
    const interactedIds = new Set();
    interactions.forEach(i => {
        interactedIds.add(i.userId.toString());
        interactedIds.add(i.matchedUserId.toString());
    });

    const active = await User.find({
        _id: { $nin: [userId, ...Array.from(interactedIds)] },
        isActive: true,
        isBanned: false,
        isMember: true,
        lastSeen: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
        .sort({ lastSeen: -1 })
        .limit(limit)
        .select("-password -refreshTokens -verificationToken -twoFactorSecret")
        .lean();

    return active.map(u => {
        const { score, reasons } = calculateCompatibility(user, u);
        return { ...u, compatibilityScore: score, compatibilityReasons: reasons };
    });
};

// ─── Get Personalized Recommendations ─────────────────────────────────────────
export const getPersonalizedRecommendations = async (userId, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    // Get users they've liked before for pattern matching
    const likedUsers = await Match.find({ userId, status: { $in: ["liked", "superliked", "matched"] } })
        .populate("matchedUserId", "interests age gender country city")
        .lean();

    // Extract patterns from liked users
    const likedPatterns = {
        interests: new Set(),
        countries: new Set(),
        cities: new Set(),
    };
    likedUsers.forEach(m => {
        const u = m.matchedUserId;
        if (u?.interests) u.interests.forEach(i => likedPatterns.interests.add(i));
        if (u?.country) likedPatterns.countries.add(u.country);
        if (u?.city) likedPatterns.cities.add(u.city);
    });

    const recommendations = await getDailyRecommendations(userId, limit * 3);

    // Boost users matching liked patterns
    recommendations.sort((a, b) => {
        let aBoost = 0, bBoost = 0;
        if (a.interests?.some(i => likedPatterns.interests.has(i))) aBoost += 15;
        if (b.interests?.some(i => likedPatterns.interests.has(i))) bBoost += 15;
        if (likedPatterns.countries.has(a.country)) aBoost += 10;
        if (likedPatterns.countries.has(b.country)) bBoost += 10;
        if (likedPatterns.cities.has(a.city)) aBoost += 5;
        if (likedPatterns.cities.has(b.city)) bBoost += 5;
        return (b.compatibilityScore + bBoost) - (a.compatibilityScore + aBoost);
    });

    return recommendations.slice(0, limit);
};

// ─── Get Match Score Explanation ──────────────────────────────────────────────
export const getMatchScoreExplanation = async (userId, targetUserId) => {
    const [user, target] = await Promise.all([
        User.findById(userId).lean(),
        User.findById(targetUserId).lean(),
    ]);
    if (!user || !target) return { score: 0, reasons: [] };

    return calculateCompatibility(user, target);
};

// ─── Helper: Haversine distance ───────────────────────────────────────────────
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export default {
    calculateCompatibility,
    getDailyRecommendations,
    getSuggestedMatches,
    getNearbyUsers,
    getTrendingProfiles,
    getRecentlyJoined,
    getMostActiveUsers,
    getPersonalizedRecommendations,
    getMatchScoreExplanation,
};