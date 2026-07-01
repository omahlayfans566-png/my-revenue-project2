import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ["match", "like", "message", "visit", "system"],
            required: true,
        },
        title: { type: String, default: "" },
        message: { type: String, required: true },
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        referenceModel: {
            type: String,
            enum: ["User", "Match", "Message"],
            default: null,
        },
        isRead: { type: Boolean, default: false },
        readAt: Date,
        icon: { type: String, default: "🔔" },
        metadata: { type: mongoose.Schema.Types.Mixed },
    },
    {
        timestamps: true,
    }
);

// Indexes for fast queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);