import mongoose from "mongoose";

// Available virtual gifts
export const GIFT_CATALOG = [
    { name: "Rose", emoji: "🌹", coinCost: 10, icon: "🌹" },
    { name: "Flowers", emoji: "💐", coinCost: 25, icon: "💐" },
    { name: "Chocolate", emoji: "🍫", coinCost: 15, icon: "🍫" },
    { name: "Coffee", emoji: "☕", coinCost: 20, icon: "☕" },
    { name: "Teddy Bear", emoji: "🧸", coinCost: 50, icon: "🧸" },
    { name: "Ring", emoji: "💍", coinCost: 100, icon: "💍" },
    { name: "Diamond", emoji: "💎", coinCost: 200, icon: "💎" },
    { name: "Crown", emoji: "👑", coinCost: 150, icon: "👑" },
    { name: "Hearts", emoji: "💕", coinCost: 30, icon: "💕" },
];

const giftSchema = new mongoose.Schema({
    fromUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    toUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    giftName: {
        type: String,
        required: true,
    },
    giftEmoji: {
        type: String,
        required: true,
    },
    coinCost: {
        type: Number,
        required: true,
    },
    message: {
        type: String,
        maxlength: 200,
        default: "",
    },
    source: {
        type: String,
        enum: ["chat", "profile", "story"],
        default: "profile",
    },
    sourceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    isPrivate: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

giftSchema.index({ fromUserId: 1, createdAt: -1 });
giftSchema.index({ toUserId: 1, createdAt: -1 });

export const Gift = mongoose.model("Gift", giftSchema);