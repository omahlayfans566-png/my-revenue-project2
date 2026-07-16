/**
 * Chat Service - Phase 4: Advanced Chat System
 * Handles voice notes, file sharing, GIFs, reactions, pins, archives, etc.
 */
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { Match } from "../models/Match.js";
import { createNotification } from "./notificationService.js";
import { logger as loggingService } from "./loggingService.js";

// ─── Phone Number Detection ─────────────────────────────────────────────────
const PHONE_REGEX = /(?:(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4})/g;

// Unicode homoglyph digits mapping for phone number bypass detection
const DIGIT_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const WORD_DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const WORD_DIGITS_SHORT = ['z', 'o', 't', 'th', 'f', 'fi', 's', 'se', 'e', 'n'];

export const containsPhoneNumber = (text) => {
    if (!text || typeof text !== 'string') return false;

    // Step 1: Normalize common separators (spaces, hyphens, dots, commas, brackets)
    let normalized = text
        .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, '') // zero-width chars
        .replace(/[()\[\]{}]/g, '') // brackets
        .replace(/[\s.,\-_/\\|;:'"~`!@#$%^&*+=<>?]+/g, ''); // all separators

    // Step 2: Check for word-based phone numbers (zero eight zero etc)
    const lowerText = text.toLowerCase();
    let wordCount = 0;
    for (const word of WORD_DIGITS) {
        const regex = new RegExp(word, 'gi');
        const matches = lowerText.match(regex);
        if (matches) wordCount += matches.length;
    }
    if (wordCount >= 7) return true;

    // Step 3: Check normalized text for consecutive digits (phone numbers)
    const digitSequences = normalized.match(/\d{7,15}/g);
    if (digitSequences) {
        for (const seq of digitSequences) {
            // Must have at least 7 digits to be a phone number
            if (seq.length >= 7 && seq.length <= 15) {
                // Check it starts with common prefixes or has enough digits
                if (/^\+?\d{7,15}$/.test(seq)) return true;
            }
        }
    }

    // Step 4: Apply standard regex
    const cleaned = text.replace(/[\s.\-()\[\]{}_/\\|,;:'"~`!@#$%^&*+=<>?]+/g, '');
    const matches = cleaned.match(PHONE_REGEX);
    if (matches) {
        for (const m of matches) {
            const digits = m.replace(/\D/g, '');
            if (digits.length >= 7 && digits.length <= 15) return true;
        }
    }

    return false;
};

// ─── Anti-Spam Protection ─────────────────────────────────────────────────────
const spamCache = new Map(); // userId → { count, resetAt }

const SPAM_LIMIT = 20;          // max messages per window
const SPAM_WINDOW_MS = 10000;   // 10 second window
const SPAM_SAME_CONTENT_LIMIT = 5; // max identical messages in a row

export const checkSpam = (userId, content) => {
    const now = Date.now();
    let record = spamCache.get(userId);
    if (!record || now > record.resetAt) {
        record = { count: 0, lastContent: "", sameCount: 0, resetAt: now + SPAM_WINDOW_MS };
        spamCache.set(userId, record);
    }
    record.count++;
    if (record.count > SPAM_LIMIT) {
        loggingService.warn(`[Spam] User ${userId} exceeded rate limit`);
        return { blocked: true, reason: "Too many messages. Please slow down." };
    }
    if (content && content === record.lastContent) {
        record.sameCount++;
        if (record.sameCount >= SPAM_SAME_CONTENT_LIMIT) {
            loggingService.warn(`[Spam] User ${userId} sending duplicate content`);
            return { blocked: true, reason: "Please don't send the same message repeatedly." };
        }
    } else {
        record.sameCount = 1;
    }
    record.lastContent = content;

    // Cleanup old entries periodically
    if (spamCache.size > 10000) {
        const now = Date.now();
        for (const [key, val] of spamCache) {
            if (now > val.resetAt) spamCache.delete(key);
        }
    }
    return { blocked: false };
};

// ─── Duplicate Message Prevention ─────────────────────────────────────────────
const recentMessagesCache = new Map(); // key → timestamp

export const checkDuplicate = async (fromUserId, toUserId, content, fileHash) => {
    const key = `${fromUserId}_${toUserId}_${content || fileHash || ""}`;
    const last = recentMessagesCache.get(key);
    if (last && Date.now() - last < 3000) {
        return true; // duplicate within 3 seconds
    }
    recentMessagesCache.set(key, Date.now());
    // Cleanup old entries
    if (recentMessagesCache.size > 5000) {
        const cutoff = Date.now() - 30000;
        for (const [k, v] of recentMessagesCache) {
            if (v < cutoff) recentMessagesCache.delete(k);
        }
    }
    return false;
};

// ─── Edit Message ────────────────────────────────────────────────────────────
export const editMessage = async ({ userId, messageId, content }) => {
    const message = await Message.findById(messageId);
    if (!message) throw new Error("Message not found");
    if (message.fromUserId.toString() !== userId) throw new Error("You can only edit your own messages");
    if (message.isDeleted) throw new Error("Cannot edit a deleted message");

    // Sanitize - strip HTML tags and dangerous characters
    const sanitized = content
        .replace(/<[^>]*>/g, '')
        .replace(/[<>"']/g, '');

    message.content = sanitized;
    message.editedAt = new Date();
    await message.save();

    const populated = await Message.findById(message._id)
        .populate("fromUserId", "firstName lastName profilePicture")
        .populate("toUserId", "firstName lastName profilePicture")
        .lean();

    return populated;
};

// ─── Send Message (enhanced) ──────────────────────────────────────────────────
export const sendMessage = async ({ fromUserId, toUserId, content, messageType, image, fileUrl, fileName, fileSize, gifUrl, replyTo, isForwarded, forwardedFrom, tempId }) => {
    // Check match
    const match = await Match.findOne({
        $or: [
            { userId: fromUserId, matchedUserId: toUserId, status: "matched" },
            { userId: toUserId, matchedUserId: fromUserId, status: "matched" },
        ],
    });
    if (!match) throw new Error("Not matched");

    // Phone number check
    if (content && containsPhoneNumber(content)) {
        loggingService.warn(`[PhoneBlock] User ${fromUserId} attempted to send phone number to ${toUserId}`);
        throw new Error("Phone numbers are not allowed");
    }

    // Anti-spam check
    const spamCheck = checkSpam(fromUserId, content);
    if (spamCheck.blocked) throw new Error(spamCheck.reason);

    // Duplicate check
    const isDuplicate = await checkDuplicate(fromUserId, toUserId, content, fileUrl);
    if (isDuplicate) throw new Error("Duplicate message");

    // Build reply data
    let replyData = {};
    if (replyTo) {
        const original = await Message.findById(replyTo)
            .populate("fromUserId", "firstName lastName")
            .lean();
        if (original) {
            replyData = {
                replyTo: original._id,
                replyContent: original.content || (original.image ? "[Image]" : original.gifUrl ? "[GIF]" : "[File]"),
                replyFrom: original.fromUserId?.firstName || "Unknown",
            };
        }
    }

    // Sanitize content - strip HTML tags and dangerous characters
    const sanitizedContent = content ? content
        .replace(/<[^>]*>/g, '')
        .replace(/[<>"']/g, '') : "";

    const message = new Message({
        fromUserId,
        toUserId,
        content: sanitizedContent,
        messageType: messageType || "text",
        image: image || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
        gifUrl: gifUrl || null,
        isForwarded: isForwarded || false,
        forwardedFrom: forwardedFrom || null,
        ...replyData,
    });
    await message.save();

    // Update match
    if (match) {
        match.messagesSent = (match.messagesSent || 0) + 1;
        match.lastMessageAt = new Date();
        await match.save();
    }

    // Notification
    const sender = await User.findById(fromUserId).select("firstName").lean();
    createNotification({
        userId: toUserId,
        type: "message",
        title: "New Message",
        message: `New message from ${sender?.firstName || "someone"}`,
        referenceId: message._id,
        referenceModel: "Message",
        icon: messageType === "gif" ? "🎬" : messageType === "file" ? "📎" : "💬",
        metadata: { fromUserId, conversationId: fromUserId, messageType },
    }).catch(() => { });

    const populated = await Message.findById(message._id)
        .populate("fromUserId", "firstName lastName profilePicture")
        .populate("toUserId", "firstName lastName profilePicture")
        .populate("replyTo", "content image gifUrl fileUrl fromUserId")
        .lean();

    return populated;
};

// ─── Get or Create Chat ──────────────────────────────────────────────────────
export const getOrCreateChat = async (userId, otherUserId) => {
    let match = await Match.findOne({
        $or: [
            { userId, matchedUserId: otherUserId, status: "matched" },
            { userId: otherUserId, matchedUserId: userId, status: "matched" },
        ],
    }).populate("userId matchedUserId", "firstName lastName profilePicture").lean();
    return match;
};

// ─── Get Conversations (enhanced with pin/archive support) ────────────────────
export const getConversations = async (userId, options = {}) => {
    const { includeArchived = false, search } = options;

    let matchQuery = {
        $or: [{ userId, status: "matched" }, { matchedUserId: userId, status: "matched" }],
    };

    const conversations = await Match.find(matchQuery)
        .populate("userId matchedUserId", "firstName lastName profilePicture")
        .sort({ lastMessageAt: -1 })
        .lean();

    const result = await Promise.all(
        conversations.map(async (conv) => {
            const otherUserId = conv.userId._id.toString() === userId ? conv.matchedUserId._id : conv.userId._id;

            const lastMessage = await Message.findOne({
                $or: [
                    { fromUserId: userId, toUserId: otherUserId },
                    { fromUserId: otherUserId, toUserId: userId },
                ],
                isDeleted: false,
            }).sort({ createdAt: -1 }).lean();

            if (search && lastMessage && !lastMessage.content?.toLowerCase().includes(search.toLowerCase())) {
                return null;
            }

            const unreadCount = await Message.countDocuments({
                toUserId: userId,
                fromUserId: otherUserId,
                isRead: false,
                isDeleted: false,
            });

            // Get media gallery for this conversation
            const mediaMessages = await Message.find({
                $or: [
                    { fromUserId: userId, toUserId: otherUserId },
                    { fromUserId: otherUserId, toUserId: userId },
                ],
                $or: [
                    { image: { $ne: null } },
                    { gifUrl: { $ne: null } },
                    { fileUrl: { $ne: null } },
                ],
                isDeleted: false,
            }).sort({ createdAt: -1 }).limit(50).lean();

            return {
                _id: conv._id,
                user: conv.userId._id.toString() === userId ? conv.matchedUserId : conv.userId,
                lastMessage,
                unreadCount,
                matchedAt: conv.matchedAt,
                isPinned: conv.isPinned || false,
                isArchived: conv.isArchived || false,
                mediaGallery: mediaMessages,
            };
        })
    );

    let filtered = result.filter(Boolean);

    // Filter archived if not requested
    if (!includeArchived) {
        filtered = filtered.filter(c => !c.isArchived);
    }

    // Sort pinned first, then by last message
    filtered.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const timeA = a.lastMessage?.createdAt || a.matchedAt;
        const timeB = b.lastMessage?.createdAt || b.matchedAt;
        return new Date(timeB) - new Date(timeA);
    });

    return filtered;
};

// ─── Pin / Unpin Conversation ────────────────────────────────────────────────
export const pinConversation = async (userId, otherUserId, pinned) => {
    const match = await Match.findOne({
        $or: [
            { userId, matchedUserId: otherUserId },
            { userId: otherUserId, matchedUserId: userId },
        ],
    });
    if (!match) throw new Error("Conversation not found");
    match.isPinned = pinned;
    await match.save();
    return { pinned };
};

// ─── Archive / Unarchive Conversation ────────────────────────────────────────
export const archiveConversation = async (userId, otherUserId, archived) => {
    const match = await Match.findOne({
        $or: [
            { userId, matchedUserId: otherUserId },
            { userId: otherUserId, matchedUserId: userId },
        ],
    });
    if (!match) throw new Error("Conversation not found");
    match.isArchived = archived;
    await match.save();
    return { archived };
};

// ─── Forward Message ─────────────────────────────────────────────────────────
export const forwardMessage = async (userId, messageId, targetUserId) => {
    const original = await Message.findById(messageId);
    if (!original) throw new Error("Message not found");
    if (original.fromUserId.toString() !== userId && original.toUserId.toString() !== userId) {
        throw new Error("Not your message");
    }

    // Check match with target
    const match = await Match.findOne({
        $or: [
            { userId, matchedUserId: targetUserId, status: "matched" },
            { userId: targetUserId, matchedUserId: userId, status: "matched" },
        ],
    });
    if (!match) throw new Error("Not matched with target");

    const forwarded = new Message({
        fromUserId: userId,
        toUserId: targetUserId,
        content: original.content || "",
        messageType: original.messageType,
        image: original.image,
        fileUrl: original.fileUrl,
        fileName: original.fileName,
        fileSize: original.fileSize,
        gifUrl: original.gifUrl,
        isForwarded: true,
        forwardedFrom: original.fromUserId,
    });
    await forwarded.save();

    return await Message.findById(forwarded._id)
        .populate("fromUserId", "firstName lastName profilePicture")
        .populate("toUserId", "firstName lastName profilePicture")
        .populate("forwardedFrom", "firstName lastName")
        .lean();
};

// ─── Get Media Gallery ───────────────────────────────────────────────────────
export const getMediaGallery = async (userId, otherUserId, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const messages = await Message.find({
        $or: [
            { fromUserId: userId, toUserId: otherUserId },
            { fromUserId: otherUserId, toUserId: userId },
        ],
        $or: [
            { image: { $ne: null } },
            { gifUrl: { $ne: null } },
            { fileUrl: { $ne: null } },
        ],
        isDeleted: false,
    })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const total = await Message.countDocuments({
        $or: [
            { fromUserId: userId, toUserId: otherUserId },
            { fromUserId: otherUserId, toUserId: userId },
        ],
        $or: [
            { image: { $ne: null } },
            { gifUrl: { $ne: null } },
            { fileUrl: { $ne: null } },
        ],
        isDeleted: false,
    });

    return { messages: messages.reverse(), total, page, totalPages: Math.ceil(total / limit) };
};

// ─── Search Messages ─────────────────────────────────────────────────────────
export const searchMessages = async (userId, query, page = 1, limit = 30) => {
    const skip = (page - 1) * limit;
    const messages = await Message.find({
        $or: [
            { fromUserId: userId },
            { toUserId: userId },
        ],
        content: { $regex: query, $options: "i" },
        isDeleted: false,
    })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("fromUserId toUserId", "firstName lastName profilePicture")
        .lean();

    const total = await Message.countDocuments({
        $or: [{ fromUserId: userId }, { toUserId: userId }],
        content: { $regex: query, $options: "i" },
        isDeleted: false,
    });

    return { messages, total, page, totalPages: Math.ceil(total / limit) };
};

// ─── Chat Backup ────────────────────────────────────────────────────────────
export const exportChatBackup = async (userId) => {
    const conversations = await getConversations(userId);
    const backup = [];

    for (const conv of conversations) {
        const messages = await Message.find({
            $or: [
                { fromUserId: userId, toUserId: conv.user._id },
                { fromUserId: conv.user._id, toUserId: userId },
            ],
            isDeleted: false,
            deletedFor: { $nin: [userId] },
        })
            .sort({ createdAt: 1 })
            .lean();

        backup.push({
            withUser: `${conv.user.firstName} ${conv.user.lastName}`,
            userId: conv.user._id,
            messages: messages.map(m => ({
                from: m.fromUserId === userId ? "me" : "them",
                content: m.content,
                messageType: m.messageType,
                image: m.image,
                fileUrl: m.fileUrl,
                createdAt: m.createdAt,
                isRead: m.isRead,
            })),
        });
    }

    return backup;
};

export default {
    sendMessage,
    getConversations,
    checkSpam,
    checkDuplicate,
    editMessage,
    containsPhoneNumber,
    pinConversation,
    archiveConversation,
    forwardMessage,
    getMediaGallery,
    searchMessages,
    exportChatBackup,
};