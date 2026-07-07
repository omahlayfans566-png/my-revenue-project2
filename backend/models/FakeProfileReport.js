import mongoose from "mongoose";

const fakeProfileReportSchema = new mongoose.Schema(
    {
        reportedUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        reasons: [{
            type: String,
            enum: [
                "fake_photos",
                "fake_name",
                "fake_information",
                "scam_attempt",
                "catfishing",
                "bot_account",
                "multiple_accounts",
                "other",
            ],
        }],
        description: { type: String, default: "" },
        evidenceUrls: [String],
        status: {
            type: String,
            enum: ["pending", "investigating", "confirmed_fake", "dismissed"],
            default: "pending",
        },
        aiScore: {
            type: Number, // 0-100 likelihood of being fake
            default: 0,
        },
        aiAnalysis: {
            profileConsistencyScore: { type: Number, default: 0 },
            photoAuthenticityScore: { type: Number, default: 0 },
            behavioralScore: { type: Number, default: 0 },
            details: mongoose.Schema.Types.Mixed,
        },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reviewedAt: Date,
        actionTaken: {
            type: String,
            enum: ["none", "warning", "restricted", "banned"],
            default: "none",
        },
    },
    {
        timestamps: true,
    }
);

fakeProfileReportSchema.index({ reportedUserId: 1, status: 1 });
fakeProfileReportSchema.index({ aiScore: -1 });
fakeProfileReportSchema.index({ status: 1, createdAt: -1 });

export const FakeProfileReport = mongoose.model("FakeProfileReport", fakeProfileReportSchema);