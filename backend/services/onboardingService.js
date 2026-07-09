/**
 * onboardingService.js
 *
 * Activated automatically when a user verifies their email.
 * Responsibilities:
 *   1. Compute profile-completion score
 *   2. Set isMember = true, memberSince, onboardingComplete
 *   3. Ensure isActive = true
 *   4. Apply default privacy settings
 *   5. Auto-flag if report threshold already exceeded (edge-case guard)
 */

// Weighted fields that contribute to the completion score (max 100)
const COMPLETION_WEIGHTS = [
    { field: "profilePicture", weight: 12 },
    { field: "photos", weight: 8, isArray: true, minCount: 2 },
    { field: "aboutMe", weight: 10 },
    { field: "occupation", weight: 5 },
    { field: "education", weight: 5 },
    { field: "interests", weight: 8, isArray: true },
    { field: "hobbies", weight: 5, isArray: true },
    { field: "languages", weight: 3, isArray: true },
    { field: "gender", weight: 3 },
    { field: "lookingFor", weight: 3 },
    { field: "country", weight: 3 },
    { field: "city", weight: 3 },
    { field: "relationshipGoal", weight: 4 },
    { field: "religion", weight: 3 },
    { field: "height", weight: 3 },
    { field: "smoking", weight: 2 },
    { field: "drinking", weight: 2 },
    { field: "favoriteMusic", weight: 2, isArray: true },
    { field: "favoriteMovies", weight: 2, isArray: true },
    { field: "favoriteSports", weight: 2, isArray: true },
    { field: "dateOfBirth", weight: 3 },
    { field: "zodiacSign", weight: 2 },
    { field: "tribe", weight: 3 },
];

/**
 * Compute a 0-100 profile completion score for a user document.
 */
export const computeProfileCompletion = (user) => {
    let score = 0;
    for (const { field, weight, isArray } of COMPLETION_WEIGHTS) {
        const val = user[field];
        if (isArray ? (Array.isArray(val) && val.length > 0) : (val && String(val).trim() !== "")) {
            score += weight;
        }
    }
    return Math.min(100, score);
};

/**
 * Run the full onboarding sequence for a newly verified user.
 * Mutates and saves the user document.
 *
 * @param {import('../models/User.js').User} user  — Mongoose document
 * @returns {Promise<void>}
 */
export const onboardMember = async (user) => {
    const now = new Date();

    // 1. Mark as verified member
    user.emailVerified = true;
    user.isMember = true;
    user.isActive = true;
    user.onboardingComplete = true;
    user.memberSince = user.memberSince || now; // preserve if re-verifying

    // 2. Clear OTP tokens
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;

    // 3. Profile completion score
    user.profileCompletion = computeProfileCompletion(user);

    // 4. Default privacy settings (only set fields that are still at defaults)
    if (!user.privacySettings) user.privacySettings = {};
    const ps = user.privacySettings;
    if (ps.showOnlineStatus === undefined) ps.showOnlineStatus = true;
    if (ps.showLastSeen === undefined) ps.showLastSeen = true;
    if (ps.showLocation === undefined) ps.showLocation = true;
    if (ps.showAge === undefined) ps.showAge = true;
    if (ps.profileVisible === undefined) ps.profileVisible = true;
    if (ps.showInSearch === undefined) ps.showInSearch = true;
    if (ps.allowMessageFrom === undefined) ps.allowMessageFrom = "matches_only";

    // 5. Auto-moderation guard: flag if already has reports from a previous attempt
    if (user.reportCount >= 3 && !user.flaggedForReview) {
        user.flaggedForReview = true;
        user.isActive = false; // hold pending review
        console.warn(`[Onboarding] User ${user._id} flagged on verification — report count: ${user.reportCount}`);
    }

    await user.save();

    console.log(`[Onboarding] ✅ Member activated: ${user._id} | ${user.email} | completion: ${user.profileCompletion}%`);
};
