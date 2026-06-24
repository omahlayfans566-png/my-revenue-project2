import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { useAuth } from "../context/AuthContext";
import "../style/settings.css";

const Settings = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState({ matches: true, messages: true, likes: true, visits: false });
    const [privacy, setPrivacy] = useState({ showOnline: true, showLocation: true, profileVisible: true });
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const handleDelete = () => {
        if (confirm("Are you sure you want to delete your account? This cannot be undone.")) {
            alert("Account deletion would be processed here. Contact support for now.");
        }
    };

    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="settings-page">
                <div className="settings-card">
                    <div className="settings-header">
                        <button className="ep-back" onClick={() => navigate("/profile")}>← Back</button>
                        <h1>Settings</h1>
                    </div>

                    {saved && <div className="ep-success">Settings saved! ✓</div>}

                    {/* Account */}
                    <div className="settings-section">
                        <h2>Account</h2>
                        <div className="settings-row">
                            <div>
                                <p className="sr-title">Email Address</p>
                                <p className="sr-sub">{user?.email ?? "—"}</p>
                            </div>
                        </div>
                        <div className="settings-row">
                            <div>
                                <p className="sr-title">Edit Profile</p>
                                <p className="sr-sub">Update your photos, bio and preferences</p>
                            </div>
                            <button className="settings-action-btn" onClick={() => navigate("/profile/edit")}>Edit →</button>
                        </div>
                        <div className="settings-row">
                            <div>
                                <p className="sr-title">Premium Membership</p>
                                <p className="sr-sub">{user?.isPremium ? `Active — ${user.premiumTier}` : "Free plan"}</p>
                            </div>
                            <button className="settings-action-btn" onClick={() => navigate("/premium")}>{user?.isPremium ? "Manage" : "Upgrade →"}</button>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="settings-section">
                        <h2>Notifications</h2>
                        {Object.entries(notifications).map(([key, val]) => (
                            <div key={key} className="settings-row">
                                <div>
                                    <p className="sr-title">{key.charAt(0).toUpperCase() + key.slice(1)}</p>
                                    <p className="sr-sub">Receive {key} notifications</p>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={val} onChange={() => setNotifications({ ...notifications, [key]: !val })} />
                                    <span className="toggle-slider" />
                                </label>
                            </div>
                        ))}
                    </div>

                    {/* Privacy */}
                    <div className="settings-section">
                        <h2>Privacy & Safety</h2>
                        {Object.entries(privacy).map(([key, val]) => (
                            <div key={key} className="settings-row">
                                <div>
                                    <p className="sr-title">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={val} onChange={() => setPrivacy({ ...privacy, [key]: !val })} />
                                    <span className="toggle-slider" />
                                </label>
                            </div>
                        ))}
                    </div>

                    {/* Save */}
                    <button className="btn btn-primary settings-save" onClick={handleSave}>Save Settings</button>

                    {/* Danger zone */}
                    <div className="settings-section settings-danger">
                        <h2>Danger Zone</h2>
                        <div className="settings-row">
                            <div>
                                <p className="sr-title">Log Out</p>
                                <p className="sr-sub">Sign out of your account</p>
                            </div>
                            <button className="danger-btn" onClick={handleLogout}>Log Out</button>
                        </div>
                        <div className="settings-row">
                            <div>
                                <p className="sr-title">Delete Account</p>
                                <p className="sr-sub">Permanently delete your account and data</p>
                            </div>
                            <button className="danger-btn" onClick={handleDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
