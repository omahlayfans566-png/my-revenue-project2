import dotenv from "dotenv";
dotenv.config();   // must be first — loads .env before any other import uses process.env

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
import messageRoutes from "./routes/messageRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ── CORS ──────────────────────────────────────────────────────────────────────
// IMPORTANT: Read ALLOWED_ORIGINS inside the callback, not at module load.
// On Render, process.env.FRONTEND_URL may not be available at module parse time
// depending on the platform's env injection order.
const getAllowedOrigins = () => [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
    origin: (origin, cb) => {
        // Allow server-to-server requests (no Origin header)
        if (!origin) return cb(null, true);

        const allowed = getAllowedOrigins();

        // Allow any localhost origin in development
        if (process.env.NODE_ENV !== "production" && origin.startsWith("http://localhost")) {
            return cb(null, true);
        }

        if (allowed.includes(origin)) {
            return cb(null, true);
        }

        // Return cb(null, false) — NOT cb(new Error(...))
        // Throwing an error causes Express to return 500, which breaks the preflight.
        // Returning false sends no CORS headers, which correctly blocks the request.
        console.warn(`[CORS] Blocked origin: ${origin} | Allowed: ${allowed.join(", ")}`);
        return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,   // some legacy browsers choke on 204, but Render needs this
};

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, { cors: corsOptions, pingTimeout: 60000, pingInterval: 25000 });
const onlineUsers = new Map();
global.io = io;
global.onlineUsers = onlineUsers;

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "dateclone_jwt_secret_dev");
        socket.userId = decoded.userId;
        next();
    } catch { next(new Error("Invalid token")); }
});

io.on("connection", (socket) => {
    socket.on("user_online", ({ userId }) => {
        if (!userId || userId !== socket.userId) return;
        onlineUsers.set(userId, socket.id);
        socket.join(`user:${userId}`);
        io.emit("user_status", { userId, online: true });
    });
    socket.on("send_message", ({ toUserId, content, image, tempId }) => {
        if (!socket.userId || !toUserId) return;
        const msg = { fromUserId: socket.userId, toUserId, content: content || "", image: image || null, tempId, createdAt: new Date().toISOString(), isRead: false };
        io.to(`user:${toUserId}`).emit("new_message", msg);
        socket.emit("message_sent", { tempId, createdAt: msg.createdAt });
    });
    socket.on("typing_start", ({ toUserId }) => { if (socket.userId) io.to(`user:${toUserId}`).emit("typing", { fromUserId: socket.userId, typing: true }); });
    socket.on("typing_stop", ({ toUserId }) => { if (socket.userId) io.to(`user:${toUserId}`).emit("typing", { fromUserId: socket.userId, typing: false }); });
    socket.on("messages_read", ({ fromUserId }) => { if (socket.userId) io.to(`user:${fromUserId}`).emit("messages_read_by", { readBy: socket.userId }); });
    socket.on("disconnect", () => {
        if (socket.userId) { onlineUsers.delete(socket.userId); io.emit("user_status", { userId: socket.userId, online: false }); }
    });
});

// ── CORS & Security middleware ───────────────────────────────────────────────
// CORS MUST come before helmet. Helmet's default crossOriginEmbedderPolicy
// (require-corp) and crossOriginOpenerPolicy (same-origin) add response
// headers that cause production CORS preflight (OPTIONS) to return 500.
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(helmet({ 
    crossOriginResourcePolicy: { policy: "cross-origin" }, 
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
if (process.env.NODE_ENV !== "production") app.use(requestLogger);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use("/api", rateLimit({ windowMs: 60000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60000, max: 30, message: { success: false, message: "Too many attempts. Wait 15 minutes." } }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

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
// connectDB is non-blocking — the server starts regardless of DB status.
// Auth routes return 503 when DB is not connected.

// Guard: warn if JWT_SECRET is using the insecure default
if (!process.env.JWT_SECRET) {
    console.warn("⚠️  JWT_SECRET is not set in backend/.env — using insecure development default.");
    console.warn("   Set JWT_SECRET in production to protect user sessions.\n");
}

const start = async () => {
    await connectDB(); // never throws — falls back gracefully

    // Handle EADDRINUSE and other listen errors before they become uncaughtExceptions
    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(`\n❌ Port ${PORT} is already in use.`);
            console.error(`   Another process is listening on port ${PORT}.`);
            console.error(`   Kill it with:  npx kill-port ${PORT}`);
            console.error(`   Or change PORT in backend/.env to a different number.\n`);
        } else {
            console.error("[Server Error]", err.message);
        }
        process.exit(1);
    });

    server.listen(PORT, () => {
        const dbStatus = isMongoConnected() ? "✅ MongoDB connected" : "⚠️  Memory mode (MongoDB not connected)";
        console.log(`\n🚀 Server running  → http://localhost:${PORT}`);
        console.log(`   Health check   → http://localhost:${PORT}/api/health`);
        console.log(`   Database       → ${dbStatus}`);
        console.log(`   Socket.io      → enabled`);
        console.log(`   Environment    → ${process.env.NODE_ENV || "development"}\n`);
    });
};

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async () => {
    console.log("\n⏹  Shutting down…");
    // 1. Stop accepting new Socket.IO connections
    io.close(() => console.log("   Socket.IO server closed."));
    // 2. Disconnect from MongoDB
    await mongoose.disconnect();
    console.log("   MongoDB disconnected.");
    // 3. Close the HTTP server
    server.close(() => {
        console.log("   HTTP server closed.");
        process.exit(0);
    });
    // Force exit after 15 seconds if something hangs
    setTimeout(() => {
        console.error("   ⚠️  Forced shutdown after timeout.");
        process.exit(0);
    }, 15000);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("unhandledRejection", (r) => console.error("[UnhandledRejection]", r));
process.on("uncaughtException", (e) => { console.error("[UncaughtException]", e); process.exit(1); });

start();
export default app;
