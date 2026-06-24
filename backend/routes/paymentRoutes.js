import express from "express";
import { User } from "../models/User.js";
import { Payment } from "../models/Payment.js";
import { authenticateToken } from "../middleware/auth.js";
import {
    createPaymentIntent,
    confirmPayment,
    getPricingPlans,
} from "../services/paymentService.js";
import { sendPremiumActivationEmail } from "../services/emailService.js";

const router = express.Router();

// GET: Get Pricing Plans
router.get("/pricing", (req, res) => {
    try {
        const plans = getPricingPlans();

        res.json({
            success: true,
            plans,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch pricing plans",
        });
    }
});

// POST: Create Payment Intent
router.post("/create-intent", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { tier, duration = 1 } = req.body;

        if (!tier || !["gold", "platinum"].includes(tier)) {
            return res.status(400).json({
                success: false,
                message: "Invalid tier selection",
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Get pricing plans
        const plans = getPricingPlans();
        const plan = plans[tier];

        if (!plan) {
            return res.status(400).json({
                success: false,
                message: "Invalid tier",
            });
        }

        // Calculate amount based on duration
        const amount = plan.monthlyPrice * duration;

        // Create payment intent with Stripe
        const paymentIntent = await createPaymentIntent(userId, tier, amount);

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            tier,
            amount,
            currency: "usd",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// POST: Confirm Payment
router.post("/confirm", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { paymentIntentId, tier, duration = 1 } = req.body;

        if (!paymentIntentId || !tier) {
            return res.status(400).json({
                success: false,
                message: "Payment Intent ID and tier are required",
            });
        }

        // Confirm payment with Stripe
        const { success, paymentIntent } = await confirmPayment(paymentIntentId);

        if (!success) {
            return res.status(400).json({
                success: false,
                message: "Payment not successful",
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Calculate expiry date
        const validFrom = new Date();
        const validUntil = new Date();
        validUntil.setMonth(validUntil.getMonth() + duration);

        // Create payment record
        const payment = new Payment({
            userId,
            stripePaymentIntentId: paymentIntentId,
            transactionId: paymentIntent.id,
            tier,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency.toUpperCase(),
            durationMonths: duration,
            status: "completed",
            validFrom,
            validUntil,
        });

        await payment.save();

        // Update user to premium
        user.isPremium = true;
        user.premiumTier = tier;
        user.premiumExpires = validUntil;
        user.stripeCustomerId = paymentIntent.customer || user.stripeCustomerId;

        await user.save();

        // Send premium activation email
        await sendPremiumActivationEmail(
            user.email,
            tier,
            validUntil.toLocaleDateString()
        );

        res.json({
            success: true,
            message: `Premium ${tier} activated successfully!`,
            payment,
            user: {
                _id: user._id,
                isPremium: user.isPremium,
                premiumTier: user.premiumTier,
                premiumExpires: user.premiumExpires,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// GET: Check Premium Status
router.get("/status", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if premium has expired
        if (user.isPremium && user.premiumExpires < new Date()) {
            user.isPremium = false;
            user.premiumTier = "basic";
            await user.save();
        }

        res.json({
            success: true,
            isPremium: user.isPremium,
            premiumTier: user.premiumTier,
            premiumExpires: user.premiumExpires,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch premium status",
        });
    }
});

// POST: Cancel Premium
router.post("/cancel", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (!user.isPremium) {
            return res.status(400).json({
                success: false,
                message: "User is not a premium member",
            });
        }

        user.isPremium = false;
        user.premiumTier = "basic";
        user.premiumExpires = null;

        await user.save();

        res.json({
            success: true,
            message: "Premium subscription cancelled",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to cancel premium",
        });
    }
});

export default router;
