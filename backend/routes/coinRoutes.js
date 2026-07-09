import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
    getOrCreateWallet,
    getBalance,
    getTransactionHistory,
    getCoinPackages,
    addCoins,
} from "../services/coinService.js";
import { generateReferralCode, getReferralCode, createReferral, getReferralAnalytics } from "../services/referralService.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ─── Wallet ────────────────────────────────────────────────────────────────────

// GET /coins/wallet — get wallet info
router.get("/wallet", async (req, res) => {
    try {
        const wallet = await getOrCreateWallet(req.user.userId);
        res.json({ success: true, wallet });
    } catch (error) {
        console.error("[Coins Wallet]", error);
        res.status(500).json({ success: false, message: "Failed to fetch wallet" });
    }
});

// GET /coins/balance — get balance
router.get("/balance", async (req, res) => {
    try {
        const balance = await getBalance(req.user.userId);
        res.json({ success: true, balance });
    } catch (error) {
        console.error("[Coins Balance]", error);
        res.status(500).json({ success: false, message: "Failed to fetch balance" });
    }
});

// GET /coins/transactions — transaction history
router.get("/transactions", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const result = await getTransactionHistory(req.user.userId, page, limit);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Coins Transactions]", error);
        res.status(500).json({ success: false, message: "Failed to fetch transactions" });
    }
});

// GET /coins/packages — available coin packages
router.get("/packages", async (req, res) => {
    try {
        const packages = getCoinPackages();
        res.json({ success: true, packages });
    } catch (error) {
        console.error("[Coins Packages]", error);
        res.status(500).json({ success: false, message: "Failed to fetch packages" });
    }
});

// POST /coins/purchase — initialize coin purchase (returns Paystack URL)
router.post("/purchase", async (req, res) => {
    try {
        const { packageIndex } = req.body;
        const packages = getCoinPackages();
        const selected = packages[packageIndex];

        if (!selected) {
            return res.status(400).json({ success: false, message: "Invalid package" });
        }

        // Initialize Paystack payment
        const https = await import("https");
        const params = JSON.stringify({
            email: req.user.email || "user@example.com",
            amount: selected.price * 100, // Paystack uses kobo
            callback_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/coins/callback`,
            metadata: {
                userId: req.user.userId,
                coins: selected.coins,
                packageIndex,
                type: "coin_purchase",
            },
        });

        const options = {
            hostname: "api.paystack.co",
            port: 443,
            path: "/transaction/initialize",
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json",
            },
        };

        const paystackReq = https.request(options, (paystackRes) => {
            let data = "";
            paystackRes.on("data", (chunk) => { data += chunk; });
            paystackRes.on("end", () => {
                try {
                    const response = JSON.parse(data);
                    if (response.status) {
                        res.json({
                            success: true,
                            authorizationUrl: response.data.authorization_url,
                            reference: response.data.reference,
                        });
                    } else {
                        res.status(400).json({ success: false, message: "Payment initialization failed" });
                    }
                } catch (e) {
                    res.status(500).json({ success: false, message: "Failed to parse payment response" });
                }
            });
        });

        paystackReq.on("error", (e) => {
            console.error("[Coins Purchase]", e);
            res.status(500).json({ success: false, message: "Payment initialization failed" });
        });

        paystackReq.write(params);
        paystackReq.end();
    } catch (error) {
        console.error("[Coins Purchase]", error);
        res.status(500).json({ success: false, message: "Failed to initialize purchase" });
    }
});

// POST /coins/verify — verify coin purchase
router.post("/verify", async (req, res) => {
    try {
        const { reference } = req.body;
        if (!reference) {
            return res.status(400).json({ success: false, message: "Reference is required" });
        }

        // Verify with Paystack
        const https = await import("https");
        const options = {
            hostname: "api.paystack.co",
            port: 443,
            path: `/transaction/verify/${reference}`,
            method: "GET",
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
        };

        const paystackReq = https.request(options, (paystackRes) => {
            let data = "";
            paystackRes.on("data", (chunk) => { data += chunk; });
            paystackRes.on("end", async () => {
                try {
                    const response = JSON.parse(data);
                    if (response.status && response.data.status === "success") {
                        const metadata = response.data.metadata;
                        const coins = metadata?.coins || 0;

                        // Add coins to wallet
                        const { wallet, transaction } = await addCoins(
                            req.user.userId,
                            coins,
                            "purchase",
                            `Purchased ${coins} coins`,
                            { reference, amount: response.data.amount / 100 }
                        );

                        res.json({
                            success: true,
                            message: `${coins} coins added to your wallet`,
                            wallet,
                            transaction,
                        });
                    } else {
                        res.status(400).json({ success: false, message: "Payment verification failed" });
                    }
                } catch (e) {
                    res.status(500).json({ success: false, message: "Failed to verify payment" });
                }
            });
        });

        paystackReq.on("error", (e) => {
            console.error("[Coins Verify]", e);
            res.status(500).json({ success: false, message: "Verification failed" });
        });

        paystackReq.end();
    } catch (error) {
        console.error("[Coins Verify]", error);
        res.status(500).json({ success: false, message: "Failed to verify purchase" });
    }
});

export default router;