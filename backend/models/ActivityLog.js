import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        action: {
            type: String,
            required: true,
            enum: [
                "login",
                "logout",
                "register",
                "email_verified",
                "password_changed",
                "email_changed",
                "profile_updated",
                "photo_uploaded",
                "photo_deleted",
                "like_sent",
                "superlike_sent",
                "match_created",
                "message_sent",
                "premium_purchased",
                "premium_expired",
                "boost_activated",
                "report_submitted",
                "account_deactivated",
                "account_deleted",
                "2fa_enabled",
                "2fa_disabled",
                "2fa_verified",
                "device_logout",
                "all_devices_logout",
                "session_expired",
                "settings_updated",
                "privacy_updated",
            ],
        },
        details: { type: String, default: "" },
        ipAddress: { type: String, default: "" },
        userAgent: { type: String, default: "" },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);