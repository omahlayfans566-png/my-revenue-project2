import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            // index defined via compound userId_1_status_1 below
        },
        plan: {
            type: String,
            enum: ["basic", "gold", "platinum"],
            required: true,
        },
        status: {
            type: String,
            enum: ["active", "expired", "cancelled", "pending"],
            default: "active",
        },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date, required: true },
        autoRenew: { type: Boolean, default: true },
        cancelledAt: Date,
        paymentMethod: {
            type: String,
            enum: ["paystack", "stripe", "admin"],
            default: "paystack",
        },
        // Paystack specific
        paystackReference: String,
        paystackSubscriptionCode: String,
        paystackAuthorization: {
            authorizationCode: String,
            cardType: String,
            last4: String,
            expMonth: String,
            expYear: String,
            bank: String,
            channel: String,
        },
        // Stripe specific
        stripeSubscriptionId: String,
        stripeCustomerId: String,
        // Admin granted
        grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        notes: String,
    },
    { timestamps: true }
);

// Indexes
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });
subscriptionSchema.index({ paystackReference: 1 }, { sparse: true });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);