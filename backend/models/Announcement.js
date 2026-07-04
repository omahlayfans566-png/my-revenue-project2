import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ["info", "warning", "update", "maintenance", "promotion"],
            default: "info",
        },
        audience: {
            type: String,
            enum: ["all", "premium", "free", "specific_users"],
            default: "all",
        },
        targetUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],
        sentBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        sentAt: Date,
        scheduledAt: Date,
        status: {
            type: String,
            enum: ["draft", "scheduled", "sent", "cancelled"],
            default: "draft",
        },
        readBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],
    },
    {
        timestamps: true,
    }
);

announcementSchema.index({ status: 1, createdAt: -1 });
announcementSchema.index({ sentBy: 1 });

export const Announcement = mongoose.model("Announcement", announcementSchema);