import mongoose from "mongoose";

const privacySettingsSchema = new mongoose.Schema({
    showOnlineStatus: { type: Boolean, default: true },
    showLastSeen: { type: Boolean, default: true },
    showLocation: { type: Boolean, default: true },
    showAge: { type: Boolean, default: true },
    profileVisible: { type: Boolean, default: true }, // appears in discover / search
    showInSearch: { type: Boolean, default: true },
    allowMessageFrom: { type: String, enum: ["everyone", "matches_only"], default: "matches_only" },
}, { _id: false });

const userSchema = new mongoose.Schema(
    {
        // ── Account ──────────────────────────────────────────────────────────
        firstName: { type: String, required: true, trim: true },
        lastName: { type: String, required: true, trim: true },
        displayName: { type: String, trim: true },
        username: { type: String, required: true, unique: true, trim: true, lowercase: true },
        email: { type: String, required: true, unique: true, trim: true, lowercase: true },
        newEmail: { type: String, trim: true, lowercase: true }, // pending email change
        newEmailToken: String,
        newEmailTokenExpires: Date,
        phone: { type: String, trim: true },
        password: { type: String, required: true },
        passwordChangedAt: Date,

        // ── Personal ─────────────────────────────────────────────────────────
        dateOfBirth: Date,
        age: Number,
        gender: { type: String, enum: ["male", "female", "other", "non_binary"] },
        lookingFor: { type: String, enum: ["men", "women", "both", "everyone"] },

        // ── Location ─────────────────────────────────────────────────────────
        country: String,
        state: String,
        city: String,
        latitude: Number,
        longitude: Number,

        // ── Profile ──────────────────────────────────────────────────────────
        profilePicture: String,
        photos: [String],
        coverPhoto: String,
        aboutMe: String,
        bio: String,   // alias kept for compatibility
        occupation: String,
        education: {
            type: String,
            enum: ["high_school", "some_college", "bachelors", "masters", "phd", "other"],
        },
        languages: [String],

        // ── Physical attributes ───────────────────────────────────────────────
        height: { type: Number }, // in centimeters
        weight: { type: Number }, // in kg (optional)
        zodiacSign: { type: String, enum: ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces", ""] },
        personalityType: { type: String, enum: ["intj", "intp", "entj", "entp", "infj", "infp", "enfj", "enfp", "istj", "isfj", "estj", "esfj", "istp", "isfp", "estp", "esfp", ""] },

        // ── Interests & Lifestyle ─────────────────────────────────────────────
        interests: [String],
        hobbies: [String],
        favoriteMusic: [String],
        favoriteMovies: [String],
        favoriteSports: [String],
        smoking: { type: String, enum: ["never", "socially", "occasionally", "regularly"] },
        drinking: { type: String, enum: ["never", "socially", "frequently"] },
        pets: { type: String, enum: ["dog", "cat", "both", "other", "none", ""] },
        lifestyle: { type: String, enum: ["active", "moderate", "sedentary", ""] },

        // ── Match Preferences ─────────────────────────────────────────────────
        minAge: { type: Number, default: 18 },
        maxAge: { type: Number, default: 50 },
        preferredCountry: String,
        preferredDistance: String,

        // ── Relationship & Lifestyle Goals ────────────────────────────────────
        relationshipGoal: String,
        hasChildren: { type: String, enum: ["yes", "no", "prefer_not_to_say"] },
        wantsChildren: { type: String, enum: ["yes", "no", "maybe"] },
        religion: String,
        tribe: String,
        religionImportance: { type: String, enum: ["very_important", "somewhat_important", "not_important"] },
        relationshipValue: String,

        // ── Verification ─────────────────────────────────────────────────────
        emailVerified: { type: Boolean, default: false },
        verificationToken: String,
        verificationTokenExpires: Date,
        isVerified: { type: Boolean, default: false }, // profile verification badge
        verifiedAt: Date,

        // ── Password reset ────────────────────────────────────────────────────
        passwordResetToken: String,
        passwordResetExpires: Date,

        // ── 2FA ───────────────────────────────────────────────────────────────
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorSecret: String,
        twoFactorMethod: { type: String, enum: ["email", "app"], default: "email" },

        // ── Account lockout ───────────────────────────────────────────────────
        loginAttempts: { type: Number, default: 0 },
        lockUntil: Date,
        lastFailedLogin: Date,

        // ── Refresh tokens (stored as array to support multi-device) ──────────
        refreshTokens: [{ type: String }],
        deviceSessions: [{
            token: String,
            deviceName: String,
            deviceType: String,
            ipAddress: String,
            userAgent: String,
            lastActive: Date,
            createdAt: { type: Date, default: Date.now },
        }],

        // ── Role (RBAC) ─────────────────────────────────────────────────────
        role: {
            type: String,
            enum: ["user", "moderator", "admin", "super_admin"],
            default: "user",
        },
        // Keep isAdmin for backward compatibility (derived from role)
        isAdmin: { type: Boolean, default: false },

        // ── Member status (set automatically on verification) ─────────────────
        isMember: { type: Boolean, default: false },  // fully onboarded member
        memberSince: Date,                                // timestamp of first activation
        onboardingComplete: { type: Boolean, default: false },

        // ── Account status ────────────────────────────────────────────────────
        isActive: { type: Boolean, default: true },
        isBanned: { type: Boolean, default: false },
        bannedAt: Date,
        bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        banReason: String,
        suspendedAt: Date,
        suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        suspensionReason: String,
        suspensionEnds: Date,
        deletedAt: Date,
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        lastLogin: Date,
        lastSeen: Date,

        // ── Profile completion score (0-100) ──────────────────────────────────
        profileCompletion: { type: Number, default: 0 },

        // ── Privacy settings ──────────────────────────────────────────────────
        privacySettings: { type: privacySettingsSchema, default: () => ({}) },

        // ── Premium ──────────────────────────────────────────────────────────
        isPremium: { type: Boolean, default: false },
        premiumTier: { type: String, enum: ["basic", "gold", "platinum"], default: "basic" },
        premiumExpires: Date,
        stripeCustomerId: String,
        boostExpires: Date,
        superLikesRemaining: { type: Number, default: 5 }, // daily super likes for free users
        superLikesResetDate: Date,

        // ── Passport (change location) ──────────────────────────────────────
        passportLocation: {
            latitude: Number,
            longitude: Number,
            city: String,
            country: String,
            enabled: { type: Boolean, default: false },
        },

        // ── Moderation ───────────────────────────────────────────────────────
        reportCount: { type: Number, default: 0 },
        flaggedForReview: { type: Boolean, default: false },
        blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        muted: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        reported: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// ── Indexes for fast member lookup and matching ────────────────────────────────
userSchema.index({ gender: 1, age: 1, country: 1 });
userSchema.index({ isMember: 1, isActive: 1, isBanned: 1, emailVerified: 1 });
userSchema.index({ latitude: 1, longitude: 1 });
userSchema.index({ interests: 1 });
userSchema.index({ role: 1 });

// ── Virtual: full name ─────────────────────────────────────────────────────────
userSchema.virtual("fullName").get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// ── Pre-save hook: sync `isAdmin` with `role` ─────────────────────────────────
userSchema.pre("save", function (next) {
    this.isAdmin = ["admin", "super_admin"].includes(this.role);
    next();
});

export const User = mongoose.model("User", userSchema);