import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import { body, validationResult } from "express-validator";
import { User } from "../models/User.js";
import { Otp } from "../models/Otp.js";
import {
    authenticateToken,
    generateToken,
    generateRefreshToken,
    verifyRefreshToken,
} from "../middleware/auth.js";
import {
    sendVerificationEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail,
} from "../services/emailService.js";
import { onboardMember } from "../services/onboardingService.js";

const router = express.Router();
const PUB_FIELDS =
    "-password -verificationToken -verificationTokenExpires -passwordResetToken -passwordResetExpires -refreshTokens";

const dbOk = () => mongoose.connection.readyState === 1;

const ensureDb = (res) => {
    if (dbOk()) return true;
    res.status(503).json({
        success: false,
        message: "Database not connected. Please try again shortly.",
    });
    return false;
};

const publicUser = (u) => ({
    _id: u._id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    username: u.username,
    profilePicture: u.profilePicture,
    isMember: u.isMember ?? false,
    isActive: u.isActive ?? true,
    isAdmin: u.isAdmin ?? false,
    emailVerified: u.emailVerified ?? false,
    profileCompletion: u.profileCompletion ?? 0,
    memberSince: u.memberSince,
    isPremium: u.isPremium ?? false,
    premiumTier: u.premiumTier ?? "basic",
});

/**
 * Generate a secure random 6-digit OTP using crypto.randomInt.
 */
const generateOtp = () => {
    return Math.floor(100000 + crypto.randomInt(0, 900000)).toString();
};

/**
 * Activate a user after successful OTP verification.
 * Uses the dedicated Otp model with hashed OTPs for security.
 */
const activateWithOtp = async (email, plainOtp) => {
    const otpRecord = await Otp.findOne({
        email,
        used: false,
        expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) return null;

    const isValid = await otpRecord.compareOtp(plainOtp);
    if (!isValid) return null;

    // Mark OTP as used
    otpRecord.used = true;
    await otpRecord.save();

    // Find and activate the user
    const user = await User.findById(otpRecord.userId);
    if (!user) return null;

    await onboardMember(user);

    const refreshToken = generateRefreshToken(user._id);
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push(refreshToken);
    await user.save();

    sendWelcomeEmail(user.email, user.firstName).catch(() => {});

    return {
        user,
        token: generateToken(user._id),
        refreshToken,
    };
};

// ── Rate limiting for resend endpoint ─────────────────────────────────────────
// Maximum 3 resends per 15-minute window
const checkResendRateLimit = async (email) => {
    const now = new Date();
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);

    // Find the most recent OTP record for this email
    const recent = await Otp.findOne({
        email,
        createdAt: { $gte: fifteenMinAgo },
    }).sort({ createdAt: -1 });

    if (!recent) return { allowed: true };

    // If the last resend was more than 15 minutes ago, reset the counter
    if (recent.resendFirstAt && recent.resendFirstAt < fifteenMinAgo) {
        recent.resendCount = 0;
        recent.resendFirstAt = null;
        await recent.save();
        return { allowed: true };
    }

    if (recent.resendCount >= 3) {
        return {
            allowed: false,
            message: "Too many resend attempts. Please wait 15 minutes before trying again.",
        };
    }

    return { allowed: true, record: recent };
};

