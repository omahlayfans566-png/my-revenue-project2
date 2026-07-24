import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import { body, validationResult } from "express-validator";
import { User } from "../models/User.js";
import { Otp } from "../models/Otp.js";
import { LoginHistory } from "../models/LoginHistory.js";
import { ActivityLog } from "../models/ActivityLog.js";
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
    sendEmailChangeVerification,
    send2FACode,
} from "../services/emailService.js";
import { onboardMember } from "../services/onboardingService.js";
import { notifySuggestionsChanged } from "../services/suggestionService.js";

const router = express.Router();
const PUB_FIELDS =
    "-password -verificationToken -verificationTokenExpires -passwordResetToken -passwordResetExpires -refreshTokens -deviceSessions -twoFactorSecret -loginAttempts";

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
    displayName: u.displayName,
    profilePicture: u.profilePicture,
    coverPhoto: u.coverPhoto,
    isMember: u.isMember ?? false,
    isActive: u.isActive ?? true,
    role: u.role ?? "user",
    isAdmin: u.isAdmin ?? false,
    emailVerified: u.emailVerified ?? false,
    isVerified: u.isVerified ?? false,
    profileCompletion: u.profileCompletion ?? 0,
    memberSince: u.memberSince,
    isPremium: u.isPremium ?? false,
    premiumTier: u.premiumTier ?? "basic",
    twoFactorEnabled: u.twoFactorEnabled ?? false,
});

// ── Helper to log activity ─────────────────────────────────────────────────────
const logActivity = async (userId, action, details = "", req = null) => {
    try {
        await ActivityLog.create({
            userId,
            action,
            details,
            ipAddress: req?.ip || req?.headers?.["x-forwarded-for"] || "",
            userAgent: req?.headers?.["user-agent"] || "",
        });
    } catch (err) {
        console.error("[ActivityLog] Error:", err.message);
    }
};

// ── Helper to log login history ────────────────────────────────────────────────
const logLoginHistory = async (userId, success, req, failReason = "", method = "password", sessionId = "") => {
    try {
        await LoginHistory.create({
            userId,
            success,
            method,
            failReason,
            sessionId,
            ipAddress: req?.ip || req?.headers?.["x-forwarded-for"] || "",
            userAgent: req?.headers?.["user-agent"] || "",
            device: req?.headers?.["user-agent"]?.slice(0, 100) || "",
        });
    } catch (err) {
        console.error("[LoginHistory] Error:", err.message);
    }
};

// ── Helper to get device info from request ─────────────────────────────────────
const getDeviceInfo = (req) => ({
    deviceName: req.headers["x-device-name"] || "Unknown Device",
    deviceType: req.headers["x-device-type"] || "web",
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    userAgent: req.headers["user-agent"] || "",
});

// ── Check account lockout ──────────────────────────────────────────────────────
const isAccountLocked = (user) => {
    if (user.lockUntil && user.lockUntil > new Date()) {
        const remainingMs = user.lockUntil.getTime() - Date.now();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        return { locked: true, remainingMinutes };
    }
    return { locked: false };
};

// ── Handle failed login attempt ────────────────────────────────────────────────
const handleFailedLogin = async (user) => {
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    user.lastFailedLogin = new Date();

    // Lock account after 5 failed attempts
    const MAX_ATTEMPTS = 5;
    if (user.loginAttempts >= MAX_ATTEMPTS) {
        // Progressive lockout: 15min, 30min, 1hr, 2hr, 24hr
        const lockoutDurations = [15, 30, 60, 120, 1440];
        const offenseLevel = Math.min(user.loginAttempts - MAX_ATTEMPTS, lockoutDurations.length - 1);
        const lockoutMinutes = lockoutDurations[offenseLevel >= 0 ? offenseLevel : 0];
        user.lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
    }

    await user.save();
};

// ── Generate a secure random 6-digit OTP using crypto.randomInt ────────────────
const generateOtp = () => {
    return Math.floor(100000 + crypto.randomInt(0, 900000)).toString();
};

// ── Hash an OTP using SHA-256 HMAC ─────────────────────────────────────────────
const OTP_HMAC_SECRET = process.env.JWT_SECRET || "dateclone_otp_hmac_secret";

