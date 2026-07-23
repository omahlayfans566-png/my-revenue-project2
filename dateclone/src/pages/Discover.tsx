import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
const ProfileCardSkeleton = () => (
    <div className="discover-card-skeleton">
        <div className="skeleton-photo" />
        <div className="skeleton-overlay">
            <div className="skeleton-name" />
            <div className="skeleton-location" />
            <div className="skeleton-occupation" />
        </div>
        <div className="skeleton-actions">
            <div className="skeleton-btn skeleton-pass" />
            <div className="skeleton-btn skeleton-like" />
        </div>
    </div>
);

// ─── Profile Card ─────────────────────────────────────────────────────────────
const ProfileCard = ({
    profile,
    isOnline,
    onLike,
    onPass,
    onViewProfile,
    index,
}: {
    profile: Profile;
    isOnline: boolean;
    onLike: () => void;
    onPass: () => void;
    onViewProfile: () => void;
    index: number;
}) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [liking, setLiking] = useState(false);
    const [passing, setPassing] = useState(false);
    const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
    const photoUrl = profile.profilePicture || profile.photos?.[0] || "";

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (liking || passing) return;
        setLiking(true);
        onLike();
    };

    const handlePass = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (liking || passing) return;
        setPassing(true);
        onPass();
    };

    return (
        <motion.div
            className={`discover-card ${liking ? "card-liking" : ""} ${passing ? "card-passing" : ""}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={onViewProfile}
        >
            <div className="card-photo-wrap">
                {!imgLoaded && <div className="card-photo-placeholder">{initials}</div>}
                {photoUrl ? (
                    <img
                        src={photoUrl}
                        alt={profile.firstName}
                        className={`card-photo ${imgLoaded ? "loaded" : ""}`}
                        loading="lazy"
                        onLoad={() => setImgLoaded(true)}
                        onError={() => setImgLoaded(false)}
                    />
                ) : (
                    <div className="card-photo-placeholder">{initials}</div>
                )}

                {/* Gradient overlay */}
                <div className="card-gradient" />

                {/* Online badge */}
                {isOnline && (
                    <div className="card-online-badge">
                        <span className="card-online-dot" />
                        <span className="card-online-text">Online</span>
                    </div>
                )}

                {/* Card info */}
                <div className="card-info">
                    <div className="card-name-row">
                        <h3 className="card-name">
                            {profile.firstName}
                            {profile.age !== undefined && <span className="card-age">, {profile.age}</span>}
                        </h3>
                        {profile.isVerified && (
                            <span className="card-verified" title="Verified">✓</span>
                        )}
                    </div>
                    {profile.city && (
                        <p className="card-location">
                            <span className="card-icon">📍</span>
                            {profile.city}{profile.country ? `, ${profile.country}` : ""}
                            {profile.distance && <span className="card-distance"> · {profile.distance} km</span>}
                        </p>
                    )}
                    {profile.occupation && (
                        <p className="card-occupation">
                            <span className="card-icon">💼</span>
                            {profile.occupation}
                        </p>
                    )}
                </div>
            </div>

            {/* Action buttons */}
            <div className="card-actions">
                <motion.button
                    className="card-btn card-btn-pass"
                    onClick={handlePass}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    disabled={liking || passing}
                    aria-label="Pass"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </motion.button>
                <motion.button
                    className="card-btn card-btn-like"
                    onClick={handleLike}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    disabled={liking || passing}
                    aria-label="Like"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                </motion.button>
            </div>
        </motion.div>
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
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [availableFilters, setAvailableFilters] = useState<FiltersData | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const sentinelRef = useRef<HTMLDivElement>(null);

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

    // Infinite scroll
    useEffect(() => {
        if (!sentinelRef.current || !hasMore || loadingMore) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore) {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    loadProfiles(nextPage, true);
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [hasMore, loadingMore, page, loadProfiles]);

    const applyFilters = () => {
        setActiveFilters({ ...filters });
        setShowFilters(false);
    };

    const handleLike = async (profile: Profile) => {
        if (actionLoading) return;
        setAL("like");
        try {
            const res = await matchAPI.likeUser(profile._id);
            if (res?.isMatch) {
                setMatchModal(profile);
                toast("💕 It's a Match!", {
                    duration: 3000,
                    style: { background: "#ff4081", color: "#fff" },
                });
            }
            // Remove from grid
            setProfiles(prev => prev.filter(p => p._id !== profile._id));
        } catch (err: any) {
            const msg = err?.message || "Something went wrong";
            if (msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("429")) {
                toast("❤️ Daily like limit reached. Upgrade to Premium for unlimited likes!", {
                    duration: 5000,
                    style: { background: "#ff4081", color: "#fff" },
                });
            } else {
                toast.error(msg);
            }
        } finally {
            setAL(null);
        }
    };

    const handlePass = async (profile: Profile) => {
        if (actionLoading) return;
        setAL("pass");
        try {
            await matchAPI.passUser(profile._id);
            // Remove from grid
            setProfiles(prev => prev.filter(p => p._id !== profile._id));
        } catch (err: any) {
            toast.error(err?.message || "Something went wrong");
        } finally {
            setAL(null);
        }
    };

    return (
        <div className="page-wrapper">
            <AppNavbar />

            <div className="discover-page">
                {/* Header */}
                <div className="discover-header">
                    <div className="discover-header-left">
                        <h1 className="discover-title">Discover</h1>
                        <p className="discover-subtitle">People near you</p>
                        <p className="discover-description">Find and connect with amazing people</p>
                    </div>
                    <div className="discover-header-right">
                        <button
                            className={`discover-filter-btn ${showFilters ? "active" : ""}`}
                            onClick={() => setShowFilters(true)}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="4" y1="21" x2="4" y2="14" />
                                <line x1="4" y1="10" x2="4" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12" y2="3" />
                                <line x1="20" y1="21" x2="20" y2="16" />
                                <line x1="20" y1="12" x2="20" y2="3" />
                                <line x1="1" y1="14" x2="7" y2="14" />
                                <line x1="9" y1="8" x2="15" y2="8" />
                                <line x1="17" y1="16" x2="23" y2="16" />
                            </svg>
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="filter-count-badge">{activeFilterCount}</span>
                            )}
                        </button>
                        <div className="discover-view-toggle">
                            <button
                                className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                                onClick={() => setViewMode("grid")}
                                aria-label="Grid view"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7" />
                                    <rect x="14" y="3" width="7" height="7" />
                                    <rect x="3" y="14" width="7" height="7" />
                                    <rect x="14" y="14" width="7" height="7" />
                                </svg>
                            </button>
                            <button
                                className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
                                onClick={() => setViewMode("list")}
                                aria-label="List view"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="8" y1="6" x2="21" y2="6" />
                                    <line x1="8" y1="12" x2="21" y2="12" />
                                    <line x1="8" y1="18" x2="21" y2="18" />
                                    <line x1="3" y1="6" x2="3.01" y2="6" />
                                    <line x1="3" y1="12" x2="3.01" y2="12" />
                                    <line x1="3" y1="18" x2="3.01" y2="18" />
                                </svg>
                            </button>
                        </div>
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

                {/* Profile Grid */}
                <div className="discover-main">
                    {loading ? (
                        <div className="discover-grid">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <ProfileCardSkeleton key={i} />
                            ))}
                        </div>
                    ) : profiles.length === 0 ? (
                        <motion.div
                            className="empty-state discover-empty"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
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
                        </motion.div>
                    ) : (
                        <>
                            <div className={`discover-grid ${viewMode === "list" ? "discover-list" : ""}`}>
                                <AnimatePresence mode="popLayout">
                                    {profiles.map((profile, i) => (
                                        <ProfileCard
                                            key={profile._id}
                                            profile={profile}
                                            isOnline={onlineUsers.has(profile._id) || profile.isOnline || false}
                                            onLike={() => handleLike(profile)}
                                            onPass={() => handlePass(profile)}
                                            onViewProfile={() => navigate(`/profile/${profile._id}`)}
                                            index={i}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>

                            {/* Infinite scroll sentinel */}
                            <div ref={sentinelRef} className="scroll-sentinel" />

                            {/* Load more */}
                            {loadingMore && (
                                <div className="discover-loading-more">
                                    <div className="discover-grid mini-grid">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <ProfileCardSkeleton key={i} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Find More People CTA */}
                            {profiles.length > 0 && (
                                <motion.div
                                    className="find-more-section"
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5 }}
                                >
                                    <div className="find-more-content">
                                        <div className="find-more-left">
                                            <div className="find-more-icon">💕</div>
                                            <div className="find-more-text">
                                                <h3>Find more people</h3>
                                                <p>Keep swiping to discover more amazing people.</p>
                                            </div>
                                        </div>
                                        <button
                                            className="find-more-btn"
                                            onClick={() => { setPage(1); loadProfiles(1); }}
                                        >
                                            Discover People
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Tips Card */}
                            {profiles.length > 0 && (
                                <motion.div
                                    className="tips-section"
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: 0.1 }}
                                >
                                    <div className="tips-content">
                                        <div className="tips-left">
                                            <div className="tips-icon">💡</div>
                                            <div className="tips-text">
                                                <h3>Tips for better matches</h3>
                                                <p>Complete your profile, add more photos and be yourself to get better matches.</p>
                                            </div>
                                        </div>
                                        <button
                                            className="tips-btn"
                                            onClick={() => navigate("/profile/edit")}
                                        >
                                            Update Profile
                                        </button>
                                    </div>
                                </motion.div>
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