import express from "express";
import { User } from "../models/User.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// GET: Get User Profile
router.get("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select(
            "-password -verificationToken -verificationTokenExpires"
        );

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
            message: "Failed to fetch profile",
        });
    }
});

// PUT: Update User Profile
router.put("/:userId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { _id: tokenUserId } = req.user;

        // Check if user is updating their own profile
        if (tokenUserId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "You can only update your own profile",
            });
        }

        const updateData = {
            ...req.body,
        };

        // Remove sensitive fields
        delete updateData.password;
        delete updateData.email;
        delete updateData.username;
        delete updateData.verificationToken;

        // Calculate age if dateOfBirth is provided
        if (updateData.dateOfBirth) {
            updateData.age =
                new Date().getFullYear() -
                new Date(updateData.dateOfBirth).getFullYear();
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
            new: true,
        }).select("-password");

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to update profile",
        });
    }
});

// POST: Upload Profile Photo
router.post("/:userId/photo", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { _id: tokenUserId } = req.user;
        const { photoUrl } = req.body;

        if (tokenUserId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized",
            });
        }

        if (!photoUrl) {
            return res.status(400).json({
                success: false,
                message: "Photo URL is required",
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Add photo to photos array if not already there
        if (!user.photos) {
            user.photos = [];
        }

        user.photos.push(photoUrl);

        // Set as profile picture if it's the first photo
        if (!user.profilePicture) {
            user.profilePicture = photoUrl;
        }

        await user.save();

        res.json({
            success: true,
            message: "Photo uploaded successfully",
            photos: user.photos,
            profilePicture: user.profilePicture,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Photo upload failed",
        });
    }
});

// GET: Get All Profiles (with pagination and filtering)
router.get("/", async (req, res) => {
    try {
        const { page = 1, limit = 20, gender, minAge, maxAge, country } = req.query;

        const query = {
            isActive: true,
            isBanned: false,
            emailVerified: true,
        };

        if (gender) {
            query.gender = gender;
        }

        if (minAge || maxAge) {
            query.age = {};
            if (minAge) query.age.$gte = parseInt(minAge);
            if (maxAge) query.age.$lte = parseInt(maxAge);
        }

        if (country) {
            query.country = country;
        }

        const skip = (page - 1) * limit;

        const users = await User.find(query)
            .select("-password -verificationToken")
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch profiles",
        });
    }
});

export default router;
