import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getAuthToken } from "../services/apiService";

interface SocketContextValue {
    socket: Socket | null;
    connected: boolean;
    onlineUsers: Set<string>;
    lastSeen: Map<string, string>;
    deliveredMessages: Map<string, string>;
    unreadMessageCount: number;
    archivedUnreadCount: number;
    sendMessage: (toUserId: string, content: string, image?: string, tempId?: string) => void;
    startTyping: (toUserId: string) => void;
    stopTyping: (toUserId: string) => void;
    markRead: (fromUserId: string) => void;
    requestUnreadCount: () => void;
    premiumStatus: { isPremium: boolean; premiumTier: string; premiumExpires: string | null } | null;
    suggestionsVersion: number;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export const useSocket = () => {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error("useSocket must be inside SocketProvider");
    return ctx;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const SocketProvider = ({ children }: { children: ReactNode }) => {
    const { user, isAuthenticated } = useAuth();
    const socketRef = useRef<Socket | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [lastSeen, setLastSeen] = useState<Map<string, string>>(new Map());
    const [deliveredMessages, setDeliveredMessages] = useState<Map<string, string>>(new Map());
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const [archivedUnreadCount, setArchivedUnreadCount] = useState(0);
    const [premiumStatus, setPremiumStatus] = useState<{ isPremium: boolean; premiumTier: string; premiumExpires: string | null } | null>(null);
    const [suggestionsVersion, setSuggestionsVersion] = useState(0);
    const reconnectAttempts = useRef(0);

    const triggerSuggestionsRefresh = useCallback(() => {
        setSuggestionsVersion(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !user) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
            }
            setConnected(false);
            return;
        }

        if (socketRef.current?.connected) return;
        reconnectAttempts.current = 0;

        const token = getAuthToken();
        const newSocket = io(SOCKET_URL, {
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 30000,
            randomizationFactor: 0.5,
            auth: { token },
        });

        socketRef.current = newSocket;

        newSocket.on("connect", () => {
            setConnected(true);
            setSocket(newSocket);
            reconnectAttempts.current = 0;
            newSocket.emit("user_online", { userId: user._id });
            newSocket.emit("get_unread_counts");
            triggerSuggestionsRefresh();
        });

        newSocket.on("disconnect", () => {
            setConnected(false);
        });

        newSocket.on("connect_error", () => {
            setConnected(false);
            reconnectAttempts.current++;
        });

        newSocket.on("reconnect", () => {
            setConnected(true);
            reconnectAttempts.current = 0;
            newSocket.emit("user_online", { userId: user._id });
            newSocket.emit("get_unread_counts");
            triggerSuggestionsRefresh();
        });

        newSocket.on("user_status", ({ userId, online }: { userId: string; online: boolean }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (online) next.add(userId); else next.delete(userId);
                return next;
            });
        });

        newSocket.on("user_last_seen", ({ userId, lastSeen: ls }: { userId: string; lastSeen: string }) => {
            setLastSeen(prev => {
                const next = new Map(prev);
                next.set(userId, ls);
                return next;
            });
        });

        newSocket.on("messages_delivered", ({ toUserId, deliveredAt }: { toUserId: string; deliveredAt: string }) => {
            setDeliveredMessages(prev => {
                const next = new Map(prev);
                next.set(toUserId, deliveredAt);
                return next;
            });
        });

        newSocket.on("unread_message_count", ({ count, archivedCount }: { count: number; archivedCount?: number }) => {
            setUnreadMessageCount(count);
            if (archivedCount !== undefined) setArchivedUnreadCount(archivedCount);
        });

        newSocket.on("premium_status_changed", (data: { isPremium: boolean; premiumTier: string; premiumExpires: string | null }) => {
            setPremiumStatus(data);
        });

        newSocket.on("like_status", () => {
            triggerSuggestionsRefresh();
        });

        const suggestionEvents = [
            "suggestions_updated", "user_registered", "profile_updated",
            "profile_photo_uploaded", "user_deleted", "user_banned",
            "user_unbanned", "user_activated", "profile_completed",
        ];

        suggestionEvents.forEach(event => {
            newSocket.on(event, () => {
                triggerSuggestionsRefresh();
            });
        });

        return () => {
            newSocket.disconnect();
            socketRef.current = null;
            setSocket(null);
            setConnected(false);
        };
    }, [isAuthenticated, user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

    const sendMessage = useCallback((toUserId: string, content: string, image?: string, tempId?: string) => {
        socketRef.current?.emit("send_message", { toUserId, content, image, tempId });
    }, []);

    const startTyping = useCallback((toUserId: string) => {
        socketRef.current?.emit("typing_start", { toUserId });
    }, []);

    const stopTyping = useCallback((toUserId: string) => {
        socketRef.current?.emit("typing_stop", { toUserId });
    }, []);

    const markRead = useCallback((fromUserId: string) => {
        socketRef.current?.emit("messages_read", { fromUserId });
    }, []);

    const requestUnreadCount = useCallback(() => {
        socketRef.current?.emit("get_unread_counts");
    }, []);

    return (
        <SocketContext.Provider value={{
            socket,
            connected,
            onlineUsers,
            lastSeen,
            deliveredMessages,
            unreadMessageCount,
            archivedUnreadCount,
            sendMessage,
            startTyping,
            stopTyping,
            markRead,
            requestUnreadCount,
            premiumStatus,
            suggestionsVersion,
        }}>
            {children}
        </SocketContext.Provider>
    );
};