import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "../models/User.js";
import { authenticateToken, generateToken } from "../middleware/auth.js";
import {
    sendVerificationEmail,
    sendWelcomeEmail,
} from "../services/emailService.js";
import { body, validationResult } from "express-validator";

const router = express.Router();

// POST: Register User
router.post(
    "/register",
    [
        body("email").isEmail().normalizeEmail(),
        body("password").isLength({ min: 8 }),
        body("username").isLength({ min: 3 }),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const {
                firstName,
                lastName,
                username,
                email,
                phone,
                password,
                confirmPassword,
                dateOfBirth,
                gender,
                lookingFor,
                country,
                state,
                city,
                profilePicture,
                aboutMe,
                occupation,
                education,
                languages,
                interests,
                minAge,
                maxAge,
                preferredCountry,
                preferredDistance,
                relationshipGoal,
                hasChildren,
                wantsChildren,
                smoking,
                drinking,
                religion,
                religionImportance,
                relationshipValue,
                latitude,
                longitude,
            } = req.body;

            // Validate required fields
            if (!firstName || !lastName || !username || !email || !password) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message: "Please provide all required fields",
                    });
            }

            // Validate password confirmation
            if (password !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Passwords do not match",
                });
            }

            // Check if user already exists
            const existingUser = await User.findOne({
                $or: [{ email }, { username }],
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message:
                        existingUser.email === email
                            ? "Email already registered"
                            : "Username already taken",
                });
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Generate verification token
            const verificationToken = crypto.randomBytes(32).toString("hex");
            const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // Calculate age
            const age = new Date().getFullYear() - new Date(dateOfBirth).getFullYear();

            // Create new user
            const newUser = new User({
                firstName,
                lastName,
                username,
                email,
                phone,
                password: hashedPassword,
                dateOfBirth,
                age,
                gender,
                lookingFor,
                country,
                state,
                city,
                profilePicture,
                aboutMe,
                occupation,
                education,
                languages: languages || [],
                interests: interests || [],
                minAge: minAge || 18,
                maxAge: maxAge || 80,
                preferredCountry,
                preferredDistance,
                relationshipGoal,
                hasChildren,
                wantsChildren,
                smoking,
                drinking,
                religion,
                religionImportance,
                relationshipValue,
                latitude,
                longitude,
                verificationToken,
                verificationTokenExpires,
                profileCompletion: 100,
            });

            await newUser.save();

            // Send verification email
            await sendVerificationEmail(email, verificationToken);

            // Generate JWT token
            const token = generateToken(newUser._id);

            res.status(201).json({
                success: true,
                message: "Registration successful. Please verify your email.",
                token,
                user: {
                    _id: newUser._id,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    email: newUser.email,
                    username: newUser.username,
                    profilePicture: newUser.profilePicture,
                },
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                message: error.message || "Registration failed",
            });
        }
    }
);

// POST: Verify Email
router.post("/verify-email", async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Verification token is required",
            });
        }

        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification token",
            });
        }

        // Mark user as verified
        user.emailVerified = true;
        user.verificationToken = null;
        user.verificationTokenExpires = null;
        await user.save();

        // Send welcome email
        await sendWelcomeEmail(user.email, user.firstName);

        res.json({
            success: true,
            message: "Email verified successfully. Welcome to DateClone!",
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                emailVerified: user.emailVerified,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Email verification failed",
        });
    }
});

// POST: Resend Verification Email
router.post("/resend-verification", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                message: "Email already verified",
            });
        }

        // Generate new verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");
        user.verificationToken = verificationToken;
        user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();

        // Send verification email
        await sendVerificationEmail(email, verificationToken);

        res.json({
            success: true,
            message: "Verification email resent. Please check your inbox.",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Resend verification failed",
        });
    }
});

// POST: Login
router.post(
    "/login",
    [body("email").isEmail(), body("password").exists()],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const { email, password } = req.body;

            // Find user
            const user = await User.findOne({ email });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password",
                });
            }

            // Check if email is verified
            if (!user.emailVerified) {
                return res.status(403).json({
                    success: false,
                    message: "Please verify your email before logging in",
                });
            }

            // Compare password
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password",
                });
            }

            // Update last login
            user.lastLogin = new Date();
            await user.save();

            // Generate token
            const token = generateToken(user._id);

            res.json({
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
                },
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                message: "Login failed",
            });
        }
    }
);

// GET: Get Current User
router.get("/me", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.json({
            success: true,
            user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch user",
        });
    }
});

export default router;
