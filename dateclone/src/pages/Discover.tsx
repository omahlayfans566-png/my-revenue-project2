import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import type { PanInfo } from "framer-motion";
import toast from "react-hot-toast";
import AppNavbar from "../component/AppNavbar";
import { discoveryAPI, matchAPI } from "../services/apiService";
import { useSocket } from "../context/SocketContext";
import "../style/discover.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
    _id: string; firstName: string; lastName: string;
    profilePicture?: string; photos?: string[];
    age?: number; city?: string; country?: string; distance?: number;
    occupation?: string; aboutMe?: string;
    interests?: string[]; relationshipGoal?: string;
    education?: string; religion?: string;
    compatibilityScore?: number; isVerified?: boolean;
    isPremium?: boolean; isOnline?: boolean;
    memberSince?: string; lastLogin?: string;
    profileCompletion?: number;
}

interface FilterState {
    distance: string;
    minAge: string;
    maxAge: string;
    gender: string;
    lookingFor: string;
    online: string;
    recentlyActive: string;
    verifiedOnly: string;
    interests: string[];
    relationshipGoal: string;
    religion: string;
}

interface FiltersData {
    interests: string[];
    religions: string[];
    occupations: string[];
    educations: string[];
    distanceOptions: { value: string; label: string }[];
    ageRange: { min: number; max: number };
    relationshipGoals: string[];
}

const DEFAULT_FILTERS: FilterState = {
    distance: "",
    minAge: "",
    maxAge: "",
    gender: "",
    lookingFor: "",
    online: "",
    recentlyActive: "",
    verifiedOnly: "",
    interests: [],
    relationshipGoal: "",
    religion: "",
};

const SWIPE_THRESHOLD = 100;

