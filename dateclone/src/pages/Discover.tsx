import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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

// ─── Swipe Card Component ─────────────────────────────────────────────────────
const SwipeCard = ({
    profile, swipeDir, onLike, onSuperLike, onPass, actionLoading, navigate, isOnline,
}: {
    profile: Profile; swipeDir: string | null;
    onLike: () => void; onSuperLike: () => void; onPass: () => void;
    actionLoading: string | null; navigate: (p: string) => void; isOnline: boolean;
}) => {
    const [photoIdx, setPhotoIdx] = useState(0);
    const photos = [profile.profilePicture, ...(profile.photos || [])].filter(Boolean) as string[];
    const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();

    return (
        <div className={`swipe-card ${swipeDir === "right" ? "swipe-right" : swipeDir === "left" ? "swipe-left" : swipeDir === "up" ? "swipe-up" : ""}`}>

            {/* Photo area */}
            <div className="swipe-photo" onClick={() => navigate(`/profile/${profile._id}`)}>
                {photos.length > 0 ? (
                    <img src={photos[photoIdx]} alt={profile.firstName} loading="lazy" />
                ) : (
                    <div className="swipe-photo-placeholder">{initials}</div>
                )}

                {/* Photo navigation bars */}
                {photos.length > 1 && (
                    <>
                        <div className="photo-dots">
                            {photos.map((_, i) => (
                                <span key={i} className={`photo-dot ${i === photoIdx ? "active" : ""}`}
                                    onClick={e => { e.stopPropagation(); setPhotoIdx(i); }} />
                            ))}
                        </div>
                        <div className="photo-prev" onClick={e => { e.stopPropagation(); setPhotoIdx(i => Math.max(0, i - 1)); }} />
                        <div className="photo-next" onClick={e => { e.stopPropagation(); setPhotoIdx(i => Math.min(photos.length - 1, i + 1)); }} />
                    </>
                )}

                {/* Badges */}
                <div className="swipe-badges">
                    {profile.isVerified && <span className="badge-verified">✓ Verified</span>}
                    {isOnline && <span className="badge-online">● Online</span>}
                    {profile.compatibilityScore && profile.compatibilityScore > 0 && (
                        <span className="badge-compat">{profile.compatibilityScore}% Match</span>
                    )}
                    {profile.isPremium && <span className="badge-premium">✨ Premium</span>}
                    {profile.distance && <span className="badge-distance">{profile.distance} km</span>}
                </div>

                {/* Swipe stamps */}
                {swipeDir === "right" && <div className="swipe-stamp stamp-like">LIKE</div>}
                {swipeDir === "left" && <div className="swipe-stamp stamp-nope">NOPE</div>}
                {swipeDir === "up" && <div className="swipe-stamp stamp-super">SUPER</div>}

                {/* Info overlay */}
                <div className="swipe-overlay">
                    <div className="swipe-overlay-top">
                        <div className="swipe-name-age">
                            <h2>{profile.firstName}, {profile.age ?? "?"}</h2>
                            {profile.isOnline && <span className="online-indicator-dot" />}
                        </div>
                    </div>
                    {(profile.city || profile.country) && (
                        <p className="swipe-location">
                            📍 {[profile.city, profile.country].filter(Boolean).join(", ")}
                            {profile.distance && <span className="swipe-distance"> · {profile.distance} km</span>}
                        </p>
                    )}
                    {profile.occupation && <p className="swipe-occupation">💼 {profile.occupation}</p>}
                </div>
            </div>

            {/* Bio */}
            {profile.aboutMe && (
                <div className="swipe-bio">
                    <p>"{profile.aboutMe.slice(0, 200)}{profile.aboutMe.length > 200 ? "…" : ""}"</p>
                </div>
            )}

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
                <div className="swipe-interests">
                    {profile.interests.slice(0, 8).map(i => (
                        <span key={i} className="swipe-tag">{i}</span>
                    ))}
                </div>
            )}

            {/* Details row */}
            <div className="swipe-details-row">
                {profile.education && <span>🎓 {profile.education.replace("_", " ")}</span>}
                {profile.religion && <span>🙏 {profile.religion}</span>}
                {profile.relationshipGoal && <span>💞 {profile.relationshipGoal.replace("_", " ")}</span>}
            </div>

            {/* View full profile */}
            <button className="swipe-view-btn" onClick={() => navigate(`/profile/${profile._id}`)}>
                View Full Profile →
            </button>

            {/* Action buttons */}
            <div className="swipe-actions">
                <button className="action-btn action-pass"
                    onClick={onPass} disabled={!!actionLoading} aria-label="Pass" title="Pass">
                    <span>✕</span>
                </button>
                <button className="action-btn action-superlike"
                    onClick={onSuperLike} disabled={!!actionLoading} aria-label="Super Like" title="Super Like">
                    <span>⭐</span>
                </button>
                <button className="action-btn action-like"
                    onClick={onLike} disabled={!!actionLoading} aria-label="Like" title="Like">
                    <span>❤️</span>
                </button>
            </div>

            <p className="swipe-hint">← Pass &nbsp;|&nbsp; ⭐ Super Like &nbsp;|&nbsp; ❤️ Like →</p>
        </div>
    );
};

