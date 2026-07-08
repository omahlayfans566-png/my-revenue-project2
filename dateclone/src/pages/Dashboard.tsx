import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { matchAPI, messageAPI, notificationAPI } from "../services/apiService";
import "../style/dashboard.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SuggestedUser {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    age?: number;
    city?: string;
    country?: string;
    occupation?: string;
    compatibilityScore?: number;
    isVerified?: boolean;
    isPremium?: boolean;
    interests?: string[];
}

interface RecentConv {
    _id: string;
    user: { _id: string; firstName: string; lastName: string; profilePicture?: string };
    lastMessage?: { content: string; createdAt: string };
    unreadCount: number;
}

interface StatsData {
    matches: number;
    unreadMessages: number;
    unreadNotifications: number;
    memberCount: number;
}

// ─── Error states ─────────────────────────────────────────────────────────────
type SuggestionError = "network" | "server" | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getGreeting = (): string => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
};

const calcCompleteness = (user: any): number => {
    const fields = [
        user.profilePicture, user.aboutMe, user.age, user.city,
        user.occupation, user.education, user.religion,
        user.relationshipGoal, user.interests?.length > 0,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
};

const fmtTime = (iso: string): string => {
    const d = new Date(iso), now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

// ─── Quick-action shortcut cards ─────────────────────────────────────────────
const SHORTCUTS = [
    { icon: "🔥", label: "Discover", sub: "Swipe & match", to: "/discover", color: "#ff1744" },
    { icon: "💞", label: "Matches", sub: "Your connections", to: "/matches", color: "#e91e63" },
    { icon: "💬", label: "Messages", sub: "Chat with matches", to: "/chat", color: "#9c27b0" },
    { icon: "🔔", label: "Alerts", sub: "Notifications", to: "/notifications", color: "#673ab7" },
    { icon: "👤", label: "Profile", sub: "Edit & boost", to: "/profile", color: "#3f51b5" },
    { icon: "✨", label: "Premium", sub: "Unlock all features", to: "/premium", color: "#f57f17" },
];

// ─── Completion tips ──────────────────────────────────────────────────────────
const getTips = (user: any): { icon: string; text: string; to: string }[] => {
    const tips = [];
    const u = user as any;
    if (!u.profilePicture) tips.push({ icon: "📸", text: "Add a profile photo", to: "/profile/edit" });
    if (!u.aboutMe) tips.push({ icon: "📝", text: "Write your bio", to: "/profile/edit" });
    if (!u.occupation) tips.push({ icon: "💼", text: "Add your occupation", to: "/profile/edit" });
    if (!u.interests?.length) tips.push({ icon: "🎯", text: "Add your interests", to: "/profile/edit" });
    if (!u.city) tips.push({ icon: "📍", text: "Add your location", to: "/profile/edit" });
    return tips.slice(0, 3);
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { onlineUsers, suggestionsVersion } = useSocket();

    const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
    const [convs, setConvs] = useState<RecentConv[]>([]);
    const [stats, setStats] = useState<StatsData>({ matches: 0, unreadMessages: 0, unreadNotifications: 0, memberCount: 0 });
    const [loading, setLoading] = useState(true);
    const [suggestionsLoading, setSuggestionsLoading] = useState(true);
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const [liking, setLiking] = useState<string | null>(null);
    const [suggestionError, setSuggestionError] = useState<SuggestionError>(null);

    // Request deduplication ref
    const pendingRequestRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    const u = user as any;
    const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();
    const completeness = user ? calcCompleteness(u) : 0;
    const tips = user ? getTips(u) : [];

    // ── Fetch suggestions with deduplication ─────────────────────────────────
    const fetchSuggestions = useCallback(async () => {
        // Cancel any pending request
        if (pendingRequestRef.current) {
            pendingRequestRef.current.abort();
        }

        const controller = new AbortController();
        pendingRequestRef.current = controller;
        const signal = controller.signal;

        setSuggestionsLoading(true);
        setSuggestionError(null);

        try {
            // Use a custom fetch to support abort
            const token = sessionStorage.getItem("authToken");
            const API_BASE_URL = import.meta.env.VITE_API_URL || "https://dateclone-backend.onrender.com/api";
            const response = await fetch(`${API_BASE_URL}/matches/suggestions`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                signal,
            });

            if (signal.aborted) return;

            if (!response.ok) {
                setSuggestionError("server");
                setSuggestionsLoading(false);
                return;
            }

            const data = await response.json();

            if (signal.aborted) return;

            if (data.success) {
                setSuggestions((data.suggestions || []).slice(0, 6));
                setSuggestionError(null);
            } else {
                setSuggestionError("server");
            }
        } catch (err: any) {
            if (err?.name === "AbortError" || signal.aborted) return;
            setSuggestionError("network");
        } finally {
            if (!signal.aborted) {
                setSuggestionsLoading(false);
                pendingRequestRef.current = null;
            }
        }
    }, []);

    // ── Load all dashboard data in parallel ───────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [convRes, matchRes, notifRes, countRes] = await Promise.allSettled([
                messageAPI.getAllConversations(),
                matchAPI.getMatches(),
                notificationAPI.getUnreadCount(),
                matchAPI.getMemberCount(),
            ]);

            if (convRes.status === "fulfilled") {
                const list: RecentConv[] = (convRes.value.conversations || []).slice(0, 4);
                setConvs(list);
                const unread = list.reduce((s: number, c: RecentConv) => s + (c.unreadCount || 0), 0);
                setStats(prev => ({ ...prev, unreadMessages: unread }));
            }
            if (matchRes.status === "fulfilled")
                setStats(prev => ({ ...prev, matches: (matchRes.value.matches || []).length }));
            if (notifRes.status === "fulfilled")
                setStats(prev => ({ ...prev, unreadNotifications: notifRes.value.count || 0 }));
            if (countRes.status === "fulfilled")
                setStats(prev => ({ ...prev, memberCount: countRes.value.count || 0 }));
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    // ── Initial load: fetch suggestions + other data on mount ─────────────
    useEffect(() => {
        mountedRef.current = true;
        fetchSuggestions();
        load();
        return () => {
            mountedRef.current = false;
            if (pendingRequestRef.current) {
                pendingRequestRef.current.abort();
            }
        };
    }, [fetchSuggestions, load]);

    // ── React to socket suggestion events ─────────────────────────────────
    useEffect(() => {
        if (suggestionsVersion > 0) {
            fetchSuggestions();
        }
    }, [suggestionsVersion, fetchSuggestions]);

    // ── Like from dashboard ────────────────────────────────────────────────
    const handleLike = async (uid: string) => {
        if (liking) return;
        setLiking(uid);
        try {
            await matchAPI.likeUser(uid);
            setLikedIds(prev => new Set([...prev, uid]));
            // Optimistically remove the liked user from suggestions
            setSuggestions(prev => prev.filter(s => s._id !== uid));
        } catch (err: any) {
            // Log the full error to console for debugging
            console.error("[Dashboard Like] Error:", err);
            // Display the actual backend error message
            const message = err?.message || "Failed to like user";
            // Show toast or alert with the real error
            if (message.includes("already liked") || message.includes("Already liked")) {
                // Already liked — still add to liked set so UI updates
                setLikedIds(prev => new Set([...prev, uid]));
            } else if (message.includes("yourself")) {
                alert("You cannot like yourself!");
            } else {
                // Show descriptive error
                alert(message);
            }
        }
        finally { setLiking(null); }
    };

    // ── Handle suggestion retry (network error) ────────────────────────────
    const handleRetry = () => {
        fetchSuggestions();
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="page-wrapper">
            <AppNavbar unreadMessages={stats.unreadMessages} />

            <div className="dashboard">

                {/* ── Hero Welcome Banner ─────────────────────────────────────────── */}
                <section className="db-hero">
                    <div className="db-hero-bg" aria-hidden="true">
                        <span className="db-hero-blob db-blob-1" />
                        <span className="db-hero-blob db-blob-2" />
                        <span className="db-hero-blob db-blob-3" />
                    </div>

                    <div className="db-hero-inner">
                        {/* Avatar */}
                        <div className="db-hero-avatar-wrap">
                            {user?.profilePicture
                                ? <img src={user.profilePicture} alt="You" className="db-hero-avatar" />
                                : <div className="db-hero-avatar db-hero-avatar-ph">{initials}</div>}
                            <span className="db-hero-online-dot" title="Online" />
                        </div>

                        {/* Text */}
                        <div className="db-hero-text">
                            <p className="db-greeting">{getGreeting()},</p>
                            <h1 className="db-hero-name">{user?.firstName} {user?.lastName} 👋</h1>
                            <p className="db-hero-sub">
                                {completeness < 60
                                    ? "Complete your profile to get more matches!"
                                    : stats.matches > 0
                                        ? `You have ${stats.matches} match${stats.matches !== 1 ? "es" : ""} waiting for you 💕`
                                        : "Start swiping and find your perfect match ✨"}
                            </p>
                        </div>

                        {/* Hero actions */}
                        <div className="db-hero-actions">
                            <button className="db-hero-cta" onClick={() => navigate("/discover")}>
                                🔥 Start Swiping
                            </button>
                            {!user?.isPremium && (
                                <button className="db-hero-cta db-hero-cta--gold" onClick={() => navigate("/premium")}>
                                    ✨ Go Premium
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {/* ── Main Content ────────────────────────────────────────────────── */}
                <div className="db-content">

                    {/* ── Left column ─────────────────────────────────────────────── */}
                    <div className="db-col-main">

                        {/* Stats row */}
                        <div className="db-stats-row">
                            {[
                                { icon: "💞", val: stats.matches, label: "Matches", to: "/matches", color: "#ff1744" },
                                { icon: "💬", val: stats.unreadMessages, label: "Unread", to: "/chat", color: "#9c27b0", badge: stats.unreadMessages > 0 },
                                { icon: "🔔", val: stats.unreadNotifications, label: "Alerts", to: "/notifications", color: "#673ab7", badge: stats.unreadNotifications > 0 },
                                { icon: "🏆", val: user?.isPremium ? "✨" : "💎", label: user?.isPremium ? "Premium" : "Upgrade", to: "/premium", color: "#ff6f00" },
                            ].map((s, i) => (
                                <Link key={i} to={s.to} className="db-stat-card" style={{ "--stat-color": s.color } as any}>
                                    <div className="db-stat-icon">{s.icon}</div>
                                    <div className="db-stat-body">
                                        <span className="db-stat-val">
                                            {s.val}
                                            {s.badge && s.val > 0 && <span className="db-stat-badge" />}
                                        </span>
                                        <span className="db-stat-label">{s.label}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        {/* Suggested Matches */}
                        <div className="db-section">
                            <div className="db-section-head">
                                <h2 className="db-section-title">💫 Suggested for You</h2>
                                <Link to="/discover" className="db-section-link">See all →</Link>
                            </div>

                            {suggestionsLoading ? (
                                <div className="db-suggestions-grid">
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="db-match-card db-match-card--skeleton">
                                            <div className="skeleton db-match-photo-sk" />
                                            <div className="skeleton db-match-name-sk" />
                                            <div className="skeleton db-match-sub-sk" />
                                        </div>
                                    ))}
                                </div>
                            ) : suggestionError === "network" ? (
                                <div className="db-empty db-empty--error">
                                    <span>🌐</span>
                                    <p>Unable to load suggestions. Check your connection.</p>
                                    <button className="btn btn-primary btn-sm" onClick={handleRetry}>
                                        Try Again
                                    </button>
                                </div>
                            ) : suggestionError === "server" ? (
                                <div className="db-empty db-empty--error">
                                    <span>⚠️</span>
                                    <p>Something went wrong. Please try again later.</p>
                                    <button className="btn btn-primary btn-sm" onClick={handleRetry}>
                                        Retry
                                    </button>
                                </div>
                            ) : suggestions.length === 0 ? (
                                <div className="db-empty">
                                    <span>💫</span>
                                    <p>No suggestions yet. Check back soon!</p>
                                    <button className="btn btn-primary btn-sm" onClick={() => navigate("/discover")}>
                                        Explore People
                                    </button>
                                </div>
                            ) : (
                                <div className="db-suggestions-grid">
                                    {suggestions.map((p, i) => {
                                        const pi = `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase();
                                        const liked = likedIds.has(p._id);
                                        return (
                                            <div key={p._id} className="db-match-card" style={{ animationDelay: `${i * 0.06}s` }}>
                                                {/* Photo */}
                                                <div className="db-match-photo" onClick={() => navigate(`/profile/${p._id}`)}>
                                                    {p.profilePicture
                                                        ? <img src={p.profilePicture} alt={p.firstName} />
                                                        : <div className="db-match-photo-ph">{pi}</div>}
                                                    {p.compatibilityScore && (
                                                        <span className="db-match-compat">{p.compatibilityScore}%</span>
                                                    )}
                                                    {onlineUsers.has(p._id) && (
                                                        <span className="db-match-online" />
                                                    )}
                                                    {p.isVerified && <span className="db-match-verified">✓</span>}
                                                </div>

                                                {/* Info */}
                                                <div className="db-match-info">
                                                    <h3 className="db-match-name">{p.firstName}, {p.age ?? "?"}</h3>
                                                    <p className="db-match-loc">
                                                        {p.city ?? p.country ?? "Africa"}
                                                    </p>
                                                    {p.occupation && (
                                                        <p className="db-match-occ">{p.occupation}</p>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="db-match-actions">
                                                    <button
                                                        className={`db-like-btn ${liked ? "liked" : ""}`}
                                                        onClick={() => !liked && handleLike(p._id)}
                                                        disabled={liking === p._id}
                                                        aria-label={liked ? "Liked" : "Like"}
                                                        title={liked ? "Liked!" : "Like"}
                                                    >
                                                        {liking === p._id
                                                            ? <span className="db-like-spin" />
                                                            : liked ? "💖" : "❤️"}
                                                    </button>
                                                    <button
                                                        className="db-view-btn"
                                                        onClick={() => navigate(`/profile/${p._id}`)}
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Recent Messages */}
                        <div className="db-section">
                            <div className="db-section-head">
                                <h2 className="db-section-title">💬 Recent Messages</h2>
                                <Link to="/chat" className="db-section-link">All chats →</Link>
                            </div>

                            {loading ? (
                                <div className="db-convs-list">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="db-conv-item db-conv-skeleton">
                                            <div className="skeleton db-conv-avatar-sk" />
                                            <div className="db-conv-sk-body">
                                                <div className="skeleton db-conv-name-sk" />
                                                <div className="skeleton db-conv-msg-sk" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : convs.length === 0 ? (
                                <div className="db-empty">
                                    <span>💬</span>
                                    <p>No conversations yet. Match with someone to start chatting!</p>
                                    <button className="btn btn-primary btn-sm" onClick={() => navigate("/matches")}>
                                        View Matches
                                    </button>
                                </div>
                            ) : (
                                <div className="db-convs-list">
                                    {convs.map(c => {
                                        const ci = `${c.user.firstName?.[0] ?? ""}${c.user.lastName?.[0] ?? ""}`.toUpperCase();
                                        return (
                                            <div key={c._id} className="db-conv-item" onClick={() => navigate(`/chat/${c.user._id}`)}>
                                                <div className="db-conv-avatar-wrap">
                                                    {c.user.profilePicture
                                                        ? <img src={c.user.profilePicture} alt="" className="db-conv-avatar" />
                                                        : <div className="db-conv-avatar db-conv-avatar-ph">{ci}</div>}
                                                    {onlineUsers.has(c.user._id) && <span className="db-conv-online" />}
                                                </div>
                                                <div className="db-conv-body">
                                                    <div className="db-conv-top">
                                                        <span className="db-conv-name">{c.user.firstName} {c.user.lastName}</span>
                                                        {c.lastMessage && <span className="db-conv-time">{fmtTime(c.lastMessage.createdAt)}</span>}
                                                    </div>
                                                    <p className="db-conv-preview">
                                                        {c.lastMessage?.content ?? "Say hello! 👋"}
                                                    </p>
                                                </div>
                                                {c.unreadCount > 0 && (
                                                    <span className="db-conv-unread">{c.unreadCount}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right column / sidebar ────────────────────────────────────── */}
                    <div className="db-col-side">

                        {/* Profile card */}
                        <div className="db-profile-card">
                            <div className="db-pc-banner" />
                            <div className="db-pc-avatar-wrap">
                                {user?.profilePicture
                                    ? <img src={user.profilePicture} alt="You" className="db-pc-avatar" />
                                    : <div className="db-pc-avatar db-pc-avatar-ph">{initials}</div>}
                                {user?.isPremium && <span className="db-pc-premium">✨</span>}
                            </div>
                            <div className="db-pc-info">
                                <h3>{user?.firstName} {user?.lastName}</h3>
                                {u?.city && <p className="db-pc-loc">📍 {u.city}{u.country ? `, ${u.country}` : ""}</p>}
                            </div>

                            {/* Completeness ring */}
                            <div className="db-pc-completion">
                                <div className="db-completion-ring">
                                    <svg viewBox="0 0 44 44" className="db-ring-svg">
                                        <circle cx="22" cy="22" r="18" className="db-ring-track" />
                                        <circle
                                            cx="22" cy="22" r="18"
                                            className="db-ring-fill"
                                            strokeDasharray={`${(completeness / 100) * 113} 113`}
                                        />
                                    </svg>
                                    <span className="db-ring-pct">{completeness}%</span>
                                </div>
                                <div className="db-completion-text">
                                    <p className="db-completion-label">Profile</p>
                                    <p className="db-completion-sub">Complete</p>
                                </div>
                            </div>

                            <Link to="/profile/edit" className="db-pc-edit-btn">
                                ✏️ Edit Profile
                            </Link>
                        </div>

                        {/* Profile tips */}
                        {tips.length > 0 && (
                            <div className="db-tips-card">
                                <div className="db-tips-head">
                                    <span className="db-tips-badge">💡 Tips</span>
                                    <h3>Boost your profile</h3>
                                </div>
                                <div className="db-tips-list">
                                    {tips.map((tip, i) => (
                                        <Link key={i} to={tip.to} className="db-tip-item">
                                            <span className="db-tip-icon">{tip.icon}</span>
                                            <span className="db-tip-text">{tip.text}</span>
                                            <span className="db-tip-arrow">→</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick shortcuts */}
                        <div className="db-shortcuts-card">
                            <h3 className="db-shortcuts-title">Quick Actions</h3>
                            <div className="db-shortcuts-grid">
                                {SHORTCUTS.map(s => (
                                    <Link
                                        key={s.to}
                                        to={s.to}
                                        className="db-shortcut"
                                        style={{ "--sc-color": s.color } as any}
                                    >
                                        <span className="db-sc-icon">{s.icon}</span>
                                        <span className="db-sc-label">{s.label}</span>
                                        <span className="db-sc-sub">{s.sub}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Premium upsell (free users only) */}
                        {!user?.isPremium && (
                            <div className="db-premium-card" onClick={() => navigate("/premium")}>
                                <div className="db-premium-stars" aria-hidden="true">
                                    {["✨", "💎", "⭐"].map((e, i) => (
                                        <span key={i} className="db-prem-star" style={{ animationDelay: `${i * 0.4}s` }}>{e}</span>
                                    ))}
                                </div>
                                <h3>Go Premium 💎</h3>
                                <p>See who liked you, unlimited likes, and priority visibility.</p>
                                <div className="db-premium-cta">Unlock Now →</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;