const hashOtpFast = (plainOtp) => {
    return crypto
        .createHmac("sha256", OTP_HMAC_SECRET)
        .update(String(plainOtp))
        .digest("hex");
};

const compareOtpFast = (plainOtp, storedHash) => {
    const computed = hashOtpFast(plainOtp);
    return crypto.timingSafeEqual(
        Buffer.from(computed, "hex"),
        Buffer.from(storedHash, "hex")
    );
};

// ── Activate user after OTP verification ───────────────────────────────────────
const activateWithOtp = async (email, plainOtp) => {
    const otpRecord = await Otp.findOne({
        email,
        used: false,
        expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) return null;

    let isValid = false;
    if (otpRecord.hashType === "hmac") {
        try {
            isValid = compareOtpFast(plainOtp, otpRecord.otp);
        } catch {
            isValid = false;
        }
    } else {
        isValid = await bcrypt.compare(plainOtp, otpRecord.otp);
    }

    if (!isValid) return null;

    otpRecord.used = true;
    await otpRecord.save();

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
const checkResendRateLimit = async (email) => {
    const now = new Date();
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const recent = await Otp.findOne({
        email,
        createdAt: { $gte: fifteenMinAgo },
    }).sort({ createdAt: -1 });

    if (!recent) return { allowed: true };

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

// ════════════════════════════════════════════════════════════════════════════════
// REGISTRATION
// ════════════════════════════════════════════════════════════════════════════════

// ── POST /register ────────────────────────────────────────────────────────────
router.post(
    "/register",
    [
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
                languages, interests, hobbies, smoking, drinking,
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

            const [existing, hashed] = await Promise.all([
                User.findOne(
                    { $or: [{ email: normalizedEmail }, { username: normalizedUsername }] },
                    { _id: 1, email: 1 }
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

            const dob = dateOfBirth ? new Date(dateOfBirth) : null;
            const age = dob ? new Date().getFullYear() - dob.getFullYear() : undefined;
            const plainOtp = generateOtp();
            const expires = new Date(Date.now() + 10 * 60 * 1000);
            const hashedOtp = hashOtpFast(plainOtp);
            lap("OTP generation + HMAC hash");

            const newUser = new User({
                firstName,
                lastName,
                displayName: `${firstName} ${lastName}`,
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
                hobbies: Array.isArray(hobbies) ? hobbies : [],
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

            const otpDoc = new Otp({
                userId: newUser._id,
                email: normalizedEmail,
                otp: hashedOtp,
                hashType: "hmac",
                expiresAt: expires,
                used: false,
            });

            await Promise.all([newUser.save(), otpDoc.save()]);
            lap("user + OTP saved (parallel)");

            const token = generateToken(newUser._id);
            res.status(201).json({
                success: true,
                message: "Account created. Enter the 6-digit verification code sent to your email.",
                token,
                user: publicUser(newUser),
            });
            lap("response sent");

            // Log activity
            await logActivity(newUser._id, "register", "Account created", req);

            // Notify suggestions
            try {
                const { emitUserRegistered } = await import("../server.js");
                emitUserRegistered(newUser._id.toString());
            } catch (e) { /* silent */ }

            // Send verification email in background
            sendVerificationEmail(normalizedEmail, plainOtp).then(() => {
                lap("background email sent");
            }).catch((err) => {
                console.error("[Register] Background email failed:", err.message);
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

// ════════════════════════════════════════════════════════════════════════════════
// EMAIL VERIFICATION
// ════════════════════════════════════════════════════════════════════════════════

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

        await logActivity(result.user._id, "email_verified", "Email verified via OTP", req);

        try {
            notifySuggestionsChanged();
        } catch (e) { /* silent */ }

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

// ── POST /verify-email (alias for verify-otp) ─────────────────────────────────
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

        await logActivity(result.user._id, "email_verified", "Email verified", req);

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

        const rateCheck = await checkResendRateLimit(email);
        if (!rateCheck.allowed) {
            return res.status(429).json({ success: false, message: rateCheck.message });
        }

        const plainOtp = generateOtp();
        const expires = new Date(Date.now() + 10 * 60 * 1000);
        const hashedOtp = hashOtpFast(plainOtp);

        await Otp.updateMany(
            { email, used: false },
            { $set: { used: true } }
        );

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

// ════════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════════

// ── POST /login ───────────────────────────────────────────────────────────────
router.post(
    "/login",
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
                await logLoginHistory(null, false, req, "No account found");
                return res.status(401).json({
                    success: false,
                    message: "No account found with that email.",
                });
            }

            // Check account lockout
            const lockStatus = isAccountLocked(user);
            if (lockStatus.locked) {
                await logLoginHistory(user._id, false, req, "Account locked");
                return res.status(429).json({
                    success: false,
                    message: `Account temporarily locked. Try again in ${lockStatus.remainingMinutes} minutes.`,
                    code: "ACCOUNT_LOCKED",
                    remainingMinutes: lockStatus.remainingMinutes,
                });
            }

            if (user.isBanned) {
                await logLoginHistory(user._id, false, req, "Account banned");
                return res.status(403).json({
                    success: false,
                    message: "Account suspended. Contact support.",
                });
            }

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                await handleFailedLogin(user);
                await logLoginHistory(user._id, false, req, "Incorrect password");
                return res.status(401).json({
                    success: false,
                    message: "Incorrect password. Please try again.",
                });
            }

            // Reset login attempts on success
            user.loginAttempts = 0;
            user.lockUntil = undefined;
            user.lastLogin = new Date();

            const token = generateToken(user._id, rememberMe ? "30d" : "7d");
            const refreshToken = generateRefreshToken(user._id);
            user.refreshTokens = user.refreshTokens || [];
            if (user.refreshTokens.length >= 10) user.refreshTokens.shift();
            user.refreshTokens.push(refreshToken);

            // Track device session
            const deviceInfo = getDeviceInfo(req);
            user.deviceSessions = user.deviceSessions || [];
            if (user.deviceSessions.length >= 10) user.deviceSessions.shift();
            user.deviceSessions.push({
                token: refreshToken,
                ...deviceInfo,
                lastActive: new Date(),
            });

            await user.save();

            // Check if 2FA is enabled
            if (user.twoFactorEnabled) {
                // Generate and send 2FA OTP
                const twoFactorOtp = generateOtp();
                const hashed2FAOtp = hashOtpFast(twoFactorOtp);

                await Otp.create({
                    userId: user._id,
                    email: user.email,
                    otp: hashed2FAOtp,
                    hashType: "hmac",
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
                    used: false,
                    purpose: "2fa",
                });

                // Send 2FA code via email
                send2FACode(user.email, twoFactorOtp).catch(err => {
                    console.error("[2FA] Email failed:", err.message);
                });

                await logLoginHistory(user._id, true, req, "", "password", refreshToken);
                await logActivity(user._id, "login", "2FA required", req);

                return res.json({
                    success: true,
                    message: "2FA code sent to your email.",
                    requires2FA: true,
                    tempToken: token,
                    userId: user._id,
                });
            }

            await logLoginHistory(user._id, true, req, "", "password", refreshToken);
            await logActivity(user._id, "login", "Login successful", req);

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

// ── POST /verify-2fa ──────────────────────────────────────────────────────────
router.post("/verify-2fa", async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const { userId, otp, tempToken } = req.body;
        if (!userId || !otp) {
            return res.status(400).json({
                success: false,
                message: "User ID and 2FA code are required.",
            });
        }

        const otpRecord = await Otp.findOne({
            userId,
            used: false,
            purpose: "2fa",
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired 2FA code.",
            });
        }

        let isValid = false;
        try {
            isValid = compareOtpFast(otp, otpRecord.otp);
        } catch {
            isValid = false;
        }

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid 2FA code. Please try again.",
            });
        }

        otpRecord.used = true;
        await otpRecord.save();

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const refreshToken = generateRefreshToken(user._id);
        user.refreshTokens = user.refreshTokens || [];
        user.refreshTokens.push(refreshToken);

        const deviceInfo = getDeviceInfo(req);
        user.deviceSessions = user.deviceSessions || [];
        user.deviceSessions.push({
            token: refreshToken,
            ...deviceInfo,
            lastActive: new Date(),
        });
        await user.save();

        const finalToken = generateToken(user._id);

        await logActivity(user._id, "2fa_verified", "2FA verification successful", req);

        return res.json({
            success: true,
            message: "2FA verified successfully.",
            token: finalToken,
            refreshToken,
            user: publicUser(user),
        });
    } catch (err) {
        console.error("[Verify2FA]", err);
        return res.status(500).json({ success: false, message: "2FA verification failed." });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// TOKEN REFRESH
// ════════════════════════════════════════════════════════════════════════════════

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
        // Also remove from device sessions
        if (user.deviceSessions) {
            user.deviceSessions = user.deviceSessions.filter(s => s.token !== refreshToken);
        }

        const newAccess = generateToken(user._id);
        const newRefresh = generateRefreshToken(user._id);
        user.refreshTokens.push(newRefresh);

        // Add new device session entry
        const deviceInfo = getDeviceInfo(req);
        user.deviceSessions = user.deviceSessions || [];
        user.deviceSessions.push({
            token: newRefresh,
            ...deviceInfo,
            lastActive: new Date(),
        });

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

// ════════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════════════════════════

// ── POST /logout ──────────────────────────────────────────────────────────────
router.post("/logout", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const { refreshToken } = req.body;
        const user = await User.findById(req.user.userId);

        if (user) {
            if (refreshToken) {
                user.refreshTokens = (user.refreshTokens || []).filter(
                    (t) => t !== refreshToken
                );
                // Remove from device sessions
                if (user.deviceSessions) {
                    user.deviceSessions = user.deviceSessions.filter(s => s.token !== refreshToken);
                }
            }
            await user.save();
            await logActivity(user._id, "logout", "Logged out from device", req);
        }

        return res.json({ success: true, message: "Logged out successfully." });
    } catch (err) {
        console.error("[Logout]", err);
        return res
            .status(500)
            .json({ success: false, message: "Logout failed." });
    }
});

// ── POST /logout-all ──────────────────────────────────────────────────────────
router.post("/logout-all", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const user = await User.findById(req.user.userId);
        if (user) {
            user.refreshTokens = [];
            user.deviceSessions = [];
            await user.save();
            await logActivity(user._id, "all_devices_logout", "Logged out from all devices", req);
        }

        return res.json({ success: true, message: "Logged out from all devices successfully." });
    } catch (err) {
        console.error("[LogoutAll]", err);
        return res.status(500).json({ success: false, message: "Logout failed." });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// PASSWORD MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

// ── POST /change-password ─────────────────────────────────────────────────────
router.post(
    "/change-password",
    authenticateToken,
    [
        body("currentPassword").notEmpty().withMessage("Current password is required"),
        body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters"),
    ],
    async (req, res) => {
        try {
            if (!ensureDb(res)) return;

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const { currentPassword, newPassword } = req.body;
            const user = await User.findById(req.user.userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found." });
            }

            const valid = await bcrypt.compare(currentPassword, user.password);
            if (!valid) {
                return res.status(400).json({
                    success: false,
                    message: "Current password is incorrect.",
                });
            }

            user.password = await bcrypt.hash(newPassword, 10);
            user.passwordChangedAt = new Date();
            // Invalidate all existing sessions
            user.refreshTokens = [];
            user.deviceSessions = [];
            await user.save();

            await logActivity(user._id, "password_changed", "Password changed", req);

            return res.json({
                success: true,
                message: "Password changed successfully. Please log in again with your new password.",
            });
        } catch (err) {
            console.error("[ChangePassword]", err);
            return res.status(500).json({ success: false, message: "Failed to change password." });
        }
    }
);

// ── POST /forgot-password ─────────────────────────────────────────────────────
router.post(
    "/forgot-password",
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
            user.deviceSessions = [];
            user.passwordChangedAt = new Date();
            await user.save();

            await logActivity(user._id, "password_changed", "Password reset via email", req);

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

// ════════════════════════════════════════════════════════════════════════════════
// EMAIL CHANGE
// ════════════════════════════════════════════════════════════════════════════════

// ── POST /change-email (initiate) ─────────────────────────────────────────────
router.post(
    "/change-email",
    authenticateToken,
    [body("newEmail").isEmail().withMessage("Valid new email required")],
    async (req, res) => {
        try {
            if (!ensureDb(res)) return;

            const newEmail = String(req.body.newEmail).trim().toLowerCase();
            const user = await User.findById(req.user.userId);

            if (!user) {
                return res.status(404).json({ success: false, message: "User not found." });
            }

            // Check if new email already in use
            const existing = await User.findOne({ email: newEmail });
            if (existing && existing._id.toString() !== user._id.toString()) {
                return res.status(409).json({
                    success: false,
                    message: "This email is already in use by another account.",
                });
            }

            // Generate verification token
            const verificationToken = crypto.randomBytes(32).toString("hex");
            user.newEmail = newEmail;
            user.newEmailToken = verificationToken;
            user.newEmailTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
            await user.save();

            // Send verification to new email
            sendEmailChangeVerification(newEmail, verificationToken).catch(err => {
                console.error("[ChangeEmail] Email error:", err.message);
            });

            return res.json({
                success: true,
                message: "Verification link sent to your new email address.",
            });
        } catch (err) {
            console.error("[ChangeEmail]", err);
            return res.status(500).json({ success: false, message: "Failed to initiate email change." });
        }
    }
);

// ── POST /confirm-email-change ────────────────────────────────────────────────
router.post("/confirm-email-change", async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Verification token required." });
        }

        const user = await User.findOne({
            newEmailToken: token,
            newEmailTokenExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Verification token is invalid or has expired.",
            });
        }

        const oldEmail = user.email;
        user.email = user.newEmail;
        user.newEmail = undefined;
        user.newEmailToken = undefined;
        user.newEmailTokenExpires = undefined;
        user.emailVerified = true; // new email is verified by this action
        await user.save();

        await logActivity(user._id, "email_changed", `Email changed from ${oldEmail} to ${user.email}`, req);

        return res.json({
            success: true,
            message: "Email changed successfully.",
        });
    } catch (err) {
        console.error("[ConfirmEmailChange]", err);
        return res.status(500).json({ success: false, message: "Failed to confirm email change." });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// 2FA MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

// ── POST /enable-2fa ──────────────────────────────────────────────────────────
router.post("/enable-2fa", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (user.twoFactorEnabled) {
            return res.status(400).json({ success: false, message: "2FA is already enabled." });
        }

        // Generate and send OTP to verify
        const otp = generateOtp();
        const hashedOtp = hashOtpFast(otp);

        await Otp.create({
            userId: user._id,
            email: user.email,
            otp: hashedOtp,
            hashType: "hmac",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            used: false,
            purpose: "2fa_enable",
        });

        send2FACode(user.email, otp).catch(err => {
            console.error("[Enable2FA] Email error:", err.message);
        });

        return res.json({
            success: true,
            message: "Verification code sent to your email. Enter it to confirm enabling 2FA.",
            tempToken: generateToken(user._id, "5m"),
        });
    } catch (err) {
        console.error("[Enable2FA]", err);
        return res.status(500).json({ success: false, message: "Failed to enable 2FA." });
    }
});

// ── POST /confirm-enable-2fa ──────────────────────────────────────────────────
router.post("/confirm-enable-2fa", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const { otp } = req.body;
        if (!otp) {
            return res.status(400).json({ success: false, message: "Verification code required." });
        }

        const otpRecord = await Otp.findOne({
            userId: req.user.userId,
            used: false,
            purpose: "2fa_enable",
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({ success: false, message: "Invalid or expired verification code." });
        }

        let isValid = false;
        try {
            isValid = compareOtpFast(otp, otpRecord.otp);
        } catch {
            isValid = false;
        }

        if (!isValid) {
            return res.status(400).json({ success: false, message: "Invalid verification code." });
        }

        otpRecord.used = true;
        await otpRecord.save();

        const user = await User.findById(req.user.userId);
        user.twoFactorEnabled = true;
        user.twoFactorMethod = "email";
        await user.save();

        await logActivity(user._id, "2fa_enabled", "Two-factor authentication enabled", req);

        return res.json({
            success: true,
            message: "Two-factor authentication enabled successfully.",
            user: publicUser(user),
        });
    } catch (err) {
        console.error("[ConfirmEnable2FA]", err);
        return res.status(500).json({ success: false, message: "Failed to enable 2FA." });
    }
});

// ── POST /disable-2fa ─────────────────────────────────────────────────────────
router.post("/disable-2fa", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, message: "Password required to disable 2FA." });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(400).json({ success: false, message: "Incorrect password." });
        }

        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        user.twoFactorMethod = "email";
        await user.save();

        await logActivity(user._id, "2fa_disabled", "Two-factor authentication disabled", req);

        return res.json({
            success: true,
            message: "Two-factor authentication disabled.",
            user: publicUser(user),
        });
    } catch (err) {
        console.error("[Disable2FA]", err);
        return res.status(500).json({ success: false, message: "Failed to disable 2FA." });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// DEVICE / SESSION MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

// ── GET /sessions ─────────────────────────────────────────────────────────────
router.get("/sessions", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const user = await User.findById(req.user.userId).select("deviceSessions");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        return res.json({
            success: true,
            sessions: (user.deviceSessions || []).map(s => ({
                deviceName: s.deviceName,
                deviceType: s.deviceType,
                ipAddress: s.ipAddress,
                lastActive: s.lastActive,
                createdAt: s.createdAt,
                isCurrentSession: s.token === req.headers["authorization"]?.split(" ")[1]
                    ? false : false, // Simplified - frontend can determine current
            })),
        });
    } catch (err) {
        console.error("[Sessions]", err);
        return res.status(500).json({ success: false, message: "Failed to get sessions." });
    }
});

