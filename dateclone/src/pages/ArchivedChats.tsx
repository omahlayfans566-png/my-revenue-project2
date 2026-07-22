import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { messageAPI } from "../services/apiService";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import "../style/chat.css";

interface ArchivedConv {
    _id: string;
    user: { _id: string; firstName: string; lastName: string; profilePicture?: string; isVerified?: boolean };
    lastMessage?: { content: string; createdAt: string };
    unreadCount: number;
    isArchived: boolean;
}

const ArchivedChats = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { onlineUsers, lastSeen, unreadMessageCount } = useSocket();
    const [archivedConvs, setArchivedConvs] = useState<ArchivedConv[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [restoring, setRestoring] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadArchived = useCallback(async (search?: string) => {
        setLoading(true);
        try {
            const res = await messageAPI.getArchivedConversations(search);
            const list: ArchivedConv[] = (res.conversations || []).filter((c: ArchivedConv) => c.isArchived);
            setArchivedConvs(list);
        } catch {
            setArchivedConvs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadArchived(); }, [loadArchived]);

    const handleUnarchive = async (targetUserId: string) => {
        setRestoring(targetUserId);
        try {
            await messageAPI.archiveConversation(targetUserId, false);
            setArchivedConvs(prev => prev.filter(c => c.user._id !== targetUserId));
            showToast("Chat restored successfully!");
        } catch {
            showToast("Failed to restore chat", 'error');
        } finally {
            setRestoring(null);
        }
    };

    const handleSearch = () => {
        if (searchQuery.trim()) {
            loadArchived(searchQuery.trim());
        } else {
            loadArchived();
        }
    };

    const initials = (u: ArchivedConv["user"]) => `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
    const isOnline = (uid: string) => onlineUsers.has(uid);
    const fmtDate = (iso: string) => {
        const d = new Date(iso), t = new Date();
        if (d.toDateString() === t.toDateString()) return "Today";
        const y = new Date(t); y.setDate(t.getDate() - 1);
        if (d.toDateString() === y.toDateString()) return "Yesterday";
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    return (
        <div className="page-wrapper">
            <AppNavbar unreadMessages={unreadMessageCount} />
            
            <div className="chat-page">
                <div className="chat-sidebar" style={{ width: "100%", minWidth: "100%", borderRight: "none" }}>
                    <div className="chat-sidebar-header">
                        <button 
                            className="chat-back-btn" 
                            onClick={() => navigate("/chat")} 
                            aria-label="Back to chat"
                            style={{ display: "flex" }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6"/>
                            </svg>
                        </button>
                        <h2>Archived Chats {archivedConvs.length > 0 && `(${archivedConvs.length})`}</h2>
                        <div className="chat-sidebar-actions">
                            <button className="chat-icon-btn" onClick={() => navigate("/chat")} title="Back to messages" aria-label="Back to messages">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="chat-search-bar" style={{ display: "flex" }}>
                        <input
                            type="text"
                            placeholder="Search archived conversations..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                            aria-label="Search archived conversations"
                        />
                        {searchQuery && (
                            <button className="chat-search-clear" onClick={() => { setSearchQuery(""); loadArchived(); }}>
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Toast notification */}
                    {toast && (
                        <div style={{
                            padding: "12px 20px",
                            margin: "8px 16px",
                            borderRadius: "var(--chat-radius-sm)",
                            background: toast.type === 'success' ? "var(--chat-green-bg)" : "#FEF2F2",
                            color: toast.type === 'success' ? "#065F46" : "var(--chat-red)",
                            fontSize: 13,
                            fontWeight: 500,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            animation: "slideDown 0.2s ease",
                            border: `1px solid ${toast.type === 'success' ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                        }}>
                            {toast.type === 'success' ? '✓' : '⚠'} {toast.message}
                        </div>
                    )}

                    {/* List */}
                    {loading ? (
                        <div className="chat-skeleton">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="chat-skeleton-item">
                                    <div className="chat-skeleton-avatar" />
                                    <div className="chat-skeleton-lines">
                                        <div className="chat-skeleton-line" />
                                        <div className="chat-skeleton-line" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : archivedConvs.length === 0 ? (
                        <div className="chat-empty-sidebar">
                            <div className="empty-illustration">📂</div>
                            <h3>No Archived Chats</h3>
                            <p>Chats you archive will appear here. You can restore them anytime.</p>
                            <button className="btn" onClick={() => navigate("/chat")}>
                                Back to Messages
                            </button>
                        </div>
                    ) : (
                        <div className="chat-list">
                            {archivedConvs.map(conv => (
                                <div key={conv._id} className="chat-list-item">
                                    <div className="cli-avatar-wrap">
                                        {conv.user.profilePicture
                                            ? <img src={conv.user.profilePicture} alt="" className="cli-avatar" loading="lazy" />
                                            : <div className="cli-avatar cli-avatar-placeholder">{initials(conv.user)}</div>}
                                        {isOnline(conv.user._id) && <span className="cli-online-dot" />}
                                        {conv.user.isVerified && <span className="cli-verification-badge">✓</span>}
                                    </div>
                                    <div className="cli-info">
                                        <div className="cli-top">
                                            <span className="cli-name">{conv.user.firstName} {conv.user.lastName}</span>
                                            {conv.lastMessage && <span className="cli-time">{fmtDate(conv.lastMessage.createdAt)}</span>}
                                        </div>
                                        <div className="cli-bottom">
                                            <span className="cli-last">
                                                {conv.lastMessage?.content ?? "No messages yet"}
                                            </span>
                                            <div className="cli-actions">
                                                {conv.unreadCount > 0 && <span className="cli-unread">{conv.unreadCount}</span>}
                                                <button
                                                    className="cli-more-btn"
                                                    onClick={() => handleUnarchive(conv.user._id)}
                                                    disabled={restoring === conv.user._id}
                                                    title="Restore chat"
                                                    style={{ opacity: 0.8 }}
                                                >
                                                    {restoring === conv.user._id ? "..." : "↩ Restore"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ArchivedChats;