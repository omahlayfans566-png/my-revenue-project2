import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { messageAPI } from "../services/apiService";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import "../style/chat.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Msg {
    _id: string; tempId?: string;
    fromUserId: { _id: string; firstName: string; profilePicture?: string } | string;
    toUserId: { _id: string } | string;
    content: string; image?: string;
    createdAt: string; isRead: boolean;
    pending?: boolean;
}
interface Conv {
    _id: string;
    user: { _id: string; firstName: string; lastName: string; profilePicture?: string };
    lastMessage?: { content: string; createdAt: string };
    unreadCount: number;
}

// ─── Main Chat Component ──────────────────────────────────────────────────────
const Chat = () => {
    const { userId: paramId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { socket, connected, onlineUsers, sendMessage, startTyping, stopTyping, markRead } = useSocket();

    const [convs, setConvs] = useState<Conv[]>([]);
    const [activeConv, setActiveConv] = useState<Conv | null>(null);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState("");
    const [convLoading, setConvLoading] = useState(true);
    const [msgLoading, setMsgLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [typing, setTyping] = useState(false);
    const [typingFrom, setTypingFrom] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [totalUnread, setTotalUnread] = useState(0);

    const bottomRef = useRef<HTMLDivElement>(null);
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // ── Load conversations ──────────────────────────────────────────────────────
    const loadConvs = useCallback(async () => {
        setConvLoading(true);
        try {
            const res = await messageAPI.getAllConversations();
            const list: Conv[] = res.conversations || [];
            setConvs(list);
            setTotalUnread(list.reduce((s, c) => s + (c.unreadCount || 0), 0));

            if (paramId) {
                const found = list.find(c => c.user._id === paramId);
                if (found) openConv(found);
            }
        } catch { /* silent */ }
        finally { setConvLoading(false); }
    }, [paramId]);

    useEffect(() => { loadConvs(); }, [loadConvs]);

    // ── Socket event listeners ──────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onMsg = (msg: Msg) => {
            const fromId = typeof msg.fromUserId === "string" ? msg.fromUserId : msg.fromUserId._id;
            // Add to active conversation if open
            setActiveConv(conv => {
                if (conv && conv.user._id === fromId) {
                    setMessages(prev => [...prev, msg]);
                    markRead(fromId);
                    return conv;
                }
                return conv;
            });
            // Update conv list unread count
            setConvs(prev => prev.map(c =>
                c.user._id === fromId
                    ? { ...c, lastMessage: { content: msg.content, createdAt: msg.createdAt }, unreadCount: c.unreadCount + 1 }
                    : c
            ));
            setTotalUnread(n => n + 1);
        };

        const onSent = ({ tempId, createdAt }: { tempId: string; createdAt: string }) => {
            setMessages(prev => prev.map(m =>
                m.tempId === tempId ? { ...m, pending: false, createdAt } : m
            ));
        };

        const onTyping = ({ fromUserId, typing }: { fromUserId: string; typing: boolean }) => {
            setActiveConv(conv => {
                if (conv?.user._id === fromUserId) setTypingFrom(typing ? fromUserId : null);
                return conv;
            });
        };

        const onRead = ({ readBy }: { readBy: string }) => {
            setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
        };

        const onNewMatch = ({ with: withId }: { with: string }) => {
            loadConvs(); // refresh conversation list
        };

        socket.on("new_message", onMsg);
        socket.on("message_sent", onSent);
        socket.on("typing", onTyping);
        socket.on("messages_read_by", onRead);
        socket.on("new_match", onNewMatch);

        return () => {
            socket.off("new_message", onMsg);
            socket.off("message_sent", onSent);
            socket.off("typing", onTyping);
            socket.off("messages_read_by", onRead);
            socket.off("new_match", onNewMatch);
        };
    }, [socket, markRead, loadConvs]);

    // ── Open conversation ───────────────────────────────────────────────────────
    const openConv = async (conv: Conv) => {
        setActiveConv(conv);
        setMsgLoading(true);
        setMessages([]);
        navigate(`/chat/${conv.user._id}`, { replace: true });
        // Mark as read in list
        setConvs(prev => prev.map(c => c._id === conv._id ? { ...c, unreadCount: 0 } : c));
        setTotalUnread(n => Math.max(0, n - (conv.unreadCount || 0)));
        try {
            const res = await messageAPI.getConversation(conv.user._id);
            setMessages(res.messages || []);
            markRead(conv.user._id);
        } catch { setMessages([]); }
        finally { setMsgLoading(false); }
    };

    // ── Auto scroll ─────────────────────────────────────────────────────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, typingFrom]);

    // ── Send message ─────────────────────────────────────────────────────────────
    const handleSend = async () => {
        if ((!input.trim() && !imagePreview) || !activeConv || sending) return;
        const text = input.trim();
        const img = imagePreview || undefined;
        const tempId = `temp_${Date.now()}`;
        setInput("");
        setImagePreview(null);
        setSending(true);

        // Optimistic message
        const optimistic: Msg = {
            _id: tempId, tempId,
            fromUserId: user!._id,
            toUserId: activeConv.user._id,
            content: text, image: img,
            createdAt: new Date().toISOString(),
            isRead: false, pending: true,
        };
        setMessages(prev => [...prev, optimistic]);

        try {
            // Real-time via socket
            if (connected) {
                sendMessage(activeConv.user._id, text, img, tempId);
            }
            // Also persist via REST
            await messageAPI.sendMessage(activeConv.user._id, text, img);
            // Update conv last message
            setConvs(prev => prev.map(c =>
                c._id === activeConv._id
                    ? { ...c, lastMessage: { content: text, createdAt: new Date().toISOString() } }
                    : c
            ));
        } catch { /* silent */ }
        finally { setSending(false); }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); return; }
        if (!activeConv) return;
        startTyping(activeConv.user._id);
        if (typingTimer.current !== null) {
    clearTimeout(typingTimer.current);
}

