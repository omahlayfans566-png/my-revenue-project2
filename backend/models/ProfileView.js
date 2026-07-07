import mongoose from "mongoose";

const profileViewSchema = new mongoose.Schema(
    {
        viewerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        profileOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        viewedAt: { type: Date, default: Date.now },
        isIncognito: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient queries
profileViewSchema.index({ profileOwnerId: 1, viewedAt: -1 });
profileViewSchema.index({ viewerId: 1, viewedAt: -1 });
profileViewSchema.index({ profileOwnerId: 1, viewerId: 1 }, { unique: true });

export const ProfileView = mongoose.model("ProfileView", profileViewSchema);