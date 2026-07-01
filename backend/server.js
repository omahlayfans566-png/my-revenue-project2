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
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    "http://localhost:5173", "http://localhost:5174",
    "http://localhost:5175", "http://localhost:5176",
    process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        if (process.env.NODE_ENV !== "production" && origin.startsWith("http://localhost")) return cb(null, true);
        cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: process.env.NODE_ENV === "production" }));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
if (process.env.NODE_ENV !== "production") app.use(requestLogger);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use("/api", rateLimit({ windowMs: 60000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60000, max: 30, message: { success: false, message: "Too many attempts. Wait 15 min." } }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/messages", messageRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
    const connected = isMongoConnected();
    res.status(connected ? 200 : 503).json({
        status: connected ? "healthy" : "degraded",
        database: connected ? "MongoDB Atlas connected" : "MongoDB disconnected",
        persistence: connected ? "persistent" : "unavailable",
        onlineUsers: onlineUsers.size,
        uptime: Math.floor(process.uptime()) + "s",
        time: new Date().toISOString(),
        version: "1.0.0",
    });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found" }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
    try {
        await connectDB();
        server.listen(PORT, () => {
            console.log(`\nServer running -> http://localhost:${PORT}`);
            console.log(`Health check  -> http://localhost:${PORT}/api/health`);
            console.log("Socket.io     -> enabled");
            console.log(`Environment   -> ${process.env.NODE_ENV || "development"}\n`);
        });
    } catch (error) {
        console.error("Failed to start backend because MongoDB did not connect.");
        console.error(error.message);
        process.exit(1);
    }
};

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async () => {
    console.log("\n⏹  Shutting down…");
    await mongoose.disconnect();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 8000);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("unhandledRejection", (r) => console.error("[UnhandledRejection]", r));
process.on("uncaughtException", (e) => { console.error("[UncaughtException]", e); process.exit(1); });

start();
export default app;
