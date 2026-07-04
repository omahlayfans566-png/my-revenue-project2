import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { matchAPI } from "../services/apiService";
import { useSocket } from "../context/SocketContext";
import "../style/discover.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
    _id: string; firstName: string; lastName: string;
    profilePicture?: string; photos?: string[];
    age?: number; city?: string; country?: string; distance?: string | number;
    occupation?: string; aboutMe?: string;
    interests?: string[]; relationshipGoal?: string;
    education?: string; religion?: string;
    compatibilityScore?: number; isVerified?: boolean;
    isPremium?: boolean; memberSince?: string; lastLogin?: string;
}

type FeedTab = "for-you" | "new" | "active" | "nearby" | "online";

const TABS: { key: FeedTab; label: string; icon: string }[] = [
    { key: "for-you", label: "For You", icon: "✨" },
    { key: "new", label: "New", icon: "🆕" },
    { key: "active", label: "Active", icon: "🟢" },
    { key: "nearby", label: "Nearby", icon: "📍" },
    { key: "online", label: "Online", icon: "💫" },
];

// ─── Swipe card component ─────────────────────────────────────────────────────
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
                    <img src={photos[photoIdx]} alt={profile.firstName} />
                ) : (
                    <div className="swipe-photo-placeholder">{initials}</div>
                )}

                {/* Photo dots — bar style */}
                {photos.length > 1 && (
                    <div className="photo-dots">
                        {photos.map((_, i) => (
                            <span key={i} className={`photo-dot ${i === photoIdx ? "active" : ""}`}
                                onClick={e => { e.stopPropagation(); setPhotoIdx(i); }} />
                        ))}
                    </div>
                )}

                {/* Photo nav areas */}
                {photos.length > 1 && (
                    <>
                        <div className="photo-prev" onClick={e => { e.stopPropagation(); setPhotoIdx(i => Math.max(0, i - 1)); }} />
                        <div className="photo-next" onClick={e => { e.stopPropagation(); setPhotoIdx(i => Math.min(photos.length - 1, i + 1)); }} />
                    </>
                )}

                {/* Badges */}
                <div className="swipe-badges">
                    {profile.isVerified && <span className="badge-verified">✓ Verified</span>}
                    {isOnline && <span className="badge-online">Online</span>}
                    {profile.compatibilityScore && (
                        <span className="badge-compat">{profile.compatibilityScore}%</span>
                    )}
                    {profile.isPremium && <span className="badge-premium">✨ Premium</span>}
                </div>

                {/* LIKE / NOPE overlays */}
                {swipeDir === "right" && <div className="swipe-stamp stamp-like">LIKE</div>}
                {swipeDir === "left" && <div className="swipe-stamp stamp-nope">NOPE</div>}
                {swipeDir === "up" && <div className="swipe-stamp stamp-super">SUPER</div>}

                {/* Info overlay */}
                <div className="swipe-overlay">
                    <div className="swipe-overlay-top">
                        <div className="swipe-name-age">
                            <h2>{profile.firstName}, {profile.age ?? "?"}</h2>
                        </div>
                        {profile.distance && (
                            <span className="swipe-distance">📍 {profile.distance}</span>
                        )}
                    </div>
                    {(profile.city || profile.country) && (
                        <p className="swipe-location">📍 {[profile.city, profile.country].filter(Boolean).join(", ")}</p>
                    )}
                    {profile.occupation && <p className="swipe-occupation">💼 {profile.occupation}</p>}
                </div>
            </div>

            {/* Bio */}
            {profile.aboutMe && (
                <div className="swipe-bio">
                    <p>{profile.aboutMe.slice(0, 160)}{profile.aboutMe.length > 160 ? "…" : ""}</p>
                </div>
            )}

            {/* Interests — modern chips */}
            {profile.interests && profile.interests.length > 0 && (
                <div className="swipe-interests">
                    {profile.interests.slice(0, 6).map(i => (
                        <span key={i} className="swipe-tag">{i}</span>
                    ))}
                </div>
            )}

            {/* Details row */}
            <div className="swipe-details-row">
                {profile.education && <span>🎓 {profile.education.replace("_", " ")}</span>}
                {profile.religion && <span>🙏 {profile.religion}</span>}
                {profile.relationshipGoal && <span>💞 {profile.relationshipGoal}</span>}
            </div>

            {/* View profile */}
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

// ─── Match modal ──────────────────────────────────────────────────────────────
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

