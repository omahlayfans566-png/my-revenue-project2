import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import { User } from "../models/User.js";
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
import { body, validationResult } from "express-validator";
import {
    memCreateUser, memFindByEmail, memFindById, memFindByUsername,
    memVerifyUser, memCheckPassword, memUpdateVerificationToken,
} from "../services/memoryStore.js";

const router = express.Router();
const PUB_FIELDS = "-password -verificationToken -verificationTokenExpires -passwordResetToken -passwordResetExpires -refreshTokens";

// ── Helpers ───────────────────────────────────────────────────────────────────
const dbOk = () => mongoose.connection.readyState === 1;

let _memWarn = false;
const warnMem = () => {
    if (_memWarn) return; _memWarn = true;
    console.warn("\n⚠️  [Auth] MongoDB unavailable — IN-MEMORY mode (data not persisted).\n   Connect to MongoDB Atlas for permanent storage.\n");
};

// Safe public shape for API responses
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

// ── POST /register ────────────────────────────────────────────────────────────
router.post(
    "/register",
    [
        body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
        body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
        body("username").isLength({ min: 3 }).trim().withMessage("Username must be at least 3 characters"),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const {
                firstName, lastName, username, email, phone,
                password, confirmPassword,
                dateOfBirth, gender, lookingFor,
                country, state, city, latitude, longitude,
                profilePicture, aboutMe, occupation, education, languages,
                interests, smoking, drinking,
                minAge, maxAge, preferredCountry, preferredDistance,
                relationshipGoal, hasChildren, wantsChildren,
                religion, religionImportance, relationshipValue,
            } = req.body;

            if (!firstName || !lastName || !username || !email || !password) {
                return res.status(400).json({ success: false, message: "All required fields must be provided." });
            }
            if (password !== confirmPassword) {
                return res.status(400).json({ success: false, message: "Passwords do not match." });
            }

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = new Date(Date.now() + 10 * 60 * 1000);
            const age = dateOfBirth
                ? new Date().getFullYear() - new Date(dateOfBirth).getFullYear()
                : 0;

            if (dbOk()) {
                // ── MongoDB path ──────────────────────────────────────────────
                const existing = await User.findOne({
                    $or: [{ email }, { username: username.toLowerCase() }],
                });
                if (existing) {
                    return res.status(409).json({
                        success: false,
                        message: existing.email === email
                            ? "This email is already registered. Please log in."
                            : "This username is already taken. Please choose another.",
                    });
                }

                const hashed = await bcrypt.hash(password, 12);
                const newUser = new User({
                    firstName, lastName,
                    username: username.toLowerCase(),
                    email, phone,
                    password: hashed,
                    dateOfBirth, age, gender, lookingFor,
                    country, state, city, latitude, longitude,
                    profilePicture, aboutMe, occupation, education,
                    languages: languages || [], interests: interests || [],
                    smoking, drinking,
                    minAge: minAge || 18, maxAge: maxAge || 50,
                    preferredCountry, preferredDistance,
                    relationshipGoal, hasChildren, wantsChildren,
                    religion, religionImportance, relationshipValue,
                    verificationToken: otp,
                    verificationTokenExpires: expires,
                    isMember: false, isActive: false, onboardingComplete: false,
                });
                await newUser.save();
                console.log(`[Register] ✅ User saved to MongoDB: ${email}`);

                sendVerificationEmail(email, otp).catch(e =>
                    console.error("[Register] Email error:", e.message)
                );

                const token = generateToken(newUser._id);
                return res.status(201).json({
                    success: true,
                    message: "Account created! Check your email (or backend terminal) for the verification code.",
                    token,
                    user: publicUser(newUser),
                });
            }

            // ── Memory fallback ───────────────────────────────────────────────
            warnMem();
            if (memFindByEmail(email)) return res.status(409).json({ success: false, message: "Email already registered (memory mode)." });
            if (memFindByUsername(username)) return res.status(409).json({ success: false, message: "Username taken (memory mode)." });

            const memUser = await memCreateUser({
                firstName, lastName, username, email, phone, password,
                dateOfBirth, age, gender, lookingFor,
                country, state, city, latitude, longitude,
                profilePicture, aboutMe, occupation, education,
                languages: languages || [], interests: interests || [],
                smoking, drinking,
                minAge: minAge || 18, maxAge: maxAge || 50,
                preferredCountry, preferredDistance,
                relationshipGoal, hasChildren, wantsChildren,
                religion, religionImportance, relationshipValue,
                verificationToken: otp, verificationTokenExpires: expires,
            });
            sendVerificationEmail(email, otp).catch(() => { });

            const token = generateToken(memUser._id);
            return res.status(201).json({
                success: true,
                message: "Account created! (⚠️ Memory mode — data will reset on server restart. Connect MongoDB for persistence.) Check backend terminal for OTP.",
                token,
                memoryMode: true,
                user: publicUser(memUser),
            });

        } catch (err) {
            console.error("[Register]", err);
            res.status(500).json({ success: false, message: "Registration failed. Please try again." });
        }
    }
);

