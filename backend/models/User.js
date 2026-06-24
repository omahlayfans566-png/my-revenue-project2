import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        // Step 1: Account Information
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        username: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        phone: String,
        password: { type: String, required: true },
        profilePicture: String,

        // Step 2: Personal Information
        dateOfBirth: Date,
        age: Number,
        gender: { type: String, enum: ["male", "female", "other"] },
        lookingFor: { type: String, enum: ["men", "women", "both"] },
        country: String,
        state: String,
        city: String,
        latitude: Number,
        longitude: Number,

        // Step 3: Profile Information
        aboutMe: String,
        occupation: String,
        education: {
            type: String,
            enum: ["high_school", "bachelors", "masters", "phd"],
        },
        languages: [String],

        // Step 4: Interests
        interests: [String],

        // Step 5: Match Preferences
        minAge: { type: Number, default: 18 },
        maxAge: { type: Number, default: 80 },
        preferredCountry: String,
        preferredDistance: String,

        // Step 6: Relationship & Lifestyle
        relationshipGoal: String,
        hasChildren: { type: String, enum: ["yes", "no", "prefer_not_to_say"] },
        wantsChildren: { type: String, enum: ["yes", "no", "maybe"] },
        smoking: { type: String, enum: ["never", "occasionally", "regularly"] },
        drinking: { type: String, enum: ["never", "socially", "frequently"] },
        religion: String,
        religionImportance: {
            type: String,
            enum: ["very_important", "somewhat_important", "not_important"],
        },
        relationshipValue: String,

        // Verification
        emailVerified: { type: Boolean, default: false },
        verificationToken: String,
        verificationTokenExpires: Date,

        // Premium Features
        isPremium: { type: Boolean, default: false },
        premiumTier: {
            type: String,
            enum: ["basic", "gold", "platinum"],
            default: "basic",
        },
        premiumExpires: Date,
        stripeCustomerId: String,

        // Profile Completion
        profileCompletion: { type: Number, default: 0 },

        // Account Status
        isActive: { type: Boolean, default: true },
        isBanned: { type: Boolean, default: false },
        lastLogin: Date,

        // Additional
        bio: String,
        photos: [String],
        blocked: [mongoose.Schema.Types.ObjectId],
        reported: [mongoose.Schema.Types.ObjectId],
    },
    { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
