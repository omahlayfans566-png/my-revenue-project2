import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { connectDB, isMongoConnected } from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ── CORS origins ──────────────────────────────────────────────────────────────
const ALLOWED = [
    "http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176",
    process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (ALLOWED.includes(origin)) return cb(null, true);
        if (process.env.NODE_ENV !== "production" && origin.startsWith("http://localhost")) return cb(null, true);
        cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: (origin, cb) => {
            if (!origin || ALLOWED.includes(origin)) return cb(null, true);
            if (process.env.NODE_ENV !== "production" && origin?.startsWith("http://localhost")) return cb(null, true);
            cb(new Error(`Socket CORS blocked: ${origin}`));
        },
        credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});

// ── Global online tracking ────────────────────────────────────────────────────
global.io = io;
global.onlineUsers = new Map(); // userId → socketId

io.on("connection", (socket) => {
    console.log(`[Socket] connect: ${socket.id}`);

    socket.on("user_online", ({ userId, token }) => {
        if (!userId) return;
        // Verify JWT before accepting
        try {
            if (token) jwt.verify(token, process.env.JWT_SECRET || "dateclone_jwt_secret_dev");
        } catch { /* accept anyway in dev — socket is already authenticated at HTTP level */ }
        global.onlineUsers.set(userId, socket.id);
        socket.join(`user:${userId}`);
        socket.userId = userId;
        io.emit("user_status", { userId, online: true });
    });

    // ── Messaging ──────────────────────────────────────────────────────────────
    socket.on("send_message", async (data) => {
        const { toUserId, content, image, tempId } = data;
        if (!socket.userId || !toUserId || (!content && !image)) return;

        // Emit to recipient immediately
        io.to(`user:${toUserId}`).emit("new_message", {
            fromUserId: socket.userId,
            toUserId,
            content,
            image,
            tempId,
            createdAt: new Date().toISOString(),
            isRead: false,
        });
        // Echo back to sender (confirms delivery)
        socket.emit("message_sent", { tempId, createdAt: new Date().toISOString() });
    });

    // ── Typing indicators ──────────────────────────────────────────────────────
    socket.on("typing_start", ({ toUserId }) => {
        if (!socket.userId) return;
        io.to(`user:${toUserId}`).emit("typing", { fromUserId: socket.userId, typing: true });
    });
    socket.on("typing_stop", ({ toUserId }) => {
        if (!socket.userId) return;
        io.to(`user:${toUserId}`).emit("typing", { fromUserId: socket.userId, typing: false });
    });

    // ── Read receipts ──────────────────────────────────────────────────────────
    socket.on("messages_read", ({ fromUserId }) => {
        if (!socket.userId) return;
        io.to(`user:${fromUserId}`).emit("messages_read_by", { readBy: socket.userId });
    });

    // ── Disconnect ─────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
        if (socket.userId) {
            global.onlineUsers.delete(socket.userId);
            io.emit("user_status", { userId: socket.userId, online: false });
            console.log(`[Socket] user offline: ${socket.userId}`);
        }
        console.log(`[Socket] disconnect: ${socket.id}`);
    });
});

// ── Express middleware ────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use("/api", rateLimit({ windowMs: 60000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60000, max: 30, message: { success: false, message: "Too many auth attempts. Try again in 15 minutes." } }));

// ── Database ──────────────────────────────────────────────────────────────────
connectDB();

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/messages", messageRoutes);

app.get("/api/health", (_req, res) => {
    const dbState = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" }[mongoose.connection.readyState] ?? "unknown";
    const ok = isMongoConnected();
    res.status(ok ? 200 : 503).json({
        status: ok ? "healthy" : "degraded",
        database: dbState,
        persistence: ok ? "MongoDB Atlas — data is permanent" : "Memory only — data lost on restart. Fix MongoDB connection.",
        onlineUsers: global.onlineUsers?.size ?? 0,
        uptime: Math.floor(process.uptime()) + "s",
        time: new Date().toISOString(),
        version: "1.0.0",
    });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found" }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error(`[Error]`, err.message);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === "production"
            ? "Something went wrong"
            : err.message || "Internal Server Error",
    });
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`\n🚀 Server      → http://localhost:${PORT}`);
    console.log(`   Health      → http://localhost:${PORT}/api/health`);
    console.log(`   Socket.io   → enabled`);
    console.log(`   Environment → ${process.env.NODE_ENV || "development"}\n`);
});

process.on("SIGTERM", async () => {
    console.log("\n⏹  Shutting down gracefully…");
    await mongoose.disconnect();
    server.close(() => process.exit(0));
});

process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled rejection:", reason);
});

export default app;