// ─── Main Discover page ───────────────────────────────────────────────────────
const Discover = () => {
    const navigate = useNavigate();
    const { onlineUsers } = useSocket();
    const [tab, setTab] = useState<FeedTab>("for-you");
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [index, setIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setAL] = useState<string | null>(null);
    const [matchModal, setMatchModal] = useState<Profile | null>(null);
    const [swipeDir, setSwipeDir] = useState<string | null>(null);
    const [newMatchBadge, setNewMatchBadge] = useState(false);
    const touchStart = useRef<{ x: number; y: number } | null>(null);

    const loadTab = useCallback(async (t: FeedTab) => {
        setLoading(true);
        setIndex(0);
        try {
            let data: Profile[] = [];
            if (t === "for-you") data = (await matchAPI.getSuggestions()).suggestions || [];
            else if (t === "new") data = (await matchAPI.getRecentlyJoined()).users || [];
            else if (t === "active") data = (await matchAPI.getRecentlyActive()).users || [];
            else if (t === "nearby") data = (await matchAPI.getNearby()).users || [];
            else if (t === "online") data = (await matchAPI.getOnline()).users || [];
            setProfiles(data);
        } catch {
            setProfiles([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTab(tab); }, [tab, loadTab]);

    const current = profiles[index];

    const doAction = async (dir: "right" | "left" | "up", action: () => Promise<any>) => {
        if (!current || actionLoading) return;
        setAL(dir); setSwipeDir(dir);
        try {
            const res = await action();
            if (res?.isMatch) {
                setMatchModal(current);
                setNewMatchBadge(true);
            }
        } catch { /* silent */ }
        setTimeout(() => { setSwipeDir(null); setAL(null); setIndex(i => i + 1); }, 450);
    };

    // Touch swipe support
    const onTouchStart = (e: React.TouchEvent) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart.current) return;
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = e.changedTouches[0].clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) doAction("right", () => matchAPI.likeUser(current._id));
            else doAction("left", () => matchAPI.passUser(current._id));
        } else if (dy < -80) {
            doAction("up", () => matchAPI.superLikeUser(current._id));
        }
    };

    const initials = (p: Profile) => `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase();

    return (
        <div className="page-wrapper">
            <AppNavbar />

            <div className="discover-page">
                {/* Feed tabs */}
                <div className="discover-tabs">
                    {TABS.map(t => (
                        <button key={t.key}
                            className={`discover-tab ${tab === t.key ? "active" : ""}`}
                            onClick={() => setTab(t.key)}>
                            <span>{t.icon}</span>
                            <span>{t.label}</span>
                            {t.key === "online" && onlineUsers.size > 0 && (
                                <span className="tab-online-count">{onlineUsers.size}</span>
                            )}
                        </button>
                    ))}
                </div>

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
                            <div className="empty-icon">
                                {tab === "online" ? "😴" : tab === "nearby" ? "🗺️" : "💫"}
                            </div>
                            <h3>
                                {tab === "online" ? "No one online right now"
                                    : tab === "nearby" ? "No one nearby yet"
                                        : "You've seen everyone!"}
                            </h3>
                            <p>
                                {tab === "for-you"
                                    ? "Check back later or update your preferences for better matches."
                                    : "Try a different tab or check back soon."}
                            </p>
                            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
                                <button className="btn btn-primary" onClick={() => loadTab(tab)}>Refresh</button>
                                <button className="btn btn-outline" onClick={() => navigate("/profile/edit")}>Edit Preferences</button>
                            </div>
                        </div>
                    ) : (
                        <SwipeCard
                            profile={current}
                            swipeDir={swipeDir}
                            isOnline={onlineUsers.has(current._id)}
                            onLike={() => doAction("right", () => matchAPI.likeUser(current._id))}
                            onSuperLike={() => doAction("up", () => matchAPI.superLikeUser(current._id))}
                            onPass={() => doAction("left", () => matchAPI.passUser(current._id))}
                            actionLoading={actionLoading}
                            navigate={navigate}
                        />
                    )}

                    {/* Progress dots */}
                    {!loading && profiles.length > 0 && (
                        <div className="swipe-progress">
                            {profiles.slice(0, Math.min(profiles.length, 8)).map((_, i) => (
                                <span key={i} className={`progress-dot ${i === index ? "active" : i < index ? "done" : ""}`} />
                            ))}
                            {profiles.length > 8 && <span className="progress-more">+{profiles.length - 8}</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Match modal */}
            {matchModal && (
                <MatchModal
                    profile={matchModal}
                    onClose={() => { setMatchModal(null); setNewMatchBadge(false); }}
                    onMessage={() => { setMatchModal(null); navigate(`/chat/${matchModal._id}`); }}
                />
            )}
        </div>
    );
};

export default Discover;