import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        ipAddress: { type: String, default: "" },
        userAgent: { type: String, default: "" },
        device: { type: String, default: "" },
        location: { type: String, default: "" },
        success: { type: Boolean, default: true },
        method: {
            type: String,
            enum: ["password", "refresh_token", "2fa", "google", "apple"],
            default: "password",
        },
        failReason: { type: String, default: "" },
        sessionId: { type: String, default: "" },
    },
    { timestamps: true }
);

loginHistorySchema.index({ userId: 1, createdAt: -1 });
loginHistorySchema.index({ userId: 1, success: 1 });

export const LoginHistory = mongoose.model("LoginHistory", loginHistorySchema);