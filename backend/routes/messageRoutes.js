import express from "express";
import { Message } from "../models/Message.js";
import { Match } from "../models/Match.js";
import { User } from "../models/User.js";
import { authenticateToken } from "../middleware/auth.js";
import { createNotification } from "../services/notificationService.js";
import {
    sendMessage,
    getConversations,
    pinConversation,
    archiveConversation,
    forwardMessage,
    getMediaGallery,
    searchMessages,
    exportChatBackup,
    getOrCreateChat,
} from "../services/chatService.js";

const router = express.Router();

// GET: Get All Conversations (enhanced with pin/archive/search)
router.get("/", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { includeArchived, search } = req.query;
        const conversations = await getConversations(userId, {
            includeArchived: includeArchived === "true",
            search,
        });
        res.json({ success: true, conversations });
    } catch (error) {
        console.error("[Get Conversations]", error);
        res.status(500).json({ success: false, message: "Failed to fetch conversations" });
    }
});

// POST: Send Message (enhanced)
router.post("/send", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { toUserId, content, image, messageType, voiceNote, fileUrl, fileName, fileSize, gifUrl, replyTo, isForwarded, forwardedFrom, tempId } = req.body;

        if (!toUserId) {
            return res.status(400).json({ success: false, message: "Recipient ID is required" });
        }

        const message = await sendMessage({
            fromUserId: userId,
            toUserId,
            content,
            messageType,
            image,
            voiceNote,
            fileUrl,
            fileName,
            fileSize,
            gifUrl,
            replyTo,
            isForwarded,
            forwardedFrom,
            tempId,
        });

        // Emit via Socket.IO if available
        if (global.io) {
            global.io.to(`user:${toUserId}`).emit("new_message", message);
            // Emit message sent confirmation
            if (tempId) {
                global.io.to(`user:${userId}`).emit("message_sent", {
                    tempId,
                    _id: message._id,
                    createdAt: message.createdAt,
                });
            }
        }

        res.status(201).json({ success: true, message: "Message sent", data: message });
    } catch (error) {
        console.error("[Send Message]", error);
        const status = error.message === "Not matched" ? 403 :
                       error.message === "Too many messages. Please slow down." ? 429 :
                       error.message === "Duplicate message" ? 409 : 500;
        res.status(status).json({ success: false, message: error.message || "Failed to send message" });
    }
});

// POST: React to Message
router.post("/react/:messageId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { messageId } = req.params;
        const { reaction } = req.body;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (message.fromUserId.toString() !== userId && message.toUserId.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Not part of this conversation" });
        }

        // Toggle reaction off if same one
        if (message.reaction === reaction) {
            message.reaction = null;
        } else {
            message.reaction = reaction;
        }

        await message.save();

        const otherUserId = message.fromUserId.toString() === userId
            ? message.toUserId.toString()
            : message.fromUserId.toString();
        if (global.io) {
            global.io.to(`user:${otherUserId}`).emit("message_reaction", {
                messageId: message._id,
                reaction: message.reaction,
                userId,
            });
        }

        res.json({ success: true, reaction: message.reaction });
    } catch (error) {
        console.error("[React Message]", error);
        res.status(500).json({ success: false, message: "Failed to react" });
    }
});

// POST: Forward Message
router.post("/forward", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { messageId, targetUserId } = req.body;

        if (!messageId || !targetUserId) {
            return res.status(400).json({ success: false, message: "Message ID and target user ID required" });
        }

        const message = await forwardMessage(userId, messageId, targetUserId);

        if (global.io) {
            global.io.to(`user:${targetUserId}`).emit("new_message", message);
        }

        res.status(201).json({ success: true, message: "Message forwarded", data: message });
    } catch (error) {
        console.error("[Forward Message]", error);
        res.status(500).json({ success: false, message: error.message || "Failed to forward message" });
    }
});

// POST: Pin/Unpin Conversation
router.post("/pin", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { targetUserId, pinned } = req.body;
        const result = await pinConversation(userId, targetUserId, pinned);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || "Failed to pin conversation" });
    }
});

// POST: Archive/Unarchive Conversation
router.post("/archive", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { targetUserId, archived } = req.body;
        const result = await archiveConversation(userId, targetUserId, archived);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || "Failed to archive conversation" });
    }
});

// GET: Media Gallery
router.get("/media/:otherUserId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { otherUserId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const result = await getMediaGallery(userId, otherUserId, parseInt(page), parseInt(limit));
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Get Media Gallery]", error);
        res.status(500).json({ success: false, message: "Failed to fetch media gallery" });
    }
});

// GET: Search Messages
router.get("/search", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { q, page = 1, limit = 30 } = req.query;

        if (!q) {
            return res.status(400).json({ success: false, message: "Search query required" });
        }

        const result = await searchMessages(userId, q, parseInt(page), parseInt(limit));
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Search Messages]", error);
        res.status(500).json({ success: false, message: "Search failed" });
    }
});

// GET: Export Chat Backup
router.get("/export/backup", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const backup = await exportChatBackup(userId);
        res.json({ success: true, backup });
    } catch (error) {
        console.error("[Export Backup]", error);
        res.status(500).json({ success: false, message: "Failed to export backup" });
    }
});

// DELETE: Delete Message (soft delete)
router.delete("/:messageId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { messageId } = req.params;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (message.fromUserId.toString() !== userId) {
            return res.status(403).json({ success: false, message: "You can only delete your own messages" });
        }

        message.isDeleted = true;
        message.deletedFor = message.deletedFor || [];
        if (!message.deletedFor.includes(userId)) {
            message.deletedFor.push(userId);
        }
        await message.save();

        res.json({ success: true, message: "Message deleted" });
    } catch (error) {
        console.error("[Delete Message]", error);
        res.status(500).json({ success: false, message: "Failed to delete message" });
    }
});

// GET: Get Messages with User (with pagination)
router.get("/conversation/:otherUserId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { otherUserId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const match = await Match.findOne({
            $or: [
                { userId, matchedUserId: otherUserId, status: "matched" },
                { userId: otherUserId, matchedUserId: userId, status: "matched" },
            ],
        });

        if (!match) {
            return res.status(403).json({ success: false, message: "You can only view messages with matched users" });
        }

        const skip = (page - 1) * limit;

        const messages = await Message.find({
            $and: [
                {
                    $or: [
                        { fromUserId: userId, toUserId: otherUserId },
                        { fromUserId: otherUserId, toUserId: userId },
                    ],
                },
                {
                    $or: [
                        { isDeleted: false },
                        { deletedFor: { $nin: [userId] } },
                    ],
                },
            ],
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate("fromUserId toUserId", "firstName lastName profilePicture")
            .populate("replyTo", "content image voiceNote gifUrl fileUrl fromUserId")
            .lean();

        const total = await Message.countDocuments({
            $and: [
                {
                    $or: [
                        { fromUserId: userId, toUserId: otherUserId },
                        { fromUserId: otherUserId, toUserId: userId },
                    ],
                },
                {
                    $or: [
                        { isDeleted: false },
                        { deletedFor: { $nin: [userId] } },
                    ],
                },
            ],
        });

        // Mark messages as read
        await Message.updateMany(
            { toUserId: userId, fromUserId: otherUserId, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        const otherUser = await User.findById(otherUserId).select("-password -verificationToken -refreshTokens");

        res.json({
            success: true,
            messages: messages.reverse(),
            otherUser,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
        });
    } catch (error) {
        console.error("[Get Conversation]", error);
        res.status(500).json({ success: false, message: "Failed to fetch messages" });
    }
});

export default router;