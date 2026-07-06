import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        subscriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subscription",
        },
        amount: { type: Number, required: true },
        currency: { type: String, default: "NGN" },
        status: {
            type: String,
            enum: ["pending", "success", "failed", "refunded"],
            default: "pending",
        },
        paymentMethod: {
            type: String,
            enum: ["paystack", "stripe", "admin"],
            required: true,
        },
        // Paystack
        paystackReference: { type: String, unique: true, sparse: true },
        paystackAccessCode: String,
        paystackTransactionData: mongoose.Schema.Types.Mixed,
        // Stripe
        stripePaymentIntentId: String,
        stripeChargeId: String,
        // Plan details
        plan: {
            type: String,
            enum: ["basic", "gold", "platinum"],
        },
        durationDays: { type: Number, default: 30 },
        // Admin
        processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        notes: String,
        // Metadata (flexible)
        metadata: mongoose.Schema.Types.Mixed,
        // Refund
        refundedAt: Date,
        refundReason: String,
    },
    { timestamps: true }
);

// Indexes
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ paystackReference: 1 }, { unique: true, sparse: true });
paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model("Payment", paymentSchema);