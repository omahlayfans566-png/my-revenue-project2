import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        stripePaymentIntentId: String,
        transactionId: { type: String, unique: true },
        tier: {
            type: String,
            enum: ["gold", "platinum"],
            required: true,
        },
        amount: { type: Number, required: true },
        currency: { type: String, default: "USD" },
        durationMonths: { type: Number, default: 1 },
        status: {
            type: String,
            enum: ["pending", "completed", "failed", "refunded"],
            default: "pending",
        },
        paymentMethod: {
            type: String,
            enum: ["credit_card", "debit_card", "mobile_money"],
        },
        validFrom: Date,
        validUntil: Date,
        autoRenew: { type: Boolean, default: true },
        refundReason: String,
    },
    { timestamps: true }
);

export const Payment = mongoose.model("Payment", paymentSchema);