// ── POST /register ────────────────────────────────────────────────────────────
router.post(
    "/register",
    [
        body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
        body("password")
            .isLength({ min: 8 })
            .withMessage("Password must be at least 8 characters"),
        body("username")
            .isLength({ min: 3 })
            .trim()
            .withMessage("Username must be at least 3 characters"),
    ],
    async (req, res) => {
        try {
            if (!ensureDb(res)) return;

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const {
                firstName, lastName, username, email, phone,
                password, confirmPassword, dateOfBirth, gender, lookingFor,
                country, state, city, latitude, longitude,
                profilePicture, aboutMe, occupation, education,
                languages, interests, smoking, drinking,
                minAge, maxAge, preferredCountry, preferredDistance,
                relationshipGoal, hasChildren, wantsChildren,
                religion, religionImportance, relationshipValue,
            } = req.body;

            if (!firstName || !lastName || !username || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "All required fields must be provided.",
                });
            }

            if (password !== confirmPassword) {
                return res
                    .status(400)
                    .json({ success: false, message: "Passwords do not match." });
            }

            const normalizedEmail = String(email).trim().toLowerCase();
            const normalizedUsername = String(username).trim().toLowerCase();

            const existing = await User.findOne({
                $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
            });

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message:
                        existing.email === normalizedEmail
                            ? "This email is already registered. Please log in."
                            : "This username is already taken. Please choose another.",
                });
            }

            // Generate secure OTP
            const plainOtp = generateOtp();
            const expires = new Date(Date.now() + 10 * 60 * 1000);
            const dob = dateOfBirth ? new Date(dateOfBirth) : null;
            const age = dob
                ? new Date().getFullYear() - dob.getFullYear()
                : undefined;

            // Use bcrypt with cost 10 for password hashing (balances speed + security)
            const hashed = await bcrypt.hash(password, 10);

            const newUser = new User({
                firstName,
                lastName,
                username: normalizedUsername,
                email: normalizedEmail,
                phone,
                password: hashed,
                dateOfBirth,
                age,
                gender,
                lookingFor,
                country,
                state,
                city,
                latitude,
                longitude,
                profilePicture,
                aboutMe,
                occupation,
                education,
                languages: Array.isArray(languages) ? languages : [],
                interests: Array.isArray(interests) ? interests : [],
                smoking,
                drinking,
                minAge: Number(minAge) || 18,
                maxAge: Number(maxAge) || 50,
                preferredCountry,
                preferredDistance,
                relationshipGoal,
                hasChildren,
                wantsChildren,
                religion,
                religionImportance,
                relationshipValue,
                isMember: false,
                isActive: true,
                onboardingComplete: false,
            });

            await newUser.save();
            console.log(`[Register] User saved to MongoDB: ${normalizedEmail}`);

            // Save hashed OTP to the dedicated Otp collection
            const hashedOtp = await Otp.hashOtp(plainOtp);
            const otpRecord = new Otp({
                userId: newUser._id,
                email: normalizedEmail,
                otp: hashedOtp,
                expiresAt: expires,
                used: false,
            });
            await otpRecord.save();

            // Send verification email
            try {
                await sendVerificationEmail(normalizedEmail, plainOtp);
            } catch (err) {
                await User.findByIdAndDelete(newUser._id);
                await Otp.deleteMany({ email: normalizedEmail });
                console.error("[Register] Verification email failed:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not send verification email. Please try again.",
                });
            }

            return res.status(201).json({
                success: true,
                message: "Account created. Enter the 6-digit verification code sent to your email.",
                token: generateToken(newUser._id),
                user: publicUser(newUser),
            });
        } catch (err) {
            console.error("[Register]", err);
            return res.status(500).json({
                success: false,
                message: "Registration failed. Please try again.",
            });
        }
    }
);

// ── POST /verify-otp ──────────────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const email = String(req.body.email || "").trim().toLowerCase();
        const otp = String(req.body.otp || "").trim();

        if (!email || !otp) {
            return res
                .status(400)
                .json({ success: false, message: "Email and OTP are required." });
        }

        const result = await activateWithOtp(email, otp);
        if (!result) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification code.",
            });
        }

        return res.json({
            success: true,
            message: "Email verified successfully.",
            token: result.token,
            refreshToken: result.refreshToken,
            user: publicUser(result.user),
        });
    } catch (err) {
        console.error("[VerifyOTP]", err);
        return res
            .status(500)
            .json({ success: false, message: "Verification failed." });
    }
});

