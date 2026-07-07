import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { authenticateToken } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Subscription } from "../models/Subscription.js";
import { Payment } from "../models/Payment.js";
import { AdminLog } from "../models/AdminLog.js";

const router = express.Router();

const dbOk = () => mongoose.connection.readyState === 1;

// ─── Pricing Plans (Monthly & Yearly) ─────────────────────────────────────────
const PLANS = {
    basic: { price: 2999, priceUSD: 3.99, durationDays: 30, name: "Basic" },
    gold: { price: 5999, priceUSD: 7.99, durationDays: 30, name: "Gold" },
    platinum: { price: 9999, priceUSD: 12.99, durationDays: 30, name: "Platinum" },
};

const YEARLY_PLANS = {
    basic: { price: 23990, priceUSD: 29.99, durationDays: 365, name: "Basic Yearly", monthlyEquivalent: 1999 },
    gold: { price: 47990, priceUSD: 59.99, durationDays: 365, name: "Gold Yearly", monthlyEquivalent: 3999 },
    platinum: { price: 79990, priceUSD: 99.99, durationDays: 365, name: "Platinum Yearly", monthlyEquivalent: 6666 },
};

// ─── GET /pricing ──────────────────────────────────────────────────────────────
router.get("/pricing", (_req, res) => {
    res.json({ success: true, plans: PLANS, yearlyPlans: YEARLY_PLANS });
});

