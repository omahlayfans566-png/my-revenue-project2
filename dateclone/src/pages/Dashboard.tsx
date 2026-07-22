import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import type { PanInfo } from "framer-motion";
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

interface LikedUser {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
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

const SWIPE_THRESHOLD = 80;

// ─── Swipe Card Component ─────────────────────────────────────────────────────
const SwipeCard = memo(({
    profile,
    isOnline,
    onSwipeEnd,
    index: cardIndex,
}: {
    profile: SuggestedUser;
    isOnline: boolean;
    onSwipeEnd: (dir: "left" | "right" | "up") => void;
    index: number;
}) => {
    const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 0, 200], [-20, 0, 20]);
    const likeOpacity = useTransform(x, [0, 80], [0, 1]);
    const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);

    const handleDragEnd = (_: any, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;
        if (Math.abs(offset) > SWIPE_THRESHOLD || Math.abs(velocity) > 400) {
            if (offset > 0) onSwipeEnd("right");
            else onSwipeEnd("left");
        }
    };

    return (
        <motion.div
            className="db-swipe-card"
            drag={cardIndex === 0 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.85}
            style={{ x, rotate, zIndex: cardIndex === 0 ? 2 : 0 }}
            onDragEnd={handleDragEnd}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.3 } }}
            whileTap={{ cursor: "grabbing" }}
            layout
        >
            {/* Photo */}
            {profile.profilePicture ? (
                <img src={profile.profilePicture} alt={profile.firstName} className="db-swipe-card-img" loading="lazy" />
            ) : (
                <div className="db-swipe-card-ph">{initials}</div>
            )}

            {/* Swipe stamps */}
            <motion.div className="db-swipe-stamp db-swipe-stamp--like" style={{ opacity: likeOpacity }}>
                LIKE
            </motion.div>
            <motion.div className="db-swipe-stamp db-swipe-stamp--nope" style={{ opacity: nopeOpacity }}>
                NOPE
            </motion.div>

            {/* Overlay */}
            <div className="db-swipe-card-overlay">
                <div className="db-swipe-card-name">
                    {profile.firstName}, <small>{profile.age ?? "?"}</small>
                    {profile.isVerified && <span className="db-swipe-card-verified">✓</span>}
                </div>
                {profile.occupation && (
                    <div className="db-swipe-card-detail">
                        <span>💼 {profile.occupation}</span>
                    </div>
                )}
                <div className="db-swipe-card-detail">
                    <span>📍 {profile.city ?? profile.country ?? "Location"}</span>
                </div>
                {profile.interests && profile.interests.length > 0 && (
                    <div className="db-swipe-card-interests">
                        {profile.interests.slice(0, 3).map((interest) => (
                            <span key={interest} className="db-swipe-card-interest">{interest}</span>
                        ))}
                        {profile.interests.length > 3 && (
                            <span className="db-swipe-card-interest">+{profile.interests.length - 3}</span>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { onlineUsers, suggestionsVersion } = useSocket();

    const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
    const [convs, setConvs] = useState<RecentConv[]>([]);
    const [likedUsers, setLikedUsers] = useState<LikedUser[]>([]);
    const [stats, setStats] = useState<StatsData>({ matches: 0, unreadMessages: 0, unreadNotifications: 0, memberCount: 0 });
    const [loading, setLoading] = useState(true);
    const [suggestionsLoading, setSuggestionsLoading] = useState(true);
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const [liking, setLiking] = useState<string | null>(null);
    const [suggestionError, setSuggestionError] = useState<SuggestionError>(null);
    const [swiping, setSwiping] = useState(false);
    const [swipeIndex, setSwipeIndex] = useState(0);
    const [profileOpen, setProfileOpen] = useState(false);

    // Request deduplication ref
    const pendingRequestRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    const u = user as any;
    const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();
    const completeness = user ? calcCompleteness(u) : 0;

    // ── Fetch suggestions with deduplication ─────────────────────────────────
    const fetchSuggestions = useCallback(async () => {
        if (pendingRequestRef.current) {
            pendingRequestRef.current.abort();
        }

        const controller = new AbortController();
        pendingRequestRef.current = controller;
        const signal = controller.signal;

        setSuggestionsLoading(true);
        setSuggestionError(null);

        try {
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
                setSuggestions((data.suggestions || []).slice(0, 10));
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
            const [convRes, matchRes, notifRes, countRes, likesRes] = await Promise.allSettled([
                messageAPI.getAllConversations(),
                matchAPI.getMatches(),
                notificationAPI.getUnreadCount(),
                matchAPI.getMemberCount(),
                matchAPI.getLikesReceived(),
            ]);

            if (convRes.status === "fulfilled") {
                const list: RecentConv[] = (convRes.value.conversations || []).slice(0, 5);
                setConvs(list);
                const unread = list.reduce((s: number, c: RecentConv) => s + (c.unreadCount || 0), 0);
                setStats(prev => ({ ...prev, unreadMessages: unread }));
            }
            if (matchRes.status === "fulfilled")
                setStats(prev => ({ ...prev, matches: (matchRes.value.matches || []).length }));

            if (likesRes.status === "fulfilled") {
                const likes = (likesRes.value.likes || []).slice(0, 12);
                setLikedUsers(likes);
            }

            if (notifRes.status === "fulfilled")
                setStats(prev => ({ ...prev, unreadNotifications: notifRes.value.count || 0 }));
            if (countRes.status === "fulfilled")
                setStats(prev => ({ ...prev, memberCount: countRes.value.count || 0 }));
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    // ── Initial load on mount ─────────────────────────────────────────────
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
        setSwiping(true);
        try {
            await matchAPI.likeUser(uid);
            setLikedIds(prev => new Set([...prev, uid]));
            setSuggestions(prev => prev.filter(s => s._id !== uid));
        } catch (err: any) {
            console.error("[Dashboard Like] Error:", err);
            const message = err?.message || "Failed to like user";
            if (message.includes("already liked") || message.includes("Already liked")) {
                setLikedIds(prev => new Set([...prev, uid]));
                setSuggestions(prev => prev.filter(s => s._id !== uid));
            } else if (message.includes("yourself")) {
                alert("You cannot like yourself!");
            } else {
                alert(message);
            }
        }
        finally {
            setLiking(null);
            setSwiping(false);
        }
    };

    const handlePass = async (uid: string) => {
        if (liking) return;
        setLiking(uid);
        setSwiping(true);
        try {
            await matchAPI.passUser(uid);
            setSuggestions(prev => prev.filter(s => s._id !== uid));
        } catch { /* silent */ }
        finally {
            setLiking(null);
            setSwiping(false);
        }
    };

    const handleSuperLike = async (uid: string) => {
        if (liking) return;
        setLiking(uid);
        setSwiping(true);
        try {
            await matchAPI.superLikeUser(uid);
            setSuggestions(prev => prev.filter(s => s._id !== uid));
        } catch (err: any) {
            console.error("[Dashboard SuperLike] Error:", err);
            alert(err?.message || "Failed to super like");
        }
        finally {
            setLiking(null);
            setSwiping(false);
        }
    };

    const handleSwipeEnd = (dir: "left" | "right" | "up") => {
        const current = suggestions[swipeIndex];
        if (!current || swiping) return;
        if (dir === "right") handleLike(current._id);
        else if (dir === "left") handlePass(current._id);
        else if (dir === "up") handleSuperLike(current._id);
        setTimeout(() => {
            setSwipeIndex(prev => prev + 1);
        }, 300);
    };

    // ── Handle suggestion retry ────────────────────────────────────────────
    const handleRetry = () => {
        fetchSuggestions();
    };

    const getTips = (): { icon: string; text: string; to: string }[] => {
        const tips = [];
        if (!u.profilePicture) tips.push({ icon: "📸", text: "Add a profile photo", to: "/profile/edit" });
        if (!u.aboutMe) tips.push({ icon: "📝", text: "Write your bio", to: "/profile/edit" });
        if (!u.occupation) tips.push({ icon: "💼", text: "Add your occupation", to: "/profile/edit" });
        if (!u.interests?.length) tips.push({ icon: "🎯", text: "Add your interests", to: "/profile/edit" });
        if (!u.city) tips.push({ icon: "📍", text: "Add your location", to: "/profile/edit" });
        return tips.slice(0, 3);
    };
    const tips = user ? getTips() : [];

    // Get current profile for swipe deck
    const currentProfile = suggestions[swipeIndex];
    const nextProfile = suggestions[swipeIndex + 1];
    const nextNextProfile = suggestions[swipeIndex + 2];

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="page-wrapper">
            <AppNavbar unreadMessages={stats.unreadMessages} />

            <div className="dashboard">
                <div className="dashboard-inner">

                    {/* ── Header ──────────────────────────────────────────────── */}
                    <div className="db-header">
                        <div className="db-header-left">
                            <h1>{getGreeting()}, {user?.firstName} <span>👋</span></h1>
                            <p className="db-header-sub">Ready to find your perfect match?</p>
                        </div>
                        <div className="db-header-right">
                            <Link to="/notifications" className="db-header-notif" aria-label="Notifications">
                                🔔
                                {stats.unreadNotifications > 0 && (
                                    <span className="db-header-notif-dot" />
                                )}
                            </Link>
                            <div className="db-header-avatar" onClick={() => setProfileOpen(!profileOpen)}>
                                {user?.profilePicture ? (
                                    <img src={user.profilePicture} alt="Profile" />
                                ) : (
                                    <div className="db-header-avatar-ph">{initials}</div>
                                )}
                                {profileOpen && (
                                    <div className="db-header-dropdown" onClick={e => e.stopPropagation()}>
                                        <Link to="/profile" onClick={() => setProfileOpen(false)}>👤 My Profile</Link>
                                        <Link to="/profile/edit" onClick={() => setProfileOpen(false)}>✏️ Edit Profile</Link>
                                        <Link to="/settings" onClick={() => setProfileOpen(false)}>⚙️ Settings</Link>
                                        <Link to="/premium" onClick={() => setProfileOpen(false)}>✨ Premium</Link>
                                        <div className="dropdown-divider" />
                                        <button onClick={() => { setProfileOpen(false); logout(); }}>🚪 Log Out</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Statistics Cards ─────────────────────────────────────── */}
                    <div className="db-stats-row">
                        <Link to="/discover" className="db-stat-card">
                            <div className="db-stat-top">
                                <div className="db-stat-icon db-stat-icon--likes">❤️</div>
                                <span className="db-stat-arrow">→</span>
                            </div>
                            <div>
                                <div className="db-stat-value">{likedUsers.length || 0}</div>
                                <div className="db-stat-label">Likes</div>
                                <div className="db-stat-sub">See who likes you</div>
                            </div>
                        </Link>

                        <Link to="/matches" className="db-stat-card">
                            <div className="db-stat-top">
                                <div className="db-stat-icon db-stat-icon--matches">💬</div>
                                <span className="db-stat-arrow">→</span>
                            </div>
                            <div>
                                <div className="db-stat-value">{stats.matches}</div>
                                <div className="db-stat-label">Matches</div>
                                <div className="db-stat-sub">Start a conversation</div>
                            </div>
                        </Link>

                        <Link to="/discover" className="db-stat-card">
                            <div className="db-stat-top">
                                <div className="db-stat-icon db-stat-icon--views">👁</div>
                                <span className="db-stat-arrow">→</span>
                            </div>
                            <div>
                                <div className="db-stat-value">{stats.memberCount || 0}</div>
                                <div className="db-stat-label">Profile Views</div>
                                <div className="db-stat-sub">This week</div>
                            </div>
                        </Link>

                        <Link to="/premium" className="db-stat-card">
                            <div className="db-stat-top">
                                <div className="db-stat-icon db-stat-icon--premium">💎</div>
                                <span className="db-stat-arrow">→</span>
                            </div>
                            <div>
                                {user?.isPremium ? (
                                    <>
                                        <div className="db-stat-value">
                                            <span className="db-premium-badge">✅ Premium Active</span>
                                        </div>
                                        <div className="db-stat-label" style={{ marginTop: 4 }}>Unlock all features</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="db-stat-value">Go Premium</div>
                                        <div className="db-stat-label">Unlock all features</div>
                                        <div className="db-stat-sub">Upgrade now</div>
                                    </>
                                )}
                            </div>
                        </Link>
                    </div>

                    {/* ── Main Content Grid ─────────────────────────────────────── */}
                    <div className="db-main">

                        {/* ── LEFT COLUMN ───────────────────────────────────────── */}
                        <div className="db-main-left">

                            {/* ── Discover People (Swipe Deck) ──────────────────── */}
                            <div className="db-card">
                                <div className="db-card-header">
                                    <div>
                                        <div className="db-card-title">Discover People</div>
                                        <div className="db-card-subtitle">Find your perfect match</div>
                                    </div>
                                    <button className="db-filters-btn" onClick={() => navigate("/discover")}>
                                        🔍 Filters
                                    </button>
                                </div>
                                <div className="db-card-body">
                                    {suggestionsLoading ? (
                                        <div className="db-swipe-loader">
                                            <div className="db-swipe-spinner" />
                                        </div>
                                    ) : suggestionError === "network" ? (
                                        <div className="db-swipe-empty">
                                            <span>🌐</span>
                                            <p>Unable to load suggestions. Check your connection.</p>
                                            <button className="db-error-btn" onClick={handleRetry}>Try Again</button>
                                        </div>
                                    ) : suggestionError === "server" ? (
                                        <div className="db-swipe-empty">
                                            <span>⚠️</span>
                                            <p>Something went wrong. Please try again later.</p>
                                            <button className="db-error-btn" onClick={handleRetry}>Retry</button>
                                        </div>
                                    ) : suggestions.length === 0 || !currentProfile ? (
                                        <div className="db-swipe-empty">
                                            <span>💫</span>
                                            <p>No more profiles to discover right now. Check back soon!</p>
                                            <button className="db-error-btn" onClick={() => navigate("/discover")}>
                                                Explore More
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="db-swipe-container">
                                                <AnimatePresence mode="popLayout">
                                                    {/* Back card 2 */}
                                                    {nextNextProfile && (
                                                        <div
                                                            key={nextNextProfile._id + "-back2"}
                                                            className="db-swipe-card db-swipe-card--back-2"
                                                        >
                                                            {nextNextProfile.profilePicture ? (
                                                                <img src={nextNextProfile.profilePicture} alt="" className="db-swipe-card-img" loading="lazy" />
                                                            ) : (
                                                                <div className="db-swipe-card-ph">
                                                                    {`${nextNextProfile.firstName?.[0] ?? ""}${nextNextProfile.lastName?.[0] ?? ""}`.toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Back card 1 */}
                                                    {nextProfile && (
                                                        <div
                                                            key={nextProfile._id + "-back1"}
                                                            className="db-swipe-card db-swipe-card--back-1"
                                                        >
                                                            {nextProfile.profilePicture ? (
                                                                <img src={nextProfile.profilePicture} alt="" className="db-swipe-card-img" loading="lazy" />
                                                            ) : (
                                                                <div className="db-swipe-card-ph">
                                                                    {`${nextProfile.firstName?.[0] ?? ""}${nextProfile.lastName?.[0] ?? ""}`.toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Active card */}
                                                    {currentProfile && (
                                                        <SwipeCard
                                                            key={currentProfile._id}
                                                            profile={currentProfile}
                                                            isOnline={onlineUsers.has(currentProfile._id)}
                                                            onSwipeEnd={handleSwipeEnd}
                                                            index={0}
                                                        />
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Swipe Action Buttons */}
                                            <div className="db-swipe-actions">
                                                <button
                                                    className="db-swipe-btn db-swipe-btn--pass"
                                                    onClick={() => handlePass(currentProfile._id)}
                                                    disabled={!!liking || swiping}
                                                    aria-label="Pass"
                                                >
                                                    ❌
                                                </button>
                                                <button
                                                    className="db-swipe-btn db-swipe-btn--super"
                                                    onClick={() => handleSuperLike(currentProfile._id)}
                                                    disabled={!!liking || swiping}
                                                    aria-label="Super Like"
                                                >
                                                    ⭐
                                                </button>
                                                <button
                                                    className="db-swipe-btn db-swipe-btn--like"
                                                    onClick={() => handleLike(currentProfile._id)}
                                                    disabled={!!liking || swiping}
                                                    aria-label="Like"
                                                >
                                                    ❤️
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* ── People Who Liked You + Recent Messages ──────────── */}
                            <div className="db-split-row">

                                {/* People Who Liked You */}
                                <div className="db-card">
                                    <div className="db-card-header">
                                        <div>
                                            <div className="db-card-title">People Who Liked You</div>
                                            {!user?.isPremium && (
                                                <div className="db-card-subtitle">Upgrade to see who</div>
                                            )}
                                        </div>
                                        <Link to="/discover" className="db-card-link">View all</Link>
                                    </div>
                                    <div className="db-card-body">
                                        {likedUsers.length === 0 ? (
                                            <div className="db-liked-empty">No likes yet</div>
                                        ) : user?.isPremium ? (
                                            <div className="db-liked-row">
                                                {likedUsers.map((lu) => {
                                                    const li = `${lu.firstName?.[0] ?? ""}${lu.lastName?.[0] ?? ""}`.toUpperCase();
                                                    return (
                                                        <div key={lu._id} className="db-liked-item" onClick={() => navigate(`/profile/${lu._id}`)}>
                                                            {lu.profilePicture ? (
                                                                <img src={lu.profilePicture} alt={lu.firstName} className="db-liked-avatar" loading="lazy" />
                                                            ) : (
                                                                <div className="db-liked-avatar-ph">{li}</div>
                                                            )}
                                                            <span className="db-liked-name">{lu.firstName}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="db-liked-row">
                                                {likedUsers.slice(0, 6).map((lu) => {
                                                    const li = `${lu.firstName?.[0] ?? ""}${lu.lastName?.[0] ?? ""}`.toUpperCase();
                                                    return (
                                                        <div key={lu._id} className="db-liked-item">
                                                            {lu.profilePicture ? (
                                                                <img src={lu.profilePicture} alt="" className="db-liked-avatar db-liked-avatar--blurred" />
                                                            ) : (
                                                                <div className="db-liked-avatar-ph db-liked-avatar--blurred">{li}</div>
                                                            )}
                                                            <span className="db-liked-name">••••</span>
                                                        </div>
                                                    );
                                                })}
                                                <div className="db-liked-upgrade">
                                                    <p>Upgrade to Premium to see who likes you</p>
                                                    <button className="db-liked-upgrade-btn" onClick={() => navigate("/premium")}>
                                                        Upgrade Now
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Recent Messages */}
                                <div className="db-card">
                                    <div className="db-card-header">
                                        <div>
                                            <div className="db-card-title">Recent Messages</div>
                                        </div>
                                        <Link to="/chat" className="db-card-link">View all</Link>
                                    </div>
                                    <div className="db-card-body">
                                        {loading ? (
                                            <div className="db-msg-list">
                                                {[...Array(3)].map((_, i) => (
                                                    <div key={i} className="db-msg-item" style={{ pointerEvents: "none" }}>
                                                        <div className="db-skeleton db-skeleton--circle" style={{ width: 48, height: 48 }} />
                                                        <div className="db-msg-body" style={{ flex: 1 }}>
                                                            <div className="db-skeleton db-skeleton--text" />
                                                            <div className="db-skeleton db-skeleton--text-sm" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : convs.length === 0 ? (
                                            <div className="db-liked-empty">No conversations yet</div>
                                        ) : (
                                            <div className="db-msg-list">
                                                {convs.map(c => {
                                                    const ci = `${c.user.firstName?.[0] ?? ""}${c.user.lastName?.[0] ?? ""}`.toUpperCase();
                                                    return (
                                                        <div key={c._id} className="db-msg-item" onClick={() => navigate(`/chat/${c.user._id}`)}>
                                                            <div className="db-msg-avatar-wrap">
                                                                {c.user.profilePicture ? (
                                                                    <img src={c.user.profilePicture} alt="" className="db-msg-avatar" loading="lazy" />
                                                                ) : (
                                                                    <div className="db-msg-avatar-ph">{ci}</div>
                                                                )}
                                                                {onlineUsers.has(c.user._id) && <span className="db-msg-online" />}
                                                            </div>
                                                            <div className="db-msg-body">
                                                                <div className="db-msg-top">
                                                                    <span className="db-msg-name">{c.user.firstName} {c.user.lastName}</span>
                                                                    {c.lastMessage && <span className="db-msg-time">{fmtTime(c.lastMessage.createdAt)}</span>}
                                                                </div>
                                                                <p className="db-msg-preview">
                                                                    {c.lastMessage?.content ?? "Say hello! 👋"}
                                                                </p>
                                                            </div>
                                                            {c.unreadCount > 0 && (
                                                                <span className="db-msg-unread">{c.unreadCount}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT COLUMN (Sidebar) ────────────────────────────── */}
                        <div className="db-main-right">

                            {/* Profile Card */}
                            <div className="db-card db-profile-card">
                                <div className="db-profile-banner" />
                                <div className="db-profile-avatar-wrap">
                                    {user?.profilePicture ? (
                                        <img src={user.profilePicture} alt="You" className="db-profile-avatar" />
                                    ) : (
                                        <div className="db-profile-avatar-ph">{initials}</div>
                                    )}
                                    {user?.isPremium && <span className="db-profile-premium-badge">✨</span>}
                                </div>
                                <div className="db-profile-name">{user?.firstName} {user?.lastName}</div>
                                {u?.city && <div className="db-profile-loc">📍 {u.city}{u.country ? `, ${u.country}` : ""}</div>}

                                <div className="db-profile-stats">
                                    <div className="db-profile-stat">
                                        <div className="db-profile-stat-val">{completeness}%</div>
                                        <div className="db-profile-stat-label">Profile</div>
                                    </div>
                                    <div className="db-profile-stat">
                                        <div className="db-profile-stat-val">{stats.matches}</div>
                                        <div className="db-profile-stat-label">Matches</div>
                                    </div>
                                    <div className="db-profile-stat">
                                        <div className="db-profile-stat-val">{stats.memberCount}</div>
                                        <div className="db-profile-stat-label">Members</div>
                                    </div>
                                </div>

                                <Link to="/profile/edit" className="db-profile-edit-btn">
                                    ✏️ Edit Profile
                                </Link>
                            </div>

                            {/* Quick Actions */}
                            <div className="db-card db-quick-actions">
                                <div className="db-quick-title">Quick Actions</div>
                                <div className="db-quick-grid">
                                    {[
                                        { icon: "🔥", label: "Discover", sub: "Find matches", to: "/discover" },
                                        { icon: "💞", label: "Matches", sub: "Connections", to: "/matches" },
                                        { icon: "💬", label: "Chat", sub: "Messages", to: "/chat" },
                                        { icon: "👤", label: "Profile", sub: "Edit profile", to: "/profile/edit" },
                                    ].map((s) => (
                                        <Link key={s.to} to={s.to} className="db-quick-item">
                                            <span className="db-quick-icon">{s.icon}</span>
                                            <span className="db-quick-label">{s.label}</span>
                                            <span className="db-quick-sub">{s.sub}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* Tips (if profile incomplete) */}
                            {tips.length > 0 && (
                                <div className="db-card db-tips-card">
                                    <div className="db-tips-badge">💡 Tips</div>
                                    <h3>Boost your profile</h3>
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
                        </div>
                    </div>

                    {/* ── Premium Banner (Bottom) ──────────────────────────────── */}
                    {!user?.isPremium && (
                        <div className="db-premium-banner">
                            <div className="db-premium-banner-inner">
                                <div className="db-premium-banner-left">
                                    <div className="db-premium-banner-title">Go Premium 💎</div>
                                    <div className="db-premium-banner-sub">
                                        Get unlimited likes, advanced filters, read receipts and more.
                                    </div>
                                    <div className="db-premium-features">
                                        <div className="db-premium-feature">
                                            <span className="db-premium-feature-icon">✓</span>
                                            Unlimited Likes
                                        </div>
                                        <div className="db-premium-feature">
                                            <span className="db-premium-feature-icon">✓</span>
                                            See Who Liked You
                                        </div>
                                        <div className="db-premium-feature">
                                            <span className="db-premium-feature-icon">✓</span>
                                            Read Receipts
                                        </div>
                                        <div className="db-premium-feature">
                                            <span className="db-premium-feature-icon">✓</span>
                                            Priority Support
                                        </div>
                                    </div>
                                </div>
                                <button className="db-premium-banner-btn" onClick={() => navigate("/premium")}>
                                    Unlock Premium →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;