import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        mediaUrl: {
            type: String,
            required: true,
        },
        mediaType: {
            type: String,
            enum: ["image", "video"],
            default: "image",
        },
        caption: {
            type: String,
            maxlength: 280,
            default: "",
        },
        backgroundColor: {
            type: String,
            default: "#000000",
        },
        textColor: {
            type: String,
            default: "#ffffff",
        },
        viewers: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            viewedAt: { type: Date, default: Date.now },
        }],
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

storySchema.index({ userId: 1, createdAt: -1 });
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ isActive: 1, expiresAt: 1 });

export const Story = mongoose.model("Story", storySchema);