typingTimer.current = setTimeout(() => {
    stopTyping(activeConv.user._id);
}, 2000);
    };

    const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onloadend = () => setImagePreview(r.result as string);
        r.readAsDataURL(f);
    };

    // ── Helpers ──────────────────────────────────────────────────────────────────
    const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const fmtDate = (iso: string) => {
        const d = new Date(iso), t = new Date();
        if (d.toDateString() === t.toDateString()) return "Today";
        const y = new Date(t); y.setDate(t.getDate() - 1);
        if (d.toDateString() === y.toDateString()) return "Yesterday";
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    };
    const initials = (u: Conv["user"]) => `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
    const isOnline = (uid: string) => onlineUsers.has(uid);
    const fromId = (msg: Msg) => typeof msg.fromUserId === "string" ? msg.fromUserId : (msg.fromUserId as any)._id;

    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div className="page-wrapper">
            <AppNavbar unreadMessages={totalUnread} />

            <div className="chat-page">

                {/* ── Sidebar ──────────────────────────────────────────────────────── */}
                <div className={`chat-sidebar ${activeConv ? "hidden-mobile" : ""}`}>
                    <div className="chat-sidebar-header">
                        <h2>Messages</h2>
                        {totalUnread > 0 && <span className="sidebar-unread-badge">{totalUnread}</span>}
                        {connected && <span className="conn-dot" title="Live" />}
                    </div>

                    {convLoading ? (
                        <div className="chat-loading"><div className="discover-spinner" /></div>
                    ) : convs.length === 0 ? (
                        <div className="chat-empty-sidebar">
                            <div className="empty-icon" style={{ fontSize: "2.5rem" }}>💬</div>
                            <p>No conversations yet.</p>
                            <p style={{ fontSize: "0.82rem", color: "#bbb" }}>Match with someone to start chatting!</p>
                            <button className="btn btn-primary" style={{ marginTop: 12, padding: "9px 20px", fontSize: "0.85rem" }}
                                onClick={() => navigate("/matches")}>
                                View Matches
                            </button>
                        </div>
                    ) : (
                        <div className="chat-list">
                            {convs.map(c => (
                                <div key={c._id}
                                    className={`chat-list-item ${activeConv?._id === c._id ? "active" : ""}`}
                                    onClick={() => openConv(c)}>
                                    <div className="cli-avatar-wrap">
                                        {c.user.profilePicture
                                            ? <img src={c.user.profilePicture} alt="" className="cli-avatar" />
                                            : <div className="cli-avatar cli-avatar-placeholder">{initials(c.user)}</div>}
                                        {isOnline(c.user._id) && <span className="cli-online-dot" />}
                                    </div>
                                    <div className="cli-info">
                                        <div className="cli-top">
                                            <span className="cli-name">{c.user.firstName} {c.user.lastName}</span>
                                            {c.lastMessage && <span className="cli-time">{fmtDate(c.lastMessage.createdAt)}</span>}
                                        </div>
                                        <div className="cli-bottom">
                                            <span className="cli-last">
                                                {c.lastMessage?.content ?? "Say hello! 👋"}
                                            </span>
                                            {c.unreadCount > 0 && <span className="cli-unread">{c.unreadCount}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Message panel ─────────────────────────────────────────────────── */}
                <div className={`chat-panel ${!activeConv ? "hidden-mobile" : ""}`}>
                    {!activeConv ? (
                        <div className="chat-no-selection">
                            <div className="empty-icon" style={{ fontSize: "3rem" }}>💬</div>
                            <h3>Select a conversation</h3>
                            <p>Choose from your matches on the left.</p>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="chat-panel-header">
                                <button className="chat-back-btn" onClick={() => { setActiveConv(null); navigate("/chat", { replace: true }); }}>
                                    ←
                                </button>
                                <div className="chat-panel-avatar-wrap" onClick={() => navigate(`/profile/${activeConv.user._id}`)}>
                                    {activeConv.user.profilePicture
                                        ? <img src={activeConv.user.profilePicture} alt="" className="cpa-img" />
                                        : <div className="cpa-placeholder">{initials(activeConv.user)}</div>}
                                    {isOnline(activeConv.user._id) && <span className="cpa-online-dot" />}
                                </div>
                                <div className="chat-panel-info" onClick={() => navigate(`/profile/${activeConv.user._id}`)}>
                                    <h3>{activeConv.user.firstName} {activeConv.user.lastName}</h3>
                                    <span className={isOnline(activeConv.user._id) ? "chat-status online" : "chat-status"}>
                                        {isOnline(activeConv.user._id) ? "● Online" : "● Offline"}
                                    </span>
                                </div>
                                <div className="chat-header-actions">
                                    <button className="chat-icon-btn" onClick={() => navigate(`/profile/${activeConv.user._id}`)}
                                        title="View profile">👤</button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="chat-messages">
                                {msgLoading ? (
                                    <div className="chat-loading"><div className="discover-spinner" /></div>
                                ) : messages.length === 0 ? (
                                    <div className="chat-no-messages">
                                        <p>Start your conversation with {activeConv.user.firstName}! 💕</p>
                                        <p style={{ fontSize: "0.8rem", color: "#bbb", marginTop: 6 }}>
                                            Say something kind to break the ice ✨
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((msg, i) => {
                                        const isMe = fromId(msg) === user?._id;
                                        const prev = i > 0 ? messages[i - 1] : null;
                                        const showDate = !prev || fmtDate(msg.createdAt) !== fmtDate(prev.createdAt);

                                        return (
                                            <div key={msg._id}>
                                                {showDate && (
                                                    <div className="msg-date-divider">
                                                        <span>{fmtDate(msg.createdAt)}</span>
                                                    </div>
                                                )}
                                                <div className={`msg-row ${isMe ? "msg-me" : "msg-them"} ${msg.pending ? "msg-pending" : ""}`}>
                                                    {!isMe && (
                                                        <div className="msg-avatar-sm">
                                                            {activeConv.user.profilePicture
                                                                ? <img src={activeConv.user.profilePicture} alt="" />
                                                                : <div className="msg-avatar-placeholder">{initials(activeConv.user)}</div>}
                                                        </div>
                                                    )}
                                                    <div className="msg-bubble-wrap">
                                                        {msg.image && (
                                                            <div className={`msg-image-bubble ${isMe ? "bubble-me" : "bubble-them"}`}>
                                                                <img src={msg.image} alt="shared" onClick={() => window.open(msg.image, "_blank")} />
                                                            </div>
                                                        )}
                                                        {msg.content && (
                                                            <div className={`msg-bubble ${isMe ? "bubble-me" : "bubble-them"}`}>
                                                                {msg.content}
                                                            </div>
                                                        )}
                                                        <div className={`msg-meta ${isMe ? "meta-right" : "meta-left"}`}>
                                                            <span className="msg-time">{fmtTime(msg.createdAt)}</span>
                                                            {isMe && (
                                                                <span className="msg-status">
                                                                    {msg.pending ? "⏳" : msg.isRead ? "✓✓" : "✓"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}

                                {/* Typing indicator */}
                                {typingFrom && typingFrom === activeConv.user._id && (
                                    <div className="msg-row msg-them">
                                        <div className="msg-avatar-sm">
                                            {activeConv.user.profilePicture
                                                ? <img src={activeConv.user.profilePicture} alt="" />
                                                : <div className="msg-avatar-placeholder">{initials(activeConv.user)}</div>}
                                        </div>
                                        <div className="msg-typing">
                                            <span /><span /><span />
                                        </div>
                                    </div>
                                )}
                                <div ref={bottomRef} />
                            </div>

                            {/* Image preview */}
                            {imagePreview && (
                                <div className="chat-image-preview">
                                    <img src={imagePreview} alt="preview" />
                                    <button className="remove-preview" onClick={() => setImagePreview(null)}>✕</button>
                                </div>
                            )}

                            {/* Input bar */}
                            <div className="chat-input-bar">
                                <button className="chat-attach-btn" onClick={() => fileRef.current?.click()} title="Share image">
                                    📎
                                </button>
                                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImagePick} />
                                <textarea
                                    className="chat-input"
                                    placeholder={`Message ${activeConv.user.firstName}…`}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                />
                                <button
                                    className="chat-send-btn"
                                    onClick={handleSend}
                                    disabled={(!input.trim() && !imagePreview) || sending}
                                    aria-label="Send">
                                    {sending ? <span className="auth-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : "➤"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Chat;
