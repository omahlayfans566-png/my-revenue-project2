import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createPaymentIntent = async (userId, tier, amount) => {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100, // Convert to cents
            currency: "usd",
            metadata: {
                userId,
                tier,
            },
            payment_method_types: ["card"],
        });

        return paymentIntent;
    } catch (error) {
        throw new Error(`Payment intent creation failed: ${error.message}`);
    }
};

export const confirmPayment = async (paymentIntentId) => {
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === "succeeded") {
            return {
                success: true,
                paymentIntent,
            };
        }

        return {
            success: false,
            message: "Payment not completed",
        };
    } catch (error) {
        throw new Error(`Payment confirmation failed: ${error.message}`);
    }
};

export const createCustomer = async (email, name) => {
    try {
        const customer = await stripe.customers.create({
            email,
            name,
        });

        return customer;
    } catch (error) {
        throw new Error(`Customer creation failed: ${error.message}`);
    }
};

export const createSubscription = async (customerId, priceId) => {
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
