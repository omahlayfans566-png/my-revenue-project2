import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { matchAPI } from "../services/apiService";
import { useAuth } from "../context/AuthContext";
import { usePremium } from "../services/premiumService";
import PremiumBadge from "../component/PremiumBadge";
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

    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="matches-page">
                <div className="matches-header">
                    <h1>Your Matches</h1>
                    <p>People who liked you back ❤️</p>
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

                {loading ? (
                    <div className="matches-loading">
                        <div className="discover-spinner" />
                    </div>
                ) : tab === "matches" ? (
                    matches.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">💞</div>
                            <h3>No matches yet</h3>
                            <p>Keep swiping to find your match!</p>
                            <button className="btn btn-primary" onClick={() => navigate("/discover")} style={{ marginTop: 16 }}>
                                Start Swiping
                            </button>
                        </div>
                    ) : (
                        <div className="matches-grid">
                            {matches.map((m) => (
                                <div key={m._id} className="match-card" onClick={() => navigate(`/chat/${m.user._id}`)}>
                                    <div className="match-card-photo">
                                        {m.user.profilePicture ? (
                                            <img src={m.user.profilePicture} alt={m.user.firstName} />
                                        ) : (
                                            <div className="match-card-placeholder">{initials(m.user)}</div>
                                        )}
                                        <div className="match-card-badge">💞</div>
                                    </div>
                                    <div className="match-card-info">
                                        <h3>{m.user.firstName}, {m.user.age ?? "?"}</h3>
                                        <p className="match-card-location">
                                            {m.user.city ?? ""}{m.user.city && m.user.country ? ", " : ""}{m.user.country ?? ""}
                                        </p>
                                        {m.user.occupation && <p className="match-card-occupation">{m.user.occupation}</p>}
                                    </div>
                                    <div className="match-card-actions">
                                        <button className="match-action-btn msg" onClick={(e) => { e.stopPropagation(); navigate(`/chat/${m.user._id}`); }}>
                                            💬 Chat
                                        </button>
                                        <button className="match-action-btn view" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${m.user._id}`); }}>
                                            👤 Profile
                                        </button>
                                        <button
                                            className="match-action-btn unmatch"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUnmatch(m._id, m.user._id);
                                            }}
                                            disabled={actionLoading === m._id}
                                            title="Unmatch"
                                        >
                                            {actionLoading === m._id ? "..." : "✕"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    likes.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">💝</div>
                            <h3>No likes yet</h3>
                            {isPremium ? (
                                <p>No one has liked your profile yet. Keep swiping!</p>
                            ) : (
                                <p>Upgrade to Premium to see who likes you!</p>
                            )}
                            <button className="btn btn-primary" onClick={() => navigate(isPremium ? "/discover" : "/premium")} style={{ marginTop: 16 }}>
                                {isPremium ? "Start Swiping" : "✨ Go Premium"}
                            </button>
                        </div>
                    ) : isPremium ? (
                        <div className="matches-grid">
                            {likes.map((l) => {
                                const from = l.from;
                                const li = `${from?.firstName?.[0] ?? ""}${from?.lastName?.[0] ?? ""}`.toUpperCase();
                                return (
                                    <div key={l._id} className="match-card likes-card" onClick={() => navigate(`/profile/${from._id}`)}>
                                        <div className="match-card-photo">
                                            {from?.profilePicture ? (
                                                <img src={from.profilePicture} alt={from.firstName} />
                                            ) : (
                                                <div className="match-card-placeholder">{li || "?"}</div>
                                            )}
                                            {l.isSuperLike && <div className="match-card-badge superlike">⭐ Super Like</div>}
                                        </div>
                                        <div className="match-card-info">
                                            <h3>{from?.firstName || "Someone"}, {from?.age ?? "?"}</h3>
                                            <p className="match-card-location">
                                                {from?.city ?? ""}{from?.city && from?.country ? ", " : ""}{from?.country ?? ""}
                                            </p>
                                            {from?.occupation && <p className="match-card-occupation">{from.occupation}</p>}
                                        </div>
                                        <div className="match-card-actions">
                                            <button className="match-action-btn msg" onClick={(e) => { e.stopPropagation(); navigate(`/chat/${from._id}`); }}>
                                                💬 Say Hi
                                            </button>
                                            <button className="match-action-btn view" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${from._id}`); }}>
                                                👤 View
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="matches-grid">
                            {likes.map((l) => (
                                <div key={l._id} className="match-card likes-card">
                                    <div className="match-card-photo blurred">
                                        {l.from?.profilePicture ? (
                                            <img src={l.from.profilePicture} alt="?" className="blurred-img" />
                                        ) : (
                                            <div className="match-card-placeholder">?</div>
                                        )}
                                        <div className="match-blur-overlay">
                                            <span>❤️</span>
                                            <p>Unlock to see</p>
                                        </div>
                                    </div>
                                    <div className="match-card-info">
                                        <h3>Someone likes you!</h3>
                                        <p className="match-card-location">Upgrade to reveal</p>
                                    </div>
                                </div>
                            ))}
                            <div className="match-card premium-upsell-card" onClick={() => navigate("/premium")}>
                                <div className="match-card-photo premium-upsell-photo">
                                    <div className="premium-upsell-content">
                                        <span>✨</span>
                                        <h3>See Who Likes You</h3>
                                        <p>Upgrade to Premium to see everyone who liked your profile and match instantly!</p>
                                        <button className="btn btn-primary btn-sm">Go Premium</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default Matches;