// ─── Match Modal ──────────────────────────────────────────────────────────────
const MatchModal = ({ profile, onClose, onMessage }: {
    profile: Profile; onClose: () => void; onMessage: () => void;
}) => {
    const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
    return (
        <div className="match-modal-overlay" onClick={onClose}>
            <div className="match-modal" onClick={e => e.stopPropagation()}>
                <div className="match-confetti">
                    {["🎉", "💕", "✨", "💖", "🌟"].map((e, i) => (
                        <span key={i} className="confetti-piece" style={{ animationDelay: `${i * 0.1}s` }}>{e}</span>
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
            </div>
        </div>
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
                    {/* Distance */}
                    <div className="filter-group">
                        <label>Distance</label>
                        <select value={filters.distance} onChange={e => update("distance", e.target.value)}>
                            <option value="">Anywhere</option>
                            {(availableFilters?.distanceOptions || []).map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Age Range */}
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

                    {/* Gender */}
                    <div className="filter-group">
                        <label>Gender</label>
                        <select value={filters.gender} onChange={e => update("gender", e.target.value)}>
                            <option value="">Any</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    {/* Looking For */}
                    <div className="filter-group">
                        <label>Looking For</label>
                        <select value={filters.lookingFor} onChange={e => update("lookingFor", e.target.value)}>
                            <option value="">Any</option>
                            <option value="men">Men</option>
                            <option value="women">Women</option>
                            <option value="both">Both</option>
                        </select>
                    </div>

                    {/* Status filters */}
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

                    {/* Relationship Goal */}
                    <div className="filter-group">
                        <label>Relationship Goal</label>
                        <select value={filters.relationshipGoal} onChange={e => update("relationshipGoal", e.target.value)}>
                            <option value="">Any</option>
                            {(availableFilters?.relationshipGoals || []).map(g => (
                                <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
                            ))}
                        </select>
                    </div>

                    {/* Religion */}
                    <div className="filter-group">
                        <label>Religion</label>
                        <select value={filters.religion} onChange={e => update("religion", e.target.value)}>
                            <option value="">Any</option>
                            {(availableFilters?.religions || []).map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    {/* Interests */}
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
    const [swipeDir, setSwipeDir] = useState<string | null>(null);
    const [index, setIndex] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [availableFilters, setAvailableFilters] = useState<FiltersData | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const touchStart = useRef<{ x: number; y: number } | null>(null);

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
        if (!current || actionLoading) return;
        setAL(dir); setSwipeDir(dir);
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
            // Capture the error message from the server
            errorMsg = err?.message || "Something went wrong";
            // 429 = daily like limit reached — surface it clearly
            // Other errors are also surfaced so users know what happened
            console.error("[Like/Pass/SuperLike error]", err);
        }
        setTimeout(() => {
            setSwipeDir(null); setAL(null);
            // Only advance the card if the action succeeded (no error)
            if (!errorMsg) {
                setIndex(i => i + 1);
                // Load more when reaching end
                if (index >= profiles.length - 3 && hasMore && !loadingMore) {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    loadProfiles(nextPage, true);
                }
            } else {
                // Show the actual server error as a toast
                // Rate limit gets a special message
                if (errorMsg!.toLowerCase().includes("limit") || errorMsg!.toLowerCase().includes("429")) {
                    toast("❤️ Daily like limit reached. Upgrade to Premium for unlimited likes!", {
                        duration: 5000,
                        style: { background: "#ff4081", color: "#fff" },
                    });
                } else {
                    toast.error(errorMsg!);
                }
            }
        }, 450);
    };

    // Touch swipe
    const onTouchStart = (e: React.TouchEvent) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart.current) return;
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = e.changedTouches[0].clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) doAction("right", () => matchAPI.likeUser(current!._id));
            else doAction("left", () => matchAPI.passUser(current!._id));
        } else if (dy < -80) {
            doAction("up", () => matchAPI.superLikeUser(current!._id));
        }
    };

    // Keyboard support
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!current || actionLoading) return;
            if (e.key === "ArrowRight") doAction("right", () => matchAPI.likeUser(current!._id));
            if (e.key === "ArrowLeft") doAction("left", () => matchAPI.passUser(current!._id));
            if (e.key === "ArrowUp") doAction("up", () => matchAPI.superLikeUser(current!._id));
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [current, actionLoading]);

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
                <div className="discover-main"
                    onTouchStart={onTouchStart}
                    onTouchEnd={onTouchEnd}>

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
                            <SwipeCard
                                profile={current}
                                swipeDir={swipeDir}
                                isOnline={onlineUsers.has(current._id) || current.isOnline || false}
                                onLike={() => doAction("right", () => matchAPI.likeUser(current._id))}
                                onSuperLike={() => doAction("up", () => matchAPI.superLikeUser(current._id))}
                                onPass={() => doAction("left", () => matchAPI.passUser(current._id))}
                                actionLoading={actionLoading}
                                navigate={navigate}
                            />

                            {/* Progress dots */}
                            <div className="swipe-progress">
                                {profiles.slice(0, Math.min(profiles.length, 10)).map((_, i) => (
                                    <span key={i} className={`progress-dot ${i === index ? "active" : i < index ? "done" : ""}`} />
                                ))}
                                {profiles.length > 10 && <span className="progress-more">+{profiles.length - 10}</span>}
                            </div>

                            {/* Load more indicator */}
                            {loadingMore && (
                                <div className="discover-loading-more">
                                    <div className="discover-spinner" style={{ width: 24, height: 24 }} />
                                    <p>Loading more…</p>
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