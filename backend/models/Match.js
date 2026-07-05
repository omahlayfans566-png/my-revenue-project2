import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
    {
        users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        user1: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        user2: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // Who initiated the match
        initiatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        // Like types
        user1Liked: { type: Boolean, default: false },
        user2Liked: { type: Boolean, default: false },
        user1SuperLiked: { type: Boolean, default: false },
        user2SuperLiked: { type: Boolean, default: false },
        // Match status
        isMatch: { type: Boolean, default: false },
        matchedAt: Date,
        // Unmatch tracking
        isUnmatched: { type: Boolean, default: false },
        unmatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        unmatchedAt: Date,
        // Block tracking
        blockedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        // Last activity
        lastMessageAt: Date,
        messagesCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Indexes
matchSchema.index({ user1: 1, user2: 1 }, { unique: true });
matchSchema.index({ users: 1 });
matchSchema.index({ isMatch: 1, matchedAt: -1 });
matchSchema.index({ user1: 1, isMatch: 1 });
matchSchema.index({ user2: 1, isMatch: 1 });
matchSchema.index({ lastMessageAt: -1 });

export const Match = mongoose.model("Match", matchSchema);