// ── DELETE /sessions/:token (remove specific session) ─────────────────────────
router.delete("/sessions/:token", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const sessionToken = req.params.token;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        user.refreshTokens = (user.refreshTokens || []).filter(t => t !== sessionToken);
        if (user.deviceSessions) {
            user.deviceSessions = user.deviceSessions.filter(s => s.token !== sessionToken);
        }
        await user.save();

        await logActivity(user._id, "device_logout", "Removed specific device session", req);

        return res.json({ success: true, message: "Session removed." });
    } catch (err) {
        console.error("[RemoveSession]", err);
        return res.status(500).json({ success: false, message: "Failed to remove session." });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// LOGIN HISTORY & ACTIVITY LOG
// ════════════════════════════════════════════════════════════════════════════════

// ── GET /login-history ────────────────────────────────────────────────────────
router.get("/login-history", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const history = await LoginHistory.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const total = await LoginHistory.countDocuments({ userId: req.user.userId });

        return res.json({
            success: true,
            history,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error("[LoginHistory]", err);
        return res.status(500).json({ success: false, message: "Failed to get login history." });
    }
});

// ── GET /activity-log ─────────────────────────────────────────────────────────
router.get("/activity-log", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const logs = await ActivityLog.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const total = await ActivityLog.countDocuments({ userId: req.user.userId });

        return res.json({
            success: true,
            logs,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error("[ActivityLog]", err);
        return res.status(500).json({ success: false, message: "Failed to get activity log." });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// ACCOUNT MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

// ── DELETE /delete-account ────────────────────────────────────────────────────
router.delete("/delete-account", authenticateToken, async (req, res) => {
    try {
        if (!ensureDb(res)) return;

        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, message: "Password required to delete account." });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(400).json({ success: false, message: "Incorrect password." });
        }

        // Soft delete
        user.isActive = false;
        user.deletedAt = new Date();
        user.email = `deleted_${user._id}@deleted.dateclone.com`;
        user.username = `deleted_${user._id}`;
        user.refreshTokens = [];
        user.deviceSessions = [];
        await user.save();

        await logActivity(user._id, "account_deleted", "Account deleted by user", req);

        return res.json({ success: true, message: "Account deleted successfully." });
    } catch (err) {
        console.error("[DeleteAccount]", err);
        return res.status(500).json({ success: false, message: "Failed to delete account." });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// USER INFO
// ════════════════════════════════════════════════════════════════════════════════

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

        return res.json({ success: true, user: publicUser(user) });
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

        const user = await User.findById(req.user.userId).select("isAdmin email role");
        if (!user?.isAdmin) {
            return res
                .status(403)
                .json({ success: false, message: "Admin access only." });
        }

        return res.json({ success: true, isAdmin: true, role: user.role });
    } catch (err) {
        console.error("[AdminCheck]", err);
        return res
            .status(500)
            .json({ success: false, message: "Admin check failed." });
    }
});

export default router;