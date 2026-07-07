import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

// Lazy-initialize Stripe so a missing key doesn't crash the server at startup.
// Routes that need Stripe will call getStripe() and get a clear error if unconfigured.
let _stripe = null;
const getStripe = () => {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key || key.startsWith("sk_test_xxx")) {
            console.warn("[PaymentService] STRIPE_SECRET_KEY is not configured — Stripe payments are disabled.");
            return null;
        }
        _stripe = new Stripe(key);
    }
    return _stripe;
};

export const createPaymentIntent = async (userId, tier, amount) => {
    const stripe = getStripe();
    if (!stripe) throw new Error("Stripe is not configured on this server.");
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100,
            currency: "usd",
            metadata: { userId, tier },
            payment_method_types: ["card"],
        });
        return paymentIntent;
    } catch (error) {
        throw new Error(`Payment intent creation failed: ${error.message}`);
    }
};

export const confirmPayment = async (paymentIntentId) => {
    const stripe = getStripe();
    if (!stripe) throw new Error("Stripe is not configured on this server.");
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status === "succeeded") {
            return { success: true, paymentIntent };
        }
        return { success: false, message: "Payment not completed" };
    } catch (error) {
        throw new Error(`Payment confirmation failed: ${error.message}`);
    }
};

export const createCustomer = async (email, name) => {
    const stripe = getStripe();
    if (!stripe) throw new Error("Stripe is not configured on this server.");
    try {
        const customer = await stripe.customers.create({ email, name });
        return customer;
    } catch (error) {
        throw new Error(`Customer creation failed: ${error.message}`);
    }
};

export const createSubscription = async (customerId, priceId) => {
    const stripe = getStripe();
    if (!stripe) throw new Error("Stripe is not configured on this server.");
    try {
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: "default_incomplete",
            expand: ["latest_invoice.payment_intent"],
        });
        return subscription;
    } catch (error) {
        throw new Error(`Subscription creation failed: ${error.message}`);
    }
};

export const cancelSubscription = async (subscriptionId) => {
    const stripe = getStripe();
    if (!stripe) throw new Error("Stripe is not configured on this server.");
    try {
        const subscription = await stripe.subscriptions.del(subscriptionId);
        return subscription;
    } catch (error) {
        throw new Error(`Subscription cancellation failed: ${error.message}`);
    }
};

export const getPricingPlans = () => {
    return {
        gold: {
            tier: "gold",
            name: "Gold",
            monthlyPrice: 9.99,
            annualPrice: 99.99,
            features: [
                "See who likes you",
                "Advanced filters",
                "Message anyone",
                "Unlimited likes",
            ],
        },
        platinum: {
            tier: "platinum",
            name: "Platinum",
            monthlyPrice: 19.99,
            annualPrice: 199.99,
            features: [
                "All Gold features",
                "Priority visibility",
                "Verified badge",
                "Instant messaging",
                "Hide your profile",
                "Rematch feature",
                "24/7 support",
            ],
        },
    };
};
