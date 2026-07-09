import express from "express";
import mongoose from "mongoose";
import { Photo } from "../models/Photo.js";
import { Album } from "../models/Album.js";
import { User } from "../models/User.js";
import { authenticateToken } from "../middleware/auth.js";
import {
    uploadPhoto,
    deletePhoto,
    setProfilePicture,
    setCoverPhoto,
    reorderPhotos,
    getPhotos,
    createAlbum,
    getAlbums,
    addPhotoToAlbum,
    removePhotoFromAlbum,
    unlockAlbum,
    deleteAlbum,
    flagPhotoForReview,
    moderatePhoto,
} from "../services/mediaService.js";
import { createNotification } from "../services/notificationService.js";
import { logAction } from "../services/adminService.js";

const router = express.Router();

// All media routes require authentication
router.use(authenticateToken);

// ============================================================================
// PHOTO ENDPOINTS
// ============================================================================

// GET /media/photos — get all photos for current user
router.get("/photos", async (req, res) => {
    try {
        const photos = await getPhotos(req.user.userId, true);
        res.json({ success: true, photos });
    } catch (error) {
        console.error("[Media Photos]", error);
        res.status(500).json({ success: false, message: "Failed to fetch photos" });
    }
});

// GET /media/photos/:userId — get public photos for a specific user
router.get("/photos/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }
        const isOwner = req.user.userId === userId;
        const photos = await getPhotos(userId, isOwner);
        res.json({ success: true, photos });
    } catch (error) {
        console.error("[Media User Photos]", error);
        res.status(500).json({ success: false, message: "Failed to fetch photos" });
    }
});

// POST /media/photos/upload — upload a new photo
router.post("/photos/upload", async (req, res) => {
    try {
        const { url, thumbnailUrl, width, height, fileSize, mimeType, isPrivate } = req.body;

        if (!url) {
            return res.status(400).json({ success: false, message: "Photo URL is required" });
        }

        const photo = await uploadPhoto(req.user.userId, {
            url,
            thumbnailUrl,
            width,
            height,
            fileSize,
            mimeType,
            isPrivate,
        });

        res.status(201).json({ success: true, message: "Photo uploaded", photo });
    } catch (error) {
        console.error("[Media Upload]", error);
        if (error.message?.includes("Maximum")) {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Failed to upload photo" });
    }
});

// DELETE /media/photos/:photoId — delete a photo
router.delete("/photos/:photoId", async (req, res) => {
    try {
        const { photoId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(photoId)) {
            return res.status(400).json({ success: false, message: "Invalid photo ID" });
        }
        const result = await deletePhoto(req.user.userId, photoId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Media Delete]", error);
        res.status(error.message === "Photo not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to delete photo" });
    }
});

// POST /media/photos/:photoId/set-profile — set as profile picture
router.post("/photos/:photoId/set-profile", async (req, res) => {
    try {
        const { photoId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(photoId)) {
            return res.status(400).json({ success: false, message: "Invalid photo ID" });
        }
        const photo = await setProfilePicture(req.user.userId, photoId);

        // Emit socket event
        if (global.io) {
            global.io.to(`user:${req.user.userId}`).emit("profile_picture_updated", {
                userId: req.user.userId,
                profilePicture: photo.url,
            });
        }

        res.json({ success: true, message: "Profile picture updated", photo });
    } catch (error) {
        console.error("[Media Set Profile]", error);
        res.status(error.message === "Photo not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to set profile picture" });
    }
});

// POST /media/photos/:photoId/set-cover — set as cover photo
router.post("/photos/:photoId/set-cover", async (req, res) => {
    try {
        const { photoId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(photoId)) {
            return res.status(400).json({ success: false, message: "Invalid photo ID" });
        }
        const photo = await setCoverPhoto(req.user.userId, photoId);

        if (global.io) {
            global.io.to(`user:${req.user.userId}`).emit("cover_photo_updated", {
                userId: req.user.userId,
                coverPhoto: photo.url,
            });
        }

        res.json({ success: true, message: "Cover photo updated", photo });
    } catch (error) {
        console.error("[Media Set Cover]", error);
        res.status(error.message === "Photo not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to set cover photo" });
    }
});

// POST /media/photos/reorder — reorder photos
router.post("/photos/reorder", async (req, res) => {
    try {
        const { photoIds } = req.body;
        if (!Array.isArray(photoIds) || photoIds.length === 0) {
            return res.status(400).json({ success: false, message: "photoIds array is required" });
        }
        const result = await reorderPhotos(req.user.userId, photoIds);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Media Reorder]", error);
        res.status(error.message === "Invalid photo IDs" ? 400 : 500)
            .json({ success: false, message: error.message || "Failed to reorder photos" });
    }
});

