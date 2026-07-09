/**
 * Media Service — Profile media management
 * Handles photo uploads, albums, videos, voice introductions
 */
import { Photo } from "../models/Photo.js";
import { Album } from "../models/Album.js";
import { User } from "../models/User.js";
import { createNotification } from "./notificationService.js";

const MAX_PHOTOS = 9;

// ─── Photo Management ───────────────────────────────────────────────────────────

export const uploadPhoto = async (userId, photoData) => {
    const { url, thumbnailUrl, width, height, fileSize, mimeType, isPrivate } = photoData;

    // Count existing photos
    const existingCount = await Photo.countDocuments({ userId, isPrivate: { $ne: true } });
    if (existingCount >= MAX_PHOTOS) {
        throw new Error(`Maximum ${MAX_PHOTOS} photos allowed`);
    }

    const maxOrder = await Photo.findOne({ userId }).sort({ order: -1 }).select("order");
    const photo = new Photo({
        userId,
        url,
        thumbnailUrl,
        width,
        height,
        fileSize,
        mimeType,
        isPrivate: isPrivate || false,
        order: (maxOrder?.order || 0) + 1,
    });

    await photo.save();

    // If no profile picture exists, set this as profile picture
    const hasProfilePic = await Photo.findOne({ userId, isProfilePicture: true });
    if (!hasProfilePic) {
        photo.isProfilePicture = true;
        await photo.save();
        await User.findByIdAndUpdate(userId, { profilePicture: url });
    }

    // Update user photos array
    const user = await User.findById(userId);
    if (user) {
        user.photos = user.photos || [];
        if (!user.photos.includes(url)) {
            user.photos.push(url);
        }
        await user.save();
    }

    return photo;
};

export const deletePhoto = async (userId, photoId) => {
    const photo = await Photo.findOne({ _id: photoId, userId });
    if (!photo) throw new Error("Photo not found");

    const wasProfilePic = photo.isProfilePicture;
    const wasCoverPhoto = photo.isCoverPhoto;

    await Photo.deleteOne({ _id: photoId });

    // Update user's photos array
    const user = await User.findById(userId);
    if (user) {
        user.photos = (user.photos || []).filter(p => p !== photo.url);
        if (wasProfilePic || user.profilePicture === photo.url) {
            // Set next available photo as profile picture
            const nextPhoto = await Photo.findOne({ userId, isPrivate: false }).sort({ order: 1 });
            if (nextPhoto) {
                nextPhoto.isProfilePicture = true;
                await nextPhoto.save();
                user.profilePicture = nextPhoto.url;
            } else {
                user.profilePicture = null;
            }
        }
        if (wasCoverPhoto) {
            user.coverPhoto = null;
        }
        await user.save();
    }

    return { deleted: true };
};

export const setProfilePicture = async (userId, photoId) => {
    // Unset all existing profile pictures
    await Photo.updateMany({ userId, isProfilePicture: true }, { isProfilePicture: false });

    const photo = await Photo.findOne({ _id: photoId, userId });
    if (!photo) throw new Error("Photo not found");

    photo.isProfilePicture = true;
    await photo.save();

    await User.findByIdAndUpdate(userId, { profilePicture: photo.url });

    return photo;
};

export const setCoverPhoto = async (userId, photoId) => {
    // Unset existing cover
    await Photo.updateMany({ userId, isCoverPhoto: true }, { isCoverPhoto: false });

    const photo = await Photo.findOne({ _id: photoId, userId });
    if (!photo) throw new Error("Photo not found");

    photo.isCoverPhoto = true;
    await photo.save();

    await User.findByIdAndUpdate(userId, { coverPhoto: photo.url });

    return photo;
};

export const reorderPhotos = async (userId, photoIds) => {
    // Validate all photos belong to user
    const photos = await Photo.find({ _id: { $in: photoIds }, userId });
    if (photos.length !== photoIds.length) throw new Error("Invalid photo IDs");

    const bulkOps = photoIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id, userId },
            update: { $set: { order: index + 1 } },
        },
    }));

    await Photo.bulkWrite(bulkOps);
    return { success: true };
};

export const getPhotos = async (userId, includePrivate = false) => {
    const query = { userId };
    if (!includePrivate) {
        query.isPrivate = false;
    }
    return Photo.find(query).sort({ order: 1 });
};

export const getPhotoById = async (photoId) => {
    return Photo.findById(photoId);
};

// ─── Album Management ───────────────────────────────────────────────────────────