// ── POST /verify-otp ──────────────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ success: false, message: "Email and OTP required." });

        if (dbOk()) {
            const user = await User.findOne({
                email,
                verificationToken: otp.toString().trim(),
                verificationTokenExpires: { $gt: Date.now() },
            });
            if (!user) {
                return res.status(400).json({ success: false, message: "Invalid or expired code. Request a new one." });
            }
            await onboardMember(user);
            sendWelcomeEmail(user.email, user.firstName).catch(() => { });
            const token = generateToken(user._id);
            const refreshToken = generateRefreshToken(user._id);
            user.refreshTokens = user.refreshTokens || [];
            user.refreshTokens.push(refreshToken);
            await user.save();
            console.log(`[VerifyOTP] ✅ Member activated: ${email}`);
            return res.json({
                success: true,
                message: "Email verified! Welcome to DateClone 💕",
                token,
                refreshToken,
                user: publicUser(user),
            });
        }

        warnMem();
        const memUser = memVerifyUser(email, otp.toString().trim());
        if (!memUser) return res.status(400).json({ success: false, message: "Invalid or expired code." });
        sendWelcomeEmail(email, memUser.firstName).catch(() => { });
        const token = generateToken(memUser._id);
        const refreshToken = generateRefreshToken(memUser._id);
        return res.json({
            success: true,
            message: "Email verified! Welcome to DateClone 💕 (⚠️ Memory mode)",
            token, refreshToken, memoryMode: true,
            user: publicUser(memUser),
        });

    } catch (err) {
        console.error("[VerifyOTP]", err);
        res.status(500).json({ success: false, message: "Verification failed." });
    }
});

// ── POST /resend-verification ─────────────────────────────────────────────────
router.post("/resend-verification", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required." });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        if (dbOk()) {
            const user = await User.findOne({ email });
            if (!user) return res.status(404).json({ success: false, message: "No account with that email." });
            if (user.isMember) return res.status(400).json({ success: false, message: "Email already verified." });
            user.verificationToken = otp;
            user.verificationTokenExpires = expires;
            await user.save();
        } else {
            warnMem();
            if (!memUpdateVerificationToken(email, otp, expires)) {
                return res.status(404).json({ success: false, message: "No account with that email." });
            }
        }

        await sendVerificationEmail(email, otp);
        res.json({ success: true, message: "New verification code sent." });

    } catch (err) {
        console.error("[Resend]", err);
        res.status(500).json({ success: false, message: "Resend failed." });
    }
});

