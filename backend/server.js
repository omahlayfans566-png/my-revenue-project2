import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { connectDB, isMongoConnected } from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import premiumRoutes from "./routes/premiumRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import discoveryRoutes from "./routes/discoveryRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import advancedFeaturesRoutes from "./routes/advancedFeaturesRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import coinRoutes from "./routes/coinRoutes.js";
import giftRoutes from "./routes/giftRoutes.js";
import referralRoutes from "./routes/referralRoutes.js";
import storyRoutes from "./routes/storyRoutes.js";
import safetyRoutes from "./routes/safetyRoutes.js";
import matchingRoutes from "./routes/matchingRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { verifyEmailService } from "./services/emailService.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { performanceMiddleware } from "./middleware/performanceMonitor.js";
import { User } from "./models/User.js";
import { Message } from "./models/Message.js";

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ── CORS ──────────────────────────────────────────────────────────────────────
const getAllowedOrigins = () => [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const allowed = getAllowedOrigins();
        if (process.env.NODE_ENV !== "production" && origin.startsWith("http://localhost")) {
            return cb(null, true);
        }
        if (allowed.includes(origin)) {
            return cb(null, true);
        }
        return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
};

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: corsOptions,
    pingTimeout: 30000,
    pingInterval: 15000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
});
const onlineUsers = new Map();
const userSockets = new Map();
global.io = io;
global.onlineUsers = onlineUsers;

// ── Socket authentication middleware ──────────────────────────────────────────
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "dateclone_jwt_secret_dev");
        socket.userId = decoded.userId;
        next();
    } catch { next(new Error("Invalid token")); }
});

// ── Track typing sessions for cleanup ─────────────────────────────────────────
const activeTypingSessions = new Map();

// ── Mark messages as delivered for a user ──────────────────────────────────────
const markMessagesDelivered = async (userId) => {
    try {
        await Message.updateMany(
            { toUserId: userId, isDelivered: false, isDeleted: false },
            { isDelivered: true, deliveredAt: new Date() }
        );
    } catch { /* silent */ }
};

// ── Get unread message count for a user ────────────────────────────────────────
const getUnreadMessageCount = async (userId) => {
    try {
        return await Message.countDocuments({
            toUserId: userId,
            isRead: false,
            isDeleted: false,
        });
    } catch {
        return 0;
    }
};

// ── Update lastSeen for a user ─────────────────────────────────────────────────
const updateLastSeen = async (userId) => {
    try {
        await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    } catch { /* silent */ }
};

// ── Emit suggestion-related events ────────────────────────────────────────────
export const emitUserRegistered = (userId) => {
    io.emit("user_registered", { userId, timestamp: new Date().toISOString() });
};

export const emitProfileCompleted = (userId) => {
    io.emit("profile_completed", { userId, timestamp: new Date().toISOString() });
};

export const emitProfileUpdated = (userId) => {
    io.emit("profile_updated", { userId, timestamp: new Date().toISOString() });
};

export const emitProfilePhotoUploaded = (userId) => {
    io.emit("profile_photo_uploaded", { userId, timestamp: new Date().toISOString() });
};

export const emitUserDeleted = (userId) => {
    io.emit("user_deleted", { userId, timestamp: new Date().toISOString() });
    io.emit("suggestions_updated", { timestamp: new Date().toISOString(), type: "user_deleted" });
};

export const emitUserBanned = (userId) => {
    io.emit("user_banned", { userId, timestamp: new Date().toISOString() });
    io.emit("suggestions_updated", { timestamp: new Date().toISOString(), type: "user_banned" });
};

export const emitUserUnbanned = (userId) => {
    io.emit("user_unbanned", { userId, timestamp: new Date().toISOString() });
    io.emit("suggestions_updated", { timestamp: new Date().toISOString(), type: "user_unbanned" });
};

export const emitUserActivated = (userId) => {
    io.emit("user_activated", { userId, timestamp: new Date().toISOString() });
    io.emit("suggestions_updated", { timestamp: new Date().toISOString(), type: "user_activated" });
};