// ── POST /verify-email (alias for verify-otp for backwards compatibility) ─────
router.post("/verify-email", async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const email = String(req.body.email || "").trim().toLowerCase();
        const token = String(req.body.token || req.body.otp || "").trim();

        if (!email || !token) {
            return res.status(400).json({
                success: false,
                message: "Email and verification token are required.",
            });
        }

        const result = await activateWithOtp(email, token);
        if (!result) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification token.",
            });
        }

        return res.json({
            success: true,
            message: "Email verified successfully.",
            token: result.token,
            refreshToken: result.refreshToken,
            user: publicUser(result.user),
        });
    } catch (err) {
        console.error("[VerifyEmail]", err);
        return res
            .status(500)
            .json({ success: false, message: "Verification failed." });
    }
});

// ── POST /resend-verification ─────────────────────────────────────────────────
// Rate limited: max 3 resends every 15 minutes
router.post("/resend-verification", async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const email = String(req.body.email || "").trim().toLowerCase();
        if (!email) {
            return res
                .status(400)
                .json({ success: false, message: "Email is required." });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res
                .status(404)
                .json({ success: false, message: "No account found with that email." });
        }

        if (user.emailVerified) {
            return res
                .status(400)
                .json({ success: false, message: "Email is already verified." });
        }

        // Check rate limit: max 3 resends per 15 minutes
        const rateCheck = await checkResendRateLimit(email);
        if (!rateCheck.allowed) {
            return res.status(429).json({ success: false, message: rateCheck.message });
        }

        // Generate a new OTP
        const plainOtp = generateOtp();
        const expires = new Date(Date.now() + 10 * 60 * 1000);
        const hashedOtp = await Otp.hashOtp(plainOtp);

        // Invalidate old unused OTPs for this email
        await Otp.updateMany(
            { email, used: false },
            { $set: { used: true } }
        );

        // Create new OTP record
        const now = new Date();
        const otpRecord = new Otp({
            userId: user._id,
            email,
            otp: hashedOtp,
            expiresAt: expires,
            used: false,
            resendCount: rateCheck.record ? rateCheck.record.resendCount + 1 : 1,
            resendFirstAt: rateCheck.record ? rateCheck.record.resendFirstAt : now,
        });
        await otpRecord.save();

        // Send the verification email
        try {
            await sendVerificationEmail(email, plainOtp);
        } catch (err) {
            console.error("[ResendVerification] Email error:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to send verification email. Please try again.",
            });
        }

        return res.json({ success: true, message: "A new verification code has been sent to your email." });
    } catch (err) {
        console.error("[ResendVerification]", err);
        return res
            .status(500)
            .json({ success: false, message: "Resend failed. Please try again." });
    }
});

// ── POST /login ───────────────────────────────────────────────────────────────
router.post(
    "/login",
    [body("email").isEmail().normalizeEmail(), body("password").notEmpty()],
    async (req, res) => {
        try {
            if (!ensureDb(res)) return;

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Valid email and password are required.",
                });
            }

            const email = String(req.body.email).trim().toLowerCase();
            const { password, rememberMe = false } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "No account found with that email.",
                });
            }

            if (user.isBanned) {
                return res.status(403).json({
                    success: false,
                    message: "Account suspended. Contact support.",
                });
            }

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                return res.status(401).json({
                    success: false,
                    message: "Incorrect password. Please try again.",
                });
            }

            user.lastLogin = new Date();

            const token = generateToken(user._id, rememberMe ? "30d" : "7d");
            const refreshToken = generateRefreshToken(user._id);
            user.refreshTokens = user.refreshTokens || [];
            if (user.refreshTokens.length >= 5) user.refreshTokens.shift();
            user.refreshTokens.push(refreshToken);
            await user.save();

            return res.json({
                success: true,
                message: "Login successful.",
                token,
                refreshToken,
                user: publicUser(user),
            });
        } catch (err) {
            console.error("[Login]", err);
            return res
                .status(500)
                .json({ success: false, message: "Login failed. Please try again." });
        }
    }
);

