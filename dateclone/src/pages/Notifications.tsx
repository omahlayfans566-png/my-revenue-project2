import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { notificationAPI } from "../services/apiService";
import { useSocket } from "../context/SocketContext";
import "../style/notifications.css";

interface NotificationItem {
    _id: string;
    type: "match" | "like" | "message" | "visit" | "system";
    title: string;
    message: string;
    icon: string;
    isRead: boolean;
    referenceId?: string;
    referenceModel?: string;
    createdAt: string;
    metadata?: any;
}

const Notifications = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [markingAll, setMarkingAll] = useState(false);

    const loadNotifications = useCallback(async (p: number = 1, append: boolean = false) => {
        try {
            const res = await notificationAPI.getNotifications(p, 20);
            const items = res.notifications || [];
            if (append) {
                setNotifications(prev => [...prev, ...items]);
            } else {
                setNotifications(items);
            }
            setUnreadCount(res.pagination?.unreadCount || 0);
            setHasMore(items.length === 20);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    // Listen for real-time notifications
    useEffect(() => {
        if (!socket) return;

        const onNewNotification = (notif: NotificationItem) => {
            setNotifications(prev => [notif, ...prev]);
            if (!notif.isRead) {
                setUnreadCount(c => c + 1);
            }
        };

        const onUnreadCount = ({ count }: { count: number }) => {
            setUnreadCount(count);
        };

        socket.on("new_notification", onNewNotification);
        socket.on("unread_notification_count", onUnreadCount);

        return () => {
            socket.off("new_notification", onNewNotification);
            socket.off("unread_notification_count", onUnreadCount);
        };
    }, [socket]);

    const handleMarkAllRead = async () => {
        setMarkingAll(true);
        try {
            await notificationAPI.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch {
            // silent
        } finally {
            setMarkingAll(false);
        }
    };

    const handleMarkRead = async (id: string) => {
        try {
            await notificationAPI.markAsRead(id);
            setNotifications(prev =>
                prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
            );
            setUnreadCount(c => Math.max(0, c - 1));
        } catch {
            // silent
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await notificationAPI.deleteNotification(id);
            setNotifications(prev => prev.filter(n => n._id !== id));
            setUnreadCount(c => Math.max(0, c - 1));
        } catch {
            // silent
        }
    };

    const handleLoadMore = () => {
        const next = page + 1;
        setPage(next);
        loadNotifications(next, true);
    };

    const handleNotificationClick = (notif: NotificationItem) => {
        if (!notif.isRead) handleMarkRead(notif._id);

        // Navigate based on type
        if (notif.type === "match" && notif.referenceId) {
            navigate(`/chat/${notif.referenceId}`);
        } else if (notif.type === "message" && notif.metadata?.fromUserId) {
            navigate(`/chat/${notif.metadata.fromUserId}`);
        } else if (notif.type === "like" && notif.referenceId) {
            navigate(`/profile/${notif.referenceId}`);
        }
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return "Just now";
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay < 7) return `${diffDay}d ago`;
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    const getIconForType = (notif: NotificationItem) => {
        if (notif.icon) return notif.icon;
        const icons: Record<string, string> = {
            match: "💞", like: "❤️", message: "💬", visit: "👀", system: "🔔",
        };
        return icons[notif.type] || "🔔";
    };

    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="notifications-page">
                <div className="notifications-header">
                    <h1>Notifications</h1>
                    {unreadCount > 0 && (
                        <button
                            className="notif-clear-btn"
                            onClick={handleMarkAllRead}
                            disabled={markingAll}
                        >
                            {markingAll ? "Marking…" : `Mark all read (${unreadCount})`}
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="matches-loading">
                        <div className="discover-spinner" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon" style={{ fontSize: "3rem" }}>🔔</div>
                        <h3>No notifications yet</h3>
                        <p>You'll see new matches, likes, and messages here.</p>
                        <button
                            className="btn btn-primary"
                            style={{ marginTop: 16 }}
                            onClick={() => navigate("/discover")}
                        >
                            Start Swiping
                        </button>
                    </div>
                ) : (
                    <div className="notifications-list">
                        {notifications.map((n) => (
                            <div
                                key={n._id}
                                className={`notif-item ${!n.isRead ? "unread" : ""}`}
                                onClick={() => handleNotificationClick(n)}
                                style={{ cursor: "pointer" }}
                            >
                                <div className="notif-icon">{getIconForType(n)}</div>
                                <div className="notif-content">
                                    <p className="notif-title">{n.title}</p>
                                    <p className="notif-text">{n.message}</p>
                                    <span className="notif-time">{formatTime(n.createdAt)}</span>
                                </div>
                                {!n.isRead && <div className="notif-dot" />}
                                <button
                                    className="notif-delete-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(n._id);
                                    }}
                                    title="Dismiss"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        {hasMore && (
                            <button
                                className="btn btn-outline"
                                style={{ width: "100%", marginTop: 12 }}
                                onClick={handleLoadMore}
                            >
                                Load More
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notifications;