// ─── POST /initialize-paystack ─────────────────────────────────────────────────
router.post("/initialize-paystack", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const { plan: planId, durationDays = 30, isYearly = false } = req.body;
        const planSource = isYearly ? YEARLY_PLANS : PLANS;
        const plan = planSource[planId];
        if (!plan) return res.status(400).json({ success: false, message: "Invalid plan" });

        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const amount = plan.price;
        const reference = `PAY-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;

        // Callback URL for redirect mode (Paystack sends user here after payment)
        const callbackUrl = process.env.PAYSTACK_CALLBACK_URL
            || `${process.env.FRONTEND_URL || "https://dateclone.online"}/payment/callback`;

        // Create pending payment record
        const payment = new Payment({
            userId: user._id,
            amount,
            currency: "NGN",
            status: "pending",
            paymentMethod: "paystack",
            paystackReference: reference,
            plan: planId,
            durationDays: plan.durationDays,
            metadata: { isYearly },
        });
        await payment.save();

        res.json({
            success: true,
            data: {
                reference,
                amount: amount * 100, // Paystack uses kobo
                email: user.email,
                plan: planId,
                durationDays: plan.durationDays,
                isYearly,
                callbackUrl,
                metadata: {
                    userId: user._id.toString(),
                    tier: planId,
                    durationDays: plan.durationDays,
                    isYearly,
                },
            },
        });
    } catch (err) {
        console.error("[Premium/Initialize]", err);
        res.status(500).json({ success: false, message: "Failed to initialize payment" });
    }
});

// ─── POST /verify-paystack ─────────────────────────────────────────────────────
router.post("/verify-paystack", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const { reference, plan: planId, durationDays = 30, trxref, isYearly = false } = req.body;
        const ref = reference || trxref;

        if (!ref) return res.status(400).json({ success: false, message: "Reference is required" });

        const planSource = isYearly ? YEARLY_PLANS : PLANS;
        const plan = planSource[planId];
        if (!plan) return res.status(400).json({ success: false, message: "Invalid plan" });

        // ── Duplicate-verification guard ──────────────────────────────────────
        // If this reference was already verified (status=success), return the
        // existing subscription info instead of re-activating.
        const existingPayment = await Payment.findOne({ paystackReference: ref });
        if (existingPayment && existingPayment.status === "success") {
            console.log(`[Premium/Verify] Reference ${ref} already verified — returning existing subscription`);
            const user = await User.findById(req.user.userId).select("isPremium premiumTier premiumExpires");
            return res.json({
                success: true,
                alreadyVerified: true,
                message: `${planId.charAt(0).toUpperCase() + planId.slice(1)} plan is already active!`,
                user: {
                    _id: user._id,
                    isPremium: user.isPremium,
                    premiumTier: user.premiumTier,
                    premiumExpires: user.premiumExpires,
                },
            });
        }

        // ── Verify with Paystack API ───────────────────────────────────────────
        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        const isPlaceholderKey = !secretKey || secretKey.startsWith("sk_test_xxx");

        if (isPlaceholderKey) {
            // Dev mode — no real Paystack key configured, trust frontend
            console.warn("[Premium/Verify] PAYSTACK_SECRET_KEY not configured — activating in dev mode");
            return await activatePremium(req, res, planId, plan.durationDays, ref, isYearly);
        }

        try {
            const verifyRes = await fetch(
                `https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`,
                { headers: { Authorization: `Bearer ${secretKey}` } }
            );
            const verifyData = await verifyRes.json();

            if (!verifyData.status || verifyData.data?.status !== "success") {
                const paystackMsg = verifyData.message || verifyData.data?.gateway_response || "Payment not completed";
                return res.status(400).json({
                    success: false,
                    message: `Payment verification failed: ${paystackMsg}`,
                });
            }

            // Confirm amount matches (fraud prevention)
            const expectedAmount = plan.price * 100; // kobo
            const paidAmount = verifyData.data.amount;
            if (paidAmount < expectedAmount) {
                console.warn(`[Premium/Verify] Amount mismatch: expected ${expectedAmount}, got ${paidAmount}`);
                return res.status(400).json({
                    success: false,
                    message: "Payment amount does not match the plan price. Contact support.",
                });
            }

            // Update payment record with Paystack transaction data
            await Payment.findOneAndUpdate(
                { paystackReference: ref },
                { status: "success", paystackTransactionData: verifyData.data },
                { upsert: false }
            );

            return await activatePremium(req, res, planId, plan.durationDays, ref, isYearly);
        } catch (fetchErr) {
            console.error("[Premium/Verify] Paystack API error:", fetchErr.message);
            // In production, don't activate on a failed Paystack check
            if (process.env.NODE_ENV !== "production") {
                return await activatePremium(req, res, planId, plan.durationDays, ref, isYearly);
            }
            return res.status(502).json({
                success: false,
                message: "Could not reach Paystack to verify payment. Please try again in a moment.",
            });
        }
    } catch (err) {
        console.error("[Premium/Verify]", err);
        res.status(500).json({ success: false, message: "Verification failed. Please contact support." });
    }
});

// ─── POST /paystack-webhook ────────────────────────────────────────────────────
// Paystack sends webhook events here for subscription charges, recurring payments
// Body is parsed as raw by server.js BEFORE this route is reached
router.post("/paystack-webhook", async (req, res) => {
    try {
        // Verify webhook signature
        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) {
            console.warn("[Webhook] PAYSTACK_SECRET_KEY not set, skipping verification");
            return res.status(200).json({ status: "skipped" });
        }

        // req.body is a Buffer from express.raw() - convert to string for HMAC
        const rawBody = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);
        const hash = crypto
            .createHmac("sha512", secretKey)
            .update(rawBody)
            .digest("hex");

        if (hash !== req.headers["x-paystack-signature"]) {
            console.error("[Webhook] Invalid signature");
            return res.status(401).json({ status: "invalid signature" });
        }

        const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        console.log("[Webhook] Received event:", event.event);

        // Handle different event types
        switch (event.event) {
            case "charge.success": {
                const data = event.data;
                const reference = data.reference;
                const metadata = data.metadata || {};

                // Find the payment
                const payment = await Payment.findOne({ paystackReference: reference });
                if (!payment) {
                    console.warn("[Webhook] Payment not found for reference:", reference);
                    return res.status(200).json({ status: "payment not found" });
                }

                // Update payment status
                payment.status = "success";
                payment.paystackTransactionData = data;
                await payment.save();

                // Activate premium for the user
                const user = await User.findById(payment.userId);
                if (user) {
                    const planId = payment.plan || "gold";
                    const durationDays = payment.durationDays || 30;
                    const isYearly = payment.metadata?.isYearly || false;

                    let subscription = await Subscription.findOne({ userId: user._id, status: "active" });
                    const now = new Date();
                    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

                    if (subscription) {
                        subscription.endDate = new Date(subscription.endDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
                        subscription.plan = planId;
                        subscription.paystackReference = reference;
                        subscription.autoRenew = true;
                    } else {
                        subscription = new Subscription({
                            userId: user._id,
                            plan: planId,
                            status: "active",
                            startDate: now,
                            endDate,
                            paystackReference: reference,
                            autoRenew: true,
                        });
                    }
                    await subscription.save();

                    user.isPremium = true;
                    user.premiumTier = planId;
                    user.premiumExpires = endDate;
                    await user.save();

                    // Emit socket event for real-time update
                    if (global.io) {
                        global.io.to(`user:${user._id}`).emit("premium_status_changed", {
                            isPremium: true,
                            premiumTier: planId,
                            premiumExpires: endDate,
                        });
                    }

                    await AdminLog.create({
                        adminId: user._id,
                        action: "premium_activated_webhook",
                        targetUserId: user._id,
                        details: { plan: planId, durationDays, reference, source: "webhook" },
                    });
                }
                break;
            }

            case "subscription.create":
            case "subscription.enable": {
                const subData = event.data;
                const customerEmail = subData.customer?.email;
                if (customerEmail) {
                    const user = await User.findOne({ email: customerEmail });
                    if (user) {
                        // Update subscription with Paystack subscription code
                        await Subscription.findOneAndUpdate(
                            { userId: user._id, status: "active" },
                            { paystackSubscriptionCode: subData.subscription_code }
                        );
                    }
                }
                break;
            }

            case "subscription.disable":
            case "subscription.expiring_cards": {
                const subData = event.data;
                const customerEmail = subData.customer?.email;
                if (customerEmail) {
                    const user = await User.findOne({ email: customerEmail });
                    if (user) {
                        await Subscription.findOneAndUpdate(
                            { userId: user._id, status: "active" },
                            { autoRenew: false, cancelledAt: new Date() }
                        );
                    }
                }
                break;
            }

            case "transfer.success":
                console.log("[Webhook] Transfer successful:", event.data.reference);
                break;

            default:
                console.log("[Webhook] Unhandled event type:", event.event);
        }

        res.status(200).json({ status: "success" });
    } catch (err) {
        console.error("[Webhook] Error:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});

// ─── Helper: Activate Premium ──────────────────────────────────────────────────
async function activatePremium(req, res, planId, durationDays, reference, isYearly = false) {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const planSource = isYearly ? YEARLY_PLANS : PLANS;
    const plan = planSource[planId];
    const now = new Date();
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Create or update subscription
    let subscription = await Subscription.findOne({ userId: user._id, status: "active" });
    if (subscription) {
        subscription.endDate = new Date(subscription.endDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        subscription.plan = planId;
        subscription.paystackReference = reference;
        subscription.autoRenew = true;
    } else {
        subscription = new Subscription({
            userId: user._id,
            plan: planId,
            status: "active",
            startDate: now,
            endDate,
            paystackReference: reference,
            autoRenew: true,
        });
    }
    await subscription.save();

    // Update user
    user.isPremium = true;
    user.premiumTier = planId;
    user.premiumExpires = endDate;
    await user.save();

    // Update payment record
    await Payment.findOneAndUpdate(
        { paystackReference: reference },
        { subscriptionId: subscription._id, status: "success" }
    );

    // Emit socket event for real-time update
    if (global.io) {
        global.io.to(`user:${user._id}`).emit("premium_status_changed", {
            isPremium: true,
            premiumTier: planId,
            premiumExpires: endDate,
        });
    }

    // Log
    await AdminLog.create({
        adminId: user._id,
        action: "premium_activated",
        targetUserId: user._id,
        details: { plan: planId, durationDays, reference, isYearly },
    });

    res.json({
        success: true,
        message: `Premium ${plan.name} activated!`,
        user: {
            _id: user._id,
            isPremium: true,
            premiumTier: planId,
            premiumExpires: endDate,
        },
    });
}

// ─── GET /status ───────────────────────────────────────────────────────────────
router.get("/status", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const user = await User.findById(req.user.userId).select("isPremium premiumTier premiumExpires");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const subscription = await Subscription.findOne({ userId: user._id, status: "active" });

        res.json({
            success: true,
            isPremium: user.isPremium,
            tier: user.premiumTier,
            expires: user.premiumExpires,
            subscription: subscription
                ? {
                    _id: subscription._id,
                    plan: subscription.plan,
                    status: subscription.status,
                    startDate: subscription.startDate,
                    endDate: subscription.endDate,
                    autoRenew: subscription.autoRenew,
                    cancelledAt: subscription.cancelledAt,
                    paymentMethod: subscription.paymentMethod,
                }
                : null,
        });
    } catch (err) {
        console.error("[Premium/Status]", err);
        res.status(500).json({ success: false, message: "Failed to get status" });
    }
});

// ─── POST /cancel ──────────────────────────────────────────────────────────────
router.post("/cancel", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const subscription = await Subscription.findOne({
            userId: req.user.userId,
            status: "active",
        });

        if (!subscription) {
            return res.status(404).json({ success: false, message: "No active subscription" });
        }

        // If has Paystack subscription code, cancel on Paystack too
        if (subscription.paystackSubscriptionCode && process.env.PAYSTACK_SECRET_KEY) {
            try {
                await fetch(
                    `https://api.paystack.co/subscription/${subscription.paystackSubscriptionCode}`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ token: subscription.paystackAuthorization?.authorizationCode }),
                    }
                );
            } catch (paystackErr) {
                console.error("[Premium/Cancel] Paystack cancel error:", paystackErr.message);
            }
        }

        subscription.autoRenew = false;
        subscription.cancelledAt = new Date();
        subscription.status = "cancelled";
        await subscription.save();

        // Emit socket event
        if (global.io) {
            global.io.to(`user:${req.user.userId}`).emit("premium_status_changed", {
                isPremium: true, // still active until expiry
                premiumTier: subscription.plan,
                premiumExpires: subscription.endDate,
                cancelled: true,
            });
        }

        res.json({
            success: true,
            message: "Subscription cancelled. Premium will remain active until the end of the billing period.",
            expiresAt: subscription.endDate,
        });
    } catch (err) {
        console.error("[Premium/Cancel]", err);
        res.status(500).json({ success: false, message: "Failed to cancel subscription" });
    }
});

