import mongoose from "mongoose";

const albumSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        description: {
            type: String,
            maxlength: 500,
            default: "",
        },
        coverPhoto: String,
        isPrivate: {
            type: Boolean,
            default: false,
        },
        lockType: {
            type: String,
            enum: ["none", "premium_only", "coin"],
            default: "none",
        },
        coinCost: {
            type: Number,
            default: 0,
        },
        allowedUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],
        photoCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

albumSchema.index({ userId: 1 });
albumSchema.index({ userId: 1, isPrivate: 1 });

export const Album = mongoose.model("Album", albumSchema);