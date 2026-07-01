import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
} from "../services/notificationService.js";

const router = express.Router();

// GET /api/notifications — Get all notifications for current user
router.get("/", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { page = 1, limit = 20 } = req.query;

        const result = await getNotifications(
            userId,
            parseInt(page),
            parseInt(limit)
        );

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("[Notifications GET]", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch notifications",
        });
    }
});

// GET /api/notifications/unread-count — Get unread notification count
router.get("/unread-count", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { Notification } = await import("../models/Notification.js");
        const count = await Notification.countDocuments({
            userId,
            isRead: false,
        });

        res.json({
            success: true,
            count,
        });
    } catch (error) {
        console.error("[Notifications Unread Count]", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch unread count",
        });
    }
});

// PUT /api/notifications/:id/read — Mark a single notification as read
router.put("/:id/read", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { id } = req.params;

        const notification = await markNotificationRead(id, userId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        res.json({
            success: true,
            message: "Notification marked as read",
            notification,
        });
    } catch (error) {
        console.error("[Notifications Mark Read]", error);
        res.status(500).json({
            success: false,
            message: "Failed to mark notification as read",
        });
    }
});

// PUT /api/notifications/read-all — Mark all notifications as read
router.put("/read-all", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;

        const count = await markAllNotificationsRead(userId);

        res.json({
            success: true,
            message: "All notifications marked as read",
            count,
        });
    } catch (error) {
        console.error("[Notifications Mark All Read]", error);
        res.status(500).json({
            success: false,
            message: "Failed to mark all notifications as read",
        });
    }
});

// DELETE /api/notifications/:id — Delete a notification
router.delete("/:id", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { id } = req.params;

        const deleted = await deleteNotification(id, userId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        res.json({
            success: true,
            message: "Notification deleted",
        });
    } catch (error) {
        console.error("[Notifications Delete]", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete notification",
        });
    }
});

export default router;