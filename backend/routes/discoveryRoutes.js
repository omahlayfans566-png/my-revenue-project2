import express from "express";
import { User } from "../models/User.js";
import { Match } from "../models/Match.js";
import { authenticateToken } from "../middleware/auth.js";
import { calculateCompatibility } from "../services/matchingService.js";

const router = express.Router();

const PUBLIC_FIELDS =
    "-password -verificationToken -verificationTokenExpires -passwordResetToken -passwordResetExpires -refreshTokens";

// ── GET /discover ──────────────────────────────────────────────────────────────
// Main discovery endpoint with full filter support
// Query params: page, limit, distance, minAge, maxAge, gender, lookingFor,
//               online, recentlyActive, verifiedOnly, interests, relationshipGoal,
//               religion, occupation, education, heightMin, heightMax
router.get("/", authenticateToken, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.userId).lean();
        if (!currentUser) return res.status(404).json({ success: false, message: "User not found" });

        const {
            page = 1,
            limit = 20,
            distance,
            minAge,
            maxAge,
            gender,
            lookingFor,
            online,
            recentlyActive,
            verifiedOnly,
            interests,
            relationshipGoal,
            religion,
            occupation,
            education,
            heightMin,
            heightMax,
        } = req.query;

        // ── Build base query ────────────────────────────────────────────────
        const query = {
            _id: { $ne: currentUser._id },
            emailVerified: true,
            isBanned: false,
            isActive: true,
            "privacySettings.profileVisible": { $ne: false },
            blocked: { $nin: [currentUser._id] },
        };

        // ── Diagnostic: log total before filters ─────────────────────────────
        const totalBeforeFilters = await User.countDocuments({ _id: { $ne: currentUser._id } });
        console.log(`[Discovery] total users in DB (excl. self): ${totalBeforeFilters}`);

        const banned = await User.countDocuments({ _id: { $ne: currentUser._id }, isBanned: false, isActive: true });
        console.log(`[Discovery] after active+banned filter: ${banned}`);

        const verified = await User.countDocuments({ _id: { $ne: currentUser._id }, isBanned: false, isActive: true, emailVerified: true });
        console.log(`[Discovery] after emailVerified filter: ${verified}`);

        // ── Gender filter ────────────────────────────────────────────────────
        // Only filter by gender if explicitly requested in query param.
        // Do NOT auto-apply from currentUser.lookingFor — this silently excludes
        // users who haven't set their gender field.
        if (gender) {
            query.gender = gender;
            console.log(`[Discovery] gender filter applied: ${gender}`);
        }
        // NOTE: lookingFor-based gender filtering is intentionally removed.
        // It excluded candidates who hadn't filled in the gender field.

        // ── Looking for filter ───────────────────────────────────────────────
        if (lookingFor) {
            query.lookingFor = lookingFor;
        }

        // ── Age filter ───────────────────────────────────────────────────────
        // ONLY apply if explicitly requested via query param OR if the current
        // user has minAge/maxAge set. NEVER assume age = 18-100 as a hard filter
        // because many registered users don't have an `age` field set yet.
        const ageMin = parseInt(minAge) || currentUser.minAge || null;
        const ageMax = parseInt(maxAge) || currentUser.maxAge || null;
        if (ageMin && ageMax && ageMin < ageMax) {
            // Include users with no age set so we never accidentally exclude everyone
            query.$or = query.$or
                ? [{ $and: [{ age: { $gte: ageMin, $lte: ageMax } }] }, { age: { $exists: false } }, { age: null }]
                : [{ age: { $gte: ageMin, $lte: ageMax } }, { age: { $exists: false } }, { age: null }];
            console.log(`[Discovery] age filter applied: ${ageMin}-${ageMax} (includes null age)`);
        }

        // ── Online now filter ────────────────────────────────────────────────
        if (online === "true") {
            const onlineIds = global.onlineUsers ? Array.from(global.onlineUsers.keys()) : [];
            if (onlineIds.length > 0) {
                query._id = { $in: onlineIds, $ne: currentUser._id };
            } else {
                // Fallback: active in last 15 minutes
                query.lastLogin = { $gte: new Date(Date.now() - 15 * 60 * 1000) };
            }
        }

        // ── Recently active filter (last 24h) ────────────────────────────────
        if (recentlyActive === "true") {
            query.lastLogin = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
        }

        // ── Verified only filter ─────────────────────────────────────────────
        if (verifiedOnly === "true") {
            query.isMember = true;
        }

        // ── Interests filter ─────────────────────────────────────────────────
        if (interests) {
            const interestList = Array.isArray(interests) ? interests : interests.split(",");
            query.interests = { $in: interestList };
        }

        // ── Relationship goal filter ─────────────────────────────────────────
        if (relationshipGoal) {
            query.relationshipGoal = relationshipGoal;
        }

        // ── Religion filter ──────────────────────────────────────────────────
        if (religion) {
            query.religion = religion;
        }

        // ── Occupation filter ────────────────────────────────────────────────
        if (occupation) {
            query.occupation = { $regex: occupation, $options: "i" };
        }

        // ── Education filter ─────────────────────────────────────────────────
        if (education) {
            query.education = education;
        }

        // ── Height filter ────────────────────────────────────────────────────
        if (heightMin || heightMax) {
            query.height = {};
            if (heightMin) query.height.$gte = parseInt(heightMin);
            if (heightMax) query.height.$lte = parseInt(heightMax);
        }

        // ── Exclude already acted-upon users ─────────────────────────────────
        const acted = await Match.find({
            $or: [
                { userId: currentUser._id },
                { matchedUserId: currentUser._id },
            ],
            status: { $in: ["liked", "matched", "rejected", "blocked", "superliked"] },
        }).select("userId matchedUserId status").lean();

        const actedIds = new Set();
        acted.forEach(m => {
            const otherId = m.userId.toString() === currentUser._id.toString()
                ? m.matchedUserId.toString()
                : m.userId.toString();
            actedIds.add(otherId);
        });

        // Also exclude users who blocked the current user
        const blockers = await User.find({
            blocked: currentUser._id,
        }).select("_id").lean();
        blockers.forEach(b => actedIds.add(b._id.toString()));

        if (actedIds.size > 0) {
            query._id = { ...(typeof query._id === 'object' ? query._id : { $ne: currentUser._id }), $nin: Array.from(actedIds) };
        }

        // ── Distance filter (geospatial) ─────────────────────────────────────
        let distanceFiltered = false;
        const distValue = distance || currentUser.preferredDistance;

        if (currentUser.latitude && currentUser.longitude && distValue && distValue !== "anywhere") {
            const distNum = parseInt(distValue);
            if (!isNaN(distNum) && distNum > 0) {
                // Convert km to approximate degree deltas
                // 1 degree latitude ≈ 111km
                // 1 degree longitude ≈ 111*cos(latitude) km
                const latDelta = distNum / 111;
                const lonDelta = distNum / (111 * Math.cos((currentUser.latitude * Math.PI) / 180));

                query.latitude = {
                    $gte: currentUser.latitude - latDelta,
                    $lte: currentUser.latitude + latDelta,
                };
                query.longitude = {
                    $gte: currentUser.longitude - lonDelta,
                    $lte: currentUser.longitude + lonDelta,
                };
                distanceFiltered = true;
            }
        }

        // ── Execute query with pagination ────────────────────────────────────
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await User.countDocuments(query);
        console.log(`[Discovery] final query total before pagination: ${total}`);

        let users = await User.find(query)
            .select(PUBLIC_FIELDS)
            .sort({ lastLogin: -1, profileCompletion: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // ── Calculate distance for each user ─────────────────────────────────
        const onlineUsersSet = global.onlineUsers ? new Set(global.onlineUsers.keys()) : new Set();

        const enriched = users.map(u => {
            let distance_km = null;
            if (currentUser.latitude && currentUser.longitude && u.latitude && u.longitude) {
                distance_km = calcDistance(
                    currentUser.latitude, currentUser.longitude,
                    u.latitude, u.longitude
                );
            }

            const compatibility = calculateCompatibility(currentUser, u);

            return {
                _id: u._id,
                firstName: u.firstName,
                lastName: u.lastName,
                profilePicture: u.profilePicture,
                photos: u.photos || [],
                age: u.age,
                city: u.city,
                country: u.country,
                state: u.state,
                latitude: u.latitude,
                longitude: u.longitude,
                occupation: u.occupation,
                education: u.education,
                aboutMe: u.aboutMe,
                bio: u.bio,
                interests: u.interests || [],
                relationshipGoal: u.relationshipGoal,
                religion: u.religion,
                religionImportance: u.religionImportance,
                languages: u.languages || [],
                smoking: u.smoking,
                drinking: u.drinking,
                hasChildren: u.hasChildren,
                wantsChildren: u.wantsChildren,
                profileCompletion: u.profileCompletion,
                isPremium: u.isPremium || false,
                premiumTier: u.premiumTier,
                isVerified: u.isMember && u.emailVerified,
                isOnline: onlineUsersSet.has(u._id.toString()),
                lastLogin: u.lastLogin,
                memberSince: u.memberSince,
                distance: distance_km ? Math.round(distance_km) : null,
                compatibilityScore: compatibility,
            };
        });

        // Sort by compatibility score for best matches first
        enriched.sort((a, b) => (b.compatibilityScore || 0) - (a.compatibilityScore || 0));

        res.json({
            success: true,
            users: enriched,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                limit: parseInt(limit),
            },
        });
    } catch (err) {
        console.error("[Discovery]", err);
        res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
});

