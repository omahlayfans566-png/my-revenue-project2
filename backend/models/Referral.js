import mongoose from "mongoose";

const referralSchema = new mongoose.Schema({
    referrerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    referredUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    referralCode: {
        type: String,
        required: true,
        index: true,
    },
    email: String,
    phone: String,
    status: {
        type: String,
        enum: ["invited", "joined", "completed", "rewarded"],
        default: "invited",
    },
    rewardGiven: {
        type: Boolean,
        default: false,
    },
    rewardAmount: {
        type: Number,
        default: 0,
    },
    joinedAt: Date,
    completedAt: Date,
    ipAddress: String,
    userAgent: String,
}, { timestamps: true });

referralSchema.index({ referrerId: 1, status: 1 });
referralSchema.index({ referralCode: 1 });

const referralCodeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
    },
    totalReferrals: {
        type: Number,
        default: 0,
    },
    successfulReferrals: {
        type: Number,
        default: 0,
    },
    totalRewards: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

export const Referral = mongoose.model("Referral", referralSchema);
export const ReferralCode = mongoose.model("ReferralCode", referralCodeSchema);