// ── POST /refresh ─────────────────────────────────────────────────────────────
router.post("/refresh", async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res
                .status(401)
                .json({ success: false, message: "Refresh token is required." });
        }

        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token. Please log in again.",
            });
        }

        const user = await User.findById(decoded.userId);
        if (!user || !user.refreshTokens?.includes(refreshToken)) {
            return res.status(401).json({
                success: false,
                message: "Refresh token revoked. Please log in again.",
            });
        }

        user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
        const newAccess = generateToken(user._id);
        const newRefresh = generateRefreshToken(user._id);
        user.refreshTokens.push(newRefresh);
        await user.save();

        return res.json({
            success: true,
            token: newAccess,
            refreshToken: newRefresh,
        });
    } catch (err) {
        console.error("[Refresh]", err);
        return res
            .status(500)
            .json({ success: false, message: "Token refresh failed." });
    }
});

// ── POST /logout ──────────────────────────────────────────────────────────────
router.post("/logout", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const { refreshToken } = req.body;
        const user = await User.findById(req.user.userId);

        if (user && refreshToken) {
            user.refreshTokens = (user.refreshTokens || []).filter(
                (t) => t !== refreshToken
            );
            await user.save();
        }

        return res.json({ success: true, message: "Logged out successfully." });
    } catch (err) {
        console.error("[Logout]", err);
        return res
            .status(500)
            .json({ success: false, message: "Logout failed." });
    }
});

// ── POST /forgot-password ─────────────────────────────────────────────────────
router.post(
    "/forgot-password",
    [body("email").isEmail().normalizeEmail()],
    async (req, res) => {
        try {
            if (!ensureDb(res)) return;

            const email = String(req.body.email || "").trim().toLowerCase();
            const genericMsg =
                "If an account with that email exists, a reset link has been sent.";

            const user = await User.findOne({ email });
            if (!user) return res.json({ success: true, message: genericMsg });

            const resetToken = crypto.randomBytes(32).toString("hex");
            user.passwordResetToken = resetToken;
            user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
            await user.save();

            await sendPasswordResetEmail(email, resetToken).catch((err) =>
                console.error("[ForgotPassword] Email error:", err.message)
            );

            return res.json({ success: true, message: genericMsg });
        } catch (err) {
            console.error("[ForgotPassword]", err);
            return res
                .status(500)
                .json({ success: false, message: "Failed to process request." });
        }
    }
);

// ── POST /reset-password ──────────────────────────────────────────────────────
router.post(
    "/reset-password",
    [body("token").notEmpty(), body("password").isLength({ min: 8 })],
    async (req, res) => {
        try {
            if (!ensureDb(res)) return;

            const { token, password } = req.body;

            const user = await User.findOne({
                passwordResetToken: token,
                passwordResetExpires: { $gt: Date.now() },
            });

            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: "Reset link is invalid or has expired.",
                });
            }

            user.password = await bcrypt.hash(password, 10);
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            user.refreshTokens = [];
            await user.save();

            return res.json({
                success: true,
                message: "Password reset successfully. You can now log in.",
            });
        } catch (err) {
            console.error("[ResetPassword]", err);
            return res
                .status(500)
                .json({ success: false, message: "Password reset failed." });
        }
    }
);

// ── GET /me ───────────────────────────────────────────────────────────────────
router.get("/me", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const user = await User.findById(req.user.userId).select(PUB_FIELDS);
        if (!user) {
            return res
                .status(404)
                .json({ success: false, message: "User not found." });
        }

        return res.json({ success: true, user });
    } catch (err) {
        console.error("[Me]", err);
        return res
            .status(500)
            .json({ success: false, message: "Failed to fetch user." });
    }
});

// ── GET /admin-check ──────────────────────────────────────────────────────────
router.get("/admin-check", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const user = await User.findById(req.user.userId).select("isAdmin email");
        if (!user?.isAdmin) {
            return res
                .status(403)
                .json({ success: false, message: "Admin access only." });
        }

        return res.json({ success: true, isAdmin: true });
    } catch (err) {
        console.error("[AdminCheck]", err);
        return res
            .status(500)
            .json({ success: false, message: "Admin check failed." });
    }
});

export default router;