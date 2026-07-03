import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { profileAPI, matchAPI } from "../services/apiService";
import "../style/profile.css";

const ViewProfile = () => {
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState("");

    useEffect(() => {
        if (!userId) return;
        profileAPI.getProfile(userId)
            .then((r) => setProfile(r.user))
            .catch(() => setProfile(null))
            .finally(() => setLoading(false));
    }, [userId]);

    const handleLike = async () => {
        try {
            const res = await matchAPI.likeUser(userId!);
            setActionMsg(res.isMatch ? "💞 It's a match!" : "❤️ Liked!");
        } catch (e: any) { setActionMsg(e.message || "Failed to like."); }
    };

    const handleSuperLike = async () => {
        try {
            const res = await matchAPI.superLikeUser(userId!);
            setActionMsg(res.isMatch ? "💞 It's a match!" : "⭐ Super Liked!");
        } catch (e: any) { setActionMsg(e.message || "Failed to super like."); }
    };

    const handleBlock = async () => {
        if (!confirm("Block this user?")) return;
        try {
            await matchAPI.blockUser(userId!);
            setActionMsg("User blocked.");
        } catch (e: any) { setActionMsg(e.message); }
    };

    const handleReport = async () => {
        const reason = prompt("Reason for report (harassment, fake profile, inappropriate content, etc.):");
        if (reason === null) return;
        try {
            await profileAPI.reportUser(userId!, reason || "unspecified");
            setActionMsg("✅ Report submitted. Our team will review it.");
        } catch (e: any) { setActionMsg(e.message); }
    };

    if (loading) return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="discover-loading" style={{ padding: "80px 0", textAlign: "center" }}>
                <div className="discover-spinner" style={{ margin: "0 auto 16px" }} />
            </div>
        </div>
    );

    if (!profile) return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="empty-state" style={{ padding: "80px 24px" }}>
                <div className="empty-icon">🔍</div>
                <h3>Profile not found</h3>
                <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
            </div>
        </div>
    );

    const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();

    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="profile-page">
                <div className="profile-hero">
                    <div className="profile-hero-bg" />
                    <div className="profile-avatar-wrap">
                        {profile.profilePicture ? (
                            <img src={profile.profilePicture} alt="Profile" className="profile-avatar" />
                        ) : (
                            <div className="profile-avatar profile-avatar-placeholder">{initials}</div>
                        )}
                        {profile.isPremium && (
                            <div className="profile-premium-badge">✨ {profile.premiumTier?.toUpperCase()}</div>
                        )}
                    </div>
                    <div className="profile-hero-info">
                        <h1>{profile.firstName} {profile.lastName}</h1>
                        {profile.age && <p className="profile-username">{profile.age} years old</p>}
                    </div>
                </div>

                {actionMsg && (
                    <div className="profile-action-msg">{actionMsg}</div>
                )}

                <div className="profile-actions">
                    <button className="btn btn-primary" onClick={handleLike}>❤️ Like</button>
                    <button className="btn" style={{ background: "linear-gradient(135deg,#1565c0,#42a5f5)", color: "white", boxShadow: "0 6px 20px rgba(21,101,192,0.3)" }} onClick={handleSuperLike}>⭐ Super Like</button>
                    <button className="btn btn-outline" onClick={() => navigate(`/chat/${userId}`)}>💬 Message</button>
                    <button className="btn btn-ghost" onClick={handleBlock}>🚫 Block</button>
                    <button className="btn btn-ghost" onClick={handleReport} style={{ color: "#e53935" }}>🚩 Report</button>
                </div>

                <div className="profile-stats">
                    <div className="profile-stat"><span className="stat-val">📍</span><span className="stat-label">{[profile.city, profile.country].filter(Boolean).join(", ") || "—"}</span></div>
                    <div className="profile-stat"><span className="stat-val">💼</span><span className="stat-label">{profile.occupation || "—"}</span></div>
                    <div className="profile-stat"><span className="stat-val">🎓</span><span className="stat-label">{profile.education || "—"}</span></div>
                </div>

                <div className="profile-body">
                    {profile.aboutMe && (
                        <div className="profile-section">
                            <h2>About</h2>
                            <p>{profile.aboutMe}</p>
                        </div>
                    )}

                    <div className="profile-section">
                        <h2>Details</h2>
                        <div className="profile-details-grid">
                            <div className="profile-detail"><span>🙏</span><span>{profile.religion || "—"}</span></div>
                            <div className="profile-detail"><span>💞</span><span>{profile.relationshipGoal || "—"}</span></div>
                            <div className="profile-detail"><span>👶</span><span>Has children: {profile.hasChildren || "—"}</span></div>
                            <div className="profile-detail"><span>🚬</span><span>Smoking: {profile.smoking || "—"}</span></div>
                            <div className="profile-detail"><span>🍺</span><span>Drinking: {profile.drinking || "—"}</span></div>
                            <div className="profile-detail"><span>🌍</span><span>Looking for: {profile.lookingFor || "—"}</span></div>
                        </div>
                    </div>

                    {profile.interests?.length > 0 && (
                        <div className="profile-section">
                            <h2>Interests</h2>
                            <div className="profile-interests">
                                {profile.interests.map((i: string) => (
                                    <span key={i} className="profile-interest-tag">{i}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {profile.languages?.length > 0 && (
                        <div className="profile-section">
                            <h2>Languages</h2>
                            <div className="profile-interests">
                                {profile.languages.map((l: string) => (
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

export default ViewProfile;
