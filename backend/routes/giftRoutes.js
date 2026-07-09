import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { GIFT_CATALOG } from "../models/Gift.js";
import {
    sendGift,
    getGiftCatalog,
    getReceivedGifts,
    getSentGifts,
} from "../services/coinService.js";

const router = express.Router();

router.use(authenticateToken);

// GET /gifts/catalog — list available gifts
router.get("/catalog", async (req, res) => {
    try {
        const catalog = getGiftCatalog();
        res.json({ success: true, catalog });
    } catch (error) {
        console.error("[Gifts Catalog]", error);
        res.status(500).json({ success: false, message: "Failed to fetch catalog" });
    }
});

// POST /gifts/send — send a gift
router.post("/send", async (req, res) => {
    try {
        const { toUserId, giftName, message, source, sourceId, isPrivate } = req.body;

        if (!toUserId || !giftName) {
            return res.status(400).json({ success: false, message: "Recipient and gift name are required" });
        }

        const result = await sendGift(req.user.userId, toUserId, giftName, {
            message,
            source: source || "profile",
            sourceId,
            isPrivate,
        });

        res.json({ success: true, message: `Sent ${giftName}!`, ...result });
    } catch (error) {
        console.error("[Gifts Send]", error);
        if (error.message === "Insufficient coins") {
            return res.status(400).json({ success: false, message: "Insufficient coins" });
        }
        res.status(500).json({ success: false, message: error.message || "Failed to send gift" });
    }
});

// GET /gifts/received — get received gifts
router.get("/received", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const result = await getReceivedGifts(req.user.userId, page, limit);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Gifts Received]", error);
        res.status(500).json({ success: false, message: "Failed to fetch gifts" });
    }
});

// GET /gifts/sent — get sent gifts
router.get("/sent", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const result = await getSentGifts(req.user.userId, page, limit);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Gifts Sent]", error);
        res.status(500).json({ success: false, message: "Failed to fetch gifts" });
    }
});

export default router;