// ── POST /login ───────────────────────────────────────────────────────────────
router.post(
    "/login",
    [
        body("email").isEmail().normalizeEmail(),
        body("password").notEmpty(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: "Valid email and password are required." });
            }

            const { email, password, rememberMe = false } = req.body;
            console.log(`[Login] Attempt: ${email} | DB: ${dbOk() ? "MongoDB" : "Memory"}`);

            if (dbOk()) {
                const user = await User.findOne({ email });
                if (!user) {
                    console.warn(`[Login] ✗ Not found: ${email}`);
                    return res.status(401).json({ success: false, message: "No account found with that email." });
                }
                if (!user.emailVerified) {
                    return res.status(403).json({
                        success: false,
                        message: "Please verify your email before logging in.",
                        requiresVerification: true, email: user.email,
                    });
                }
                if (user.isBanned) {
                    console.warn(`[Login] ✗ Banned: ${email}`);
                    return res.status(403).json({ success: false, message: "Account suspended. Contact support@dateclone.com" });
                }

                const valid = await bcrypt.compare(password, user.password);
                if (!valid) {
                    console.warn(`[Login] ✗ Wrong password: ${email}`);
                    return res.status(401).json({ success: false, message: "Incorrect password. Please try again." });
                }

                user.lastLogin = new Date();
                const token = generateToken(user._id, rememberMe ? "30d" : "7d");
                const refreshToken = generateRefreshToken(user._id);
                user.refreshTokens = user.refreshTokens || [];
                // Keep max 5 refresh tokens (multi-device support)
                if (user.refreshTokens.length >= 5) user.refreshTokens.shift();
                user.refreshTokens.push(refreshToken);
                await user.save();
                console.log(`[Login] ✅ Success: ${email} (${dbOk() ? "MongoDB" : "Memory"})`);

                return res.json({
                    success: true,
                    message: "Login successful!",
                    token, refreshToken,
                    user: publicUser(user),
                });
            }

            // Memory fallback
            warnMem();
            const memUser = await memCheckPassword(email, password);
            if (!memUser) {
                console.warn(`[Login] ✗ Memory: not found or wrong password: ${email}`);
                return res.status(401).json({ success: false, message: "Incorrect email or password." });
            }
            if (!memUser.emailVerified) {
                return res.status(403).json({
                    success: false,
                    message: "Please verify your email first.",
                    requiresVerification: true, email: memUser.email,
                });
            }
            const token = generateToken(memUser._id);
            const refreshToken = generateRefreshToken(memUser._id);
            console.log(`[Login] ✅ Memory login: ${email}`);
            return res.json({
                success: true,
                message: "Login successful! (⚠️ Memory mode — connect MongoDB for persistence)",
                token, refreshToken, memoryMode: true,
                user: publicUser(memUser),
            });

        } catch (err) {
            console.error("[Login]", err);
            res.status(500).json({ success: false, message: "Login failed. Please try again." });
        }
    }
);

// ── POST /refresh ─────────────────────────────────────────────────────────────
router.post("/refresh", async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(401).json({ success: false, message: "Refresh token required." });

        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) return res.status(401).json({ success: false, message: "Invalid or expired refresh token. Please log in again." });

        if (dbOk()) {
            const user = await User.findById(decoded.userId);
            if (!user || !user.refreshTokens?.includes(refreshToken)) {
                return res.status(401).json({ success: false, message: "Refresh token revoked. Please log in again." });
            }
            // Rotate: remove old, add new
            user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
            const newAccess = generateToken(user._id);
            const newRefresh = generateRefreshToken(user._id);
            user.refreshTokens.push(newRefresh);
            await user.save();
            return res.json({ success: true, token: newAccess, refreshToken: newRefresh });
        }

        // Memory fallback — just issue new tokens
        const memUser = memFindById(decoded.userId);
        if (!memUser) return res.status(401).json({ success: false, message: "User not found." });
        return res.json({
            success: true,
            token: generateToken(memUser._id),
            refreshToken: generateRefreshToken(memUser._id),
        });

    } catch (err) {
        console.error("[Refresh]", err);
        res.status(500).json({ success: false, message: "Token refresh failed." });
    }
});

