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

// ─── Pricing Plans ─────────────────────────────────────────────────────────────
const PLANS = {
    basic: { price: 2999, priceUSD: 3.99, durationDays: 30, name: "Basic" },
    gold: { price: 5999, priceUSD: 7.99, durationDays: 30, name: "Gold" },
    platinum: { price: 9999, priceUSD: 12.99, durationDays: 30, name: "Platinum" },
};

// ─── GET /pricing ──────────────────────────────────────────────────────────────
router.get("/pricing", (_req, res) => {
    res.json({ success: true, plans: PLANS });
});

// ─── POST /initialize-paystack ─────────────────────────────────────────────────
router.post("/initialize-paystack", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const { plan: planId, durationDays = 30 } = req.body;
        const plan = PLANS[planId];
        if (!plan) return res.status(400).json({ success: false, message: "Invalid plan" });

        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const amount = plan.price * durationDays;
        const reference = `PAY-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;

        // Create pending payment record
        const payment = new Payment({
            userId: user._id,
            amount,
            currency: "NGN",
            status: "pending",
            paymentMethod: "paystack",
            paystackReference: reference,
            plan: planId,
            durationDays,
        });
        await payment.save();

        // Return the reference and amount for the frontend to initialize Paystack
        res.json({
            success: true,
            data: {
                reference,
                amount: amount * 100, // Paystack uses kobo
                email: user.email,
                plan: planId,
                durationDays,
                metadata: {
                    userId: user._id.toString(),
                    tier: planId,
                    durationDays,
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

        const { reference, plan: planId, durationDays = 30, trxref } = req.body;
        const ref = reference || trxref;

        if (!ref) return res.status(400).json({ success: false, message: "Reference is required" });

        const plan = PLANS[planId];
        if (!plan) return res.status(400).json({ success: false, message: "Invalid plan" });

        // Verify with Paystack API
        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) {
            // Fallback: trust the frontend verification (dev mode)
            return await activatePremium(req, res, planId, durationDays, ref);
        }

        try {
            const verifyRes = await fetch(
                `https://api.paystack.co/transaction/verify/${ref}`,
                { headers: { Authorization: `Bearer ${secretKey}` } }
            );
            const verifyData = await verifyRes.json();

            if (!verifyData.status || verifyData.data.status !== "success") {
                return res.status(400).json({ success: false, message: "Payment verification failed" });
            }

            // Update payment record
            await Payment.findOneAndUpdate(
                { paystackReference: ref },
                {
                    status: "success",
                    paystackTransactionData: verifyData.data,
                }
            );

            await activatePremium(req, res, planId, durationDays, ref);
        } catch (fetchErr) {
            console.error("[Premium/Verify] Paystack API error:", fetchErr.message);
            // Fallback: activate anyway in dev mode
            if (process.env.NODE_ENV !== "production") {
                return await activatePremium(req, res, planId, durationDays, ref);
            }
            res.status(502).json({ success: false, message: "Payment verification service unavailable" });
        }
    } catch (err) {
        console.error("[Premium/Verify]", err);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
});

// ─── Helper: Activate Premium ──────────────────────────────────────────────────
async function activatePremium(req, res, planId, durationDays, reference) {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const plan = PLANS[planId];
    const now = new Date();
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Create or update subscription
    let subscription = await Subscription.findOne({ userId: user._id, status: "active" });
    if (subscription) {
        // Extend existing subscription
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

    // Log
    await AdminLog.create({
        adminId: user._id,
        action: "premium_activated",
        targetUserId: user._id,
        details: { plan: planId, durationDays, reference },
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
                    plan: subscription.plan,
                    status: subscription.status,
                    startDate: subscription.startDate,
                    endDate: subscription.endDate,
                    autoRenew: subscription.autoRenew,
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

        subscription.autoRenew = false;
        subscription.cancelledAt = new Date();
        subscription.status = "cancelled";
        await subscription.save();

        // Don't remove premium immediately - let it expire
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

// ─── GET /history ──────────────────────────────────────────────────────────────
router.get("/history", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected" });

        const payments = await Payment.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        res.json({ success: true, payments });
    } catch (err) {
        console.error("[Premium/History]", err);
        res.status(500).json({ success: false, message: "Failed to get history" });
    }
});

export default router;