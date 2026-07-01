import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { notificationAPI } from "../services/apiService";
import { useSocket } from "../context/SocketContext";
import "../style/appNavbar.css";

const AppNavbar = ({ unreadMessages = 0 }: { unreadMessages?: number }) => {
    const { user, logout } = useAuth();
    const { socket } = useSocket();
    const location = useLocation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    const isActive = (path: string) => location.pathname.startsWith(path);

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    // Load unread notification count
    useEffect(() => {
        if (!user) return;
        notificationAPI.getUnreadCount()
            .then(res => setUnreadNotifications(res.count || 0))
            .catch(() => {});
    }, [user]);

    // Listen for real-time notification count updates
    useEffect(() => {
        if (!socket) return;
        const onUnreadCount = ({ count }: { count: number }) => setUnreadNotifications(count);
        socket.on("unread_notification_count", onUnreadCount);
        return () => { socket.off("unread_notification_count", onUnreadCount); };
    }, [socket]);

    const initials = user
        ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
        : "?";

    return (
        <nav className="app-navbar">
            <div className="app-navbar-inner">
                {/* Logo */}
                <Link to="/discover" className="app-nav-logo">
                    DateClone <span>💕</span>
                </Link>

                {/* Desktop nav links */}
                <ul className="app-nav-links">
                    <li>
                        <Link to="/discover" className={isActive("/discover") ? "active" : ""}>
                            <span className="nav-icon">🔥</span> Discover
                        </Link>
                    </li>
                    <li>
                        <Link to="/matches" className={isActive("/matches") ? "active" : ""}>
                            <span className="nav-icon">💞</span> Matches
                        </Link>
                    </li>
                    <li>
                        <Link to="/chat" className={isActive("/chat") ? "active" : ""}>
                            <span className="nav-icon">💬</span> Messages
                        </Link>
                    </li>
                    <li>
                        <Link to="/notifications" className={isActive("/notifications") ? "active" : ""}>
                            <span className="nav-icon">🔔</span> Notifications
                            {unreadNotifications > 0 && (
                                <span className="nav-badge">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>
                            )}
                        </Link>
                    </li>
                </ul>

                {/* Right side */}
                <div className="app-nav-right">
                    {user && !user.isPremium && (
                        <Link to="/premium" className="app-nav-upgrade">
                            ✨ Go Premium
                        </Link>
                    )}

                    {/* Profile dropdown */}
                    <div className="app-nav-profile" onClick={() => setProfileOpen(!profileOpen)}>
                        {user?.profilePicture ? (
                            <img src={user.profilePicture} alt="Profile" className="avatar avatar-sm nav-avatar" />
                        ) : (
                            <div className="avatar avatar-sm nav-avatar">{initials}</div>
                        )}
                        <span className="nav-name">{user?.firstName}</span>
                        <span className="nav-chevron">{profileOpen ? "▲" : "▼"}</span>

                        {profileOpen && (
                            <div className="app-nav-dropdown">
                                <Link to="/profile" onClick={() => setProfileOpen(false)}>👤 My Profile</Link>
                                <Link to="/profile/edit" onClick={() => setProfileOpen(false)}>✏️ Edit Profile</Link>
                                <Link to="/settings" onClick={() => setProfileOpen(false)}>⚙️ Settings</Link>
                                <Link to="/premium" onClick={() => setProfileOpen(false)}>✨ Premium</Link>
                                <div className="dropdown-divider" />
                                <button onClick={handleLogout} className="dropdown-logout">
                                    🚪 Log Out
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Mobile hamburger */}
                    <button
                        className={`app-hamburger ${menuOpen ? "open" : ""}`}
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span /><span /><span />
                    </button>
                </div>
            </div>

            {/* Mobile menu */}
            {menuOpen && (
                <div className="app-mobile-menu">
                    <Link to="/discover" onClick={() => setMenuOpen(false)}>🔥 Discover</Link>
                    <Link to="/matches" onClick={() => setMenuOpen(false)}>💞 Matches</Link>
                    <Link to="/chat" onClick={() => setMenuOpen(false)}>💬 Messages</Link>
                    <Link to="/notifications" onClick={() => setMenuOpen(false)}>
                        🔔 Notifications
                        {unreadNotifications > 0 && (
                            <span className="nav-badge-mobile">{unreadNotifications}</span>
                        )}
                    </Link>
                    <Link to="/profile" onClick={() => setMenuOpen(false)}>👤 My Profile</Link>
                    <Link to="/profile/edit" onClick={() => setMenuOpen(false)}>✏️ Edit Profile</Link>
                    <Link to="/settings" onClick={() => setMenuOpen(false)}>⚙️ Settings</Link>
                    <Link to="/premium" onClick={() => setMenuOpen(false)}>✨ Premium</Link>
                    <button onClick={handleLogout} className="mobile-logout">🚪 Log Out</button>
                </div>
            )}

            {/* Bottom mobile nav (always visible on mobile when authenticated) */}
            <div className="app-bottom-nav">
                <Link to="/discover" className={isActive("/discover") ? "active" : ""}>
                    <span>🔥</span><span>Discover</span>
                </Link>
                <Link to="/matches" className={isActive("/matches") ? "active" : ""}>
                    <span>💞</span><span>Matches</span>
                </Link>
                <Link to="/chat" className={isActive("/chat") ? "active" : ""}>
                    <span>💬</span><span>Chat</span>
                </Link>
                <Link to="/notifications" className={isActive("/notifications") ? "active" : ""}>
                    <span>🔔</span><span>Alerts</span>
                    {unreadNotifications > 0 && (
                        <span className="bottom-nav-badge">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>
                    )}
                </Link>
                <Link to="/profile" className={isActive("/profile") ? "active" : ""}>
                    <span>👤</span><span>Profile</span>
                </Link>
            </div>
        </nav>
    );
};

export default AppNavbar;