// ─── POST /reactivate ──────────────────────────────────────────────────────────
router.post("/reactivate", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const subscription = await Subscription.findOne({
            userId: req.user.userId,
            status: "cancelled",
        });

        if (!subscription) {
            return res.status(404).json({ success: false, message: "No cancelled subscription found" });
        }

        // Only reactivate if still within valid period
        if (new Date(subscription.endDate) < new Date()) {
            return res.status(400).json({ success: false, message: "Subscription has already expired. Please purchase a new plan." });
        }

        subscription.autoRenew = true;
        subscription.cancelledAt = undefined;
        subscription.status = "active";
        await subscription.save();

        res.json({
            success: true,
            message: "Subscription reactivated! Auto-renewal is back on.",
        });
    } catch (err) {
        console.error("[Premium/Reactivate]", err);
        res.status(500).json({ success: false, message: "Failed to reactivate subscription" });
    }
});

// ─── GET /history ──────────────────────────────────────────────────────────────
router.get("/history", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const payments = await Payment.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({ success: true, payments });
    } catch (err) {
        console.error("[Premium/History]", err);
        res.status(500).json({ success: false, message: "Failed to get history" });
    }
});

// ─── POST /request-refund ──────────────────────────────────────────────────────
router.post("/request-refund", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const { paymentId, reason } = req.body;
        if (!paymentId || !reason) {
            return res.status(400).json({ success: false, message: "Payment ID and reason are required" });
        }

        const payment = await Payment.findOne({ _id: paymentId, userId: req.user.userId });
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        if (payment.status !== "success") {
            return res.status(400).json({ success: false, message: "Payment is not eligible for refund" });
        }

        if (payment.refundedAt) {
            return res.status(400).json({ success: false, message: "Payment has already been refunded" });
        }

        // Mark as refund requested
        payment.status = "refunded";
        payment.refundedAt = new Date();
        payment.refundReason = reason;
        await payment.save();

        // If Paystack is configured, initiate refund via API
        if (process.env.PAYSTACK_SECRET_KEY && payment.paystackReference) {
            try {
                await fetch("https://api.paystack.co/refund", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        transaction: payment.paystackReference,
                        amount: payment.amount * 100, // in kobo
                        merchant_note: reason,
                    }),
                });
            } catch (paystackErr) {
                console.error("[Premium/Refund] Paystack refund error:", paystackErr.message);
            }
        }

        // Revoke premium
        const user = await User.findById(req.user.userId);
        if (user) {
            user.isPremium = false;
            user.premiumTier = "basic";
            user.premiumExpires = undefined;
            await user.save();

            // Cancel subscription
            await Subscription.findOneAndUpdate(
                { userId: user._id, status: "active" },
                { status: "expired", autoRenew: false }
            );

            // Emit socket event
            if (global.io) {
                global.io.to(`user:${user._id}`).emit("premium_status_changed", {
                    isPremium: false,
                    premiumTier: "basic",
                    premiumExpires: null,
                });
            }
        }

        await AdminLog.create({
            adminId: req.user.userId,
            action: "refund_requested",
            targetUserId: req.user.userId,
            details: { paymentId, reason, amount: payment.amount },
        });

        res.json({
            success: true,
            message: "Refund has been processed. Premium has been revoked.",
        });
    } catch (err) {
        console.error("[Premium/Refund]", err);
        res.status(500).json({ success: false, message: "Failed to process refund" });
    }
});

