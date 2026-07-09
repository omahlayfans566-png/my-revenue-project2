/**
 * Coin Service — Virtual economy management
 */
import { CoinWallet, CoinTransaction, COIN_PACKAGES } from "../models/Coin.js";
import { Gift, GIFT_CATALOG } from "../models/Gift.js";

// ─── Wallet Management ─────────────────────────────────────────────────────────

export const getOrCreateWallet = async (userId) => {
    let wallet = await CoinWallet.findOne({ userId });
    if (!wallet) {
        wallet = new CoinWallet({ userId, balance: 0 });
        await wallet.save();
    }
    return wallet;
};

export const getBalance = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    return wallet.balance;
};

export const getTransactionHistory = async (userId, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
        CoinTransaction.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        CoinTransaction.countDocuments({ userId }),
    ]);
    return { transactions, total, page, pages: Math.ceil(total / limit) };
};

export const addCoins = async (userId, amount, type, description = "", metadata = {}) => {
    const wallet = await getOrCreateWallet(userId);
    wallet.balance += amount;
    wallet.lifetimeEarned += amount;
    await wallet.save();

    const transaction = new CoinTransaction({
        userId,
        type,
        amount,
        balance: wallet.balance,
        description,
        metadata,
    });
    await transaction.save();

    return { wallet, transaction };
};

export const spendCoins = async (userId, amount, description = "", metadata = {}) => {
    const wallet = await getOrCreateWallet(userId);

    if (wallet.balance < amount) {
        throw new Error("Insufficient coins");
    }

    wallet.balance -= amount;
    wallet.lifetimeSpent += amount;
    await wallet.save();

    const transaction = new CoinTransaction({
        userId,
        type: "spend",
        amount: -amount,
        balance: wallet.balance,
        description,
        metadata,
    });
    await transaction.save();

    return { wallet, transaction };
};

export const getCoinPackages = () => COIN_PACKAGES;

// ─── Gift Management ───────────────────────────────────────────────────────────

export const sendGift = async (fromUserId, toUserId, giftName, options = {}) => {
    const { message, source, sourceId, isPrivate } = options;

    // Find gift in catalog
    const giftDef = GIFT_CATALOG.find(g => g.name === giftName);
    if (!giftDef) throw new Error(`Gift "${giftName}" not found`);

    // Spend coins
    const { wallet } = await spendCoins(
        fromUserId,
        giftDef.coinCost,
        `Sent ${giftDef.emoji} ${giftDef.name} to user ${toUserId}`,
        { toUserId, giftName, source }
    );

    // Record gift
    const gift = new Gift({
        fromUserId,
        toUserId,
        giftName: giftDef.name,
        giftEmoji: giftDef.emoji,
        coinCost: giftDef.coinCost,
        message: message || "",
        source: source || "profile",
        sourceId: sourceId || null,
        isPrivate: isPrivate || false,
    });
    await gift.save();

    // Notify recipient
    try {
        const { createNotification } = await import("./notificationService.js");
        await createNotification({
            userId: toUserId,
            type: "gift",
            title: "Gift Received! 🎁",
            message: `You received ${giftDef.emoji} ${giftDef.name}!`,
            referenceId: gift._id,
            referenceModel: "Gift",
            metadata: { fromUserId, giftName: giftDef.name, giftEmoji: giftDef.emoji },
        }).catch(() => {});
    } catch (e) { /* silent */ }

    // Emit socket event
    if (global.io) {
        global.io.to(`user:${toUserId}`).emit("gift_received", {
            fromUserId,
            gift: { name: giftDef.name, emoji: giftDef.emoji, message: gift.message },
            _id: gift._id,
            createdAt: gift.createdAt,
        });
    }

    return { gift, wallet };
};

export const getGiftCatalog = () => GIFT_CATALOG;

export const getReceivedGifts = async (userId, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [gifts, total] = await Promise.all([
        Gift.find({ toUserId: userId })
            .populate("fromUserId", "firstName lastName profilePicture")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Gift.countDocuments({ toUserId: userId }),
    ]);
    return { gifts, total, page, pages: Math.ceil(total / limit) };
};

export const getSentGifts = async (userId, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [gifts, total] = await Promise.all([
        Gift.find({ fromUserId: userId })
            .populate("toUserId", "firstName lastName profilePicture")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Gift.countDocuments({ fromUserId: userId }),
    ]);
    return { gifts, total, page, pages: Math.ceil(total / limit) };
};