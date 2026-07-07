/**
 * advancedFeaturesService.js
 *
 * Service layer for Phase 4 advanced dating features:
 *   - Profile visits / visitors
 *   - Profile completion scoring
 *   - AI profile suggestions & icebreakers
 *   - Compatibility percentage
 *   - Verification badge
 *   - Smart recommendations
 *   - Daily picks
 *   - Height & distance filtering
 *   - Incognito mode
 *   - Block list management
 *   - Fake profile detection (score-based heuristics)
 *   - Boost profile scheduler
 */

import { User } from "../models/User.js";
import { ProfileView } from "../models/ProfileView.js";
import { Match } from "../models/Match.js";
import { VoiceIntroduction } from "../models/VoiceIntroduction.js";
import { IncognitoMode } from "../models/IncognitoMode.js";
import { FakeProfileReport } from "../models/FakeProfileReport.js";
import { Story } from "../models/Story.js";

// ─── PROFILE COMPLETION SCORING ─────────────────────────────────────────────

const PROFILE_WEIGHTS = {
    profilePicture: 15,
    photos: 10,
    aboutMe: 10,
    bio: 5,
    occupation: 5,
    education: 5,
    interests: 10,
    languages: 5,
    relationshipGoal: 5,
    religion: 3,
    smoking: 3,
    drinking: 3,
    hasChildren: 3,
    wantsChildren: 3,
    height: 5,
    voiceIntroduction: 5,
    city: 3,
    country: 3,
    dateOfBirth: 5,
    gender: 3,
};

export const calculateProfileCompletion = (user) => {
    if (!user) return 0;
    let score = 0;

    if (user.profilePicture) score += PROFILE_WEIGHTS.profilePicture;
    if (user.photos && user.photos.length >= 2) score += PROFILE_WEIGHTS.photos;
    if (user.aboutMe && user.aboutMe.length > 20) score += PROFILE_WEIGHTS.aboutMe;
    if (user.bio && user.bio.length > 10) score += PROFILE_WEIGHTS.bio;
    if (user.occupation) score += PROFILE_WEIGHTS.occupation;
    if (user.education) score += PROFILE_WEIGHTS.education;
    if (user.interests && user.interests.length >= 3) score += PROFILE_WEIGHTS.interests;
    if (user.languages && user.languages.length > 0) score += PROFILE_WEIGHTS.languages;
    if (user.relationshipGoal) score += PROFILE_WEIGHTS.relationshipGoal;
    if (user.religion) score += PROFILE_WEIGHTS.religion;
    if (user.smoking) score += PROFILE_WEIGHTS.smoking;
    if (user.drinking) score += PROFILE_WEIGHTS.drinking;
    if (user.hasChildren) score += PROFILE_WEIGHTS.hasChildren;
    if (user.wantsChildren) score += PROFILE_WEIGHTS.wantsChildren;
    if (user.height) score += PROFILE_WEIGHTS.height;
    if (user.city) score += PROFILE_WEIGHTS.city;
    if (user.country) score += PROFILE_WEIGHTS.country;
    if (user.dateOfBirth) score += PROFILE_WEIGHTS.dateOfBirth;
    if (user.gender) score += PROFILE_WEIGHTS.gender;

    return Math.min(100, score);
};

// ─── PROFILE VISITORS ───────────────────────────────────────────────────────

export const recordProfileView = async (viewerId, profileOwnerId) => {
    // Check if viewer has incognito mode enabled
    const incognito = await IncognitoMode.findOne({
        userId: viewerId,
        isEnabled: true,
        expiresAt: { $gt: new Date() },
    });

    const isIncognito = !!incognito;

    // Upsert to avoid duplicates — update viewedAt
    const view = await ProfileView.findOneAndUpdate(
        { viewerId, profileOwnerId },
        { viewedAt: new Date(), isIncognito },
        { upsert: true, new: true }
    );

    // If not incognito, notify the profile owner
    if (!isIncognito && global.io) {
        global.io.to(`user:${profileOwnerId}`).emit("profile_viewed", {
            viewerId,
            viewedAt: view.viewedAt,
        });
    }

    return view;
};

