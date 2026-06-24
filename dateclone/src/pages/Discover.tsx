import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { matchAPI } from "../services/apiService";
import "../style/discover.css";

interface Suggestion {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    age?: number;
    city?: string;
    country?: string;
    occupation?: string;
    aboutMe?: string;
    interests?: string[];
    compatibilityScore?: number;
}

const Discover = () => {
    const navigate = useNavigate();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [index, setIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<"like" | "pass" | null>(null);
    const [matchModal, setMatchModal] = useState<Suggestion | null>(null);
    const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
    const [filterOpen, setFilterOpen] = useState(false);

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const fetchSuggestions = async () => {
        setLoading(true);
        try {
            const res = await matchAPI.getSuggestions();
            setSuggestions(res.suggestions || []);
            setIndex(0);
        } catch {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    };

    const current = suggestions[index];

    const handleLike = async () => {
        if (!current || actionLoading) return;
        setActionLoading("like");
        setSwipeDir("right");
        try {
            const res = await matchAPI.likeUser(current._id);
            if (res.match?.status === "matched") {
                setMatchModal(current);
            }
        } catch {
            /* silent */
        }
        setTimeout(() => {
            setSwipeDir(null);
            setActionLoading(null);
            setIndex((i) => i + 1);
        }, 400);
    };

    const handlePass = async () => {
        if (!current || actionLoading) return;
        setActionLoading("pass");
        setSwipeDir("left");
        try {
            await matchAPI.passUser(current._id);
        } catch {
            /* silent */
        }
        setTimeout(() => {
            setSwipeDir(null);
            setActionLoading(null);
            setIndex((i) => i + 1);
        }, 400);
    };

    const initials = (s: Suggestion) =>
        `${s.firstName?.[0] ?? ""}${s.lastName?.[0] ?? ""}`.toUpperCase();

    return (
        <div className="page-wrapper">
            <AppNavbar />

            <div className="discover-page">
                {/* Header */}
                <div className="discover-header">
                    <h1>Discover</h1>
                    <button className="discover-filter-btn" onClick={() => setFilterOpen(!filterOpen)}>
                        🔍 Filter
                    </button>
                </div>

                {/* Filter panel */}
                {filterOpen && (
                    <div className="discover-filter-panel">
                        <p className="filter-hint">Filters are based on your match preferences set during registration. Update them in <a href="/profile/edit">Edit Profile</a>.</p>
                    </div>
                )}

                {/* Main card area */}
                <div className="discover-main">
                    {loading ? (
                        <div className="discover-loading">
                            <div className="discover-spinner" />
                            <p>Finding matches for you…</p>
                        </div>
                    ) : !current ? (
                        <div className="empty-state">
                            <div className="empty-icon">💫</div>
                            <h3>You've seen everyone!</h3>
                            <p>Check back later for new profiles, or adjust your preferences.</p>
                            <button className="btn btn-primary" onClick={fetchSuggestions} style={{ marginTop: 20 }}>
                                Refresh
                            </button>
                        </div>
                    ) : (
                        <div className={`swipe-card ${swipeDir === "right" ? "swipe-right" : swipeDir === "left" ? "swipe-left" : ""}`}>
                            {/* Profile picture */}
                            <div className="swipe-photo">
                                {current.profilePicture ? (
                                    <img src={current.profilePicture} alt={current.firstName} />
                                ) : (
                                    <div className="swipe-photo-placeholder">{initials(current)}</div>
                                )}

                                {current.compatibilityScore && (
                                    <div className="swipe-compat">
                                        {current.compatibilityScore}% match
                                    </div>
                                )}

                                {/* Overlay info */}
                                <div className="swipe-overlay">
                                    <h2>
                                        {current.firstName}, {current.age ?? "?"}
                                    </h2>
                                    <p className="swipe-location">
                                        📍 {current.city ?? ""}{current.city && current.country ? ", " : ""}{current.country ?? ""}
                                    </p>
                                    {current.occupation && (
                                        <p className="swipe-occupation">💼 {current.occupation}</p>
                                    )}
                                </div>
                            </div>

                            {/* Bio */}
                            {current.aboutMe && (
                                <div className="swipe-bio">
                                    <p>{current.aboutMe.slice(0, 160)}{current.aboutMe.length > 160 ? "…" : ""}</p>
                                </div>
                            )}

                            {/* Interests */}
                            {current.interests && current.interests.length > 0 && (
                                <div className="swipe-interests">
                                    {current.interests.slice(0, 5).map((i) => (
                                        <span key={i} className="swipe-tag">{i}</span>
                                    ))}
                                </div>
                            )}

                            {/* View profile link */}
                            <button
                                className="swipe-view-btn"
                                onClick={() => navigate(`/profile/${current._id}`)}
                            >
                                View Full Profile
                            </button>

                            {/* Action buttons */}
                            <div className="swipe-actions">
                                <button
                                    className="action-btn action-pass"
                                    onClick={handlePass}
                                    disabled={!!actionLoading}
                                    aria-label="Pass"
                                >
                                    ✕
                                </button>
                                <button
                                    className="action-btn action-like"
                                    onClick={handleLike}
                                    disabled={!!actionLoading}
                                    aria-label="Like"
                                >
                                    ❤️
                                </button>
                            </div>

                            {/* Stack peek */}
                            <p className="swipe-counter">
                                {index + 1} / {suggestions.length}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Match modal */}
            {matchModal && (
                <div className="match-modal-overlay" onClick={() => setMatchModal(null)}>
                    <div className="match-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="match-modal-confetti">🎉</div>
                        <h2>It's a Match!</h2>
                        <p>You and <strong>{matchModal.firstName}</strong> liked each other.</p>
                        <div className="match-modal-avatars">
                            {matchModal.profilePicture ? (
                                <img src={matchModal.profilePicture} alt="" className="match-avatar" />
                            ) : (
                                <div className="match-avatar match-avatar-placeholder">{initials(matchModal)}</div>
                            )}
                        </div>
                        <div className="match-modal-actions">
                            <button className="btn btn-primary" onClick={() => { setMatchModal(null); navigate("/chat"); }}>
                                💬 Send Message
                            </button>
                            <button className="btn btn-outline" onClick={() => setMatchModal(null)}>
                                Keep Swiping
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Discover;