// ─── POST /boost ───────────────────────────────────────────────────────────────
router.post("/boost", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (!user.isPremium) {
            return res.status(403).json({ success: false, message: "Premium subscription required for boost" });
        }

        // Check if premium is expired
        if (user.premiumExpires && new Date(user.premiumExpires) < new Date()) {
            return res.status(403).json({ success: false, message: "Premium has expired" });
        }

        // Check boost cooldown (Gold: 1/week, Platinum: unlimited)
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const recentBoosts = await Payment.countDocuments({
            userId: user._id,
            plan: "boost",
            createdAt: { $gte: oneWeekAgo },
        });

        if (user.premiumTier === "gold" && recentBoosts >= 1) {
            return res.status(429).json({
                success: false,
                message: "Gold plan allows 1 boost per week. Upgrade to Platinum for unlimited boosts.",
            });
        }

        // Create boost payment record
        const boostPayment = new Payment({
            userId: user._id,
            amount: 0, // included in subscription
            currency: "NGN",
            status: "success",
            paymentMethod: "paystack",
            plan: "boost",
            durationDays: 1, // boost lasts 24 hours
        });
        await boostPayment.save();

        // Set boost expiry on user (24 hours from now)
        user.boostExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await user.save();

        await AdminLog.create({
            adminId: user._id,
            action: "profile_boosted",
            targetUserId: user._id,
            details: { tier: user.premiumTier, expiresAt: user.boostExpires },
        });

        res.json({
            success: true,
            message: "Your profile is boosted for 24 hours! 🚀",
            boostExpires: user.boostExpires,
        });
    } catch (err) {
        console.error("[Premium/Boost]", err);
        res.status(500).json({ success: false, message: "Failed to boost profile" });
    }
});

