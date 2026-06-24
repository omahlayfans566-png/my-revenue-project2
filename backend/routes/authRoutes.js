import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "../models/User.js";
import { authenticateToken, generateToken } from "../middleware/auth.js";
import { sendVerificationEmail, sendWelcomeEmail } from "../services/emailService.js";
import { onboardMember } from "../services/onboardingService.js";
import { body, validationResult } from "express-validator";

const router = express.Router();

// ── Safe public user projection (never expose password / OTP) ─────────────────
const PUBLIC_FIELDS = "-password -verificationToken -verificationTokenExpires";

// ── POST /register ────────────────────────────────────────────────────────────
router.post(
    "/register",
    [
        body("email").isEmail().normalizeEmail(),
        body("password").isLength({ min: 8 }),
        body("username").isLength({ min: 3 }).trim(),
    ],
    async (req, res) => {
        try {
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({ success: false, errors: validationErrors.array() });
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

            // Required field check
            if (!firstName || !lastName || !username || !email || !password) {
                return res.status(400).json({ success: false, message: "Please provide all required fields" });
            }
            if (password !== confirmPassword) {
                return res.status(400).json({ success: false, message: "Passwords do not match" });
            }

            // Duplicate check
            const existing = await User.findOne({ $or: [{ email }, { username: username.toLowerCase() }] });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: existing.email === email ? "Email already registered" : "Username already taken",
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);

            // 6-digit OTP (10 minutes)
            const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
            const verificationTokenExpires = new Date(Date.now() + 10 * 60 * 1000);

            // Age from DOB
            const age = dateOfBirth
                ? new Date().getFullYear() - new Date(dateOfBirth).getFullYear()
                : undefined;

            const newUser = new User({
                firstName, lastName,
                username: username.toLowerCase(),
                email, phone,
                password: hashedPassword,
                dateOfBirth, age,
                gender, lookingFor,
                country, state, city, latitude, longitude,
                profilePicture, aboutMe, occupation, education,
                languages: languages || [],
                interests: interests || [],
                smoking, drinking,
                minAge: minAge || 18,
                maxAge: maxAge || 50,
                preferredCountry, preferredDistance,
                relationshipGoal, hasChildren, wantsChildren,
                religion, religionImportance, relationshipValue,
                verificationToken,
                verificationTokenExpires,
                // Not yet a member — activated on email verification
                isMember: false,
                isActive: false,
                onboardingComplete: false,
            });

            await newUser.save();

            // Send OTP email (fire-and-forget — don't block response)
            sendVerificationEmail(email, verificationToken).catch((e) =>
                console.error("[Register] Email send failed:", e.message)
            );

            const token = generateToken(newUser._id);

            return res.status(201).json({
                success: true,
                message: "Registration successful. Please verify your email to activate your account.",
                token,
                user: {
                    _id: newUser._id,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    email: newUser.email,
                    username: newUser.username,
                    profilePicture: newUser.profilePicture,
                    isMember: false,
                    emailVerified: false,
                },
            });
        } catch (error) {
            console.error("[Register]", error);
            res.status(500).json({ success: false, message: error.message || "Registration failed" });
        }
    }
);

// ── POST /verify-otp ──────────────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP code are required" });
        }

        const user = await User.findOne({
            email,
            verificationToken: otp.toString().trim(),
            verificationTokenExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired code. Request a new one.",
            });
        }

        // ── Run automatic member onboarding ──────────────────────────────────
        await onboardMember(user);

        // Send welcome email (non-blocking)
        sendWelcomeEmail(user.email, user.firstName).catch((e) =>
            console.error("[Verify] Welcome email failed:", e.message)
        );

        // Return a fresh token + full member profile
        const token = generateToken(user._id);

        return res.json({
            success: true,
            message: user.isActive
                ? "Email verified! Welcome to DateClone 💕 Your profile is now live."
                : "Email verified! Your account is under review and will be activated shortly.",
            token,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                username: user.username,
                profilePicture: user.profilePicture,
                isMember: user.isMember,
                isActive: user.isActive,
                memberSince: user.memberSince,
                profileCompletion: user.profileCompletion,
                emailVerified: true,
            },
        });
    } catch (error) {
        console.error("[Verify OTP]", error);
        res.status(500).json({ success: false, message: "Verification failed. Please try again." });
    }
});

// ── POST /resend-verification ─────────────────────────────────────────────────
router.post("/resend-verification", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (user.isMember) return res.status(400).json({ success: false, message: "Account already verified" });

        user.verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationTokenExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        await sendVerificationEmail(email, user.verificationToken);

        res.json({ success: true, message: "New verification code sent. Check your inbox." });
    } catch (error) {
        console.error("[Resend]", error);
        res.status(500).json({ success: false, message: "Resend failed" });
    }
});

// ── POST /login ───────────────────────────────────────────────────────────────
router.post(
    "/login",
    [body("email").isEmail(), body("password").exists()],
    async (req, res) => {
        try {
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                return res.status(400).json({ success: false, errors: validationErrors.array() });
            }

            const { email, password } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ success: false, message: "Invalid email or password" });
            }

            // Must have verified email to log in
            if (!user.emailVerified) {
                return res.status(403).json({
                    success: false,
                    message: "Please verify your email before logging in",
                    requiresVerification: true,
                    email: user.email,
                });
            }

            if (user.isBanned) {
                return res.status(403).json({ success: false, message: "Account suspended. Contact support." });
            }

            const passwordValid = await bcrypt.compare(password, user.password);
            if (!passwordValid) {
                return res.status(401).json({ success: false, message: "Invalid email or password" });
            }

            // Update last login
            user.lastLogin = new Date();
            await user.save();

            const token = generateToken(user._id);

            return res.json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    username: user.username,
                    profilePicture: user.profilePicture,
                    isPremium: user.isPremium,
                    premiumTier: user.premiumTier,
                    isMember: user.isMember,
                    isActive: user.isActive,
                    profileCompletion: user.profileCompletion,
                    memberSince: user.memberSince,
                },
            });
        } catch (error) {
            console.error("[Login]", error);
            res.status(500).json({ success: false, message: "Login failed" });
        }
    }
);

// ── GET /me ───────────────────────────────────────────────────────────────────
router.get("/me", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select(PUBLIC_FIELDS);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.json({ success: true, user });
    } catch (error) {
        console.error("[Me]", error);
        res.status(500).json({ success: false, message: "Failed to fetch user" });
    }
});

export default router;
