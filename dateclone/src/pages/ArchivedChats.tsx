import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { messageAPI } from "../services/apiService";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import "../style/chat.css";

interface ArchivedConv {
    _id: string;
    user: { _id: string; firstName: string; lastName: string; profilePicture?: string };
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
            
            <div className="archived-page">
                <div className="archived-header">
                    <button className="archived-back-btn" onClick={() => navigate("/chat")} aria-label="Back to chat">
                        ←
                    </button>
                    <h2>Archived Chats {archivedConvs.length > 0 && `(${archivedConvs.length})`}</h2>
                </div>

                {/* Search */}
                <div className="archived-search">
                    <input
                        type="text"
                        placeholder="Search archived conversations..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                        aria-label="Search archived conversations"
                    />
                    {searchQuery && (
                        <button className="archived-search-clear" onClick={() => { setSearchQuery(""); loadArchived(); }}>
                            ✕
                        </button>
                    )}
                </div>

                {/* Toast notification */}
                {toast && (
                    <div className={`archived-toast archived-toast--${toast.type}`}>
                        {toast.type === 'success' ? '✓' : '⚠'} {toast.message}
                    </div>
                )}

                {/* List */}
                {loading ? (
                    <div className="chat-loading"><div className="discover-spinner" /></div>
                ) : archivedConvs.length === 0 ? (
                    <div className="archived-empty">
                        <div className="empty-icon" style={{ fontSize: "3rem" }}>📂</div>
                        <h3>No Archived Chats</h3>
                        <p>Chats you archive will appear here. You can restore them anytime.</p>
                        <button className="btn btn-primary" onClick={() => navigate("/chat")}>
                            Back to Messages
                        </button>
                    </div>
                ) : (
                    <div className="archived-list">
                        {archivedConvs.map(conv => (
                            <div key={conv._id} className="archived-list-item">
                                <div className="archived-avatar-wrap">
                                    {conv.user.profilePicture
                                        ? <img src={conv.user.profilePicture} alt="" className="archived-avatar" />
                                        : <div className="archived-avatar archived-avatar-placeholder">{initials(conv.user)}</div>}
                                    {isOnline(conv.user._id) && <span className="archived-online-dot" />}
                                </div>
                                <div className="archived-info">
                                    <div className="archived-top">
                                        <span className="archived-name">{conv.user.firstName} {conv.user.lastName}</span>
                                        {conv.lastMessage && <span className="archived-time">{fmtDate(conv.lastMessage.createdAt)}</span>}
                                    </div>
                                    <div className="archived-bottom">
                                        <span className="archived-last">
                                            {conv.lastMessage?.content ?? "No messages yet"}
                                        </span>
                                        <div className="archived-actions">
                                            {conv.unreadCount > 0 && <span className="archived-unread">{conv.unreadCount}</span>}
                                            <button
                                                className="archived-restore-btn"
                                                onClick={() => handleUnarchive(conv.user._id)}
                                                disabled={restoring === conv.user._id}
                                                title="Restore chat"
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
    );
};

export default ArchivedChats;