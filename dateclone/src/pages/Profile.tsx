import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { useAuth } from "../context/AuthContext";
import PremiumBadge from "../component/PremiumBadge";
import "../style/profile.css";

// Calculate profile completeness percentage
const calcCompleteness = (user: any): number => {
    const fields = [
        user.profilePicture,
        user.aboutMe,
        user.age,
        user.city,
        user.occupation,
        user.education,
        user.religion,
        user.relationshipGoal,
        user.interests?.length > 0,
        user.photos?.length > 0,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
};

const Profile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    if (!user) return null;

    const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
    const u = user as any;
    const completeness = calcCompleteness(u);
    const photos: string[] = u.photos || [];

    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="profile-page">

                {/* Hero banner */}
                <div className="profile-hero">
                    <div className="profile-hero-bg" />
                    <div className="profile-avatar-wrap">
                        {user.profilePicture ? (
                            <img src={user.profilePicture} alt="Profile" className="profile-avatar" />
                        ) : (
                            <div className="profile-avatar profile-avatar-placeholder">{initials}</div>
                        )}
                        {user.isPremium && (
                            <div className="profile-premium-badge">
                                <PremiumBadge tier={u.premiumTier} size="lg" />
                            </div>
                        )}
                    </div>
                    <div className="profile-hero-info">
                        <h1>{user.firstName} {user.lastName}</h1>
                        {u.age && <p className="profile-username">{u.age} years old{u.city ? ` · ${u.city}` : ""}</p>}
                    </div>
                </div>

                {/* Profile completeness bar */}
                {completeness < 100 && (
                    <div className="profile-completeness">
                        <div className="completeness-header">
                            <span>Profile Completeness</span>
                            <span className="completeness-pct">{completeness}%</span>
                        </div>
                        <div className="completeness-bar">
                            <div
                                className="completeness-fill"
                                style={{ width: `${completeness}%` }}
                            />
                        </div>
                        {completeness < 80 && (
                            <p className="completeness-hint">
                                Complete your profile to get 3× more matches!
                            </p>
                        )}
                    </div>
                )}

                {/* Action buttons */}
                <div className="profile-actions">
                    <button className="btn btn-primary" onClick={() => navigate("/profile/edit")}>
                        ✏️ Edit Profile
                    </button>
                    <button className="btn btn-outline" onClick={() => navigate("/settings")}>
                        ⚙️ Settings
                    </button>
                    {!user.isPremium && (
                        <button
                            className="btn"
                            style={{ background: "linear-gradient(135deg,#f57f17,#fbc02d)", color: "white", boxShadow: "0 6px 20px rgba(245,127,23,0.35)" }}
                            onClick={() => navigate("/premium")}
                        >
                            ✨ Go Premium
                        </button>
                    )}
                </div>

                {/* Stats */}
                <div className="profile-stats">
                    <div className="profile-stat">
                        <span className="stat-val">0</span>
                        <span className="stat-label">Matches</span>
                    </div>
                    <div className="profile-stat">
                        <span className="stat-val">0</span>
                        <span className="stat-label">Likes</span>
                    </div>
                    <div className="profile-stat">
                        <span className="stat-val">{completeness}%</span>
                        <span className="stat-label">Complete</span>
                    </div>
                </div>

                {/* Info sections */}
                <div className="profile-body">

                    {/* About */}
                    <div className="profile-section">
                        <h2>About Me</h2>
                        <p>{u.aboutMe || "No bio yet. Edit your profile to add one."}</p>
                    </div>

                    {/* Details */}
                    <div className="profile-section">
                        <h2>Details</h2>
                        <div className="profile-details-grid">
                            <div className="profile-detail">
                                <span>🎂</span>
                                <span>{u.age ? `${u.age} years old` : "—"}</span>
                            </div>
                            <div className="profile-detail">
                                <span>📍</span>
                                <span>{[u.city, u.country].filter(Boolean).join(", ") || "—"}</span>
                            </div>
                            <div className="profile-detail">
                                <span>💼</span>
                                <span>{u.occupation || "—"}</span>
                            </div>
                            <div className="profile-detail">
                                <span>🎓</span>
                                <span>{u.education || "—"}</span>
                            </div>
                            <div className="profile-detail">
                                <span>🙏</span>
                                <span>{u.religion || "—"}</span>
                            </div>
                            <div className="profile-detail">
                                <span>💞</span>
                                <span>{u.relationshipGoal || "—"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Photos gallery */}
                    {photos.length > 0 && (
                        <div className="profile-section">
                            <h2>Photos</h2>
                            <div className="profile-photo-grid">
                                {photos.map((url: string, i: number) => (
                                    <div key={i} className="profile-photo-item">
                                        <img src={url} alt={`Photo ${i + 1}`} />
                                    </div>
                                ))}
                                <button
                                    className="profile-photo-add"
                                    onClick={() => navigate("/profile/edit")}
                                    title="Add photo"
                                >
                                    + Add
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Interests */}
                    {u.interests?.length > 0 && (
                        <div className="profile-section">
                            <h2>Interests</h2>
                            <div className="profile-interests">
                                {(u.interests as string[]).map((tag) => (
                                    <span key={tag} className="profile-interest-tag">{tag}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Languages */}
                    {u.languages?.length > 0 && (
                        <div className="profile-section">
                            <h2>Languages</h2>
                            <div className="profile-interests">
                                {(u.languages as string[]).map((l) => (
                                    <span key={l} className="profile-interest-tag">{l}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;
