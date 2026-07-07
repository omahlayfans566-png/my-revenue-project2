import mongoose from "mongoose";

const incognitoModeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            // unique index defined explicitly below
        },
        isEnabled: {
            type: Boolean,
            default: false,
        },
        startedAt: Date,
        expiresAt: Date,
        hideDistance: { type: Boolean, default: true },
        hideOnlineStatus: { type: Boolean, default: true },
        hideLastSeen: { type: Boolean, default: true },
    },
    {
        timestamps: true,
    }
);

incognitoModeSchema.index({ userId: 1 }, { unique: true });
incognitoModeSchema.index({ isEnabled: 1, expiresAt: 1 });

export const IncognitoMode = mongoose.model("IncognitoMode", incognitoModeSchema);