export const createAlbum = async (userId, albumData) => {
    const { title, description, isPrivate, lockType, coinCost } = albumData;

    const album = new Album({
        userId,
        title,
        description,
        isPrivate: isPrivate || false,
        lockType: lockType || "none",
        coinCost: coinCost || 0,
    });

    await album.save();
    return album;
};

export const getAlbums = async (userId, viewerId = null) => {
    const query = { userId };

    // If viewer is not the owner, only show non-private albums or albums they're allowed to see
    if (viewerId && viewerId !== userId.toString()) {
        query.$or = [
            { isPrivate: false },
            { allowedUsers: viewerId },
        ];
    }

    return Album.find(query).sort({ createdAt: -1 });
};

export const addPhotoToAlbum = async (userId, albumId, photoId) => {
    const album = await Album.findOne({ _id: albumId, userId });
    if (!album) throw new Error("Album not found");

    const photo = await Photo.findOne({ _id: photoId, userId });
    if (!photo) throw new Error("Photo not found");

    photo.albumId = albumId;
    photo.isPrivate = album.isPrivate;
    await photo.save();

    album.photoCount = (album.photoCount || 0) + 1;
    if (!album.coverPhoto) {
        album.coverPhoto = photo.url;
    }
    await album.save();

    return { photo, album };
};

export const removePhotoFromAlbum = async (userId, albumId, photoId) => {
    const album = await Album.findOne({ _id: albumId, userId });
    if (!album) throw new Error("Album not found");

    const photo = await Photo.findOne({ _id: photoId, userId });
    if (!photo) throw new Error("Photo not found");

    photo.albumId = null;
    await photo.save();

    album.photoCount = Math.max(0, (album.photoCount || 1) - 1);
    if (album.coverPhoto === photo.url) {
        album.coverPhoto = null;
    }
    await album.save();

    return { success: true };
};

export const unlockAlbum = async (userId, albumId) => {
    const album = await Album.findById(albumId);
    if (!album) throw new Error("Album not found");

    // Check if user is premium for premium-only albums
    if (album.lockType === "premium_only") {
        const user = await User.findById(userId);
        if (!user?.isPremium) {
            throw new Error("Premium subscription required to view this album");
        }
    }

    // Add user to allowed list
    if (!album.allowedUsers.map(id => id.toString()).includes(userId)) {
        album.allowedUsers.push(userId);
        await album.save();
    }

    return album;
};

export const deleteAlbum = async (userId, albumId) => {
    const album = await Album.findOne({ _id: albumId, userId });
    if (!album) throw new Error("Album not found");

    // Remove album reference from photos
    await Photo.updateMany({ albumId }, { albumId: null });

    await Album.deleteOne({ _id: albumId });
    return { deleted: true };
};

// ─── Moderation ─────────────────────────────────────────────────────────────────

export const flagPhotoForReview = async (photoId, reason = "") => {
    const photo = await Photo.findById(photoId);
    if (!photo) throw new Error("Photo not found");

    photo.moderationStatus = "flagged";
    photo.moderationReason = reason || "Flagged for review";
    await photo.save();

    // Notify admins
    try {
        const admins = await User.find({ role: { $in: ["admin", "super_admin"] } });
        for (const admin of admins) {
            await createNotification({
                userId: admin._id,
                type: "moderation",
                title: "Photo Flagged",
                message: `Photo ${photoId} has been flagged for review`,
                referenceId: photo._id,
                referenceModel: "Photo",
                icon: "🚩",
            }).catch(() => {});
        }
    } catch (e) { /* silent */ }

    return photo;
};

export const moderatePhoto = async (photoId, status, reason = "", moderatorId) => {
    const allowedStatuses = ["approved", "rejected"];
    if (!allowedStatuses.includes(status)) throw new Error("Invalid moderation status");

    const photo = await Photo.findById(photoId);
    if (!photo) throw new Error("Photo not found");

    photo.moderationStatus = status;
    photo.moderationReason = reason;
    photo.moderatedBy = moderatorId;
    photo.moderatedAt = new Date();
    await photo.save();

    // Notify user
    try {
        await createNotification({
            userId: photo.userId,
            type: "moderation",
            title: status === "approved" ? "Photo Approved" : "Photo Rejected",
            message: status === "approved"
                ? "Your photo has been approved"
                : `Your photo was rejected: ${reason}`,
            referenceId: photo._id,
            referenceModel: "Photo",
            icon: status === "approved" ? "✅" : "❌",
        }).catch(() => {});
    } catch (e) { /* silent */ }

    return photo;
};