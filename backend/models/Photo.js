import mongoose from "mongoose";

const photoSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        url: {
            type: String,
            required: true,
        },
        thumbnailUrl: String,
        isProfilePicture: {
            type: Boolean,
            default: false,
        },
        isCoverPhoto: {
            type: Boolean,
            default: false,
        },
        order: {
            type: Number,
            default: 0,
        },
        isPrivate: {
            type: Boolean,
            default: false,
        },
        albumId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Album",
            default: null,
        },
        moderationStatus: {
            type: String,
            enum: ["pending", "approved", "rejected", "flagged"],
            default: "approved",
        },
        moderationReason: String,
        moderatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        moderatedAt: Date,
        width: Number,
        height: Number,
        fileSize: Number,
        mimeType: String,
    },
    {
        timestamps: true,
    }
);

photoSchema.index({ userId: 1, order: 1 });
photoSchema.index({ userId: 1, isProfilePicture: 1 });
photoSchema.index({ userId: 1, isCoverPhoto: 1 });
photoSchema.index({ albumId: 1 });
photoSchema.index({ moderationStatus: 1 });

export const Photo = mongoose.model("Photo", photoSchema);