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
        username: { type: String, required: true, unique: true, trim: true, lowercase: true },
        email: { type: String, required: true, unique: true, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        password: { type: String, required: true },

        // ── Personal ─────────────────────────────────────────────────────────
        dateOfBirth: Date,
        age: Number,
        gender: { type: String, enum: ["male", "female", "other"] },
        lookingFor: { type: String, enum: ["men", "women", "both"] },

        // ── Location ─────────────────────────────────────────────────────────
        country: String,
        state: String,
        city: String,
        latitude: Number,
        longitude: Number,

        // ── Profile ──────────────────────────────────────────────────────────
        profilePicture: String,
        photos: [String],
        aboutMe: String,
        bio: String,   // alias kept for compatibility
        occupation: String,
        education: {
            type: String,
            enum: ["high_school", "some_college", "bachelors", "masters", "phd", "other"],
        },
        languages: [String],

        // ── Interests & Lifestyle ─────────────────────────────────────────────
        interests: [String],
        smoking: { type: String, enum: ["never", "socially", "occasionally", "regularly"] },
        drinking: { type: String, enum: ["never", "socially", "frequently"] },

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
        religionImportance: { type: String, enum: ["very_important", "somewhat_important", "not_important"] },
        relationshipValue: String,

        // ── Verification ─────────────────────────────────────────────────────
        emailVerified: { type: Boolean, default: false },
        verificationToken: String,
        verificationTokenExpires: Date,

        // ── Password reset ────────────────────────────────────────────────────
        passwordResetToken: String,
        passwordResetExpires: Date,

        // ── Refresh tokens (stored as array to support multi-device) ──────────
        refreshTokens: [{ type: String }],

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

        // ── Profile completion score (0-100) ──────────────────────────────────
        profileCompletion: { type: Number, default: 0 },

        // ── Privacy settings ──────────────────────────────────────────────────
        privacySettings: { type: privacySettingsSchema, default: () => ({}) },

        // ── Premium ──────────────────────────────────────────────────────────
        isPremium: { type: Boolean, default: false },
        premiumTier: { type: String, enum: ["basic", "gold", "platinum"], default: "basic" },
        premiumExpires: Date,
        stripeCustomerId: String,

        // ── Moderation ───────────────────────────────────────────────────────
        reportCount: { type: Number, default: 0 },
        flaggedForReview: { type: Boolean, default: false },
        blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
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