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
import { notifySuggestionsChanged } from "../services/suggestionService.js";

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
    // Include role and isAdmin so the frontend can show the Admin button immediately
    // after login without waiting for /auth/me
    role: u.role ?? "user",
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
 * Hash an OTP using SHA-256 HMAC instead of bcrypt.
 *
 * A 6-digit code that expires in 10 minutes does NOT need bcrypt:
 *   - Short window makes brute-force irrelevant even with fast hashing
 *   - SHA-256 HMAC with a secret is cryptographically secure
 *   - Takes <1ms vs ~400ms for bcrypt cost-10
 *
 * Uses JWT_SECRET as the HMAC key so the hash is environment-specific.
 */
const OTP_HMAC_SECRET = process.env.JWT_SECRET || "dateclone_otp_hmac_secret";

const hashOtpFast = (plainOtp) => {
    return crypto
        .createHmac("sha256", OTP_HMAC_SECRET)
        .update(String(plainOtp))
        .digest("hex");
};

const compareOtpFast = (plainOtp, storedHash) => {
    const computed = hashOtpFast(plainOtp);
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(computed, "hex"),
        Buffer.from(storedHash, "hex")
    );
};

/**
 * Activate a user after successful OTP verification.
 * Supports both fast HMAC hashes (new) and legacy bcrypt hashes (old records).
 */
const activateWithOtp = async (email, plainOtp) => {
    const otpRecord = await Otp.findOne({
        email,
        used: false,
        expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) return null;

    // Support both fast HMAC (new) and legacy bcrypt (old) hashed OTPs
    let isValid = false;
    if (otpRecord.hashType === "hmac") {
        // Fast path: <1ms
        try {
            isValid = compareOtpFast(plainOtp, otpRecord.otp);
        } catch {
            isValid = false;
        }
    } else {
        // Legacy path: bcrypt (~300ms) for records created before this update
        isValid = await bcrypt.compare(plainOtp, otpRecord.otp);
    }

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

    sendWelcomeEmail(user.email, user.firstName).catch(() => { });

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
        // NOTE: Do NOT use .normalizeEmail() — it strips dots and plus aliases
        // (e.g. john.doe@gmail.com → johndoe@gmail.com) which breaks non-Gmail
        // addresses and causes emails to reach the wrong inbox.
        // Manual normalization (trim + lowercase) is done inside the handler.
        body("email").isEmail().withMessage("Valid email required"),
        body("password")
            .isLength({ min: 8 })
            .withMessage("Password must be at least 8 characters"),
        body("username")
            .isLength({ min: 3 })
            .trim()
            .withMessage("Username must be at least 3 characters"),
    ],
    async (req, res) => {
        const T = { start: Date.now() };
        const lap = (label) => {
            const now = Date.now();
            const delta = now - (T._last ?? T.start);
            T._last = now;
            console.log(`[Register ⏱] ${label}: +${delta}ms (total: ${now - T.start}ms)`);
        };

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

            // ── Email tracing — verify the address is preserved exactly ─────
            console.log(
                `[Register] Email pipeline:\n` +
                `  1. Received from frontend : "${email}"\n` +
                `  2. After trim+lowercase   : "${normalizedEmail}"`
            );

            // ── Step 1: Duplicate check + password hash in parallel ───────────
            // Both are independent — run them concurrently to save ~300ms
            const [existing, hashed] = await Promise.all([
                User.findOne(
                    { $or: [{ email: normalizedEmail }, { username: normalizedUsername }] },
                    { _id: 1, email: 1 }   // projection — only fetch what we need
                ),
                bcrypt.hash(password, 10),
            ]);
            lap("duplicate-check + bcrypt hash (parallel)");

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message:
                        existing.email === normalizedEmail
                            ? "This email is already registered. Please log in."
                            : "This username is already taken. Please choose another.",
                });
            }

            // ── Step 2: Prepare user + OTP (sync, no I/O) ────────────────────
            const dob = dateOfBirth ? new Date(dateOfBirth) : null;
            const age = dob ? new Date().getFullYear() - dob.getFullYear() : undefined;
            const plainOtp = generateOtp();
            const expires = new Date(Date.now() + 10 * 60 * 1000);

            // Fast HMAC hash — <1ms vs ~400ms for bcrypt
            const hashedOtp = hashOtpFast(plainOtp);
            lap("OTP generation + HMAC hash");

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

            // Build OTP document (not yet saved)
            const otpDoc = new Otp({
                userId: newUser._id,  // pre-assigned by Mongoose
                email: normalizedEmail,
                otp: hashedOtp,
                hashType: "hmac",       // marks it as fast-hash for verification
                expiresAt: expires,
                used: false,
            });

            // ── Step 3: Save user + OTP in parallel ───────────────────────────
            await Promise.all([newUser.save(), otpDoc.save()]);
            lap("user + OTP saved (parallel)");

            console.log(
                `[Register] ✅ Saved to database:\n` +
                `  Email stored in User:  "${newUser.email}"\n` +
                `  Email stored in OTP:   "${otpDoc.email}"\n` +
                `  OTP code:              ${plainOtp}`
            );

            // ── Step 4: Respond immediately — don't wait for email ────────────
            const token = generateToken(newUser._id);
            res.status(201).json({
                success: true,
                message: "Account created. Enter the 6-digit verification code sent to your email.",
                token,
                user: publicUser(newUser),
            });
            lap("response sent");

            // ── Step 5: Notify all connected clients that a new user registered ──
            // This triggers real-time suggestion updates for all online users
            try {
                const { emitUserRegistered } = await import("../server.js");
                emitUserRegistered(newUser._id.toString());
            } catch (e) {
                // Socket may not be available yet
            }

            // ── Step 6: Send verification email in background ─────────────────
            // This runs AFTER the response has been sent — SMTP latency is invisible to the user.
            sendVerificationEmail(normalizedEmail, plainOtp).then(() => {
                lap("background email sent");
            }).catch((err) => {
                console.error("[Register] Background email failed:", {
                    message: err.message,
                    code: err.code,
                    command: err.command,
                    response: err.response,
                });
                // OTP is still in the DB and printed to console — user can still verify.
                // No rollback needed: account is already created and user has been told to check email.
            });

            const total = Date.now() - T.start;
            console.log(`[Register ⏱] ✅ Total time to response: ${total}ms`);

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

        // Notify all clients that a user completed their profile (became eligible)
        try {
            notifySuggestionsChanged();
        } catch (e) {
            // silent
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
        const hashedOtp = hashOtpFast(plainOtp);

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
            hashType: "hmac",
            expiresAt: expires,
            used: false,
            resendCount: rateCheck.record ? rateCheck.record.resendCount + 1 : 1,
            resendFirstAt: rateCheck.record ? rateCheck.record.resendFirstAt : now,
        });
        await otpRecord.save();

        // Respond immediately — send email in background
        res.json({ success: true, message: "A new verification code has been sent to your email." });

        sendVerificationEmail(email, plainOtp).catch((err) => {
            console.error("[ResendVerification] Background email failed:", err.message);
        });
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
    // NOTE: Do NOT use .normalizeEmail() — it mutates the email (strips dots, etc.)
    [body("email").isEmail(), body("password").notEmpty()],
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
    // NOTE: Do NOT use .normalizeEmail() — it mutates the email
    [body("email").isEmail()],
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