import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { useAuth } from "../context/AuthContext";
import "../style/profile.css";

const Profile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    if (!user) return null;

    const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();

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
                            <div className="profile-premium-badge">✨ {user.premiumTier?.toUpperCase()}</div>
                        )}
                    </div>
                    <div className="profile-hero-info">
                        <h1>{user.firstName} {user.lastName}</h1>
                        <p className="profile-username">@{(user as any).username ?? ""}</p>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="profile-actions">
                    <button className="btn btn-primary" onClick={() => navigate("/profile/edit")}>
                        ✏️ Edit Profile
                    </button>
                    <button className="btn btn-outline" onClick={() => navigate("/settings")}>
                        ⚙️ Settings
                    </button>
                    {!user.isPremium && (
                        <button className="btn" style={{ background: "linear-gradient(135deg,#f57f17,#fbc02d)", color: "white" }} onClick={() => navigate("/premium")}>
                            ✨ Go Premium
                        </button>
                    )}
                </div>

                {/* Stats */}
                <div className="profile-stats">
                    <div className="profile-stat"><span className="stat-val">0</span><span className="stat-label">Matches</span></div>
                    <div className="profile-stat"><span className="stat-val">0</span><span className="stat-label">Likes</span></div>
                    <div className="profile-stat"><span className="stat-val">100%</span><span className="stat-label">Complete</span></div>
                </div>

                {/* Info sections */}
                <div className="profile-body">
                    <div className="profile-section">
                        <h2>About Me</h2>
                        <p>{(user as any).aboutMe || "No bio yet. Edit your profile to add one."}</p>
                    </div>

                    <div className="profile-section">
                        <h2>Details</h2>
                        <div className="profile-details-grid">
                            <div className="profile-detail"><span>🎂</span><span>{(user as any).age ? `${(user as any).age} years old` : "—"}</span></div>
                            <div className="profile-detail"><span>📍</span><span>{[(user as any).city, (user as any).country].filter(Boolean).join(", ") || "—"}</span></div>
                            <div className="profile-detail"><span>💼</span><span>{(user as any).occupation || "—"}</span></div>
                            <div className="profile-detail"><span>🎓</span><span>{(user as any).education || "—"}</span></div>
                            <div className="profile-detail"><span>🙏</span><span>{(user as any).religion || "—"}</span></div>
                            <div className="profile-detail"><span>💞</span><span>{(user as any).relationshipGoal || "—"}</span></div>
                        </div>
                    </div>

                    {(user as any).interests?.length > 0 && (
                        <div className="profile-section">
                            <h2>Interests</h2>
                            <div className="profile-interests">
                                {((user as any).interests as string[]).map((i) => (
                                    <span key={i} className="profile-interest-tag">{i}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {(user as any).languages?.length > 0 && (
                        <div className="profile-section">
                            <h2>Languages</h2>
                            <div className="profile-interests">
                                {((user as any).languages as string[]).map((l) => (
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