// ─── Profile Card ──────────────────────────────────────────────────────────────
const ProfileCard = ({
    profile,
    isOnline,
    onSwipeEnd,
    onInfo,
    onMore,
    index: cardIndex,
}: {
    profile: Profile;
    isOnline: boolean;
    onSwipeEnd: (dir: "left" | "right" | "up") => void;
    onInfo: () => void;
    onMore: () => void;
    index: number;
}) => {
    const [photoIdx, setPhotoIdx] = useState(0);
    const photos = [profile.profilePicture, ...(profile.photos || [])].filter(Boolean) as string[];
    const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();

    const x = useMotionValue(0);
    const rotate = useTransform(x, [-300, 0, 300], [-25, 0, 25]);
    const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0, 1, 1, 1, 0]);
    const likeOpacity = useTransform(x, [0, 100], [0, 1]);
    const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

    const handleDragEnd = (_: any, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;
        if (Math.abs(offset) > SWIPE_THRESHOLD || Math.abs(velocity) > 500) {
            if (offset > 0) onSwipeEnd("right");
            else onSwipeEnd("left");
        }
    };

    const swipeOutVariants = {
        exitRight: { x: 500, rotate: 25, opacity: 0, transition: { duration: 0.35 } },
        exitLeft: { x: -500, rotate: -25, opacity: 0, transition: { duration: 0.35 } },
        exitUp: { y: -500, scale: 0.8, opacity: 0, transition: { duration: 0.35 } },
    };

    return (
        <motion.div
            className="swipe-card-fm"
            drag={cardIndex === 0 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            style={{ x, rotate, opacity }}
            onDragEnd={handleDragEnd}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{
                x: 0,
                y: 0,
                rotate: 0,
                opacity: 0,
                scale: 0.85,
                transition: { duration: 0.3 },
            }}
            layout
            whileTap={{ cursor: "grabbing" }}
        >
            <div className="sc-photo-wrap" onClick={() => {
                // Taps on left/right halves navigate photos
            }}>
                {/* Photo */}
                {photos.length > 0 ? (
                    <img src={photos[photoIdx]} alt={profile.firstName} className="sc-photo" loading="lazy" />
                ) : (
                    <div className="sc-photo-placeholder">{initials}</div>
                )}

                {/* Photo tap zones */}
                <div className="sc-photo-tap-left" onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => Math.max(0, i - 1)); }} />
                <div className="sc-photo-tap-right" onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => Math.min(photos.length - 1, i + 1)); }} />

                {/* Photo progress bars */}
                {photos.length > 1 && (
                    <div className="sc-photo-progress">
                        {photos.map((_, i) => (
                            <span key={i} className={`sc-photo-bar ${i === photoIdx ? "active" : ""}`} />
                        ))}
                    </div>
                )}

                {/* Swipe stamps */}
                <motion.div className="sc-stamp stamp-like" style={{ opacity: likeOpacity }}>
                    LIKE
                </motion.div>
                <motion.div className="sc-stamp stamp-nope" style={{ opacity: nopeOpacity }}>
                    NOPE
                </motion.div>

                {/* Online badge top left */}
                {isOnline && <span className="sc-online-badge">●</span>}

                {/* More button top right */}
                <button className="sc-more-btn" onClick={(e) => { e.stopPropagation(); onMore(); }} aria-label="More">
                    ⋮
                </button>

                {/* Bottom info overlay */}
                <div className="sc-overlay">
                    <div className="sc-overlay-row">
                        <div className="sc-overlay-left">
                            <div className="sc-name-row">
                                <h2 className="sc-name">{profile.firstName}, {profile.age ?? "?"}</h2>
                                {profile.isVerified && (
                                    <span className="sc-verified-badge" title="Verified">✓</span>
                                )}
                            </div>
                            {profile.occupation && <p className="sc-occupation">{profile.occupation}</p>}
                            <p className="sc-location">
                                📍 {[profile.city, profile.country].filter(Boolean).join(", ")}
                                {profile.distance && <span className="sc-distance"> · {profile.distance} km</span>}
                            </p>
                        </div>
                        <button className="sc-info-btn" onClick={(e) => { e.stopPropagation(); onInfo(); }} aria-label="Info">
                            ⓘ
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ─── Stacked Card Deck ─────────────────────────────────────────────────────────
const SwipeStack = ({
    profiles,
    currentIndex,
    onlineUsersSet,
    onSwipeEnd,
    onInfo,
    onMore,
}: {
    profiles: Profile[];
    currentIndex: number;
    onlineUsersSet: Set<string>;
    onSwipeEnd: (dir: "left" | "right" | "up") => void;
    onInfo: (p: Profile) => void;
    onMore: (p: Profile) => void;
}) => {
    // Show up to 3 cards stacked
    const visibleProfiles = [];
    for (let i = 0; i < 3; i++) {
        const idx = currentIndex + i;
        if (idx < profiles.length) {
            visibleProfiles.push({ profile: profiles[idx], stackIndex: i });
        }
    }

    if (visibleProfiles.length === 0) return null;

    return (
        <div className="swipe-stack-container">
            {visibleProfiles.map(({ profile, stackIndex }) => {
                // Determine the card type: center, left-behind, right-behind
                let cardClass = "sc-stack-card sc-stack-center";
                if (stackIndex === 1) cardClass = "sc-stack-card sc-stack-right";
                else if (stackIndex === 2) cardClass = "sc-stack-card sc-stack-left";

                if (stackIndex === 0) {
                    // Active draggable card
                    return (
                        <AnimatePresence mode="popLayout" key={profile._id}>
                            <ProfileCard
                                profile={profile}
                                isOnline={onlineUsersSet.has(profile._id) || profile.isOnline || false}
                                onSwipeEnd={onSwipeEnd}
                                onInfo={() => onInfo(profile)}
                                onMore={() => onMore(profile)}
                                index={0}
                            />
                        </AnimatePresence>
                    );
                }

                // Stacked background cards - static
                const isRight = stackIndex === 1;
                return (
                    <div
                        key={profile._id}
                        className={`sc-stack-card ${isRight ? "sc-stack-right" : "sc-stack-left"}`}
                    >
                        <div className="sc-stack-photo-wrap">
                            {profile.profilePicture ? (
                                <img src={profile.profilePicture} alt="" className="sc-stack-photo" loading="lazy" />
                            ) : (
                                <div className="sc-photo-placeholder">
                                    {`${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase()}
                                </div>
                            )}
                            <div className="sc-stack-overlay">
                                <span className="sc-stack-name">{profile.firstName}, {profile.age ?? "?"}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Match Modal ──────────────────────────────────────────────────────────────
const MatchModal = ({ profile, onClose, onMessage }: {
    profile: Profile; onClose: () => void; onMessage: () => void;
}) => {
    const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
    return (
        <motion.div className="match-modal-overlay" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="match-modal" onClick={e => e.stopPropagation()}
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 20 }}>
                <div className="match-confetti">
                    {["🎉", "💕", "✨", "💖", "🌟"].map((e, i) => (
                        <motion.span key={i} className="confetti-piece"
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: i * 0.1, type: "spring" }}>
                            {e}
                        </motion.span>
                    ))}
                </div>
                <div className="match-modal-avatars">
                    {profile.profilePicture
                        ? <img src={profile.profilePicture} alt="" className="match-avatar" />
                        : <div className="match-avatar match-avatar-placeholder">{initials}</div>}
                </div>
                <h2>It's a Match! 💕</h2>
                <p>You and <strong>{profile.firstName}</strong> liked each other.</p>
                <div className="match-modal-actions">
                    <button className="btn btn-primary" onClick={onMessage}>💬 Send Message</button>
                    <button className="btn btn-outline" onClick={onClose}>Keep Swiping</button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ─── Filter Panel ─────────────────────────────────────────────────────────────
const FilterPanel = ({
    filters, setFilters, availableFilters, onApply, onClose,
}: {
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
    availableFilters: FiltersData | null;
    onApply: () => void;
    onClose: () => void;
}) => {
    const update = (key: keyof FilterState, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const toggleInterest = (interest: string) => {
        setFilters(prev => ({
            ...prev,
            interests: prev.interests.includes(interest)
                ? prev.interests.filter(i => i !== interest)
                : [...prev.interests, interest],
        }));
    };

    const clearAll = () => setFilters(DEFAULT_FILTERS);

    return (
        <div className="filter-overlay" onClick={onClose}>
            <div className="filter-panel" onClick={e => e.stopPropagation()}>
                <div className="filter-header">
                    <h2>🔍 Filters</h2>
                    <div className="filter-header-actions">
                        <button className="filter-clear-btn" onClick={clearAll}>Clear All</button>
                        <button className="filter-close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>

                <div className="filter-body">
                    <div className="filter-group">
                        <label>Distance</label>
                        <select value={filters.distance} onChange={e => update("distance", e.target.value)}>
                            <option value="">Anywhere</option>
                            {(availableFilters?.distanceOptions || []).map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Age Range</label>
                        <div className="filter-range">
                            <input type="number" placeholder="18" min={18} max={100}
                                value={filters.minAge} onChange={e => update("minAge", e.target.value)} />
                            <span>to</span>
                            <input type="number" placeholder="100" min={18} max={100}
                                value={filters.maxAge} onChange={e => update("maxAge", e.target.value)} />
                        </div>
                    </div>

                    <div className="filter-group">
                        <label>Gender</label>
                        <select value={filters.gender} onChange={e => update("gender", e.target.value)}>
                            <option value="">Any</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Looking For</label>
                        <select value={filters.lookingFor} onChange={e => update("lookingFor", e.target.value)}>
                            <option value="">Any</option>
                            <option value="men">Men</option>
                            <option value="women">Women</option>
                            <option value="both">Both</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Status</label>
                        <div className="filter-checkboxes">
                            <label className="filter-checkbox">
                                <input type="checkbox" checked={filters.online === "true"}
                                    onChange={e => update("online", e.target.checked ? "true" : "")} />
                                Online now
                            </label>
                            <label className="filter-checkbox">
                                <input type="checkbox" checked={filters.recentlyActive === "true"}
                                    onChange={e => update("recentlyActive", e.target.checked ? "true" : "")} />
                                Recently active
                            </label>
                            <label className="filter-checkbox">
                                <input type="checkbox" checked={filters.verifiedOnly === "true"}
                                    onChange={e => update("verifiedOnly", e.target.checked ? "true" : "")} />
                                Verified only
                            </label>
                        </div>
                    </div>

                    <div className="filter-group">
                        <label>Relationship Goal</label>
                        <select value={filters.relationshipGoal} onChange={e => update("relationshipGoal", e.target.value)}>
                            <option value="">Any</option>
                            {(availableFilters?.relationshipGoals || []).map(g => (
                                <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Religion</label>
                        <select value={filters.religion} onChange={e => update("religion", e.target.value)}>
                            <option value="">Any</option>
                            {(availableFilters?.religions || []).map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    {availableFilters?.interests && availableFilters.interests.length > 0 && (
                        <div className="filter-group">
                            <label>Interests</label>
                            <div className="filter-chips">
                                {availableFilters.interests.map(i => (
                                    <button key={i}
                                        className={`filter-chip ${filters.interests.includes(i) ? "active" : ""}`}
                                        onClick={() => toggleInterest(i)}>
                                        {i}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="filter-footer">
                    <button className="btn btn-primary btn-block" onClick={onApply}>Apply Filters</button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Discover Page ───────────────────────────────────────────────────────
const Discover = () => {
    const navigate = useNavigate();
    const { onlineUsers } = useSocket();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setAL] = useState<string | null>(null);
    const [matchModal, setMatchModal] = useState<Profile | null>(null);
    const [swiping, setSwiping] = useState(false);
    const [index, setIndex] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [availableFilters, setAvailableFilters] = useState<FiltersData | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [history, setHistory] = useState<Profile[]>([]);

    // Active filter count
    const activeFilterCount = Object.entries(activeFilters).filter(([k, v]) => {
        if (k === "interests") return (v as string[]).length > 0;
        return v !== "";
    }).length;

    // Load available filters on mount
    useEffect(() => {
        discoveryAPI.getFilters()
            .then(res => setAvailableFilters(res.filters))
            .catch(() => { });
    }, []);

    // Load profiles
    const loadProfiles = useCallback(async (pageNum: number = 1, append: boolean = false) => {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);
        try {
            const f: Record<string, any> = { page: pageNum, limit: 20 };
            Object.entries(activeFilters).forEach(([k, v]) => {
                if (k === "interests" && (v as string[]).length > 0) f.interests = (v as string[]).join(",");
                else if (v !== "") f[k] = v;
            });
            const res = await discoveryAPI.getUsers(f);
            const users: Profile[] = res.users || [];
            if (append) {
                setProfiles(prev => [...prev, ...users]);
            } else {
                setProfiles(users);
                setIndex(0);
                setHistory([]);
            }
            setHasMore(users.length >= 20 && res.pagination?.page < res.pagination?.pages);
        } catch {
            if (!append) setProfiles([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [activeFilters]);

    useEffect(() => {
        setPage(1);
        loadProfiles(1);
    }, [loadProfiles]);

    const applyFilters = () => {
        setActiveFilters({ ...filters });
        setShowFilters(false);
    };

    const current = profiles[index];

    const doAction = async (dir: "right" | "left" | "up", action: () => Promise<any>) => {
        if (!current || actionLoading || swiping) return;
        setAL(dir);
        setSwiping(true);
        let errorMsg: string | null = null;
        try {
            const res = await action();
            if (res?.isMatch) {
                setMatchModal(current);
                toast("💕 It's a Match!", {
                    duration: 3000,
                    style: { background: "#ff4081", color: "#fff" },
                });
            }
        } catch (err: any) {
            errorMsg = err?.message || "Something went wrong";
            console.error("[Swipe error]", err);
        }
        setTimeout(() => {
            setAL(null);
            setSwiping(false);
            if (!errorMsg) {
                setHistory(prev => [current, ...prev]);
                setIndex(i => i + 1);
                if (index >= profiles.length - 3 && hasMore && !loadingMore) {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    loadProfiles(nextPage, true);
                }
            } else {
                if (errorMsg!.toLowerCase().includes("limit") || errorMsg!.toLowerCase().includes("429")) {
                    toast("❤️ Daily like limit reached. Upgrade to Premium for unlimited likes!", {
                        duration: 5000,
                        style: { background: "#ff4081", color: "#fff" },
                    });
                } else {
                    toast.error(errorMsg!);
                }
            }
        }, 400);
    };

    const handleSwipeEnd = (dir: "left" | "right" | "up") => {
        if (dir === "right") doAction("right", () => matchAPI.likeUser(current!._id));
        else if (dir === "left") doAction("left", () => matchAPI.passUser(current!._id));
        else if (dir === "up") doAction("up", () => matchAPI.superLikeUser(current!._id));
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const last = history[0];
        setHistory(prev => prev.slice(1));
        setProfiles(prev => [last, ...prev]);
        setIndex(i => Math.max(0, i - 1));
    };

    // Keyboard support
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!current || actionLoading || swiping) return;
            if (e.key === "ArrowRight") handleSwipeEnd("right");
            if (e.key === "ArrowLeft") handleSwipeEnd("left");
            if (e.key === "ArrowUp") handleSwipeEnd("up");
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [current, actionLoading, swiping]);

    return (
        <div className="page-wrapper">
            <AppNavbar />

            <div className="discover-page">
                {/* Header */}
                <div className="discover-header">
                    <h1>Discover</h1>
                    <div className="discover-header-actions">
                        {activeFilterCount > 0 && (
                            <span className="active-filter-count">{activeFilterCount}</span>
                        )}
                        <button className={`filter-toggle-btn ${showFilters ? "active" : ""}`}
                            onClick={() => setShowFilters(true)}>
                            🔍 Filters
                        </button>
                        <button className="refresh-btn" onClick={() => { setPage(1); loadProfiles(1); }} disabled={loading}>
                            🔄
                        </button>
                    </div>
                </div>

                {/* Active filter chips */}
                {activeFilterCount > 0 && (
                    <div className="active-filters-bar">
                        {activeFilters.distance && (
                            <span className="active-filter-chip" onClick={() => {
                                setActiveFilters(prev => ({ ...prev, distance: "" }));
                                setFilters(prev => ({ ...prev, distance: "" }));
                            }}>
                                📍 {activeFilters.distance} km ✕
                            </span>
                        )}
                        {activeFilters.minAge && activeFilters.maxAge && (
                            <span className="active-filter-chip" onClick={() => {
                                setActiveFilters(prev => ({ ...prev, minAge: "", maxAge: "" }));
                                setFilters(prev => ({ ...prev, minAge: "", maxAge: "" }));
                            }}>
                                🎂 {activeFilters.minAge}-{activeFilters.maxAge} ✕
                            </span>
                        )}
                        {activeFilters.online === "true" && (
                            <span className="active-filter-chip" onClick={() => {
                                setActiveFilters(prev => ({ ...prev, online: "" }));
                                setFilters(prev => ({ ...prev, online: "" }));
                            }}>
                                🟢 Online ✕
                            </span>
                        )}
                        {activeFilters.verifiedOnly === "true" && (
                            <span className="active-filter-chip" onClick={() => {
                                setActiveFilters(prev => ({ ...prev, verifiedOnly: "" }));
                                setFilters(prev => ({ ...prev, verifiedOnly: "" }));
                            }}>
                                ✓ Verified ✕
                            </span>
                        )}
                        {activeFilters.interests.length > 0 && (
                            <span className="active-filter-chip" onClick={() => {
                                setActiveFilters(prev => ({ ...prev, interests: [] }));
                                setFilters(prev => ({ ...prev, interests: [] }));
                            }}>
                                🎯 {activeFilters.interests.length} interests ✕
                            </span>
                        )}
                    </div>
                )}

                {/* Main card area */}
                <div className="discover-main">
                    {loading ? (
                        <div className="discover-loading">
                            <div className="discover-spinner" />
                            <p>Finding people for you…</p>
                        </div>
                    ) : !current ? (
                        <div className="empty-state discover-empty">
                            <div className="empty-icon">💫</div>
                            <h3>You've seen everyone!</h3>
                            <p>
                                {activeFilterCount > 0
                                    ? "Try adjusting your filters to see more people."
                                    : "Check back later or update your preferences for better matches."}
                            </p>
                            <div className="empty-actions">
                                {activeFilterCount > 0 && (
                                    <button className="btn btn-primary" onClick={() => {
                                        setActiveFilters(DEFAULT_FILTERS);
                                        setFilters(DEFAULT_FILTERS);
                                    }}>
                                        Clear Filters
                                    </button>
                                )}
                                <button className="btn btn-outline" onClick={() => { setPage(1); loadProfiles(1); }}>
                                    🔄 Refresh
                                </button>
                                <button className="btn btn-outline" onClick={() => navigate("/profile/edit")}>
                                    Edit Preferences
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <SwipeStack
                                profiles={profiles}
                                currentIndex={index}
                                onlineUsersSet={onlineUsers}
                                onSwipeEnd={handleSwipeEnd}
                                onInfo={(p) => navigate(`/profile/${p._id}`)}
                                onMore={(p) => navigate(`/profile/${p._id}`)}
                            />

                            {/* Action buttons */}
                            <div className="swipe-actions-bar">
                                <button className="sa-btn sa-undo" onClick={handleUndo} disabled={history.length === 0} title="Undo" aria-label="Undo">
                                    ↺
                                </button>
                                <button className="sa-btn sa-pass" onClick={() => handleSwipeEnd("left")} disabled={!!actionLoading || swiping} title="Pass" aria-label="Pass">
                                    ✕
                                </button>
                                <button className="sa-btn sa-like" onClick={() => handleSwipeEnd("right")} disabled={!!actionLoading || swiping} title="Like" aria-label="Like">
                                    ❤
                                </button>
                                <button className="sa-btn sa-super" onClick={() => handleSwipeEnd("up")} disabled={!!actionLoading || swiping} title="Super Like" aria-label="Super Like">
                                    ⭐
                                </button>
                                <button className="sa-btn sa-boost" title="Boost" aria-label="Boost">
                                    ⚡
                                </button>
                            </div>

                            {/* Load more indicator */}
                            {loadingMore && (
                                <div className="discover-loading-more">
                                    <div className="discover-spinner" style={{ width: 20, height: 20 }} />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Filter panel */}
            {showFilters && (
                <FilterPanel
                    filters={filters}
                    setFilters={setFilters}
                    availableFilters={availableFilters}
                    onApply={applyFilters}
                    onClose={() => setShowFilters(false)}
                />
            )}

            {/* Match modal */}
            {matchModal && (
                <MatchModal
                    profile={matchModal}
                    onClose={() => { setMatchModal(null); }}
                    onMessage={() => { setMatchModal(null); navigate(`/chat/${matchModal._id}`); }}
                />
            )}
        </div>
    );
};

export default Discover;