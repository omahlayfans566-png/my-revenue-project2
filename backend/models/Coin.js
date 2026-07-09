import mongoose from "mongoose";

const coinTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        enum: ["purchase", "earn", "spend", "refund", "bonus", "referral"],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    balance: {
        type: Number,
        required: true,
    },
    description: String,
    reference: String,
    paymentReference: String,
    metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

coinTransactionSchema.index({ userId: 1, createdAt: -1 });

const coinWalletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    balance: {
        type: Number,
        default: 0,
    },
    lifetimeEarned: {
        type: Number,
        default: 0,
    },
    lifetimeSpent: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

export const CoinTransaction = mongoose.model("CoinTransaction", coinTransactionSchema);
export const CoinWallet = mongoose.model("CoinWallet", coinWalletSchema);

// Coin pricing packages
export const COIN_PACKAGES = [
    { price: 500, coins: 500, popular: false },
    { price: 1000, coins: 1100, popular: true },
    { price: 2500, coins: 3000, popular: false },
    { price: 5000, coins: 6500, popular: false },
    { price: 10000, coins: 14000, popular: false },
];