// ============================================================================
// ALBUM ENDPOINTS
// ============================================================================

// GET /media/albums — get albums for current user
router.get("/albums", async (req, res) => {
    try {
        const albums = await getAlbums(req.user.userId, req.user.userId);
        res.json({ success: true, albums });
    } catch (error) {
        console.error("[Media Albums]", error);
        res.status(500).json({ success: false, message: "Failed to fetch albums" });
    }
});

// GET /media/albums/:userId — get albums for a specific user
router.get("/albums/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }
        const albums = await getAlbums(userId, req.user.userId);
        res.json({ success: true, albums });
    } catch (error) {
        console.error("[Media User Albums]", error);
        res.status(500).json({ success: false, message: "Failed to fetch albums" });
    }
});

// POST /media/albums — create a new album
router.post("/albums", async (req, res) => {
    try {
        const { title, description, isPrivate, lockType, coinCost } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, message: "Album title is required" });
        }
        const album = await createAlbum(req.user.userId, { title, description, isPrivate, lockType, coinCost });
        res.status(201).json({ success: true, message: "Album created", album });
    } catch (error) {
        console.error("[Media Create Album]", error);
        res.status(500).json({ success: false, message: "Failed to create album" });
    }
});

// POST /media/albums/:albumId/photos — add photo to album
router.post("/albums/:albumId/photos", async (req, res) => {
    try {
        const { albumId } = req.params;
        const { photoId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(albumId) || !mongoose.Types.ObjectId.isValid(photoId)) {
            return res.status(400).json({ success: false, message: "Invalid ID" });
        }
        const result = await addPhotoToAlbum(req.user.userId, albumId, photoId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Media Add to Album]", error);
        res.status(error.message === "Album not found" || error.message === "Photo not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to add photo to album" });
    }
});

// DELETE /media/albums/:albumId/photos/:photoId — remove photo from album
router.delete("/albums/:albumId/photos/:photoId", async (req, res) => {
    try {
        const { albumId, photoId } = req.params;
        const result = await removePhotoFromAlbum(req.user.userId, albumId, photoId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Media Remove from Album]", error);
        res.status(error.message === "Album not found" || error.message === "Photo not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to remove photo from album" });
    }
});

// POST /media/albums/:albumId/unlock — unlock a private album
router.post("/albums/:albumId/unlock", async (req, res) => {
    try {
        const { albumId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(albumId)) {
            return res.status(400).json({ success: false, message: "Invalid album ID" });
        }
        const album = await unlockAlbum(req.user.userId, albumId);
        res.json({ success: true, message: "Album unlocked", album });
    } catch (error) {
        console.error("[Media Unlock Album]", error);
        res.status(400).json({ success: false, message: error.message || "Failed to unlock album" });
    }
});

// DELETE /media/albums/:albumId — delete an album
router.delete("/albums/:albumId", async (req, res) => {
    try {
        const { albumId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(albumId)) {
            return res.status(400).json({ success: false, message: "Invalid album ID" });
        }
        const result = await deleteAlbum(req.user.userId, albumId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Media Delete Album]", error);
        res.status(error.message === "Album not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to delete album" });
    }
});

// ============================================================================
// MODERATION ENDPOINTS (admin only)
// ============================================================================

// POST /media/flag/:photoId — flag a photo for review
router.post("/flag/:photoId", async (req, res) => {
    try {
        const { photoId } = req.params;
        const { reason } = req.body;
        if (!mongoose.Types.ObjectId.isValid(photoId)) {
            return res.status(400).json({ success: false, message: "Invalid photo ID" });
        }
        const photo = await flagPhotoForReview(photoId, reason);
        res.json({ success: true, message: "Photo flagged for review", photo });
    } catch (error) {
        console.error("[Media Flag]", error);
        res.status(error.message === "Photo not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to flag photo" });
    }
});

// POST /media/moderate/:photoId — moderate a photo (admin)
router.post("/moderate/:photoId", async (req, res) => {
    try {
        const { photoId } = req.params;
        const { status, reason } = req.body;
        if (!mongoose.Types.ObjectId.isValid(photoId)) {
            return res.status(400).json({ success: false, message: "Invalid photo ID" });
        }
        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be 'approved' or 'rejected'" });
        }
        const photo = await moderatePhoto(photoId, status, reason, req.user.userId);

        await logAction(req.user.userId, "moderate_photo", "photo", photoId, { status, reason }, req);

        res.json({ success: true, message: `Photo ${status}`, photo });
    } catch (error) {
        console.error("[Media Moderate]", error);
        res.status(error.message === "Photo not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to moderate photo" });
    }
});

export default router;