// ── Socket connection handler ──────────────────────────────────────────────────
io.on("connection", (socket) => {
    const userId = socket.userId;

    // Track multi-device connections
    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // ── user_online ────────────────────────────────────────────────────────────
    socket.on("user_online", async ({ userId: uid }) => {
        if (!uid || uid !== socket.userId) return;
        onlineUsers.set(uid, socket.id);
        socket.join(`user:${uid}`);
        io.emit("user_status", { userId: uid, online: true });

        await markMessagesDelivered(uid);

        try {
            const deliveredMessages = await Message.find({
                toUserId: uid,
                isDelivered: true,
                deliveredAt: { $gte: new Date(Date.now() - 60000) },
            }).select("fromUserId").lean();

            const notifiedSenders = new Set();
            for (const msg of deliveredMessages) {
                const senderId = msg.fromUserId.toString();
                if (!notifiedSenders.has(senderId)) {
                    notifiedSenders.add(senderId);
                    io.to(`user:${senderId}`).emit("messages_delivered", {
                        toUserId: uid,
                        deliveredAt: new Date().toISOString(),
                    });
                }
            }
        } catch { /* silent */ }

        const unreadCount = await getUnreadMessageCount(uid);
        io.to(`user:${uid}`).emit("unread_message_count", { count: unreadCount });
    });

    // ── edit_message ──────────────────────────────────────────────────────────
    socket.on("edit_message", async ({ messageId, content }) => {
        if (!socket.userId || !messageId || !content) return;
        try {
            const message = await Message.findById(messageId);
            if (!message || message.fromUserId.toString() !== socket.userId) return;
            if (message.isDeleted) return;

            message.content = content;
            message.editedAt = new Date();
            await message.save();

            const recipientId = message.toUserId.toString();
            io.to(`user:${recipientId}`).emit("message_edited", {
                messageId: message._id, content, editedAt: message.editedAt,
            });
            socket.emit("message_edited", {
                messageId: message._id, content, editedAt: message.editedAt,
            });
        } catch { /* silent */ }
    });

    // ── delete_for_me ──────────────────────────────────────────────────────────
    socket.on("delete_for_me", async ({ messageId }) => {
        if (!socket.userId || !messageId) return;
        try {
            const message = await Message.findById(messageId);
            if (!message) return;
            if (message.fromUserId.toString() !== socket.userId &&
                message.toUserId.toString() !== socket.userId) return;

            message.deletedFor = message.deletedFor || [];
            if (!message.deletedFor.includes(socket.userId)) {
                message.deletedFor.push(socket.userId);
            }
            await message.save();
            socket.emit("message_deleted_for_me", { messageId });
        } catch { /* silent */ }
    });

    // ── delete_for_everyone ────────────────────────────────────────────────────
    socket.on("delete_for_everyone", async ({ messageId }) => {
        if (!socket.userId || !messageId) return;
        try {
            const message = await Message.findById(messageId);
            if (!message || message.fromUserId.toString() !== socket.userId) return;
            if (message.isDeleted) return;
            const age = Date.now() - new Date(message.createdAt).getTime();
            if (age > 24 * 60 * 60 * 1000) {
                return socket.emit("message_error", { messageId, error: "Cannot delete messages older than 24 hours" });
            }

            message.isDeleted = true;
            message.deletedAt = new Date();
            await message.save();

            const recipientId = message.toUserId.toString();
            io.to(`user:${recipientId}`).emit("message_deleted_for_everyone", { messageId });
            socket.emit("message_deleted_for_everyone", { messageId });
        } catch { /* silent */ }
    });

    // ── send_message ──────────────────────────────────────────────────────────
    socket.on("send_message", async ({ toUserId, content, image, tempId, messageType, voiceNote, fileUrl, fileName, fileSize, gifUrl, replyTo, isForwarded }) => {
        if (!socket.userId || !toUserId) return;
        try {
            const { sendMessage } = await import("./services/chatService.js");
            const result = await sendMessage({
                fromUserId: socket.userId, toUserId, content, messageType, image,
                voiceNote, fileUrl, fileName, fileSize, gifUrl, replyTo, isForwarded, tempId,
            });

            if (result) {
                const msg = { ...result, tempId };
                io.to(`user:${toUserId}`).emit("new_message", msg);
                socket.emit("message_sent", { tempId, _id: result._id, createdAt: result.createdAt });

                const unreadCount = await getUnreadMessageCount(toUserId);
                io.to(`user:${toUserId}`).emit("unread_message_count", { count: unreadCount });
            }
        } catch (err) {
            socket.emit("message_error", { tempId, error: err.message || "Failed to send message" });
        }
    });

    // ── typing_start ───────────────────────────────────────────────────────────
    socket.on("typing_start", ({ toUserId }) => {
        if (!socket.userId) return;
        const existing = activeTypingSessions.get(socket.id);
        if (existing) clearTimeout(existing.timer);

        const timer = setTimeout(() => {
            io.to(`user:${toUserId}`).emit("typing", { fromUserId: socket.userId, typing: false });
            activeTypingSessions.delete(socket.id);
        }, 10000);

        activeTypingSessions.set(socket.id, { toUserId, timer });
        io.to(`user:${toUserId}`).emit("typing", { fromUserId: socket.userId, typing: true });
    });

    // ── typing_stop ────────────────────────────────────────────────────────────
    socket.on("typing_stop", ({ toUserId }) => {
        if (!socket.userId) return;
        const existing = activeTypingSessions.get(socket.id);
        if (existing) { clearTimeout(existing.timer); activeTypingSessions.delete(socket.id); }
        io.to(`user:${toUserId}`).emit("typing", { fromUserId: socket.userId, typing: false });
    });

    // ── messages_read ──────────────────────────────────────────────────────────
    socket.on("messages_read", async ({ fromUserId }) => {
        if (!socket.userId || !fromUserId) return;
        try {
            await Message.updateMany(
                { fromUserId, toUserId: socket.userId, isRead: false, isDeleted: false },
                { isRead: true, readAt: new Date() }
            );

            io.to(`user:${fromUserId}`).emit("messages_read_by", {
                readBy: socket.userId, readAt: new Date().toISOString(),
            });

            const unreadCount = await getUnreadMessageCount(socket.userId);
            io.to(`user:${socket.userId}`).emit("unread_message_count", { count: unreadCount });
        } catch { /* silent */ }
    });

    // ── get_unread_counts ──────────────────────────────────────────────────────
    socket.on("get_unread_counts", async () => {
        if (!socket.userId) return;
        const unreadCount = await getUnreadMessageCount(socket.userId);
        socket.emit("unread_message_count", { count: unreadCount });
    });

    // ── disconnect ─────────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
        const typingSession = activeTypingSessions.get(socket.id);
        if (typingSession) {
            clearTimeout(typingSession.timer);
            io.to(`user:${typingSession.toUserId}`).emit("typing", { fromUserId: userId, typing: false });
            activeTypingSessions.delete(socket.id);
        }

        const sockets = userSockets.get(userId);
        if (sockets) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
                userSockets.delete(userId);
                onlineUsers.delete(userId);
                await updateLastSeen(userId);
                io.emit("user_status", { userId, online: false });
                io.emit("user_last_seen", { userId, lastSeen: new Date().toISOString() });
            }
        } else {
            onlineUsers.delete(userId);
            await updateLastSeen(userId);
            io.emit("user_status", { userId, online: false });
            io.emit("user_last_seen", { userId, lastSeen: new Date().toISOString() });
        }
    });
});

