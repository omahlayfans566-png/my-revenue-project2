/**
 * testApp.js — Express app for testing (no server.listen)
 * Mirrors the real server but without Socket.IO, schedulers, or listen.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";

// Routes
import authRoutes from "../../routes/authRoutes.js";
import profileRoutes from "../../routes/profileRoutes.js";
import matchRoutes from "../../routes/matchRoutes.js";
import messageRoutes from "../../routes/messageRoutes.js";
import notificationRoutes from "../../routes/notificationRoutes.js";
import discoveryRoutes from "../../routes/discoveryRoutes.js";
import adminRoutes from "../../routes/adminRoutes.js";

// Minimal middleware — no rate limiting in tests
const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Stub global.io so routes that use it don't crash
global.io = { to: () => ({ emit: () => { } }) };
global.onlineUsers = new Map();

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/discover", discoveryRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", db: mongoose.connection.readyState });
});

app.use((_req, res) => res.status(404).json({ success: false, message: "Not found" }));

export default app;
