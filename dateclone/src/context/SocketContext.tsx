import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getAuthToken } from "../services/apiService";

interface SocketContextValue {
    socket: Socket | null;
    connected: boolean;
    onlineUsers: Set<string>;
    sendMessage: (toUserId: string, content: string, image?: string, tempId?: string) => void;
    startTyping: (toUserId: string) => void;
    stopTyping: (toUserId: string) => void;
    markRead: (fromUserId: string) => void;
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
    const [connected, setConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!isAuthenticated || !user) {
            socketRef.current?.disconnect();
            socketRef.current = null;
            setConnected(false);
            return;
        }

        // Only connect once
        if (socketRef.current?.connected) return;

        const socket = io(SOCKET_URL, {
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            setConnected(true);
            socket.emit("user_online", { userId: user._id, token: getAuthToken() });
        });

        socket.on("disconnect", () => setConnected(false));

        socket.on("user_status", ({ userId, online }: { userId: string; online: boolean }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (online) next.add(userId); else next.delete(userId);
                return next;
            });
        });

        return () => {
            socket.disconnect();
            setConnected(false);
        };
    }, [isAuthenticated, user]);

    const sendMessage = (toUserId: string, content: string, image?: string, tempId?: string) => {
        socketRef.current?.emit("send_message", { toUserId, content, image, tempId });
    };

    const startTyping = (toUserId: string) => socketRef.current?.emit("typing_start", { toUserId });
    const stopTyping = (toUserId: string) => socketRef.current?.emit("typing_stop", { toUserId });
    const markRead = (fromUserId: string) => socketRef.current?.emit("messages_read", { fromUserId });

    return (
        <SocketContext.Provider value={{
            socket: socketRef.current,
            connected, onlineUsers,
            sendMessage, startTyping, stopTyping, markRead,
        }}>
            {children}
        </SocketContext.Provider>
    );
};
