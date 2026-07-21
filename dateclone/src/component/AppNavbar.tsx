import { useState, useEffect, useCallback, memo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { notificationAPI } from "../services/apiService";
import { useSocket } from "../context/SocketContext";
import PremiumBadge from "./PremiumBadge";
import "../style/appNavbar.css";

const AppNavbar = memo(({ unreadMessages: propUnreadMessages }: { unreadMessages?: number }) => {
    const { user, logout } = useAuth();
    const { socket, unreadMessageCount: socketUnreadCount } = useSocket();
    const unreadMessages = socketUnreadCount > 0 ? socketUnreadCount : (propUnreadMessages || 0);
    const location = useLocation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    const isActive = useCallback((path: string) => location.pathname.startsWith(path), [location.pathname]);

    const handleLogout = useCallback(() => {
        logout();
        navigate("/");
    }, [logout, navigate]);

    // Load unread notification count only once on mount (socket handles updates)
    useEffect(() => {
        if (!user) return;
        notificationAPI.getUnreadCount()
            .then(res => setUnreadNotifications(res.count || 0))
            .catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                <Link to="/dashboard" className="app-nav-logo">
                    DateClone <span>💕</span>
                </Link>

                {(user?.isAdmin || (user as any)?.role === "admin" || (user as any)?.role === "super_admin" || (user as any)?.role === "moderator") && (
                    <Link to="/admin" className="admin-nav-link">
                        🛡️ Admin
                    </Link>
                )}
                <ul className="app-nav-links">
                    {[
                        { to: "/dashboard", icon: "🏠", label: "Home" },
                        { to: "/discover", icon: "🔥", label: "Discover" },
                        { to: "/matches", icon: "💞", label: "Matches" },
                        { to: "/chat", icon: "💬", label: "Messages", badge: unreadMessages },
                        { to: "/notifications", icon: "🔔", label: "Notifications", badge: unreadNotifications },
                    ].map(({ to, icon, label, badge }) => (
                        <li key={to}>
                            <Link to={to} className={isActive(to) ? "active" : ""}>
                                <span className="nav-icon">{icon}</span> {label}
                                {(badge ?? 0) > 0 && (
                                    <span className="nav-badge">{badge! > 99 ? "99+" : badge}</span>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>

                <div className="app-nav-right">
                    {user && user.isPremium ? (
                        <div className="app-nav-premium-badge">
                            <PremiumBadge tier={user.premiumTier} size="sm" />
                        </div>
                    ) : (
                        <Link to="/premium" className="app-nav-upgrade">
                            ✨ Go Premium
                        </Link>
                    )}

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
                                <button onClick={handleLogout} className="dropdown-logout">🚪 Log Out</button>
                            </div>
                        )}
                    </div>

                    <button
                        className={`app-hamburger ${menuOpen ? "open" : ""}`}
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span /><span /><span />
                    </button>
                </div>
            </div>

            {menuOpen && (
                <div className="app-mobile-menu">
                    {(user?.isAdmin || (user as any)?.role === "admin" || (user as any)?.role === "super_admin" || (user as any)?.role === "moderator") && (
                        <Link to="/admin" onClick={() => setMenuOpen(false)}>🛡️ Admin</Link>
                    )}
                    <Link to="/dashboard" onClick={() => setMenuOpen(false)}>🏠 Dashboard</Link>
                    <Link to="/discover" onClick={() => setMenuOpen(false)}>🔥 Discover</Link>
                    <Link to="/matches" onClick={() => setMenuOpen(false)}>💞 Matches</Link>
                    <Link to="/chat" onClick={() => setMenuOpen(false)}>
                        💬 Messages
                        {unreadMessages > 0 && <span className="nav-badge-mobile">{unreadMessages}</span>}
                    </Link>
                    <Link to="/notifications" onClick={() => setMenuOpen(false)}>
                        🔔 Notifications
                        {unreadNotifications > 0 && <span className="nav-badge-mobile">{unreadNotifications}</span>}
                    </Link>
                    <Link to="/profile" onClick={() => setMenuOpen(false)}>👤 My Profile</Link>
                    <Link to="/profile/edit" onClick={() => setMenuOpen(false)}>✏️ Edit Profile</Link>
                    <Link to="/settings" onClick={() => setMenuOpen(false)}>⚙️ Settings</Link>
                    <Link to="/premium" onClick={() => setMenuOpen(false)}>✨ Premium</Link>
                    <button onClick={handleLogout} className="mobile-logout">🚪 Log Out</button>
                </div>
            )}

            <div className="app-bottom-nav">
                {[
                    { to: "/dashboard", icon: "🏠", label: "Home" },
                    { to: "/discover", icon: "🔥", label: "Discover" },
                    { to: "/matches", icon: "💞", label: "Matches" },
                    { to: "/chat", icon: "💬", label: "Chat", badge: unreadMessages },
                    { to: "/profile", icon: "👤", label: "Profile" },
                ].map(({ to, icon, label, badge }) => (
                    <Link key={to} to={to} className={isActive(to) ? "active" : ""}>
                        <span>{icon}</span><span>{label}</span>
                        {(badge ?? 0) > 0 && (
                            <span className="bottom-nav-badge">{badge! > 9 ? "9+" : badge}</span>
                        )}
                    </Link>
                ))}
            </div>
        </nav>
    );
});

export default AppNavbar;