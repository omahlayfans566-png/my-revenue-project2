import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        matchedUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        userLiked: { type: Boolean, default: false },
        userLikedAt: Date,
        matchedUserLiked: { type: Boolean, default: false },
        matchedUserLikedAt: Date,
        status: {
            type: String,
            enum: ["viewed", "liked", "superliked", "matched", "blocked", "rejected"],
            default: "viewed",
        },
        matchedAt: Date,
        messagesSent: Number,
        lastMessageAt: Date,
    },
    { timestamps: true }
);

export const Match = mongoose.model("Match", matchSchema);