// ─── GET /boost-status ─────────────────────────────────────────────────────────
router.get("/boost-status", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const user = await User.findById(req.user.userId).select("boostExpires premiumTier isPremium");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const isBoosted = user.boostExpires && new Date(user.boostExpires) > new Date();
        const boostEndsAt = isBoosted ? user.boostExpires : null;

        // Calculate remaining boosts for Gold
        let remainingBoosts = null;
        if (user.isPremium && user.premiumTier === "gold") {
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const recentBoosts = await Payment.countDocuments({
                userId: user._id,
                plan: "boost",
                createdAt: { $gte: oneWeekAgo },
            });
            remainingBoosts = Math.max(0, 1 - recentBoosts);
        }

        res.json({
            success: true,
            isBoosted,
            boostEndsAt,
            remainingBoosts,
            tier: user.premiumTier,
        });
    } catch (err) {
        console.error("[Premium/BoostStatus]", err);
        res.status(500).json({ success: false, message: "Failed to get boost status" });
    }
});

// ─── GET /analytics ────────────────────────────────────────────────────────────
router.get("/analytics", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const userId = req.user.userId;

        // Get subscription info
        const subscription = await Subscription.findOne({ userId, status: "active" }).lean();

        // Get payment history stats
        const payments = await Payment.find({ userId }).sort({ createdAt: -1 }).lean();
        const totalSpent = payments
            .filter(p => p.status === "success")
            .reduce((sum, p) => sum + (p.amount || 0), 0);

        // Calculate days since premium
        let daysSincePremium = 0;
        if (subscription) {
            daysSincePremium = Math.floor(
                (Date.now() - new Date(subscription.startDate).getTime()) / (1000 * 60 * 60 * 24)
            );
        }

        // Count total likes received (from Match model)
        let totalLikesReceived = 0;
        try {
            const Match = mongoose.model("Match");
            totalLikesReceived = await Match.countDocuments({
                matchedUserId: userId,
                userLiked: true,
            });
        } catch { /* model may not exist */ }

        // Count total matches
        let totalMatches = 0;
        try {
            const Match = mongoose.model("Match");
            totalMatches = await Match.countDocuments({
                $or: [
                    { userId, status: "matched" },
                    { matchedUserId: userId, status: "matched" },
                ],
            });
        } catch { /* model may not exist */ }

        // Count profile views (if tracked)
        let profileViews = 0;
        try {
            const ProfileView = mongoose.model("ProfileView");
            profileViews = await ProfileView.countDocuments({ viewedUserId: userId });
        } catch { /* model may not exist */ }

        res.json({
            success: true,
            analytics: {
                totalSpent,
                totalPayments: payments.filter(p => p.status === "success").length,
                daysSincePremium,
                totalLikesReceived,
                totalMatches,
                profileViews,
                currentPlan: subscription?.plan || null,
                subscriptionStart: subscription?.startDate || null,
                subscriptionEnd: subscription?.endDate || null,
                autoRenew: subscription?.autoRenew ?? false,
            },
        });
    } catch (err) {
        console.error("[Premium/Analytics]", err);
        res.status(500).json({ success: false, message: "Failed to get analytics" });
    }
});