// ── GET /discover/filters ──────────────────────────────────────────────────────
// Returns available filter options
router.get("/filters", authenticateToken, async (_req, res) => {
    try {
        const [interests, religions, occupations, educations] = await Promise.all([
            User.distinct("interests", { interests: { $exists: true, $ne: [] } }),
            User.distinct("religion", { religion: { $exists: true, $ne: "" } }),
            User.distinct("occupation", { occupation: { $exists: true, $ne: "" } }),
            User.distinct("education", { education: { $exists: true, $ne: "" } }),
        ]);

        res.json({
            success: true,
            filters: {
                interests: interests.filter(Boolean).sort(),
                religions: religions.filter(Boolean).sort(),
                occupations: occupations.filter(Boolean).sort(),
                educations: educations.filter(Boolean).sort(),
                distanceOptions: [
                    { value: "5", label: "5 km" },
                    { value: "10", label: "10 km" },
                    { value: "25", label: "25 km" },
                    { value: "50", label: "50 km" },
                    { value: "100", label: "100 km" },
                    { value: "anywhere", label: "Anywhere" },
                ],
                ageRange: { min: 18, max: 100 },
                relationshipGoals: [
                    "casual", "dating", "serious_relationship", "marriage",
                    "friendship", "open_to_anything", "not_sure_yet",
                ],
            },
        });
    } catch (err) {
        console.error("[Discovery Filters]", err);
        res.status(500).json({ success: false, message: "Failed to fetch filters" });
    }
});

// ── POST /discover/location ────────────────────────────────────────────────────
// Update user's location
router.post("/location", authenticateToken, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: "Latitude and longitude are required" });
        }

        await User.findByIdAndUpdate(req.user.userId, {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
        });

        res.json({ success: true, message: "Location updated" });
    } catch (err) {
        console.error("[Location Update]", err);
        res.status(500).json({ success: false, message: "Failed to update location" });
    }
});

// ── Haversine distance calculation ─────────────────────────────────────────────
function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

export default router;