import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import EmojiPicker from "../component/EmojiPicker";
import { messageAPI } from "../services/apiService";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import "../style/chat.css";

// ─── Phone Number Detection (frontend) ──────────────────────────────────────
const WORD_DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

const containsPhoneNumber = (text: string): boolean => {
    if (!text) return false;
    let normalized = text
        .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, '')
        .replace(/[()\[\]{}]/g, '')
        .replace(/[\s.,\-_/\\|;:'"~`!@#$%^&*+=<>?]+/g, '');
    const lowerText = text.toLowerCase();
    let wordCount = 0;
    for (const word of WORD_DIGITS) {
        const matches = lowerText.match(new RegExp(word, 'gi'));
        if (matches) wordCount += matches.length;
    }
    if (wordCount >= 7) return true;
    const digitSequences = normalized.match(/\d{7,15}/g);
    if (digitSequences) {
        for (const seq of digitSequences) {
            if (seq.length >= 7 && seq.length <= 15 && /^\+?\d+$/.test(seq)) return true;
        }
    }
    const cleaned = text.replace(/[\s.\-()\[\]{}_/\\|,;:'"~`!@#$%^&*+=<>?]+/g, '');
    const phoneRegex = /(?:(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4})/g;
    const matches = cleaned.match(phoneRegex);
    if (matches) {
        for (const m of matches) {
            const digits = m.replace(/\D/g, '');
            if (digits.length >= 7 && digits.length <= 15) return true;
        }
    }
    return false;
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Msg {
    _id: string; tempId?: string;
    fromUserId: { _id: string; firstName: string; profilePicture?: string } | string;
    toUserId: { _id: string } | string;
    content: string; image?: string; fileUrl?: string; fileName?: string; fileSize?: number; gifUrl?: string;
    messageType?: string;
    createdAt: string; editedAt?: string; isRead: boolean; isDelivered?: boolean;
    pending?: boolean;
    reaction?: string | null;
    reactions?: { userId: string; emoji: string }[];
    replyTo?: { _id: string; content?: string; image?: string; fromUserId: string };
    replyContent?: string;
    replyFrom?: string;
    isForwarded?: boolean;
    forwardedFrom?: { firstName: string; lastName: string };
}
interface Conv {
    _id: string;
    user: { _id: string; firstName: string; lastName: string; profilePicture?: string };
    lastMessage?: { content: string; createdAt: string };
    unreadCount: number;
    isPinned?: boolean;
    isArchived?: boolean;
}

const REACTION_EMOJIS = ["❤️", "😂", "😍", "🔥", "👍", "🎉", "😢", "😡"];

// ─── Main Chat Component ──────────────────────────────────────────────────────
const Chat = () => {
    const { userId: paramId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { socket, connected, onlineUsers, lastSeen, deliveredMessages, unreadMessageCount } = useSocket();

    const [convs, setConvs] = useState<Conv[]>([]);
    const [activeConv, setActiveConv] = useState<Conv | null>(null);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState("");
    const [convLoading, setConvLoading] = useState(true);
    const [msgLoading, setMsgLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [typingFrom, setTypingFrom] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [totalUnread, setTotalUnread] = useState(0);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showReactions, setShowReactions] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<Msg | null>(null);
    const [showForward, setShowForward] = useState(false);
    const [forwardMsg, setForwardMsg] = useState<Msg | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Msg[]>([]);
    const [searching, setSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [forwardTargets, setForwardTargets] = useState<Conv[]>([]);
    const [showGallery, setShowGallery] = useState(false);
    const [galleryMedia, setGalleryMedia] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [showPhonePopup, setShowPhonePopup] = useState(false);
    const [showMenuId, setShowMenuId] = useState<string | null>(null);

    const bottomRef = useRef<HTMLDivElement>(null);
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const docRef = useRef<HTMLInputElement>(null);
    const messagesRef = useRef<HTMLDivElement>(null);
    const editRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenuId(null);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // ── Load conversations ──────────────────────────────────────────────────────
    const loadConvs = useCallback(async (search?: string) => {
        setConvLoading(true);
        try {
            const res = await messageAPI.getAllConversations(search);
            const list: Conv[] = res.conversations || [];
            setConvs(list);
            setTotalUnread(list.reduce((s, c) => s + (c.unreadCount || 0), 0));
            if (paramId && !search) {
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
            setActiveConv(conv => {
                if (conv && conv.user._id === fromId) {
                    setMessages(prev => [...prev, msg]);
                    socket?.emit("messages_read", { fromUserId: fromId });
                    return conv;
                }
                return conv;
            });
            setConvs(prev => prev.map(c =>
                c.user._id === fromId
                    ? { ...c, lastMessage: { content: msg.content || (msg.image ? "[Image]" : msg.gifUrl ? "[GIF]" : msg.fileUrl ? "[File]" : ""), createdAt: msg.createdAt }, unreadCount: c.unreadCount + 1 }
                    : c
            ));
            setTotalUnread(n => n + 1);
        };

        const onSent = ({ tempId, _id, createdAt }: { tempId: string; _id: string; createdAt: string }) => {
            setMessages(prev => prev.map(m =>
                m.tempId === tempId ? { ...m, pending: false, _id, createdAt } : m
            ));
        };

        const onTyping = ({ fromUserId, typing }: { fromUserId: string; typing: boolean }) => {
            setActiveConv(conv => {
                if (conv?.user._id === fromUserId) setTypingFrom(typing ? fromUserId : null);
                return conv;
            });
        };

        const onRead = ({ readBy }: { readBy: string }) => {
            setMessages(prev => prev.map(m => {
                const mFromId = typeof m.fromUserId === "string" ? m.fromUserId : (m.fromUserId as any)._id;
                if (mFromId !== readBy) return { ...m, isRead: true };
                return m;
            }));
        };

        const onDelivered = ({ toUserId }: { toUserId: string }) => {
            setMessages(prev => prev.map(m => {
                const mToId = typeof m.toUserId === "string" ? m.toUserId : (m.toUserId as any)._id;
                if (mToId === toUserId) return { ...m, isDelivered: true };
                return m;
            }));
        };

        const onReaction = ({ messageId, reaction, userId }: { messageId: string; reaction: string; userId: string }) => {
            setMessages(prev => prev.map(m =>
                m._id === messageId ? { ...m, reaction, reactions: reaction ? [...(m.reactions || []), { userId, emoji: reaction }] : m.reactions } : m
            ));
        };

        // ── Edit message socket handler ────────────────────────────────────────
        const onEdited = ({ messageId, content, editedAt }: { messageId: string; content: string; editedAt: string }) => {
            setMessages(prev => prev.map(m =>
                m._id === messageId ? { ...m, content, editedAt } : m
            ));
        };

        const onError = (err: { tempId?: string; error: string }) => {
            if (err.error === "Phone numbers are not allowed") {
                setShowPhonePopup(true);
                setMessages(prev => prev.filter(m => m.tempId !== err.tempId));
            }
        };

        socket.on("new_message", onMsg);
        socket.on("message_sent", onSent);
        socket.on("typing", onTyping);
        socket.on("messages_read_by", onRead);
        socket.on("messages_delivered", onDelivered);
        socket.on("message_reaction", onReaction);
        socket.on("message_edited", onEdited);
        socket.on("message_error", onError);

        return () => {
            socket.off("new_message", onMsg);
            socket.off("message_sent", onSent);
            socket.off("typing", onTyping);
            socket.off("messages_read_by", onRead);
            socket.off("messages_delivered", onDelivered);
            socket.off("message_reaction", onReaction);
            socket.off("message_edited", onEdited);
            socket.off("message_error", onError);
        };
    }, [socket]);

    // ── Open conversation ───────────────────────────────────────────────────────
    const openConv = async (conv: Conv) => {
        setActiveConv(conv);
        setMsgLoading(true);
        setMessages([]);
        setPage(1);
        setHasMore(true);
        setEditingId(null);
        navigate(`/chat/${conv.user._id}`, { replace: true });
        setConvs(prev => prev.map(c => c._id === conv._id ? { ...c, unreadCount: 0 } : c));
        setTotalUnread(n => Math.max(0, n - (conv.unreadCount || 0)));
        try {
            const res = await messageAPI.getConversation(conv.user._id);
            setMessages(res.messages || []);
            setHasMore(res.totalPages > 1);
            socket?.emit("messages_read", { fromUserId: conv.user._id });
        } catch { setMessages([]); }
        finally { setMsgLoading(false); }
    };

    // ── Load more messages (pagination) ─────────────────────────────────────────
    const loadMore = async () => {
        if (!activeConv || loadingMore || !hasMore) return;
        setLoadingMore(true);
        const nextPage = page + 1;
        try {
            const res = await messageAPI.getConversation(activeConv.user._id, nextPage);
            if (res.messages?.length > 0) {
                setMessages(prev => [...res.messages.reverse(), ...prev]);
                setPage(nextPage);
                setHasMore(nextPage < (res.totalPages || 1));
            } else {
                setHasMore(false);
            }
        } catch { /* silent */ }
        finally { setLoadingMore(false); }
    };

    // ── Auto scroll ─────────────────────────────────────────────────────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, typingFrom]);

    // ── Send message ─────────────────────────────────────────────────────────────
    const handleSend = async (extraOptions: Record<string, any> = {}) => {
        if (!input.trim() && !imagePreview && !extraOptions.fileUrl && !extraOptions.gifUrl) return;
        if (!activeConv || sending) return;
        const text = input.trim();

        // Phone number check before sending
        if (text && containsPhoneNumber(text)) {
            setShowPhonePopup(true);
            return;
        }

        const img = imagePreview || undefined;
        const tempId = `temp_${Date.now()}`;
        setInput("");
        setImagePreview(null);
        setReplyTo(null);
        setShowEmoji(false);
        setSending(true);

        const optimistic: Msg = {
            _id: tempId, tempId,
            fromUserId: user!._id,
            toUserId: activeConv.user._id,
            content: text,
            image: img,
            fileUrl: extraOptions.fileUrl,
            fileName: extraOptions.fileName,
            gifUrl: extraOptions.gifUrl,
            messageType: extraOptions.messageType || (img ? "image" : extraOptions.gifUrl ? "gif" : extraOptions.fileUrl ? "file" : "text"),
            createdAt: new Date().toISOString(),
            isRead: false,
            pending: true,
            replyTo: replyTo ? { _id: replyTo._id, content: replyTo.content, image: replyTo.image, fromUserId: typeof replyTo.fromUserId === "string" ? replyTo.fromUserId : replyTo.fromUserId._id } : undefined,
            replyContent: replyTo?.replyContent || replyTo?.content,
            replyFrom: replyTo?.replyFrom,
        };
        setMessages(prev => [...prev, optimistic]);

        try {
            const payload: Record<string, any> = {
                toUserId: activeConv.user._id,
                content: text,
                image: img,
                ...extraOptions,
                replyTo: replyTo?._id,
                tempId,
            };
            if (connected) {
                socket?.emit("send_message", payload);
            }
            await messageAPI.sendMessage(activeConv.user._id, text, img, extraOptions);
            setConvs(prev => prev.map(c =>
                c._id === activeConv._id
                    ? { ...c, lastMessage: { content: text || extraOptions.fileName || "[Media]", createdAt: new Date().toISOString() } }
                    : c
            ));
        } catch (err: any) {
            setMessages(prev => prev.filter(m => m.tempId !== tempId));
            if (err?.message?.includes("Phone numbers are not allowed")) {
                setShowPhonePopup(true);
            }
        }
        finally { setSending(false); }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); return; }
        if (!activeConv) return;
        socket?.emit("typing_start", { toUserId: activeConv.user._id });
        if (typingTimer.current !== null) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => { socket?.emit("typing_stop", { toUserId: activeConv.user._id }); }, 2000);
    };

    // ── Image/File pick handlers ────────────────────────────────────────────────
    const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onloadend = () => setImagePreview(r.result as string);
        r.readAsDataURL(f);
    };

    const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onloadend = () => {
            handleSend({ fileUrl: r.result, fileName: f.name, fileSize: f.size, messageType: "file" });
        };
        r.readAsDataURL(f);
    };

    // ── GIF support ──────────────────────────────────────────────────────────
    const quickGifs = ["🎉", "🎊", "🎈", "🎁", "🔥", "💯", "✨", "⭐", "👏", "🙌", "😍", "😂", "🤣", "🥳", "🎂", "🍕", "☕", "🌹", "💕", "💪"];
    const handleGifSelect = (gif: string) => {
        handleSend({ gifUrl: gif, messageType: "gif" });
    };

    // ── Reactions ──────────────────────────────────────────────────────────────
    const handleReact = async (messageId: string, emoji: string) => {
        try {
            await messageAPI.reactToMessage(messageId, emoji);
            setMessages(prev => prev.map(m =>
                m._id === messageId ? { ...m, reaction: m.reaction === emoji ? null : emoji } : m
            ));
        } catch { /* silent */ }
        setShowReactions(null);
    };

    // ── Edit Message ──────────────────────────────────────────────────────────
    const handleEditStart = (msg: Msg) => {
        setEditingId(msg._id);
        setEditText(msg.content);
        setShowMenuId(null);
        setTimeout(() => editRef.current?.focus(), 50);
    };

    const handleEditCancel = () => {
        setEditingId(null);
        setEditText("");
    };

    const handleEditSave = async (msgId: string) => {
        if (!editText.trim() || !activeConv) return;
        const newContent = editText.trim();

        // Phone check on edit
        if (containsPhoneNumber(newContent)) {
            setShowPhonePopup(true);
            return;
        }

        try {
            // Optimistic update
            setMessages(prev => prev.map(m =>
                m._id === msgId ? { ...m, content: newContent, editedAt: new Date().toISOString() } : m
            ));
            setEditingId(null);
            setEditText("");

            // API call
            await messageAPI.editMessage(msgId, newContent);
            // Socket emit
            socket?.emit("edit_message", { messageId: msgId, content: newContent });
        } catch { /* silent */ }
    };

    // ── Forward ─────────────────────────────────────────────────────────────────
    const handleForward = async (msg: Msg, targetUserId: string) => {
        try {
            await messageAPI.forwardMessage(msg._id, targetUserId);
            setShowForward(false);
            setForwardMsg(null);
        } catch { /* silent */ }
    };

    const openForward = (msg: Msg) => {
        setForwardMsg(msg);
        setShowForward(true);
        setForwardTargets(convs.filter(c => c.user._id !== (typeof msg.fromUserId === "string" ? msg.fromUserId : msg.fromUserId._id)));
    };

    // ── Pin / Archive ───────────────────────────────────────────────────────────
    const handlePin = async (targetUserId: string, pinned: boolean) => {
        try {
            await messageAPI.pinConversation(targetUserId, pinned);
            setConvs(prev => prev.map(c =>
                c.user._id === targetUserId ? { ...c, isPinned: pinned } : c
            ));
        } catch { /* silent */ }
    };

    const handleArchive = async (targetUserId: string, archived: boolean) => {
        try {
            await messageAPI.archiveConversation(targetUserId, archived);
            if (archived) {
                setConvs(prev => prev.filter(c => c.user._id !== targetUserId));
                if (activeConv?.user._id === targetUserId) {
                    setActiveConv(null);
                    navigate("/chat", { replace: true });
                }
            }
        } catch { /* silent */ }
    };

    // ── Search Messages ─────────────────────────────────────────────────────────
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const res = await messageAPI.searchMessages(searchQuery.trim());
            setSearchResults(res.messages || []);
        } catch { setSearchResults([]); }
        finally { setSearching(false); }
    };

    // ── Gallery ─────────────────────────────────────────────────────────────────
    const openGallery = async () => {
        if (!activeConv) return;
        setShowGallery(true);
        try {
            const res = await messageAPI.getMediaGallery(activeConv.user._id);
            setGalleryMedia(res.messages || []);
        } catch { setGalleryMedia([]); }
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
    const getLastSeen = (uid: string) => lastSeen.get(uid) || null;
    const fromId = (msg: Msg) => typeof msg.fromUserId === "string" ? msg.fromUserId : (msg.fromUserId as any)._id;

    const getMsgStatus = (msg: Msg) => {
        if (msg.pending) return { icon: "⏳", label: "Sending..." };
        if (msg.isRead) return { icon: "✓✓", label: "Read" };
        if (msg.isDelivered || deliveredMessages.has(fromId(msg))) return { icon: "✓✓", label: "Delivered" };
        return { icon: "✓", label: "Sent" };
    };

    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div className="page-wrapper">
            <AppNavbar unreadMessages={totalUnread} />

            <div className="chat-page">

                {/* ── Sidebar ──────────────────────────────────────────────────────── */}
                <div className={`chat-sidebar ${activeConv ? "hidden-mobile" : ""}`}>
                    <div className="chat-sidebar-header">
                        <h2>Messages</h2>
                        <div className="chat-sidebar-actions">
                            <button className="chat-icon-btn" onClick={() => setShowSearch(!showSearch)} title="Search messages">🔍</button>
                            {totalUnread > 0 && <span className="sidebar-unread-badge">{totalUnread}</span>}
                            {connected && <span className="conn-dot" title="Live" />}
                        </div>
                    </div>

                    {showSearch && (
                        <div className="chat-search-bar">
                            <input
                                type="text"
                                placeholder="Search conversations or messages..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") { if (searchQuery.trim()) loadConvs(searchQuery.trim()); else loadConvs(); } }}
                                autoFocus
                                aria-label="Search conversations"
                            />
                            <button className="chat-search-clear" onClick={() => { setSearchQuery(""); loadConvs(); }}>✕</button>
                        </div>
                    )}

                    <div className="chat-archived-link" onClick={() => navigate("/chat/archived")} role="button" tabIndex={0} aria-label="View archived chats"
                        onKeyDown={e => e.key === "Enter" && navigate("/chat/archived")}>
                        📂 Archived Chats
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
                                    className={`chat-list-item ${activeConv?._id === c._id ? "active" : ""} ${c.isPinned ? "pinned" : ""}`}
                                    onClick={() => openConv(c)}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Chat with ${c.user.firstName}`}
                                    onKeyDown={e => e.key === "Enter" && openConv(c)}
                                >
                                    <div className="cli-avatar-wrap">
                                        {c.user.profilePicture
                                            ? <img src={c.user.profilePicture} alt="" className="cli-avatar" />
                                            : <div className="cli-avatar cli-avatar-placeholder">{initials(c.user)}</div>}
                                        {isOnline(c.user._id) && <span className="cli-online-dot" />}
                                    </div>
                                    <div className="cli-info">
                                        <div className="cli-top">
                                            <span className="cli-name">{c.isPinned && "📌 "}{c.user.firstName} {c.user.lastName}</span>
                                            {c.lastMessage && <span className="cli-time">{fmtDate(c.lastMessage.createdAt)}</span>}
                                        </div>
                                        <div className="cli-bottom">
                                            <span className="cli-last">
                                                {c.lastMessage?.content ?? "Say hello! 👋"}
                                            </span>
                                            <div className="cli-actions">
                                                {c.unreadCount > 0 && <span className="cli-unread">{c.unreadCount}</span>}
                                                <button className="cli-more-btn" onClick={e => { e.stopPropagation(); handlePin(c.user._id, !c.isPinned); }} title={c.isPinned ? "Unpin" : "Pin"}>
                                                    📌
                                                </button>
                                                <button className="cli-more-btn" onClick={e => { e.stopPropagation(); handleArchive(c.user._id, true); }} title="Archive">
                                                    📦
                                                </button>
                                            </div>
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
                                <button className="chat-back-btn" onClick={() => { setActiveConv(null); navigate("/chat", { replace: true }); }} aria-label="Back">
                                    ←
                                </button>
                                <div className="chat-panel-avatar-wrap" onClick={() => navigate(`/profile/${activeConv.user._id}`)} role="button" tabIndex={0} aria-label="View profile"
                                    onKeyDown={e => e.key === "Enter" && navigate(`/profile/${activeConv.user._id}`)}>
                                    {activeConv.user.profilePicture
                                        ? <img src={activeConv.user.profilePicture} alt="" className="cpa-img" />
                                        : <div className="cpa-placeholder">{initials(activeConv.user)}</div>}
                                    {isOnline(activeConv.user._id) && <span className="cpa-online-dot" />}
                                </div>
                                <div className="chat-panel-info" onClick={() => navigate(`/profile/${activeConv.user._id}`)} role="button" tabIndex={0} aria-label="View profile"
                                    onKeyDown={e => e.key === "Enter" && navigate(`/profile/${activeConv.user._id}`)}>
                                    <h3>{activeConv.user.firstName} {activeConv.user.lastName}</h3>
                                    <span className={isOnline(activeConv.user._id) ? "chat-status online" : "chat-status"}>
                                        {isOnline(activeConv.user._id)
                                            ? "● Online"
                                            : getLastSeen(activeConv.user._id)
                                                ? `Last seen ${fmtTime(getLastSeen(activeConv.user._id)!)}`
                                                : "● Offline"}
                                    </span>
                                </div>
                                <div className="chat-header-actions">
                                    <button className="chat-icon-btn" onClick={openGallery} title="Media gallery" aria-label="Media gallery">🖼️</button>
                                    <button className="chat-icon-btn" onClick={() => handlePin(activeConv.user._id, !activeConv.isPinned)} title="Pin conversation" aria-label="Pin conversation">📌</button>
                                    <button className="chat-icon-btn" onClick={() => handleArchive(activeConv.user._id, true)} title="Archive" aria-label="Archive">📦</button>
                                    <button className="chat-icon-btn" onClick={() => navigate(`/profile/${activeConv.user._id}`)} title="View profile" aria-label="View profile">👤</button>
                                </div>
                            </div>

                            {/* Search Results */}
                            {showSearch && searchResults.length > 0 && (
                                <div className="chat-search-results">
                                    <div className="chat-search-results-header">
                                        <span>Search results ({searchResults.length})</span>
                                        <button onClick={() => setSearchResults([])}>✕</button>
                                    </div>
                                    {searchResults.map(msg => (
                                        <div key={msg._id} className="chat-search-result-item" onClick={() => {
                                            const c = convs.find(c => c.user._id === (typeof msg.fromUserId === "string" ? msg.fromUserId : msg.fromUserId._id) || c.user._id === (typeof msg.toUserId === "string" ? msg.toUserId : msg.toUserId._id));
                                            if (c) openConv(c);
                                        }}>
                                            <span className="chat-search-result-text">{msg.content}</span>
                                            <span className="chat-search-result-time">{fmtDate(msg.createdAt)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Messages */}
                            <div className="chat-messages" ref={messagesRef} onScroll={e => {
                                const el = e.currentTarget;
                                if (el.scrollTop === 0 && hasMore && !loadingMore) loadMore();
                            }}>
                                {loadingMore && <div className="chat-loading-more"><div className="discover-spinner" style={{ width: 20, height: 20 }} /></div>}
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
                                        const status = getMsgStatus(msg);
                                        const isEditing = editingId === msg._id;

                                        return (
                                            <div key={msg._id} className={`msg-wrapper ${isMe ? "msg-me" : "msg-them"}`}>
                                                {showDate && (
                                                    <div className="msg-date-divider">
                                                        <span>{fmtDate(msg.createdAt)}</span>
                                                    </div>
                                                )}

                                                {/* Reply preview */}
                                                {msg.replyTo && msg.replyContent && (
                                                    <div className={`msg-reply-preview ${isMe ? "reply-me" : "reply-them"}`}>
                                                        <span className="msg-reply-from">{msg.replyFrom}</span>
                                                        <span className="msg-reply-content">{msg.replyContent?.substring(0, 80)}</span>
                                                    </div>
                                                )}

                                                {/* Forwarded tag */}
                                                {msg.isForwarded && (
                                                    <div className={`msg-forwarded-tag ${isMe ? "forwarded-me" : "forwarded-them"}`}>
                                                        📩 Forwarded {msg.forwardedFrom ? `from ${msg.forwardedFrom.firstName}` : ""}
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
                                                    <div className="msg-bubble-wrap"
                                                        onContextMenu={e => { e.preventDefault(); setShowReactions(msg._id); }}
                                                    >
                                                        {/* Image */}
                                                        {msg.image && !isEditing && (
                                                            <div className={`msg-image-bubble ${isMe ? "bubble-me" : "bubble-them"}`}>
                                                                <img src={msg.image} alt="shared" onClick={() => window.open(msg.image, "_blank")} loading="lazy" />
                                                            </div>
                                                        )}
                                                        {/* GIF */}
                                                        {msg.gifUrl && !isEditing && (
                                                            <div className={`msg-gif-bubble ${isMe ? "bubble-me" : "bubble-them"}`}>
                                                                <span style={{ fontSize: "2rem" }}>{msg.gifUrl}</span>
                                                            </div>
                                                        )}
                                                        {/* File */}
                                                        {msg.fileUrl && !isEditing && (
                                                            <div className={`msg-file-bubble ${isMe ? "bubble-me" : "bubble-them"}`}>
                                                                <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="msg-file-link">
                                                                    📎 {msg.fileName || "File"} {msg.fileSize ? `(${(msg.fileSize / 1024).toFixed(1)} KB)` : ""}
                                                                </a>
                                                            </div>
                                                        )}
                                                        {/* Text or Edit input */}
                                                        {isEditing ? (
                                                            <div className={`msg-edit-input ${isMe ? "bubble-me" : "bubble-them"}`}>
                                                                <textarea
                                                                    ref={editRef}
                                                                    value={editText}
                                                                    onChange={e => setEditText(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === "Enter" && !e.shiftKey) {
                                                                            e.preventDefault();
                                                                            handleEditSave(msg._id);
                                                                        }
                                                                        if (e.key === "Escape") handleEditCancel();
                                                                    }}
                                                                    rows={2}
                                                                    aria-label="Edit message"
                                                                />
                                                                <div className="msg-edit-actions">
                                                                    <button className="msg-edit-cancel" onClick={handleEditCancel}>Cancel</button>
                                                                    <button className="msg-edit-save" onClick={() => handleEditSave(msg._id)} disabled={!editText.trim()}>Save</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {msg.content && (
                                                                    <div className={`msg-bubble ${isMe ? "bubble-me" : "bubble-them"}`}>
                                                                        {msg.content}
                                                                        {msg.editedAt && <span className="msg-edited">(Edited)</span>}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        {/* Reaction */}
                                                        {msg.reaction && !isEditing && (
                                                            <div className={`msg-reaction ${isMe ? "reaction-me" : "reaction-them"}`}>
                                                                {msg.reaction}
                                                            </div>
                                                        )}
                                                        {!isEditing && (
                                                            <div className={`msg-meta ${isMe ? "meta-right" : "meta-left"}`}>
                                                                <span className="msg-time">{fmtTime(msg.createdAt)}</span>
                                                                {isMe && (
                                                                    <span className="msg-status" title={status.label}>
                                                                        {status.icon}
                                                                    </span>
                                                                )}
                                                                {/* Three-dot menu button for own messages */}
                                                                {isMe && (
                                                                    <button className="msg-action-btn" onClick={() => setShowMenuId(showMenuId === msg._id ? null : msg._id)} title="More" aria-label="More options">⋮</button>
                                                                )}
                                                                {/* Forward button */}
                                                                <button className="msg-action-btn" onClick={() => openForward(msg)} title="Forward" aria-label="Forward message">↗️</button>
                                                                {/* Reaction button */}
                                                                <button className="msg-action-btn" onClick={() => setShowReactions(showReactions === msg._id ? null : msg._id)} title="React" aria-label="React to message">😊</button>

                                                                {/* Three-dot menu */}
                                                                {showMenuId === msg._id && isMe && (
                                                                    <div className="msg-three-dot-menu" ref={menuRef}>
                                                                        <button className="msg-three-dot-item" onClick={() => handleEditStart(msg)}>✏️ Edit</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Reaction picker */}
                                                        {showReactions === msg._id && (
                                                            <div className="msg-reaction-picker">
                                                                {REACTION_EMOJIS.map(emoji => (
                                                                    <button key={emoji} className="msg-reaction-option" onClick={() => handleReact(msg._id, emoji)}>
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
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
                                    <button className="remove-preview" onClick={() => setImagePreview(null)} aria-label="Remove preview">✕</button>
                                </div>
                            )}

                            {/* Reply preview */}
                            {replyTo && (
                                <div className="chat-reply-preview">
                                    <span className="chat-reply-label">Replying to {replyTo.replyFrom || (typeof replyTo.fromUserId === "string" ? "" : replyTo.fromUserId.firstName)}</span>
                                    <span className="chat-reply-content">{replyTo.content?.substring(0, 60) || "[Media]"}</span>
                                    <button className="remove-preview" onClick={() => setReplyTo(null)} aria-label="Cancel reply">✕</button>
                                </div>
                            )}

                            {/* Quick GIFs */}
                            <div className="chat-gif-strip">
                                {quickGifs.slice(0, 10).map(gif => (
                                    <button key={gif} className="chat-gif-btn" onClick={() => handleGifSelect(gif)}>{gif}</button>
                                ))}
                            </div>

                            {/* Emoji picker */}
                            <EmojiPicker
                                show={showEmoji}
                                onClose={() => setShowEmoji(false)}
                                onSelect={(emoji) => {
                                    setInput(prev => prev + emoji);
                                }}
                            />

                            {/* Input bar */}
                            <div className="chat-input-bar">
                                <button className="chat-attach-btn" onClick={() => fileRef.current?.click()} title="Share image" aria-label="Share image">📷</button>
                                <button className="chat-attach-btn" onClick={() => docRef.current?.click()} title="Share file" aria-label="Share file">📎</button>
                                <button className="chat-attach-btn" onClick={() => setShowEmoji(!showEmoji)} title="Emoji" aria-label="Emoji picker">😊</button>
                                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImagePick} />
                                <input ref={docRef} type="file" style={{ display: "none" }} onChange={handleFilePick} />
                                <textarea
                                    className="chat-input"
                                    placeholder={`Message ${activeConv.user.firstName}…`}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                    aria-label="Message input"
                                />
                                <button
                                    className="chat-send-btn"
                                    onClick={() => handleSend()}
                                    disabled={(!input.trim() && !imagePreview) || sending}
                                    aria-label="Send message">
                                    {sending ? <span className="auth-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : "➤"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Phone Number Popup */}
            {showPhonePopup && (
                <div className="phone-popup-overlay" onClick={() => setShowPhonePopup(false)}>
                    <div className="phone-popup" onClick={e => e.stopPropagation()}>
                        <div className="popup-icon">🚫</div>
                        <h3>Phone Numbers Are Not Allowed</h3>
                        <p>For the safety and privacy of our members, sharing phone numbers or other direct contact information is not allowed on DateClone. Please continue communicating within the platform.</p>
                        <button onClick={() => setShowPhonePopup(false)}>OK</button>
                    </div>
                </div>
            )}

            {/* Forward Modal */}
            {showForward && forwardMsg && (
                <div className="chat-modal-overlay" onClick={() => setShowForward(false)} role="dialog" aria-label="Forward message">
                    <div className="chat-modal" onClick={e => e.stopPropagation()}>
                        <div className="chat-modal-header">
                            <h3>Forward message</h3>
                            <button onClick={() => setShowForward(false)} aria-label="Close">✕</button>
                        </div>
                        <div className="chat-modal-body">
                            {forwardTargets.length === 0 ? (
                                <p>No other conversations to forward to.</p>
                            ) : (
                                forwardTargets.map(t => (
                                    <div key={t.user._id} className="chat-forward-item" onClick={() => handleForward(forwardMsg, t.user._id)} role="button" tabIndex={0} aria-label={`Forward to ${t.user.firstName}`}
                                        onKeyDown={e => e.key === "Enter" && handleForward(forwardMsg, t.user._id)}>
                                        {t.user.profilePicture
                                            ? <img src={t.user.profilePicture} alt="" className="cli-avatar" />
                                            : <div className="cli-avatar cli-avatar-placeholder">{initials(t.user)}</div>}
                                        <span>{t.user.firstName} {t.user.lastName}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Gallery Modal */}
            {showGallery && activeConv && (
                <div className="chat-modal-overlay" onClick={() => setShowGallery(false)} role="dialog" aria-label="Media gallery">
                    <div className="chat-modal chat-modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="chat-modal-header">
                            <h3>Media Gallery - {activeConv.user.firstName}</h3>
                            <button onClick={() => setShowGallery(false)} aria-label="Close">✕</button>
                        </div>
                        <div className="chat-modal-body chat-gallery-grid">
                            {galleryMedia.length === 0 ? (
                                <p>No shared media yet.</p>
                            ) : (
                                galleryMedia.map((m: any) => (
                                    <div key={m._id} className="chat-gallery-item">
                                        {m.image && <img src={m.image} alt="" loading="lazy" onClick={() => window.open(m.image, "_blank")} />}
                                        {m.gifUrl && <span style={{ fontSize: "2rem" }}>{m.gifUrl}</span>}
                                        {m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">📎 {m.fileName}</a>}
                                        <span className="chat-gallery-time">{fmtDate(m.createdAt)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;