// ── CORS & Security middleware ───────────────────────────────────────────────
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
}));

// ── Security & Input Processing Middleware ──────────────────────────────────
import { xssProtection } from "./middleware/securityMiddleware.js";

app.use("/api/premium/paystack-webhook", express.raw({ type: "application/json", limit: "1mb" }));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(xssProtection);
if (process.env.NODE_ENV !== "production") app.use(requestLogger);
app.use(performanceMiddleware);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use("/api", rateLimit({ windowMs: 60000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60000, max: 30, message: { success: false, message: "Too many attempts. Wait 15 minutes." } }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/premium", premiumRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/discover", discoveryRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/advanced", advancedFeaturesRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/coins", coinRoutes);
app.use("/api/gifts", giftRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/safety", safetyRoutes);
app.use("/api/matching", matchingRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
    const ok = isMongoConnected();
    res.status(ok ? 200 : 503).json({
        status: ok ? "healthy" : "degraded",
        database: ok ? "MongoDB Atlas — connected" : "Not connected — memory mode",
        persistence: ok ? "permanent" : "none — data resets on restart",
        onlineUsers: onlineUsers.size,
        uptime: Math.floor(process.uptime()) + "s",
        time: new Date().toISOString(),
        version: "1.0.0",
    });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found" }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
    await connectDB();
    verifyEmailService().catch(() => { });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(`\n❌ Port ${PORT} is already in use.`);
            console.error(`   Kill it with:  npx kill-port ${PORT}\n`);
        } else {
            console.error("[Server Error]", err.message);
        }
        process.exit(1);
    });

    // ── Premium Expiry Scheduler ──────────────────────────────────────────────
    const PREMIUM_EXPIRY_INTERVAL = 15 * 60 * 1000;
    setInterval(async () => {
        try {
            const { Subscription } = await import("./models/Subscription.js");
            const { User } = await import("./models/User.js");
            const now = new Date();

            const expiredSubs = await Subscription.find({ status: "active", endDate: { $lte: now } });

            for (const sub of expiredSubs) {
                sub.status = "expired";
                sub.autoRenew = false;
                await sub.save();

                const user = await User.findById(sub.userId);
                if (user) {
                    user.isPremium = false;
                    user.premiumTier = "basic";
                    user.premiumExpires = undefined;
                    await user.save();

                    if (global.io) {
                        global.io.to(`user:${user._id}`).emit("premium_status_changed", {
                            isPremium: false, premiumTier: "basic", premiumExpires: null,
                        });
                    }
                }
            }

            await User.updateMany(
                { boostExpires: { $lte: now } },
                { $unset: { boostExpires: "" } }
            );
        } catch { /* silent */ }
    }, PREMIUM_EXPIRY_INTERVAL);

    server.listen(PORT, () => {
        const dbStatus = isMongoConnected() ? "✅ MongoDB connected" : "⚠️  Memory mode";
        console.log(`\n🚀 Server running → http://localhost:${PORT}`);
        console.log(`   Database → ${dbStatus}\n`);
    });
};

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async () => {
    console.log("\n⏹  Shutting down…");
    io.close();
    await mongoose.disconnect();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 15000);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("unhandledRejection", () => {});
process.on("uncaughtException", (e) => { console.error("[Fatal]", e); process.exit(1); });

start();
export default app;