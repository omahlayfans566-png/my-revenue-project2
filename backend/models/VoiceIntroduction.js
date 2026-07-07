import mongoose from "mongoose";

const voiceIntroductionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            // unique index defined explicitly below
        },
        audioUrl: {
            type: String,
            required: true,
        },
        duration: {
            type: Number, // in seconds
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        transcription: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

voiceIntroductionSchema.index({ userId: 1 }, { unique: true });
voiceIntroductionSchema.index({ isActive: 1 });

export const VoiceIntroduction = mongoose.model("VoiceIntroduction", voiceIntroductionSchema);