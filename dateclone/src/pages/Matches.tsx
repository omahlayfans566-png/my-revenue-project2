import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { matchAPI } from "../services/apiService";
import { useAuth } from "../context/AuthContext";
import { usePremium } from "../services/premiumService";
import "../style/matches.css";
import { useSocket } from "../context/SocketContext";

interface MatchUser {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    age?: number;
    city?: string;
    country?: string;
    occupation?: string;
}
interface MatchItem {
    _id: string;
    user: MatchUser;
    matchedAt: string;
    lastMessageAt?: string;
    messagesSent?: number;
}

// SVG Icons as inline components
const ChatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

const MoreIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
    </svg>
);

const LocationIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const VerifiedIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
);

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const CrownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M2 19h20v3H2v-3zM3.3 8.5l5.7 4.5L12 5l3 8 5.7-4.5L22 16H2l1.3-7.5z" />
    </svg>
);

const HeartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

const Matches = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const { user } = useAuth();
    const { isPremium, can } = usePremium();
    const [matches, setMatches] = useState<MatchItem[]>([]);
    const [likes, setLikes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"matches" | "likes">("matches");
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [matchRes, likeRes] = await Promise.all([
                    matchAPI.getMatches(),
                    matchAPI.getLikesReceived(),
                ]);
                setMatches(matchRes.matches || []);
                setLikes(likeRes.likes || []);
            } catch {
                /* silent */
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Listen for new match events to refresh
    useEffect(() => {
        if (!socket) return;
        const onNewMatch = () => {
            matchAPI.getMatches().then(res => setMatches(res.matches || [])).catch(() => {});
        };
        socket.on("new_match", onNewMatch);
        return () => { socket.off("new_match", onNewMatch); };
    }, [socket]);

    const handleUnmatch = async (matchId: string, userId: string) => {
        if (!window.confirm("Are you sure you want to unmatch?")) return;
        setActionLoading(matchId);
        try {
            await matchAPI.unmatchUser(userId);
            setMatches(prev => prev.filter(m => m._id !== matchId));
        } catch {
            alert("Failed to unmatch. Please try again.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleBlock = async (userId: string) => {
        if (!window.confirm("Block this user? They won't be able to see your profile.")) return;
        setActionLoading(userId);
        try {
            await matchAPI.blockUser(userId);
            setMatches(prev => prev.filter(m => m.user._id !== userId));
        } catch {
            alert("Failed to block user.");
        } finally {
            setActionLoading(null);
        }
    };

    const initials = (u: MatchUser) =>
        `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();

    // Renders a match card in the new horizontal layout
    const renderMatchCard = (m: MatchItem) => {
        const u = m.user;
        return (
            <div key={m._id} className="match-card" onClick={() => navigate(`/chat/${u._id}`)}>
                {/* Avatar */}
                <div className="match-card-avatar">
                    {u.profilePicture ? (
                        <img src={u.profilePicture} alt={u.firstName} />
                    ) : (
                        <div className="avatar-placeholder">{initials(u)}</div>
                    )}
                    <div className="online-indicator" />
                </div>

                {/* Info */}
                <div className="match-card-info">
                    <div className="match-card-name-row">
                        <h3>{u.firstName}, {u.age ?? ""}</h3>
                        <span className="verified-badge">
                            <VerifiedIcon />
                        </span>
                    </div>
                    <div className="match-card-location">
                        <LocationIcon />
                        <span>
                            {u.city ?? ""}{u.city && u.country ? ", " : ""}{u.country ?? ""}
                        </span>
                    </div>
                    {u.occupation && <p className="match-card-occupation">{u.occupation}</p>}
                </div>

                {/* Actions */}
                <div className="match-card-actions">
                    <button
                        className="match-action-btn chat"
                        onClick={(e) => { e.stopPropagation(); navigate(`/chat/${u._id}`); }}
                        title="Chat"
                    >
                        <ChatIcon />
                    </button>
                    <button
                        className="match-action-btn more"
                        onClick={(e) => {
                            e.stopPropagation();
                            // Show context menu with unmatch/block options
                            const opt = window.confirm("Unmatch this user?");
                            if (opt) handleUnmatch(m._id, u._id);
                        }}
                        title="More"
                    >
                        <MoreIcon />
                    </button>
                </div>
            </div>
        );
    };

    // Renders a locked likes card (non-premium users)
    const renderLockedLikeCard = (l: any) => (
        <div key={l._id} className="likes-card">
            <div className="like-avatar-wrapper">
                {l.from?.profilePicture ? (
                    <img src={l.from.profilePicture} alt="?" />
                ) : (
                    <div className="like-avatar-placeholder">?</div>
                )}
                <div className="lock-overlay">
                    <LockIcon />
                </div>
            </div>
            <div className="like-card-info">
                <h3>Someone new</h3>
                <p className="like-location">
                    <LocationIcon />
                    <span>{l.from?.city || "Unknown location"}</span>
                </p>
                <p className="like-recent">Liked you recently</p>
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

    // Renders an unlocked likes card (premium users)
    const renderUnlockedLikeCard = (l: any) => {
        const from = l.from;
        const li = `${from?.firstName?.[0] ?? ""}${from?.lastName?.[0] ?? ""}`.toUpperCase();
        return (
            <div key={l._id} className="likes-card unlocked" onClick={() => navigate(`/profile/${from._id}`)}>
                <div className="like-avatar-wrapper">
                    {from?.profilePicture ? (
                        <img src={from.profilePicture} alt={from.firstName} />
                    ) : (
                        <div className="like-avatar-placeholder">{li || "?"}</div>
                    )}
                </div>
                <div className="like-card-info">
                    <h3>{from?.firstName || "Someone"}, {from?.age ?? ""}</h3>
                    <p className="like-location">
                        <LocationIcon />
                        <span>{from?.city ?? ""}{from?.city && from?.country ? ", " : ""}{from?.country ?? ""}</span>
                    </p>
                    {l.isSuperLike && <p className="like-recent">⭐ Super Like</p>}
                </div>
                <div className="like-card-actions">
                    <button
                        className="btn-unlock"
                        onClick={(e) => { e.stopPropagation(); navigate(`/chat/${from._id}`); }}
                    >
                        <ChatIcon />
                        Say Hi
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="matches-page">
                {/* Header */}
                <div className="matches-header">
                    <h1>{tab === "matches" ? "Your Matches" : "Likes Received"}</h1>
                    <p>{tab === "matches" ? "People you matched with ❤️" : "People who liked you ❤️"}</p>
                </div>

                {/* Tabs */}
                <div className="matches-tabs">
                    <button
                        className={`matches-tab ${tab === "matches" ? "active" : ""}`}
                        onClick={() => setTab("matches")}
                    >
                        Matches <span className="tab-count">{matches.length}</span>
                    </button>
                    <button
                        className={`matches-tab ${tab === "likes" ? "active" : ""}`}
                        onClick={() => setTab("likes")}
                    >
                        Likes Received <span className="tab-count">{likes.length}</span>
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="matches-loading">
                        <div className="spinner" />
                    </div>
                ) : tab === "matches" ? (
                    matches.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">💞</div>
                            <h3>No matches yet</h3>
                            <p>Keep swiping to find your match!</p>
                            <button className="btn" onClick={() => navigate("/discover")}>
                                Start Swiping
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="matches-grid">
                                {matches.map(renderMatchCard)}
                            </div>
                            {/* Bottom CTA Card */}
                            <div className="bottom-cta-card">
                                <div className="cta-icon">💕</div>
                                <h3>Find more people</h3>
                                <p>Keep swiping to discover more amazing people.</p>
                                <button className="btn-discover" onClick={() => navigate("/discover")}>
                                    Discover People
                                </button>
                            </div>
                        </>
                    )
                ) : (
                    /* Likes Received Tab */
                    likes.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">💝</div>
                            <h3>No likes yet</h3>
                            {isPremium ? (
                                <p>No one has liked your profile yet. Keep swiping!</p>
                            ) : (
                                <p>Upgrade to Premium to see who likes you!</p>
                            )}
                            <button className="btn" onClick={() => navigate(isPremium ? "/discover" : "/premium")}>
                                {isPremium ? "Start Swiping" : "✨ Go Premium"}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="matches-grid">
                                {isPremium
                                    ? likes.map(renderUnlockedLikeCard)
                                    : likes.map(renderLockedLikeCard)
                                }
                            </div>
                            {!isPremium && (
                                <div className="premium-upsell">
                                    <div className="crown-icon">👑</div>
                                    <h3>Upgrade to Premium</h3>
                                    <p>See who likes you and match with your perfect someone.</p>
                                    <button className="btn-upgrade" onClick={() => navigate("/premium")}>
                                        Upgrade Now
                                    </button>
                                    <div className="premium-features">
                                        <span><HeartIcon /> See Who Likes You</span>
                                        <span><HeartIcon /> Unlimited Likes</span>
                                        <span><HeartIcon /> Priority Matching</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )
                )}
            </div>
        </div>
    );
};

export default Matches;