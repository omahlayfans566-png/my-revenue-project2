import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { messageAPI } from "../services/apiService";
import { useAuth } from "../context/AuthContext";
import "../style/chat.css";

interface Msg {
    _id: string;
    fromUserId: { _id: string; firstName: string; profilePicture?: string };
    toUserId: { _id: string };
    content: string;
    createdAt: string;
    isRead: boolean;
}

interface Conversation {
    _id: string;
    user: { _id: string; firstName: string; lastName: string; profilePicture?: string };
    lastMessage?: { content: string; createdAt: string };
    unreadCount: number;
}

const Chat = () => {
    const { userId: paramUserId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConv, setActiveConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState("");
    const [convLoading, setConvLoading] = useState(true);
    const [msgLoading, setMsgLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [typing, setTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimer = useRef<ReturnType<typeof setTimeout>>();

    // Load conversations
    useEffect(() => {
        const load = async () => {
            setConvLoading(true);
            try {
                const res = await messageAPI.getAllConversations();
                const convs: Conversation[] = res.conversations || [];
                setConversations(convs);
                // If URL has userId, open that conversation
                if (paramUserId) {
                    const found = convs.find((c) => c.user._id === paramUserId);
                    if (found) openConversation(found);
                }
            } catch {/* silent */ }
            finally { setConvLoading(false); }
        };
        load();
    }, [paramUserId]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const openConversation = async (conv: Conversation) => {
        setActiveConv(conv);
        setMsgLoading(true);
        navigate(`/chat/${conv.user._id}`, { replace: true });
        try {
            const res = await messageAPI.getConversation(conv.user._id);
            setMessages(res.messages || []);
        } catch {
            setMessages([]);
        } finally {
            setMsgLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !activeConv || sending) return;
        const text = input.trim();
        setInput("");
        setSending(true);
        try {
            const res = await messageAPI.sendMessage(activeConv.user._id, text);
            setMessages((prev) => [...prev, res.data]);
            // Update last message in sidebar
            setConversations((prev) =>
                prev.map((c) =>
                    c._id === activeConv._id
                        ? { ...c, lastMessage: { content: text, createdAt: new Date().toISOString() }, unreadCount: 0 }
                        : c
                )
            );
        } catch {/* silent */ }
        finally { setSending(false); }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        // Simulate typing indicator (local only)
        setTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 1500);
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };
    const formatDate = (iso: string) => {
        const d = new Date(iso);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return "Today";
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    const convInitials = (u: Conversation["user"]) =>
        `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();

    const msgInitials = (msg: Msg) => msg.fromUserId?.firstName?.[0]?.toUpperCase() ?? "?";

    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="chat-page">
                {/* Sidebar */}
                <div className={`chat-sidebar ${activeConv ? "hidden-mobile" : ""}`}>
                    <div className="chat-sidebar-header">
                        <h2>Messages</h2>
                    </div>
                    {convLoading ? (
                        <div className="chat-loading"><div className="discover-spinner" /></div>
                    ) : conversations.length === 0 ? (
                        <div className="chat-empty-sidebar">
                            <div className="empty-icon">💬</div>
                            <p>No conversations yet.</p>
                            <button className="btn btn-primary" onClick={() => navigate("/matches")}>
                                Go to Matches
                            </button>
                        </div>
                    ) : (
                        <div className="chat-list">
                            {conversations.map((c) => (
                                <div
                                    key={c._id}
                                    className={`chat-list-item ${activeConv?._id === c._id ? "active" : ""}`}
                                    onClick={() => openConversation(c)}
                                >
                                    <div className="cli-avatar">
                                        {c.user.profilePicture ? (
                                            <img src={c.user.profilePicture} alt="" />
                                        ) : (
                                            <div className="cli-avatar-placeholder">{convInitials(c.user)}</div>
                                        )}
                                    </div>
                                    <div className="cli-info">
                                        <div className="cli-top">
                                            <span className="cli-name">{c.user.firstName} {c.user.lastName}</span>
                                            {c.lastMessage && (
                                                <span className="cli-time">{formatDate(c.lastMessage.createdAt)}</span>
                                            )}
                                        </div>
                                        <div className="cli-bottom">
                                            <span className="cli-last">{c.lastMessage?.content ?? "Say hello! 👋"}</span>
                                            {c.unreadCount > 0 && (
                                                <span className="cli-unread">{c.unreadCount}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Message panel */}
                <div className={`chat-panel ${!activeConv ? "hidden-mobile" : ""}`}>
                    {!activeConv ? (
                        <div className="chat-no-selection">
                            <div className="empty-icon">💬</div>
                            <h3>Select a conversation</h3>
                            <p>Choose from your matched conversations on the left.</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat header */}
                            <div className="chat-panel-header">
                                <button className="chat-back-btn" onClick={() => { setActiveConv(null); navigate("/chat", { replace: true }); }}>
                                    ←
                                </button>
                                <div className="chat-panel-avatar">
                                    {activeConv.user.profilePicture ? (
                                        <img src={activeConv.user.profilePicture} alt="" />
                                    ) : (
                                        <div className="cpa-placeholder">{convInitials(activeConv.user)}</div>
                                    )}
                                </div>
                                <div className="chat-panel-info">
                                    <h3>{activeConv.user.firstName} {activeConv.user.lastName}</h3>
                                    <span className="chat-online">Online</span>
                                </div>
                                <button
                                    className="chat-view-profile"
                                    onClick={() => navigate(`/profile/${activeConv.user._id}`)}
                                >
                                    👤
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="chat-messages">
                                {msgLoading ? (
                                    <div className="chat-loading"><div className="discover-spinner" /></div>
                                ) : messages.length === 0 ? (
                                    <div className="chat-no-messages">
                                        <p>Start your conversation with {activeConv.user.firstName}! 💕</p>
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isMe = msg.fromUserId?._id === user?._id;
                                        return (
                                            <div key={msg._id} className={`msg-row ${isMe ? "msg-me" : "msg-them"}`}>
                                                {!isMe && (
                                                    <div className="msg-avatar">
                                                        {msg.fromUserId?.profilePicture ? (
                                                            <img src={msg.fromUserId.profilePicture} alt="" />
                                                        ) : (
                                                            <div className="msg-avatar-placeholder">{msgInitials(msg)}</div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="msg-bubble-wrap">
                                                    <div className={`msg-bubble ${isMe ? "bubble-me" : "bubble-them"}`}>
                                                        {msg.content}
                                                    </div>
                                                    <span className="msg-time">{formatTime(msg.createdAt)}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                {typing && (
                                    <div className="msg-row msg-them">
                                        <div className="msg-typing">
                                            <span /><span /><span />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="chat-input-bar">
                                <textarea
                                    className="chat-input"
                                    placeholder={`Message ${activeConv.user.firstName}…`}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                />
                                <button
                                    className="chat-send-btn"
                                    onClick={handleSend}
                                    disabled={!input.trim() || sending}
                                    aria-label="Send"
                                >
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
