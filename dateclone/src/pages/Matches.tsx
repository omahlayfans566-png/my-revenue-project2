import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { matchAPI } from "../services/apiService";
import { useAuth } from "../context/AuthContext";
import { usePremium } from "../services/premiumService";
import { useSocket } from "../context/SocketContext";
import "../style/matches.css";

// ─── Types ──────────────────────────────────────────────────────────────────────
interface MatchUser {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    age?: number;
    city?: string;
    country?: string;
    occupation?: string;
    isVerified?: boolean;
    lastSeen?: string;
}

interface MatchItem {
    _id: string;
    user: MatchUser;
    matchedAt: string;
    lastMessageAt?: string;
    messagesSent?: number;
}

interface LikeItem {
    _id: string;
    from: MatchUser & { isBlurred?: boolean };
    likedAt: string;
    isSuperLike: boolean;
    isPremiumView: boolean;
}

type TabType = "matches" | "likes";

// ─── Inline SVG Icons ────────────────────────────────────────────────────────────
const ChatIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

const VerifiedIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
);

const LockIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const CrownIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 19h20v3H2v-3zM3.3 8.5l5.7 4.5L12 5l3 8 5.7-4.5L22 16H2l1.3-7.5z" />
    </svg>
);

const HeartIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

const LocationIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const MoreIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
    </svg>
);

const OnlineDot = () => <span className="online-dot" />;

// ─── Skeleton Loader ────────────────────────────────────────────────────────────
const MatchSkeleton = () => (
    <div className="match-card skeleton">
        <div className="skeleton-avatar" />
        <div className="skeleton-info">
            <div className="skeleton-line w-40" />
            <div className="skeleton-line w-60" />
            <div className="skeleton-line w-30" />
        </div>
        <div className="skeleton-actions">
            <div className="skeleton-btn" />
            <div className="skeleton-btn" />
        </div>
    </div>
);

const LikeSkeleton = () => (
    <div className="likes-card skeleton">
        <div className="skeleton-avatar" />
        <div className="skeleton-info">
            <div className="skeleton-line w-50" />
            <div className="skeleton-line w-40" />
        </div>
        <div className="skeleton-btn-sm" />
    </div>
);

// ─── Three-dot dropdown menu component ──────────────────────────────────────────
const ThreeDotMenu = ({
    userId,
    onViewProfile,
    onUnmatch,
    onBlock,
    onReport,
    onClose,
}: {
    userId: string;
    onViewProfile: () => void;
    onUnmatch: () => void;
    onBlock: () => void;
    onReport: () => void;
    onClose: () => void;
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [onClose]);

    return (
        <div className="three-dot-dropdown" ref={menuRef}>
            <button className="dropdown-item" onClick={onViewProfile}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                View Profile
            </button>
            <button className="dropdown-item" onClick={onUnmatch}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l16 16M20 4L4 20" /></svg>
                Unmatch
            </button>
            <button className="dropdown-item" onClick={onBlock}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M4.93 4.93l14.14 14.14" /></svg>
                Block
            </button>
            <button className="dropdown-item danger" onClick={onReport}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                Report
            </button>
        </div>
    );
};

