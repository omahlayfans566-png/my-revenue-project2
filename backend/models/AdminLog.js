import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema(
    {
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        action: {
            type: String,
            required: true,
            trim: true,
        },
        targetType: {
            type: String,
            enum: ["user", "report", "announcement", "subscription", "system", "content", "other"],
            default: "other",
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        ipAddress: String,
        userAgent: String,
    },
    {
        timestamps: true,
    }
);

adminLogSchema.index({ admin: 1, createdAt: -1 });
adminLogSchema.index({ action: 1 });
adminLogSchema.index({ targetType: 1 });
adminLogSchema.index({ createdAt: -1 });

export const AdminLog = mongoose.model("AdminLog", adminLogSchema);