// ── POST /logout ──────────────────────────────────────────────────────────────
router.post("/logout", authenticateToken, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (dbOk()) {
            const user = await User.findById(req.user.userId);
            if (user && refreshToken) {
                user.refreshTokens = (user.refreshTokens || []).filter(t => t !== refreshToken);
                await user.save();
            }
        }
        res.json({ success: true, message: "Logged out successfully." });
    } catch (err) {
        console.error("[Logout]", err);
        res.status(500).json({ success: false, message: "Logout failed." });
    }
});

// ── POST /forgot-password ─────────────────────────────────────────────────────
router.post("/forgot-password",
    [body("email").isEmail().normalizeEmail()],
    async (req, res) => {
        try {
            const { email } = req.body;
            // Always return success to prevent email enumeration
            const genericMsg = "If an account with that email exists, a reset link has been sent.";

            if (dbOk()) {
                const user = await User.findOne({ email });
                if (!user) return res.json({ success: true, message: genericMsg });

                const resetToken = crypto.randomBytes(32).toString("hex");
                const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
                user.passwordResetToken = resetToken;
                user.passwordResetExpires = resetExpires;
                await user.save();

                await sendPasswordResetEmail(email, resetToken).catch(e =>
                    console.error("[ForgotPw] Email error:", e.message)
                );
                console.log(`[ForgotPw] Reset link sent to: ${email}`);
            } else {
                warnMem();
                console.log(`[ForgotPw] Memory mode — no persistent reset possible for: ${email}`);
            }
            return res.json({ success: true, message: genericMsg });

        } catch (err) {
            console.error("[ForgotPw]", err);
            res.status(500).json({ success: false, message: "Failed to process request." });
        }
    }
);

// ── POST /reset-password ──────────────────────────────────────────────────────
router.post("/reset-password",
    [
        body("token").notEmpty(),
        body("password").isLength({ min: 8 }),
    ],
    async (req, res) => {
        try {
            const { token, password } = req.body;
            if (!dbOk()) return res.status(503).json({ success: false, message: "Database not connected. Cannot reset password." });

            const user = await User.findOne({
                passwordResetToken: token,
                passwordResetExpires: { $gt: Date.now() },
            });
            if (!user) return res.status(400).json({ success: false, message: "Reset link is invalid or has expired." });

            user.password = await bcrypt.hash(password, 12);
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            user.refreshTokens = []; // invalidate all sessions
            await user.save();
            console.log(`[ResetPw] ✅ Password reset for: ${user.email}`);

            res.json({ success: true, message: "Password reset successfully! You can now log in." });

        } catch (err) {
            console.error("[ResetPw]", err);
            res.status(500).json({ success: false, message: "Password reset failed." });
        }
    }
);

// ── GET /me ───────────────────────────────────────────────────────────────────
router.get("/me", authenticateToken, async (req, res) => {
    try {
        if (dbOk()) {
            const user = await User.findById(req.user.userId).select(PUB_FIELDS);
            if (!user) return res.status(404).json({ success: false, message: "User not found." });
            return res.json({ success: true, user });
        }
        const memUser = memFindById(req.user.userId);
        if (!memUser) return res.status(404).json({ success: false, message: "User not found." });
        const { password: _, ...safe } = memUser;
        return res.json({ success: true, user: safe, memoryMode: true });

    } catch (err) {
        console.error("[Me]", err);
        res.status(500).json({ success: false, message: "Failed to fetch user." });
    }
});

// ── GET /admin-check (utility — verify admin status) ─────────────────────────
router.get("/admin-check", authenticateToken, async (req, res) => {
    try {
        if (!dbOk()) return res.status(503).json({ success: false, message: "Database required for admin check." });
        const user = await User.findById(req.user.userId).select("isAdmin email");
        if (!user?.isAdmin) return res.status(403).json({ success: false, message: "Admin access only." });
        return res.json({ success: true, isAdmin: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Admin check failed." });
    }
});

export default router;