// ─── Main Component ─────────────────────────────────────────────────────────────
const Matches = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const { user } = useAuth();
    const { isPremium, can } = usePremium();

    // State
    const [matches, setMatches] = useState<MatchItem[]>([]);
    const [likes, setLikes] = useState<LikeItem[]>([]);
    const [matchesCount, setMatchesCount] = useState(0);
    const [likesCount, setLikesCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<TabType>("matches");
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [reportModal, setReportModal] = useState<{ userId: string } | null>(null);
    const [reportReason, setReportReason] = useState("");
    const [reportDescription, setReportDescription] = useState("");
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const toastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Helper: show toast notification
    const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
        if (toastTimeout.current) clearTimeout(toastTimeout.current);
        setToast({ message, type });
        toastTimeout.current = setTimeout(() => setToast(null), 3000);
    }, []);

    // ─── Premium check (also bypass for admin) ──────────────────────────────────
    const canViewLikes = isPremium || user?.role === "admin" || user?.isAdmin === true;

    // ─── Load data ──────────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [matchRes, likeRes, matchCountRes, likeCountRes] = await Promise.all([
                matchAPI.getMatches(1, 50),
                matchAPI.getLikesReceived(1, 50),
                matchAPI.getMatchesCount().catch(() => ({ count: 0 })),
                matchAPI.getLikesCount().catch(() => ({ count: 0 })),
            ]);
            setMatches(matchRes.matches || []);
            setLikes(likeRes.likes || []);
            setMatchesCount(matchCountRes.count ?? matchRes.total ?? matchRes.matches?.length ?? 0);
            setLikesCount(likeCountRes.count ?? likeRes.total ?? likeRes.likes?.length ?? 0);
        } catch (err: any) {
            console.error("Failed to load matches/likes:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ─── Socket listeners for real-time updates ────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onNewMatch = () => {
            loadData();
            showToast("💕 New match!", "success");
        };

        const onNewLike = () => {
            setLikesCount(prev => prev + 1);
            loadData();
        };

        const onRemovedMatch = () => {
            loadData();
        };

        const onBlockedBy = () => {
            loadData();
        };

        socket.on("new_match", onNewMatch);
        socket.on("new_like", onNewLike);
        socket.on("removed_match", onRemovedMatch);
        socket.on("blocked_by", onBlockedBy);

        return () => {
            socket.off("new_match", onNewMatch);
            socket.off("new_like", onNewLike);
            socket.off("removed_match", onRemovedMatch);
            socket.off("blocked_by", onBlockedBy);
        };
    }, [socket, loadData, showToast]);

    // ─── Actions ────────────────────────────────────────────────────────────────
    const handleUnmatch = async (matchId: string, userId: string) => {
        if (!window.confirm("Are you sure you want to unmatch?")) return;
        setActionLoading(matchId);
        try {
            await matchAPI.unmatchUser(userId);
            setMatches(prev => prev.filter(m => m._id !== matchId));
            setMatchesCount(prev => Math.max(0, prev - 1));
            showToast("Unmatched successfully");
        } catch {
            showToast("Failed to unmatch", "error");
        } finally {
            setActionLoading(null);
            setOpenMenuId(null);
        }
    };

    const handleBlock = async (userId: string) => {
        if (!window.confirm("Block this user? They won't be able to see your profile.")) return;
        setActionLoading(userId);
        try {
            await matchAPI.blockUser(userId);
            setMatches(prev => prev.filter(m => m.user._id !== userId));
            setMatchesCount(prev => Math.max(0, prev - 1));
            showToast("User blocked");
        } catch {
            showToast("Failed to block user", "error");
        } finally {
            setActionLoading(null);
            setOpenMenuId(null);
        }
    };

    const handleReport = async () => {
        if (!reportModal || !reportReason) return;
        setActionLoading(reportModal.userId);
        try {
            await matchAPI.reportUser(reportModal.userId, reportReason, reportDescription);
            showToast("Report submitted. We'll review this.");
            setReportModal(null);
            setReportReason("");
            setReportDescription("");
        } catch {
            showToast("Failed to submit report", "error");
        } finally {
            setActionLoading(null);
        }
    };

    const handleLikeBack = async (likerId: string) => {
        setActionLoading(likerId);
        try {
            await matchAPI.likeBack(likerId);
            showToast("💕 It's a match!");
            loadData();
        } catch {
            showToast("Failed to like back", "error");
        } finally {
            setActionLoading(null);
        }
    };

    // ─── Initials helper ───────────────────────────────────────────────────────
    const initials = (u: MatchUser) =>
        `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";

    // ─── Time helper ────────────────────────────────────────────────────────────
    const timeAgo = (dateStr: string) => {
        const now = Date.now();
        const then = new Date(dateStr).getTime();
        const diffMs = now - then;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(dateStr).toLocaleDateString();
    };

    // ─── Render: Match Card ──────────────────────────────────────────────────────
    const renderMatchCard = (m: MatchItem) => {
        const u = m.user;
        const isOnline = u.lastSeen && (Date.now() - new Date(u.lastSeen).getTime() < 60000);

        return (
            <div key={m._id} className="match-card" onClick={() => navigate(`/profile/${u._id}`)}>
                {/* Avatar Section */}
                <div className="match-card-avatar">
                    {u.profilePicture ? (
                        <img src={u.profilePicture} alt={u.firstName} loading="lazy" />
                    ) : (
                        <div className="avatar-placeholder">{initials(u)}</div>
                    )}
                    {isOnline && <OnlineDot />}
                </div>

                {/* Info Section */}
                <div className="match-card-info">
                    <div className="match-card-name-row">
                        <h3>{u.firstName}, {u.age ?? ""}</h3>
                        {u.isVerified && (
                            <span className="verified-badge">
                                <VerifiedIcon />
                            </span>
                        )}
                    </div>
                    <div className="match-card-details">
                        <span className="match-card-location">
                            <LocationIcon />
                            {u.city ?? ""}{u.city && u.country ? ", " : ""}{u.country ?? ""}
                        </span>
                        {u.occupation && <span className="match-card-occupation">{u.occupation}</span>}
                    </div>
                </div>

                {/* Actions Section */}
                <div className="match-card-actions" onClick={e => e.stopPropagation()}>
                    <button
                        className="match-action-btn chat"
                        onClick={() => navigate(`/chat/${u._id}`)}
                        title="Chat"
                        disabled={actionLoading === m._id}
                    >
                        <ChatIcon />
                    </button>
                    <div className="three-dot-container">
                        <button
                            className="match-action-btn more"
                            onClick={() => setOpenMenuId(openMenuId === m._id ? null : m._id)}
                            title="More"
                        >
                            <MoreIcon />
                        </button>
                        {openMenuId === m._id && (
                            <ThreeDotMenu
                                userId={u._id}
                                onViewProfile={() => { navigate(`/profile/${u._id}`); setOpenMenuId(null); }}
                                onUnmatch={() => handleUnmatch(m._id, u._id)}
                                onBlock={() => handleBlock(u._id)}
                                onReport={() => { setReportModal({ userId: u._id }); setOpenMenuId(null); }}
                                onClose={() => setOpenMenuId(null)}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ─── Render: Locked Like Card (non-premium) ──────────────────────────────
    const renderLockedLikeCard = (l: LikeItem) => (
        <div key={l._id} className="likes-card locked">
            <div className="like-avatar-wrapper">
                <div className="blurred-avatar">
                    {l.from?.profilePicture ? (
                        <img src={l.from.profilePicture} alt="" aria-hidden="true" />
                    ) : (
                        <div className="like-avatar-placeholder" />
                    )}
                </div>
                <div className="lock-overlay">
                    <LockIcon />
                </div>
            </div>
            <div className="like-card-info">
                <h3>Someone liked you</h3>
                <p className="like-text">Liked you recently</p>
            </div>
            <div className="like-card-actions">
                <button
                    className="btn-unlock"
                    onClick={() => navigate("/premium")}
                >
                    <CrownIcon />
                    Unlock
                </button>
            </div>
        </div>
    );

    // ─── Render: Unlocked Like Card (premium/admin) ──────────────────────────
    const renderUnlockedLikeCard = (l: LikeItem) => {
        const from = l.from;
        const li = initials(from as MatchUser);
        const isOnline = from.lastSeen && (Date.now() - new Date(from.lastSeen).getTime() < 60000);

        return (
            <div
                key={l._id}
                className="likes-card unlocked"
                onClick={() => navigate(`/profile/${from._id}`)}
            >
                <div className="like-avatar-wrapper">
                    {from.profilePicture ? (
                        <img src={from.profilePicture} alt={from.firstName} loading="lazy" />
                    ) : (
                        <div className="like-avatar-placeholder">{li}</div>
                    )}
                    {isOnline && <OnlineDot />}
                </div>
                <div className="like-card-info">
                    <div className="like-card-name-row">
                        <h3>{from.firstName || "Someone"}, {from.age ?? ""}</h3>
                        {from.isVerified && (
                            <span className="verified-badge">
                                <VerifiedIcon />
                            </span>
                        )}
                    </div>
                    <div className="like-card-details">
                        {from.city && (
                            <span className="like-location">
                                <LocationIcon />
                                {from.city}{from.country ? `, ${from.country}` : ""}
                            </span>
                        )}
                        {from.occupation && <span className="like-occupation">{from.occupation}</span>}
                    </div>
                    {l.isSuperLike && <span className="super-like-badge">⭐ Super Like</span>}
                </div>
                <div className="like-card-actions" onClick={e => e.stopPropagation()}>
                    {l.isPremiumView && (
                        <>
                            <button
                                className="btn-like-back"
                                onClick={() => handleLikeBack(from._id)}
                                disabled={actionLoading === from._id}
                                title="Like back"
                            >
                                <HeartIcon />
                            </button>
                            <button
                                className="btn-chat-like"
                                onClick={() => navigate(`/chat/${from._id}`)}
                                title="Say Hi"
                                disabled={actionLoading === from._id}
                            >
                                <ChatIcon />
                            </button>
                            <div className="three-dot-container">
                                <button
                                    className="match-action-btn more"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(openMenuId === l._id ? null : l._id);
                                    }}
                                    title="More"
                                >
                                    <MoreIcon />
                                </button>
                                {openMenuId === l._id && (
                                    <ThreeDotMenu
                                        userId={from._id}
                                        onViewProfile={() => { navigate(`/profile/${from._id}`); setOpenMenuId(null); }}
                                        onUnmatch={() => handleUnmatch(l._id, from._id)}
                                        onBlock={() => handleBlock(from._id)}
                                        onReport={() => { setReportModal({ userId: from._id }); setOpenMenuId(null); }}
                                        onClose={() => setOpenMenuId(null)}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    // ─── Premium upgrade card ─────────────────────────────────────────────────
    const renderPremiumCard = () => (
        <div className="premium-upsell-card">
            <div className="premium-crown">
                <CrownIcon />
            </div>
            <h3>Upgrade to Premium</h3>
            <p>See who likes you and match with your perfect someone.</p>
            <div className="premium-benefits">
                <div className="benefit-item">
                    <HeartIcon />
                    <span>See who likes you</span>
                </div>
                <div className="benefit-item">
                    <HeartIcon />
                    <span>Unlimited Likes</span>
                </div>
                <div className="benefit-item">
                    <HeartIcon />
                    <span>Priority Matching</span>
                </div>
                <div className="benefit-item">
                    <HeartIcon />
                    <span>More visibility</span>
                </div>
            </div>
            <button className="btn-upgrade-now" onClick={() => navigate("/premium")}>
                <CrownIcon />
                Upgrade Now
            </button>
        </div>
    );

    // ─── Main Render ────────────────────────────────────────────────────────────
    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="matches-page">
                {/* Header */}
                <div className="matches-header">
                    <h1>
                        {tab === "matches" ? "Matches" : "Likes Received"}
                        <span className="header-emoji">❤️</span>
                    </h1>
                </div>

                {/* Tabs */}
                <div className="matches-tabs">
                    <button
                        className={`matches-tab ${tab === "matches" ? "active" : ""}`}
                        onClick={() => setTab("matches")}
                    >
                        <HeartIcon />
                        Matches
                        <span className="tab-count">{matchesCount}</span>
                    </button>
                    <button
                        className={`matches-tab ${tab === "likes" ? "active" : ""}`}
                        onClick={() => setTab("likes")}
                    >
                        <HeartIcon />
                        Likes Received
                        <span className="tab-count">{likesCount}</span>
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="matches-content">
                        {tab === "matches" ? (
                            <div className="matches-list">
                                {[1, 2, 3, 4, 5].map(i => <MatchSkeleton key={i} />)}
                            </div>
                        ) : (
                            <div className="matches-list">
                                {[1, 2, 3, 4].map(i => <LikeSkeleton key={i} />)}
                            </div>
                        )}
                    </div>
                ) : tab === "matches" ? (
                    matches.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">💞</div>
                            <h3>No matches yet</h3>
                            <p>Keep swiping to find your match!</p>
                            <button className="btn-primary" onClick={() => navigate("/discover")}>
                                Start Swiping
                            </button>
                        </div>
                    ) : (
                        <div className="matches-content">
                            <div className="matches-list">
                                {matches.map(renderMatchCard)}
                            </div>
                        </div>
                    )
                ) : (
                    /* Likes Received Tab */
                    likes.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">💝</div>
                            <h3>No likes yet</h3>
                            {canViewLikes ? (
                                <p>No one has liked your profile yet. Keep swiping!</p>
                            ) : (
                                <p>Upgrade to Premium to see who likes you!</p>
                            )}
                            <button
                                className="btn-primary"
                                onClick={() => navigate(canViewLikes ? "/discover" : "/premium")}
                            >
                                {canViewLikes ? "Start Swiping" : "✨ Go Premium"}
                            </button>
                        </div>
                    ) : (
                        <div className="matches-content">
                            <div className="matches-list">
                                {canViewLikes
                                    ? likes.map(renderUnlockedLikeCard)
                                    : likes.map(renderLockedLikeCard)
                                }
                            </div>
                            {!canViewLikes && renderPremiumCard()}
                        </div>
                    )
                )}
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className={`toast-notification ${toast.type}`}>
                    {toast.message}
                </div>
            )}

            {/* Report Modal */}
            {reportModal && (
                <div className="modal-overlay" onClick={() => setReportModal(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Report User</h3>
                        <p>Why are you reporting this user?</p>
                        <select
                            value={reportReason}
                            onChange={e => setReportReason(e.target.value)}
                            className="report-select"
                        >
                            <option value="">Select a reason</option>
                            <option value="spam">Spam</option>
                            <option value="harassment">Harassment</option>
                            <option value="fake_profile">Fake Profile</option>
                            <option value="inappropriate">Inappropriate Content</option>
                            <option value="scam">Scam or Fraud</option>
                            <option value="other">Other</option>
                        </select>
                        <textarea
                            placeholder="Additional details (optional)"
                            value={reportDescription}
                            onChange={e => setReportDescription(e.target.value)}
                            rows={3}
                            className="report-textarea"
                        />
                        <div className="modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setReportModal(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-submit-report"
                                onClick={handleReport}
                                disabled={!reportReason || actionLoading !== null}
                            >
                                {actionLoading ? "Submitting..." : "Submit Report"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Matches;