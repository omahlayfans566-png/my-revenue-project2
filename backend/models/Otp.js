/**
 * Otp.js
 *
 * Dedicated OTP model for storing email verification codes.
 * OTPs are hashed before storage for security.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const otpSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        otp: {
            type: String,
            required: true,
        },
        // "hmac" = fast SHA-256 HMAC (new default), "bcrypt" = legacy
        hashType: {
            type: String,
            enum: ["bcrypt", "hmac"],
            default: "bcrypt",   // legacy default so old records still work
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        used: {
            type: Boolean,
            default: false,
        },
        purpose: {
            type: String,
            enum: ["email_verification", "2fa", "2fa_enable", "password_reset"],
            default: "email_verification",
        },
        // Rate limiting: track resend attempts
        resendCount: {
            type: Number,
            default: 0,
        },
        resendFirstAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// TTL index: automatically delete expired OTPs after 15 minutes
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient lookups
otpSchema.index({ email: 1, used: 1 });

/**
 * Hash a plain-text OTP using bcrypt.
 */
otpSchema.statics.hashOtp = async function (plainOtp) {
    return bcrypt.hash(plainOtp, 10);
};

/**
 * Compare a plain-text OTP against the stored hash.
 */
otpSchema.methods.compareOtp = async function (plainOtp) {
    return bcrypt.compare(plainOtp, this.otp);
};

export const Otp = mongoose.model("Otp", otpSchema);