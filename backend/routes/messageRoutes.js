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
        const { toUserId, content, image, messageType, replyTo } = req.body;

        if (!toUserId) {
            return res.status(400).json({
                success: false,
                message: "Recipient ID is required",
            });
        }

        if (!content && !image) {
            return res.status(400).json({
                success: false,
                message: "Message content or image is required",
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

        // Build reply data if replying to a message
        let replyData = {};
        if (replyTo) {
            const originalMsg = await Message.findById(replyTo).populate("fromUserId", "firstName lastName").lean();
            if (originalMsg) {
                replyData = {
                    replyTo: originalMsg._id,
                    replyContent: originalMsg.content || (originalMsg.image ? "[Image]" : ""),
                    replyFrom: originalMsg.fromUserId?.firstName || "Unknown",
                };
            }
        }

        // Create message
        const message = new Message({
            fromUserId: userId,
            toUserId,
            content: content || "",
            image: image || null,
            messageType: messageType || (image ? "image" : "text"),
            ...replyData,
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
        }).catch(() => { });

        // Note: Real-time emission is handled by the socket.io send_message handler in server.js
        // This REST endpoint is for fallback when socket is disconnected

        // Mark as delivered if recipient is online
        const recipientOnline = global.onlineUsers?.has(toUserId);
        if (recipientOnline) {
            message.isDelivered = true;
            message.deliveredAt = new Date();
            await message.save();
        }

        // Only emit via socket if the message was sent via REST (not socket)
        if (global.io && !req.headers["x-socket-id"]) {
            const populated = await Message.findById(message._id)
                .populate("fromUserId", "firstName lastName profilePicture")
                .populate("toUserId", "firstName lastName profilePicture")
                .lean();
            global.io.to(`user:${toUserId}`).emit("new_message", populated);
        }

        const populated = await Message.findById(message._id)
            .populate("fromUserId", "firstName lastName profilePicture")
            .populate("toUserId", "firstName lastName profilePicture")
            .lean();

        res.status(201).json({
            success: true,
            message: "Message sent",
            data: populated,
        });
    } catch (error) {
        console.error("[Send Message]", error);
        res.status(500).json({
            success: false,
            message: "Failed to send message",
        });
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

        // Check user is part of this conversation
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

        // Notify the other user via socket
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
            return res.status(403).json({
                success: false,
                message: "You can only delete your own messages",
            });
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
            .populate("replyTo", "content image fromUserId")
            .lean();

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
            "-password -verificationToken -refreshTokens"
        );

        res.json({
            success: true,
            messages: messages.reverse(),
            otherUser,
        });
    } catch (error) {
        console.error("[Get Conversation]", error);
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
        const { search } = req.query;

        let matchQuery = {
            $or: [{ userId, status: "matched" }, { matchedUserId: userId, status: "matched" }],
        };

        const conversations = await Match.find(matchQuery)
            .populate("userId matchedUserId", "firstName lastName profilePicture")
            .sort({ lastMessageAt: -1 })
            .lean();

        // Get latest message for each conversation
        const conversationData = await Promise.all(
            conversations.map(async (conv) => {
                const otherUserId =
                    conv.userId._id.toString() === userId
                        ? conv.matchedUserId._id
                        : conv.userId._id;

                // Search filter
                if (search) {
                    const lastMsg = await Message.findOne({
                        $or: [
                            { fromUserId: userId, toUserId: otherUserId },
                            { fromUserId: otherUserId, toUserId: userId },
                        ],
                        content: { $regex: search, $options: "i" },
                        isDeleted: false,
                    }).sort({ createdAt: -1 });
                    if (!lastMsg) return null;
                }

                const lastMessage = await Message.findOne({
                    $or: [
                        { fromUserId: userId, toUserId: otherUserId },
                        { fromUserId: otherUserId, toUserId: userId },
                    ],
                    isDeleted: false,
                }).sort({ createdAt: -1 }).lean();

                const unreadCount = await Message.countDocuments({
                    toUserId: userId,
                    fromUserId: otherUserId,
                    isRead: false,
                    isDeleted: false,
                });

                return {
                    _id: conv._id,
                    user:
                        conv.userId._id.toString() === userId ? conv.matchedUserId : conv.userId,
                    lastMessage,
                    unreadCount,
                    matchedAt: conv.matchedAt,
                };
            })
        );

        // Remove nulls (filtered out by search)
        const filtered = conversationData.filter(Boolean);

        // Sort by last message date
        filtered.sort((a, b) => {
            const timeA = a.lastMessage?.createdAt || a.matchedAt;
            const timeB = b.lastMessage?.createdAt || b.matchedAt;
            return new Date(timeB) - new Date(timeA);
        });

        res.json({
            success: true,
            conversations: filtered,
        });
    } catch (error) {
        console.error("[Get Conversations]", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch conversations",
        });
    }
});

// GET: Search Messages
router.get("/search", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ success: false, message: "Search query required" });
        }

        const messages = await Message.find({
            $or: [
                { fromUserId: userId },
                { toUserId: userId },
            ],
            content: { $regex: q, $options: "i" },
            isDeleted: false,
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .populate("fromUserId toUserId", "firstName lastName profilePicture")
            .lean();

        res.json({ success: true, messages });
    } catch (error) {
        console.error("[Search Messages]", error);
        res.status(500).json({ success: false, message: "Search failed" });
    }
});

export default router;