// ─── POST /expire-check ────────────────────────────────────────────────────────
// Internal endpoint to check and expire subscriptions (can be called by cron)
router.post("/expire-check", async (req, res) => {
    try {
        // Simple API key check for cron job security
        const apiKey = req.headers["x-api-key"];
        if (apiKey !== process.env.CRON_API_KEY && process.env.CRON_API_KEY) {
            return res.status(401).json({ success: false, message: "Invalid API key" });
        }

        const now = new Date();

        // Find all expired active subscriptions
        const expiredSubs = await Subscription.find({
            status: "active",
            endDate: { $lte: now },
        });

        let expiredCount = 0;
        for (const sub of expiredSubs) {
            sub.status = "expired";
            sub.autoRenew = false;
            await sub.save();

            // Downgrade user
            const user = await User.findById(sub.userId);
            if (user) {
                user.isPremium = false;
                user.premiumTier = "basic";
                user.premiumExpires = undefined;
                await user.save();

                // Emit socket event
                if (global.io) {
                    global.io.to(`user:${user._id}`).emit("premium_status_changed", {
                        isPremium: false,
                        premiumTier: "basic",
                        premiumExpires: null,
                    });
                }

                // Create notification
                try {
                    const { createNotification } = await import("../services/notificationService.js");
                    await createNotification({
                        userId: user._id,
                        type: "premium_expired",
                        title: "Premium Expired 💔",
                        message: "Your premium subscription has expired. Renew to keep enjoying premium features!",
                        icon: "💔",
                    });
                } catch { /* silent */ }
            }

            expiredCount++;
        }

        // Also check for expired boosts
        const UserModel = mongoose.model("User");
        const expiredBoosts = await UserModel.updateMany(
            { boostExpires: { $lte: now } },
            { $unset: { boostExpires: "" } }
        );

        res.json({
            success: true,
            expiredSubscriptions: expiredCount,
            expiredBoosts: expiredBoosts.modifiedCount,
        });
    } catch (err) {
        console.error("[Premium/ExpireCheck]", err);
        res.status(500).json({ success: false, message: "Failed to check expirations" });
    }
});

export default router;