export const getProfileVisitors = async (userId, limit = 20, page = 1) => {
    const skip = (page - 1) * limit;
    const views = await ProfileView.find({ profileOwnerId: userId, isIncognito: false })
        .sort({ viewedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("viewerId", "firstName lastName profilePicture age city country occupation")
        .lean();

    const total = await ProfileView.countDocuments({ profileOwnerId: userId, isIncognito: false });

    return {
        visitors: views.map(v => ({
            user: v.viewerId,
            viewedAt: v.viewedAt,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
};

export const getProfileViewCount = async (userId) => {
    return ProfileView.countDocuments({ profileOwnerId: userId, isIncognito: false });
};

// ─── WHO LIKED ME ──────────────────────────────────────────────────────────

export const getWhoLikedMe = async (userId, limit = 20, page = 1) => {
    const skip = (page - 1) * limit;
    const likes = await Match.find({
        matchedUserId: userId,
        userLiked: true,
        status: { $in: ["liked", "superliked"] },
    })
        .sort({ userLikedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "firstName lastName profilePicture photos age city country occupation interests isPremium premiumTier")
        .lean();

    const total = await Match.countDocuments({
        matchedUserId: userId,
        userLiked: true,
        status: { $in: ["liked", "superliked"] },
    });

    return {
        likes: likes.map(l => ({
            user: l.userId,
            likedAt: l.userLikedAt,
            isSuperLike: l.status === "superliked",
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
};

// ─── AI PROFILE SUGGESTIONS ────────────────────────────────────────────────

export const generateProfileSuggestions = async (userId) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    const suggestions = [];

    // Analyze profile completion
    const completion = calculateProfileCompletion(user);

    if (completion < 50) {
        if (!user.profilePicture) {
            suggestions.push({
                type: "photo",
                priority: 1,
                title: "Add a Profile Photo",
                description: "Profiles with photos get 10x more matches! Upload a clear, recent photo.",
                icon: "📸",
            });
        }
        if (!user.aboutMe || user.aboutMe.length < 20) {
            suggestions.push({
                type: "about",
                priority: 2,
                title: "Write a Better Bio",
                description: "Tell people about yourself! Include your hobbies, what you do, and what you're looking for.",
                icon: "✍️",
            });
        }
        if (!user.interests || user.interests.length < 3) {
            suggestions.push({
                type: "interests",
                priority: 3,
                title: "Add Your Interests",
                description: "Add at least 3 interests to help find compatible matches.",
                icon: "🎯",
            });
        }
    }

    if (!user.occupation) {
        suggestions.push({
            type: "occupation",
            priority: 4,
            title: "Add Your Occupation",
            description: "Let people know what you do — it's a great conversation starter.",
            icon: "💼",
        });
    }

    if (!user.education) {
        suggestions.push({
            type: "education",
            priority: 5,
            title: "Add Your Education",
            description: "Share your educational background to find like-minded people.",
            icon: "🎓",
        });
    }

    if (!user.relationshipGoal) {
        suggestions.push({
            type: "goal",
            priority: 6,
            title: "Set Your Relationship Goal",
            description: "Let others know what you're looking for — casual dating, serious relationship, etc.",
            icon: "💕",
        });
    }

    if (user.photos && user.photos.length < 3) {
        suggestions.push({
            type: "more_photos",
            priority: 7,
            title: "Add More Photos",
            description: "Profiles with 3+ photos get significantly more engagement.",
            icon: "🖼️",
        });
    }

    return suggestions;
};

// ─── AI ICEBREAKER SUGGESTIONS ─────────────────────────────────────────────

export const generateIcebreakers = async (currentUserId, targetUserId) => {
    const [currentUser, targetUser] = await Promise.all([
        User.findById(currentUserId).lean(),
        User.findById(targetUserId).lean(),
    ]);

    if (!currentUser || !targetUser) return [];

    const icebreakers = [];

    // Based on shared interests
    const sharedInterests = (currentUser.interests || []).filter(
        i => (targetUser.interests || []).includes(i)
    );

    if (sharedInterests.length > 0) {
        const interest = sharedInterests[0];
        icebreakers.push({
            type: "shared_interest",
            text: `I noticed you're into ${interest} too! What got you started with it?`,
            emoji: "🎯",
        });
        if (sharedInterests.length > 1) {
            icebreakers.push({
                type: "shared_interest",
                text: `${sharedInterests.slice(0, 3).join(", ")} — we have a lot in common! What's your favorite thing about them?`,
                emoji: "✨",
            });
        }
    }

    // Based on occupation
    if (targetUser.occupation) {
        icebreakers.push({
            type: "occupation",
            text: `${targetUser.occupation} sounds fascinating! What does a typical day look like for you?`,
            emoji: "💼",
        });
    }

    // Based on photos
    if (targetUser.profilePicture) {
        icebreakers.push({
            type: "photo",
            text: "Love your profile picture! Where was it taken?",
            emoji: "📸",
        });
    }

    // Based on education
    if (targetUser.education) {
        icebreakers.push({
            type: "education",
            text: `I see you studied ${targetUser.education.replace("_", " ")} — what did you enjoy most about it?`,
            emoji: "🎓",
        });
    }

    // Based on travel / location
    if (targetUser.city && targetUser.country) {
        icebreakers.push({
            type: "location",
            text: `How's life in ${targetUser.city}, ${targetUser.country}? Any hidden gems I should know about?`,
            emoji: "🌍",
        });
    }

    // Generic fallback
    if (icebreakers.length === 0) {
        icebreakers.push({
            type: "general",
            text: "Hey! I really liked your profile — what's something you're passionate about?",
            emoji: "👋",
        });
        icebreakers.push({
            type: "general",
            text: "Hi there! If you could travel anywhere tomorrow, where would you go?",
            emoji: "✈️",
        });
    }

    return icebreakers;
};

// ─── SMART RECOMMENDATIONS ─────────────────────────────────────────────────

export const getSmartRecommendations = async (userId, limit = 10) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    const baseQuery = {
        _id: { $ne: user._id },
        isBanned: { $ne: true },
        deletedAt: { $exists: false },
        emailVerified: true,
        "privacySettings.profileVisible": { $ne: false },
    };

    // Get users the current user has already interacted with
    const acted = await Match.find({ userId }).select("matchedUserId").lean();
    const actedIds = acted.map(m => m.matchedUserId.toString());
    if (actedIds.length > 0) {
        baseQuery._id = { $ne: user._id, $nin: actedIds };
    }

    // Build recommendation scoring pipeline
    const candidates = await User.aggregate([
        { $match: baseQuery },
        {
            $addFields: {
                // Shared interests score
                sharedInterests: {
                    $size: {
                        $ifNull: [{ $setIntersection: ["$interests", user.interests || []] }, []],
                    },
                },
                // Location match
                sameCountry: { $cond: [{ $eq: ["$country", user.country] }, 1, 0] },
                // Age preference match
                ageInRange: {
                    $cond: [
                        {
                            $and: [
                                { $gte: ["$age", user.minAge || 18] },
                                { $lte: ["$age", user.maxAge || 99] },
                            ],
                        },
                        1,
                        0,
                    ],
                },
                // Gender preference match
                genderMatch: {
                    $cond: [
                        {
                            $or: [
                                { $eq: [user.lookingFor || "both", "both"] },
                                {
                                    $and: [
                                        { $eq: ["$gender", user.lookingFor === "men" ? "male" : "female"] },
                                    ],
                                },
                            ],
                        },
                        1,
                        0,
                    ],
                },
                // Profile completeness
                profileScore: { $ifNull: ["$profileCompletion", 0] },
                // Recently active bonus
                recentlyActive: {
                    $cond: [
                        { $gte: ["$lastLogin", new Date(Date.now() - 7 * 86400000)] },
                        1,
                        0,
                    ],
                },
                // Premium boost
                premiumBoost: { $cond: ["$isPremium", 1, 0] },
            },
        },
        {
            $addFields: {
                recommendationScore: {
                    $add: [
                        { $multiply: ["$sharedInterests", 15] },
                        { $multiply: ["$sameCountry", 10] },
                        { $multiply: ["$ageInRange", 20] },
                        { $multiply: ["$genderMatch", 20] },
                        { $multiply: ["$profileScore", 0.2] },
                        { $multiply: ["$recentlyActive", 15] },
                        { $multiply: ["$premiumBoost", 10] },
                    ],
                },
            },
        },
        { $sort: { recommendationScore: -1, lastLogin: -1 } },
        { $limit: limit },
        {
            $project: {
                password: 0,
                verificationToken: 0,
                refreshTokens: 0,
            },
        },
    ]);

    return candidates;
};

// ─── DAILY PICKS ──────────────────────────────────────────────────────────

export const getDailyPicks = async (userId, limit = 10) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    // Get top recommended users for the day
    const recommendations = await getSmartRecommendations(userId, limit);

    // Enhance with compatibility scores
    const picks = recommendations.map((pick) => {
        const sharedInterests = (pick.interests || []).filter(
            i => (user.interests || []).includes(i)
        ).length;
        const maxInterests = Math.max((user.interests || []).length, (pick.interests || []).length, 1);
        const compatibilityScore = Math.round(
            (sharedInterests / maxInterests) * 50 +
            (pick.sameCountry ? 15 : 0) +
            (pick.ageInRange ? 20 : 0) +
            (pick.genderMatch ? 15 : 0)
        );

        return {
            ...pick,
            compatibilityScore: Math.min(99, compatibilityScore),
            isDailyPick: true,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };
    });

    return picks;
};

// ─── DISTANCE FILTER ──────────────────────────────────────────────────────

export const getUsersByDistance = async (userId, maxDistanceKm = 50, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user || !user.latitude || !user.longitude) return [];

    const degreesPerKm = 1 / 111.32;
    const delta = maxDistanceKm * degreesPerKm;

    const query = {
        _id: { $ne: user._id },
        isBanned: { $ne: true },
        emailVerified: true,
        latitude: {
            $gte: user.latitude - delta,
            $lte: user.latitude + delta,
        },
        longitude: {
            $gte: user.longitude - delta,
            $lte: user.longitude + delta,
        },
    };

    const users = await User.find(query)
        .select("-password -verificationToken -refreshTokens")
        .limit(limit)
        .lean();

    // Calculate actual distance
    return users.map(u => {
        const distance = calculateDistance(
            user.latitude, user.longitude,
            u.latitude, u.longitude
        );
        return { ...u, distanceKm: Math.round(distance * 10) / 10 };
    }).filter(u => u.distanceKm <= maxDistanceKm);
};

// ─── HEIGHT FILTER ────────────────────────────────────────────────────────

export const getUsersByHeight = async (userId, minHeight, maxHeight, limit = 20) => {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    const query = {
        _id: { $ne: user._id },
        isBanned: { $ne: true },
        emailVerified: true,
        height: { $gte: minHeight, $lte: maxHeight },
    };

    return User.find(query)
        .select("-password -verificationToken -refreshTokens")
        .limit(limit)
        .lean();
};

// ─── VERIFICATION BADGE ───────────────────────────────────────────────────

export const getVerificationBadge = (user) => {
    if (!user) return null;

    const badges = [];

    if (user.emailVerified) {
        badges.push({
            type: "email",
            label: "Email Verified",
            icon: "📧",
            verified: true,
        });
    }

    if (user.isPremium) {
        badges.push({
            type: "premium",
            label: `Premium ${user.premiumTier.charAt(0).toUpperCase() + user.premiumTier.slice(1)}`,
            icon: "⭐",
            verified: true,
        });
    }

    if (user.phone) {
        badges.push({
            type: "phone",
            label: "Phone Verified",
            icon: "📱",
            verified: true,
        });
    }

    // Profile verification — completed profile with photo
    const completion = calculateProfileCompletion(user);
    if (completion >= 80 && user.profilePicture) {
        badges.push({
            type: "profile",
            label: "Profile Verified",
            icon: "✅",
            verified: true,
        });
    }

    return badges;
};

// ─── BLOCK LIST ──────────────────────────────────────────────────────────

export const getBlockList = async (userId, limit = 20, page = 1) => {
    const user = await User.findById(userId)
        .populate({
            path: "blocked",
            select: "firstName lastName profilePicture age city country occupation",
            options: { limit, skip: (page - 1) * limit },
        })
        .lean();

    if (!user) return { blocked: [], total: 0 };

    return {
        blocked: user.blocked || [],
        total: (user.blocked || []).length,
        page,
    };
};

export const unblockUser = async (userId, blockedUserId) => {
    return User.findByIdAndUpdate(
        userId,
        { $pull: { blocked: blockedUserId } },
        { new: true }
    );
};

// ─── BOOST PROFILE ────────────────────────────────────────────────────────

export const boostProfile = async (userId, durationHours = 1) => {
    const boostExpires = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    await User.findByIdAndUpdate(userId, { boostExpires });

    // Notify via socket
    if (global.io) {
        global.io.to(`user:${userId}`).emit("profile_boosted", {
            boostExpires,
            durationHours,
        });
    }

    return { boostExpires, durationHours };
};

export const getBoostStatus = async (userId) => {
    const user = await User.findById(userId).select("boostExpires isPremium premiumTier").lean();
    if (!user || !user.boostExpires) return { isBoosted: false };

    const now = new Date();
    const isBoosted = user.boostExpires > now;

    return {
        isBoosted,
        boostExpires: user.boostExpires,
        remainingMinutes: isBoosted
            ? Math.round((user.boostExpires - now) / 60000)
            : 0,
        canBoost: user.isPremium,
    };
};

// ─── INCognito MODE ──────────────────────────────────────────────────────

export const toggleIncognitoMode = async (userId, enabled) => {
    const incognito = await IncognitoMode.findOneAndUpdate(
        { userId },
        {
            isEnabled: enabled,
            startedAt: enabled ? new Date() : undefined,
            expiresAt: enabled ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined,
        },
        { upsert: true, new: true }
    );

    return incognito;
};

export const getIncognitoStatus = async (userId) => {
    const incognito = await IncognitoMode.findOne({ userId }).lean();
    if (!incognito) return { isEnabled: false };

    const isActive = incognito.isEnabled && incognito.expiresAt > new Date();

    // Auto-disable if expired
    if (incognito.isEnabled && !isActive) {
        await IncognitoMode.findOneAndUpdate({ userId }, { isEnabled: false });
        return { isEnabled: false };
    }

    return {
        isEnabled: isActive,
        expiresAt: incognito.expiresAt,
        remainingHours: isActive
            ? Math.round((incognito.expiresAt - new Date()) / 3600000)
            : 0,
    };
};

// ─── FAKE PROFILE DETECTION ──────────────────────────────────────────────

export const analyzeFakeProfile = async (userId) => {
    const user = await User.findById(userId).lean();
    if (!user) return { score: 0, isLikelyFake: false };

    let suspiciousScore = 0;
    const flags = [];

    // Check 1: No profile picture
    if (!user.profilePicture) {
        suspiciousScore += 20;
        flags.push("No profile picture");
    }

    // Check 2: Incomplete profile
    const completion = calculateProfileCompletion(user);
    if (completion < 30) {
        suspiciousScore += 15;
        flags.push("Very incomplete profile");
    }

    // Check 3: No bio / about me
    if (!user.aboutMe && !user.bio) {
        suspiciousScore += 10;
        flags.push("No bio or description");
    }

    // Check 4: Very new account with activity
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    const accountAgeDays = accountAge / 86400000;
    if (accountAgeDays < 1) {
        suspiciousScore += 10;
        flags.push("Account less than 24 hours old");
    }

    // Check 5: No interests
    if (!user.interests || user.interests.length === 0) {
        suspiciousScore += 5;
        flags.push("No interests listed");
    }

    // Check 6: Suspicious age (very young/old)
    if (user.age && (user.age < 18 || user.age > 100)) {
        suspiciousScore += 15;
        flags.push("Suspicious age");
    }

    // Check 7: No location data
    if (!user.city && !user.country) {
        suspiciousScore += 10;
        flags.push("No location provided");
    }

    // Check 8: Report count
    if (user.reportCount > 5) {
        suspiciousScore += 20;
        flags.push("Multiple reports");
    } else if (user.reportCount > 2) {
        suspiciousScore += 10;
        flags.push("Several reports");
    }

    // Check 9: Single photo only (no variety)
    if (user.profilePicture && (!user.photos || user.photos.length === 0)) {
        suspiciousScore += 5;
        flags.push("Only one photo");
    }

    return {
        score: Math.min(100, suspiciousScore),
        isLikelyFake: suspiciousScore >= 50,
        flags,
        details: {
            profileCompletion: completion,
            accountAgeDays: Math.round(accountAgeDays),
            reportCount: user.reportCount || 0,
        },
    };
};

// ─── HELPERS ─────────────────────────────────────────────────────────────

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toRad = (deg) => deg * (Math.PI / 180);