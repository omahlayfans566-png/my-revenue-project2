import { User } from "../models/User.js";
import { Match } from "../models/Match.js";

export const getMatchSuggestions = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new Error("User not found");
        }

        // Build query based on user preferences
        const query = {
            _id: { $ne: userId },
            isActive: true,
            isBanned: false,
            emailVerified: true,
            gender: user.lookingFor === "both" ? { $in: ["male", "female"] } : user.lookingFor.slice(0, -1), // Remove 's' for singular
        };

        // Age range filter
        if (user.minAge && user.maxAge) {
            query.age = { $gte: user.minAge, $lte: user.maxAge };
        }

        // Location filter
        if (user.preferredDistance) {
            if (user.preferredDistance === "within_10km") {
                query.latitude = {
                    $gte: user.latitude - 0.1,
                    $lte: user.latitude + 0.1,
                };
                query.longitude = {
                    $gte: user.longitude - 0.1,
                    $lte: user.longitude + 0.1,
                };
            } else if (user.preferredDistance === "within_50km") {
                query.latitude = {
                    $gte: user.latitude - 0.5,
                    $lte: user.latitude + 0.5,
                };
                query.longitude = {
                    $gte: user.longitude - 0.5,
                    $lte: user.longitude + 0.5,
                };
            }
        }

        // Find users matching criteria
        let candidates = await User.find(query).limit(50);

        // Score and sort candidates based on compatibility
        const scoredCandidates = candidates.map((candidate) => {
            let score = 100;

            // Interest compatibility
            const commonInterests = user.interests.filter((interest) =>
                candidate.interests.includes(interest)
            ).length;
            score += commonInterests * 10;

            // Age proximity
            const ageDifference = Math.abs(user.age - candidate.age);
            score -= ageDifference * 2;

            // Religion compatibility
            if (user.religion === candidate.religion) {
                score += 15;
            }

            // Relationship goal compatibility
            if (user.relationshipGoal === candidate.relationshipGoal) {
                score += 20;
            }

            // Children preferences
            if (user.wantsChildren === candidate.wantsChildren) {
                score += 15;
            }

            // Premium boost
            if (candidate.isPremium) {
                score += 5;
            }

            return { user: candidate, score };
        });

        // Sort by score and exclude already viewed/matched
        const matches = await Match.find({ userId });
        const matchedUserIds = matches.map((m) => m.matchedUserId.toString());

        const suggestions = scoredCandidates
            .filter((s) => !matchedUserIds.includes(s.user._id.toString()))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((s) => ({
                _id: s.user._id,
                firstName: s.user.firstName,
                lastName: s.user.lastName,
                profilePicture: s.user.profilePicture,
                age: s.user.age,
                city: s.user.city,
                country: s.user.country,
                occupation: s.user.occupation,
                aboutMe: s.user.aboutMe,
                interests: s.user.interests,
                compatibilityScore: Math.round(s.score),
            }));

        return suggestions;
    } catch (error) {
        throw new Error(`Error getting match suggestions: ${error.message}`);
    }
};

export const calculateCompatibility = (user1, user2) => {
    let score = 0;

    // Common interests (weight: 30)
    const commonInterests = user1.interests.filter((i) =>
        user2.interests.includes(i)
    ).length;
    score += (commonInterests / Math.max(user1.interests.length, 1)) * 30;

    // Age (weight: 20)
    const ageDiff = Math.abs(user1.age - user2.age);
    score += Math.max(0, 20 - ageDiff * 0.5);

    // Religion (weight: 20)
    if (user1.religion === user2.religion) {
        score += 20;
    } else {
        score += 5;
    }

    // Relationship goals (weight: 15)
    if (user1.relationshipGoal === user2.relationshipGoal) {
        score += 15;
    } else {
        score += 5;
    }

    // Children preferences (weight: 15)
    if (user1.hasChildren === user2.hasChildren && user1.wantsChildren === user2.wantsChildren) {
        score += 15;
    } else if (user1.wantsChildren === user2.wantsChildren) {
        score += 8;
    }

    return Math.round(Math.min(100, score));
};
