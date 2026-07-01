import express from "express";
import { Message } from "../models/Message.js";
import { Match } from "../models/Match.js";
import { User } from "../models/User.js";
import { authenticateToken } from "../middleware/auth.js";
import { createNotification } from "../services/notificationService.js";

const router = express.Router();

// POST: Send Message
router.post("/send", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { toUserId, content, image } = req.body;

        if (!toUserId || !content) {
            return res.status(400).json({
                success: false,
                message: "Recipient ID and message content are required",
            });
        }

        if (userId === toUserId) {
            return res.status(400).json({
                success: false,
                message: "You cannot message yourself",
            });
        }

        // Check if users are matched
        const match = await Match.findOne({
            $or: [
                { userId, matchedUserId: toUserId, status: "matched" },
                { userId: toUserId, matchedUserId: userId, status: "matched" },
            ],
        });

        if (!match) {
            return res.status(403).json({
                success: false,
                message: "You can only message matched users",
            });
        }

        // Create message
        const message = new Message({
            fromUserId: userId,
            toUserId,
            content,
            image,
        });

        await message.save();

        // Update match with message count
        match.messagesSent = (match.messagesSent || 0) + 1;
        match.lastMessageAt = new Date();
        await match.save();

        // Create notification for new message
        const sender = await User.findById(userId).select("firstName").lean();
        createNotification({
            userId: toUserId,
            type: "message",
            title: "New Message",
            message: `New message from ${sender?.firstName || "someone"}`,
            referenceId: message._id,
            referenceModel: "Message",
            icon: "💬",
            metadata: { fromUserId: userId, conversationId: userId },
        }).catch(() => {});

        res.status(201).json({
            success: true,
            message: "Message sent",
            data: message,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to send message",
        });
    }
});

// GET: Get Messages with User
router.get("/conversation/:otherUserId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { otherUserId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        // Check if users are matched
        const match = await Match.findOne({
            $or: [
                { userId, matchedUserId: otherUserId, status: "matched" },
                { userId: otherUserId, matchedUserId: userId, status: "matched" },
            ],
        });

        if (!match) {
            return res.status(403).json({
                success: false,
                message: "You can only view messages with matched users",
            });
        }

        const skip = (page - 1) * limit;

        const messages = await Message.find({
            $or: [
                { fromUserId: userId, toUserId: otherUserId },
                { fromUserId: otherUserId, toUserId: userId },
            ],
            isDeleted: false,
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate("fromUserId toUserId", "-password");

        // Mark messages as read
        await Message.updateMany(
            {
                toUserId: userId,
                fromUserId: otherUserId,
                isRead: false,
            },
            {
                isRead: true,
                readAt: new Date(),
            }
        );

        const otherUser = await User.findById(otherUserId).select(
            "-password -verificationToken"
        );

        res.json({
            success: true,
            messages: messages.reverse(),
            otherUser,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch messages",
        });
    }
});

// GET: Get All Conversations
router.get("/", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        // Get all matched conversations
        const conversations = await Match.find({
            $or: [{ userId, status: "matched" }, { matchedUserId: userId, status: "matched" }],
        }).populate("userId matchedUserId", "-password");

        // Get latest message for each conversation
        const conversationData = await Promise.all(
            conversations.map(async (conv) => {
                const otherUserId =
                    conv.userId.toString() === userId
                        ? conv.matchedUserId._id
                        : conv.userId._id;

                const lastMessage = await Message.findOne({
                    $or: [
                        { fromUserId: userId, toUserId: otherUserId },
                        { fromUserId: otherUserId, toUserId: userId },
                    ],
                    isDeleted: false,
                }).sort({ createdAt: -1 });

                const unreadCount = await Message.countDocuments({
                    toUserId: userId,
                    fromUserId: otherUserId,
                    isRead: false,
                    isDeleted: false,
                });

                return {
                    _id: conv._id,
                    user:
                        conv.userId.toString() === userId ? conv.matchedUserId : conv.userId,
                    lastMessage,
                    unreadCount,
                    matchedAt: conv.matchedAt,
                };
            })
        );

        // Sort by last message date
        conversationData.sort((a, b) => {
            const timeA = a.lastMessage?.createdAt || a.matchedAt;
            const timeB = b.lastMessage?.createdAt || b.matchedAt;
            return new Date(timeB) - new Date(timeA);
        });

        res.json({
            success: true,
            conversations: conversationData,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch conversations",
        });
    }
});

// DELETE: Delete Message
router.delete("/:messageId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { messageId } = req.params;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: "Message not found",
            });
        }

        if (message.fromUserId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own messages",
            });
        }

        message.isDeleted = true;
        await message.save();

        res.json({
            success: true,
            message: "Message deleted",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to delete message",
        });
    }
});

export default router;
