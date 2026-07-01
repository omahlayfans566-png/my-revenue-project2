import { Notification } from "../models/Notification.js";

/**
 * Create a notification and emit it via Socket.IO to the recipient user.
 *
 * @param {Object} params
 * @param {string} params.userId        - The recipient user ID
 * @param {("match"|"like"|"message"|"visit"|"system")} params.type - Notification type
 * @param {string} params.title         - Optional title
 * @param {string} params.message       - Notification body text
 * @param {string} [params.referenceId] - Optional linked document ID
 * @param {("User"|"Match"|"Message")} [params.referenceModel] - Linked model name
 * @param {string} [params.icon]        - Emoji icon override
 * @param {Object} [params.metadata]    - Extra data payload
 * @returns {Promise<Object>} The saved notification
 */
export const createNotification = async ({
    userId,
    type,
    title = "",
    message,
    referenceId = null,
    referenceModel = null,
    icon,
    metadata = {},
}) => {
    if (!userId || !type || !message) {
        console.warn("[NotificationService] Missing required fields");
        return null;
    }

    try {
        const notification = await Notification.create({
            userId,
            type,
            title,
            message,
            referenceId,
            referenceModel,
            icon: icon || getDefaultIcon(type),
            metadata,
        });

        // Emit via Socket.IO if available
        if (global.io) {
            global.io.to(`user:${userId}`).emit("new_notification", {
                _id: notification._id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                referenceId: notification.referenceId,
                referenceModel: notification.referenceModel,
                icon: notification.icon,
                metadata: notification.metadata,
                isRead: false,
                createdAt: notification.createdAt,
            });

            // Also emit a count update
            const unreadCount = await Notification.countDocuments({
                userId,
                isRead: false,
            });
            global.io
                .to(`user:${userId}`)
                .emit("unread_notification_count", { count: unreadCount });
        }

        return notification;
    } catch (error) {
        console.error("[NotificationService] Failed to create notification:", error.message);
        return null;
    }
};

/**
 * Mark a single notification as read.
 */
export const markNotificationRead = async (notificationId, userId) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { isRead: true, readAt: new Date() },
            { new: true }
        );
        return notification;
    } catch (error) {
        console.error("[NotificationService] Mark read error:", error.message);
        return null;
    }
};

/**
 * Mark all notifications for a user as read.
 */
export const markAllNotificationsRead = async (userId) => {
    try {
        const result = await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );
        return result.modifiedCount;
    } catch (error) {
        console.error("[NotificationService] Mark all read error:", error.message);
        return 0;
    }
};

/**
 * Get notifications for a user with pagination.
 */
export const getNotifications = async (userId, page = 1, limit = 20) => {
    try {
        const skip = (page - 1) * limit;
        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments({ userId }),
            Notification.countDocuments({ userId, isRead: false }),
        ]);

        return {
            notifications,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit,
                unreadCount,
            },
        };
    } catch (error) {
        console.error("[NotificationService] Get notifications error:", error.message);
        return { notifications: [], pagination: { total: 0, page: 1, pages: 0, limit, unreadCount: 0 } };
    }
};

/**
 * Delete a notification.
 */
export const deleteNotification = async (notificationId, userId) => {
    try {
        const result = await Notification.findOneAndDelete({
            _id: notificationId,
            userId,
        });
        return !!result;
    } catch (error) {
        console.error("[NotificationService] Delete error:", error.message);
        return false;
    }
};

/**
 * Get default icon per type.
 */
const getDefaultIcon = (type) => {
    const icons = {
        match: "💞",
        like: "❤️",
        message: "💬",
        visit: "👀",
        system: "🔔",
    };
    return icons[type] || "🔔";
};