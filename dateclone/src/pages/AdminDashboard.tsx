import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminAPI } from "../services/apiService";
import "../style/admin.css";

type TabType = "dashboard" | "users" | "reports" | "announcements" | "subscriptions" | "logs" | "flagged" | "analytics";

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>("dashboard");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Dashboard stats
    const [stats, setStats] = useState<any>(null);

    // Users
    const [users, setUsers] = useState<any[]>([]);
    const [usersPagination, setUsersPagination] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [usersPage, setUsersPage] = useState(1);

    // Reports
    const [reports, setReports] = useState<any[]>([]);
    const [reportsPagination, setReportsPagination] = useState<any>(null);
    const [reportsPage, setReportsPage] = useState(1);

    // Announcements
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [annTitle, setAnnTitle] = useState("");
    const [annContent, setAnnContent] = useState("");
    const [annType, setAnnType] = useState("info");
    const [annAudience, setAnnAudience] = useState("all");

    // Subscriptions
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [subsPagination, setSubsPagination] = useState<any>(null);

    // Logs
    const [logs, setLogs] = useState<any[]>([]);
    const [logsPagination, setLogsPagination] = useState<any>(null);

    // Flagged content
    const [flaggedUsers, setFlaggedUsers] = useState<any[]>([]);
    const [flaggedPagination, setFlaggedPagination] = useState<any>(null);

    // Analytics
    const [analytics, setAnalytics] = useState<any>(null);

    // Role change modal
    const [roleModal, setRoleModal] = useState<{ user: any; open: boolean }>({ user: null, open: false });
    const [selectedRole, setSelectedRole] = useState("user");

    // Confirmation modal
    const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
        open: false, title: "", message: "", onConfirm: () => {},
    });

    // Check if user is admin
    const isAdmin = user?.isAdmin || ["admin", "super_admin", "moderator"].includes(user?.role || "");
    const isSuperAdmin = user?.role === "super_admin";
    const isAdminOrSuper = user?.role === "admin" || user?.role === "super_admin";
    const isModOrAbove = isAdmin || isSuperAdmin || user?.role === "moderator";

    // ── Load dashboard stats ─────────────────────────────────────────────
    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await adminAPI.getDashboard();
            setStats(res.stats);
        } catch (err: any) {
            setError(err.message || "Failed to load dashboard");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Load users ───────────────────────────────────────────────────────
    const loadUsers = useCallback(async (page: number = 1, search: string = "") => {
        setLoading(true);
        setError("");
        try {
            const params: Record<string, string | number> = { page, limit: 20 };
            if (search) params.search = search;
            const res = await adminAPI.getUsers(params);
            setUsers(res.users);
            setUsersPagination(res.pagination);
        } catch (err: any) {
            setError(err.message || "Failed to load users");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Load reports ─────────────────────────────────────────────────────
    const loadReports = useCallback(async (page: number = 1) => {
        setLoading(true);
        setError("");
        try {
            const res = await adminAPI.getReports({ page, limit: 20 });
            setReports(res.reports);
            setReportsPagination(res.pagination);
        } catch (err: any) {
            setError(err.message || "Failed to load reports");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Load announcements ───────────────────────────────────────────────
    const loadAnnouncements = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await adminAPI.getAnnouncements({ limit: 50 });
            setAnnouncements(res.announcements);
        } catch (err: any) {
            setError(err.message || "Failed to load announcements");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Load subscriptions ───────────────────────────────────────────────
    const loadSubscriptions = useCallback(async (page: number = 1) => {
        setLoading(true);
        setError("");
        try {
            const res = await adminAPI.getSubscriptions({ page, limit: 20 });
            setSubscriptions(res.subscriptions);
            setSubsPagination(res.pagination);
        } catch (err: any) {
            setError(err.message || "Failed to load subscriptions");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Load logs ────────────────────────────────────────────────────────
    const loadLogs = useCallback(async (page: number = 1) => {
        setLoading(true);
        setError("");
        try {
            const res = await adminAPI.getLogs({ page, limit: 50 });
            setLogs(res.logs);
            setLogsPagination(res.pagination);
        } catch (err: any) {
            setError(err.message || "Failed to load logs");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Load flagged content ─────────────────────────────────────────────
    const loadFlagged = useCallback(async (page: number = 1) => {
        setLoading(true);
        setError("");
        try {
            const res = await adminAPI.getFlaggedContent({ page, limit: 20 });
            setFlaggedUsers(res.users);
            setFlaggedPagination(res.pagination);
        } catch (err: any) {
            setError(err.message || "Failed to load flagged content");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Load analytics ───────────────────────────────────────────────────
    const loadAnalytics = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await adminAPI.getAnalytics();
            setAnalytics(res.analytics);
        } catch (err: any) {
            setError(err.message || "Failed to load analytics");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Tab switching ────────────────────────────────────────────────────
    useEffect(() => {
        if (!isAdmin) {
            navigate("/dashboard");
            return;
        }

        switch (activeTab) {
            case "dashboard":
                loadDashboard();
                break;
            case "users":
                loadUsers(usersPage, searchQuery);
                break;
            case "reports":
                loadReports(reportsPage);
                break;
            case "announcements":
                loadAnnouncements();
                break;
            case "subscriptions":
                loadSubscriptions();
                break;
            case "logs":
                loadLogs();
                break;
            case "flagged":
                loadFlagged();
                break;
            case "analytics":
                loadAnalytics();
                break;
        }
    }, [activeTab, usersPage, reportsPage]);

    // ── Handle search ────────────────────────────────────────────────────
    const handleSearch = () => {
        setUsersPage(1);
        loadUsers(1, searchQuery);
    };

    // ── Handle role change ──────────────────────────────────────────────
    const handleRoleChange = async () => {
        if (!roleModal.user) return;
        setLoading(true);
        setError("");
        try {
            await adminAPI.changeUserRole(roleModal.user._id, selectedRole);
            setSuccess(`Role updated to ${selectedRole} for ${roleModal.user.email}`);
            setRoleModal({ user: null, open: false });
            loadUsers(usersPage, searchQuery);
        } catch (err: any) {
            setError(err.message || "Failed to change role");
        } finally {
            setLoading(false);
        }
    };

    // ── Handle ban user ──────────────────────────────────────────────────
    const handleBanUser = async (userId: string, email: string) => {
        setLoading(true);
        setError("");
        try {
            await adminAPI.banUser(userId, "Violated community guidelines");
            setSuccess(`User ${email} banned`);
            loadUsers(usersPage, searchQuery);
        } catch (err: any) {
            setError(err.message || "Failed to ban user");
        } finally {
            setLoading(false);
        }
    };

    // ── Handle unban user ────────────────────────────────────────────────
    const handleUnbanUser = async (userId: string, email: string) => {
        setLoading(true);
        setError("");
        try {
            await adminAPI.unbanUser(userId);
            setSuccess(`User ${email} unbanned`);
            loadUsers(usersPage, searchQuery);
        } catch (err: any) {
            setError(err.message || "Failed to unban user");
        } finally {
            setLoading(false);
        }
    };

    // ── Handle delete user ───────────────────────────────────────────────
    const handleDeleteUser = async (userId: string, email: string) => {
        setLoading(true);
        setError("");
        try {
            await adminAPI.deleteUser(userId);
            setSuccess(`User ${email} deleted`);
            loadUsers(usersPage, searchQuery);
        } catch (err: any) {
            setError(err.message || "Failed to delete user");
        } finally {
            setLoading(false);
        }
    };

    // ── Handle report review ─────────────────────────────────────────────
    const handleReviewReport = async (reportId: string, status: string, actionTaken: string = "") => {
        setLoading(true);
        setError("");
        try {
            await adminAPI.reviewReport(reportId, { status, actionTaken });
            setSuccess(`Report ${status}`);
            loadReports(reportsPage);
        } catch (err: any) {
            setError(err.message || "Failed to review report");
        } finally {
            setLoading(false);
        }
    };

    // ── Handle create announcement ───────────────────────────────────────
    const handleCreateAnnouncement = async () => {
        if (!annTitle.trim() || !annContent.trim()) {
            setError("Title and content are required");
            return;
        }
        setLoading(true);
        setError("");
        try {
            await adminAPI.createAnnouncement({
                title: annTitle,
                content: annContent,
                type: annType,
                audience: annAudience,
            });
            setSuccess("Announcement created");
            setAnnTitle("");
            setAnnContent("");
            loadAnnouncements();
        } catch (err: any) {
            setError(err.message || "Failed to create announcement");
        } finally {
            setLoading(false);
        }
    };

    // ── Handle flag moderation ───────────────────────────────────────────
    const handleModerateFlag = async (userId: string, clearReports: boolean = false) => {
        setLoading(true);
        setError("");
        try {
            await adminAPI.moderateContent(userId, { flaggedForReview: false, clearReports });
            setSuccess("Content moderated");
            loadFlagged();
        } catch (err: any) {
            setError(err.message || "Failed to moderate");
        } finally {
            setLoading(false);
        }
    };

    // ── Render loading ───────────────────────────────────────────────────
    if (!isModOrAbove) {
        return (
            <div className="admin-container">
                <div className="admin-access-denied">
                    <h2>🔒 Access Denied</h2>
                    <p>You do not have permission to access the admin panel.</p>
                    <button onClick={() => navigate("/dashboard")} className="btn-primary">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const renderStats = () => {
        if (!stats) return null;
        const cards = [
            { label: "Total Users", value: stats.totalUsers, icon: "👥" },
            { label: "Members", value: stats.totalMembers, icon: "✅" },
            { label: "New Today", value: stats.newUsersToday, icon: "🆕" },
            { label: "Active (30d)", value: stats.activeUsers30d, icon: "⚡" },
            { label: "Online Now", value: stats.onlineUsers, icon: "🟢" },
            { label: "Premium", value: stats.premiumUsers, icon: "⭐" },
            { label: "Banned", value: stats.bannedUsers, icon: "🚫" },
            { label: "Pending Reports", value: stats.pendingReports, icon: "📋" },
            { label: "Revenue (30d)", value: `$${(stats.revenue30d || 0).toFixed(2)}`, icon: "💰" },
            { label: "Total Revenue", value: `$${(stats.totalRevenue || 0).toFixed(2)}`, icon: "🏦" },
        ];
        return (
            <div className="admin-stats-grid">
                {cards.map((card, i) => (
                    <div key={i} className="admin-stat-card">
                        <span className="admin-stat-icon">{card.icon}</span>
                        <div className="admin-stat-info">
                            <span className="admin-stat-value">{card.value}</span>
                            <span className="admin-stat-label">{card.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderUsers = () => (
        <div className="admin-section">
            <h3>User Management</h3>
            <div className="admin-search-bar">
                <input
                    type="text"
                    placeholder="Search by name, email, or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button onClick={handleSearch} className="btn-primary">Search</button>
            </div>
            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u._id}>
                                <td>
                                    <div className="admin-user-cell">
                                        {u.profilePicture ? (
                                            <img src={u.profilePicture} alt="" className="admin-avatar" />
                                        ) : (
                                            <div className="admin-avatar admin-avatar-placeholder">
                                                {u.firstName?.[0]}{u.lastName?.[0]}
                                            </div>
                                        )}
                                        <span>{u.firstName} {u.lastName}</span>
                                    </div>
                                </td>
                                <td>{u.email}</td>
                                <td>
                                    <span className={`admin-role-badge admin-role-${u.role}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td>
                                    {u.isBanned ? (
                                        <span className="admin-status-banned">Banned</span>
                                    ) : u.suspendedAt ? (
                                        <span className="admin-status-suspended">Suspended</span>
                                    ) : (
                                        <span className="admin-status-active">Active</span>
                                    )}
                                </td>
                                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                <td>
                                    <div className="admin-action-btns">
                                        {isAdminOrSuper && (
                                            <>
                                                {!u.isBanned ? (
                                                    <button
                                                        className="btn-small btn-danger"
                                                        onClick={() => handleBanUser(u._id, u.email)}
                                                        title="Ban user"
                                                    >
                                                        🚫
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="btn-small btn-success"
                                                        onClick={() => handleUnbanUser(u._id, u.email)}
                                                        title="Unban user"
                                                    >
                                                        ✅
                                                    </button>
                                                )}
                                                <button
                                                    className="btn-small btn-danger"
                                                    onClick={() => {
                                                        setConfirmModal({
                                                            open: true,
                                                            title: "Delete User",
                                                            message: `Are you sure you want to delete ${u.email}?`,
                                                            onConfirm: () => handleDeleteUser(u._id, u.email),
                                                        });
                                                    }}
                                                    title="Delete user"
                                                >
                                                    🗑️
                                                </button>
                                            </>
                                        )}
                                        {isSuperAdmin && (
                                            <button
                                                className="btn-small btn-warning"
                                                onClick={() => {
                                                    setRoleModal({ user: u, open: true });
                                                    setSelectedRole(u.role);
                                                }}
                                                title="Change role"
                                            >
                                                🔑
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan={6} className="admin-empty">No users found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {usersPagination && (
                <div className="admin-pagination">
                    <button
                        disabled={usersPagination.page <= 1}
                        onClick={() => { setUsersPage(usersPagination.page - 1); }}
                    >
                        Previous
                    </button>
                    <span>Page {usersPagination.page} of {usersPagination.pages}</span>
                    <button
                        disabled={usersPagination.page >= usersPagination.pages}
                        onClick={() => { setUsersPage(usersPagination.page + 1); }}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );

    const renderReports = () => (
        <div className="admin-section">
            <h3>User Reports</h3>
            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Reporter</th>
                            <th>Reported User</th>
                            <th>Reason</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map((r) => (
                            <tr key={r._id}>
                                <td>{r.reporter?.firstName} {r.reporter?.lastName}</td>
                                <td>{r.reportedUser?.firstName} {r.reportedUser?.lastName}</td>
                                <td>{r.reason}</td>
                                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                                <td><span className={`admin-status-${r.status}`}>{r.status}</span></td>
                                <td>
                                    {r.status === "pending" && (
                                        <div className="admin-action-btns">
                                            <button
                                                className="btn-small btn-success"
                                                onClick={() => handleReviewReport(r._id, "reviewed", "none")}
                                            >
                                                Dismiss
                                            </button>
                                            <button
                                                className="btn-small btn-danger"
                                                onClick={() => handleReviewReport(r._id, "action_taken", "ban")}
                                            >
                                                Ban User
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {reports.length === 0 && (
                            <tr><td colSpan={6} className="admin-empty">No reports found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {reportsPagination && (
                <div className="admin-pagination">
                    <button disabled={reportsPagination.page <= 1} onClick={() => setReportsPage(reportsPagination.page - 1)}>Previous</button>
                    <span>Page {reportsPagination.page} of {reportsPagination.pages}</span>
                    <button disabled={reportsPagination.page >= reportsPagination.pages} onClick={() => setReportsPage(reportsPagination.page + 1)}>Next</button>
                </div>
            )}
        </div>
    );

    const renderAnnouncements = () => (
        <div className="admin-section">
            <h3>Send Announcement</h3>
            {isAdminOrSuper && (
                <div className="admin-announcement-form">
                    <input
                        type="text"
                        placeholder="Announcement title"
                        value={annTitle}
                        onChange={(e) => setAnnTitle(e.target.value)}
                    />
                    <textarea
                        placeholder="Announcement content..."
                        value={annContent}
                        onChange={(e) => setAnnContent(e.target.value)}
                        rows={4}
                    />
                    <div className="admin-form-row">
                        <select value={annType} onChange={(e) => setAnnType(e.target.value)}>
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="update">Update</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="promotion">Promotion</option>
                        </select>
                        <select value={annAudience} onChange={(e) => setAnnAudience(e.target.value)}>
                            <option value="all">All Users</option>
                            <option value="premium">Premium Only</option>
                            <option value="free">Free Users Only</option>
                        </select>
                        <button onClick={handleCreateAnnouncement} className="btn-primary" disabled={loading}>
                            {loading ? "Sending..." : "Send"}
                        </button>
                    </div>
                </div>
            )}
            <h4 style={{ marginTop: "2rem" }}>Previous Announcements</h4>
            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Audience</th>
                            <th>Sent By</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {announcements.map((a) => (
                            <tr key={a._id}>
                                <td>{a.title}</td>
                                <td><span className={`admin-ann-type admin-ann-${a.type}`}>{a.type}</span></td>
                                <td>{a.audience}</td>
                                <td>{a.sentBy?.firstName} {a.sentBy?.lastName}</td>
                                <td>{a.sentAt ? new Date(a.sentAt).toLocaleDateString() : "Draft"}</td>
                                <td>{a.status}</td>
                            </tr>
                        ))}
                        {announcements.length === 0 && (
                            <tr><td colSpan={6} className="admin-empty">No announcements</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderSubscriptions = () => (
        <div className="admin-section">
            <h3>Subscription Management</h3>
            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Tier</th>
                            <th>Expires</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subscriptions.map((s) => (
                            <tr key={s._id}>
                                <td>{s.firstName} {s.lastName}</td>
                                <td>{s.email}</td>
                                <td><span className="admin-premium-tier">{s.premiumTier}</span></td>
                                <td>{s.premiumExpires ? new Date(s.premiumExpires).toLocaleDateString() : "Never"}</td>
                                <td>{s.isPremium ? "✅ Active" : "❌ Expired"}</td>
                            </tr>
                        ))}
                        {subscriptions.length === 0 && (
                            <tr><td colSpan={5} className="admin-empty">No subscriptions</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {subsPagination && (
                <div className="admin-pagination">
                    <button disabled={subsPagination.page <= 1}>Previous</button>
                    <span>Page {subsPagination.page} of {subsPagination.pages}</span>
                    <button disabled={subsPagination.page >= subsPagination.pages}>Next</button>
                </div>
            )}
        </div>
    );

    const renderLogs = () => (
        <div className="admin-section">
            <h3>Activity Logs</h3>
            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Admin</th>
                            <th>Action</th>
                            <th>Target</th>
                            <th>Details</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((l) => (
                            <tr key={l._id}>
                                <td>{l.admin?.firstName} {l.admin?.lastName}</td>
                                <td><code>{l.action}</code></td>
                                <td>{l.targetType}</td>
                                <td className="admin-log-details">
                                    {l.details?.targetEmail || l.details?.title || l.details?.newRole || "-"}
                                </td>
                                <td>{new Date(l.createdAt).toLocaleString()}</td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr><td colSpan={5} className="admin-empty">No logs</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {logsPagination && (
                <div className="admin-pagination">
                    <button disabled={logsPagination.page <= 1}>Previous</button>
                    <span>Page {logsPagination.page} of {logsPagination.pages}</span>
                    <button disabled={logsPagination.page >= logsPagination.pages}>Next</button>
                </div>
            )}
        </div>
    );

    const renderFlagged = () => (
        <div className="admin-section">
            <h3>Flagged Content</h3>
            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Reports</th>
                            <th>Flagged</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {flaggedUsers.map((u) => (
                            <tr key={u._id}>
                                <td>{u.firstName} {u.lastName}</td>
                                <td>{u.email}</td>
                                <td><span className="admin-report-count">{u.reportCount}</span></td>
                                <td>{u.flaggedForReview ? "🚩 Yes" : "No"}</td>
                                <td>{u.isBanned ? "🚫 Banned" : "Active"}</td>
                                <td>
                                    <button
                                        className="btn-small btn-success"
                                        onClick={() => handleModerateFlag(u._id, true)}
                                    >
                                        Clear Flags
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {flaggedUsers.length === 0 && (
                            <tr><td colSpan={6} className="admin-empty">No flagged content</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {flaggedPagination && (
                <div className="admin-pagination">
                    <button disabled={flaggedPagination.page <= 1}>Previous</button>
                    <span>Page {flaggedPagination.page} of {flaggedPagination.pages}</span>
                    <button disabled={flaggedPagination.page >= flaggedPagination.pages}>Next</button>
                </div>
            )}
        </div>
    );

    const renderAnalytics = () => {
        if (!analytics) return <div className="admin-loading">Loading analytics...</div>;
        return (
            <div className="admin-section">
                <h3>Analytics Dashboard</h3>
                <div className="admin-analytics-grid">
                    <div className="admin-analytics-card">
                        <h4>Users by Role</h4>
                        <div className="admin-analytics-data">
                            {analytics.usersByRole?.map((r: any, i: number) => (
                                <div key={i} className="admin-analytics-row">
                                    <span>{r._id}</span>
                                    <span className="admin-count">{r.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="admin-analytics-card">
                        <h4>Gender Distribution</h4>
                        <div className="admin-analytics-data">
                            {analytics.usersByGender?.map((g: any, i: number) => (
                                <div key={i} className="admin-analytics-row">
                                    <span>{g._id}</span>
                                    <span className="admin-count">{g.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="admin-analytics-card admin-analytics-wide">
                        <h4>Top Countries</h4>
                        <div className="admin-analytics-data">
                            {analytics.usersByCountry?.map((c: any, i: number) => (
                                <div key={i} className="admin-analytics-row">
                                    <span>{c._id}</span>
                                    <span className="admin-count">{c.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="admin-analytics-card admin-analytics-wide">
                        <h4>User Growth (Last 30 Days)</h4>
                        <div className="admin-analytics-data admin-growth">
                            {analytics.userGrowth?.map((d: any, i: number) => (
                                <div key={i} className="admin-growth-bar-wrapper">
                                    <span className="admin-growth-date">{d._id}</span>
                                    <div className="admin-growth-bar">
                                        <div
                                            className="admin-growth-fill"
                                            style={{ width: `${Math.min((d.count / Math.max(...analytics.userGrowth.map((x: any) => x.count))) * 100, 100)}%` }}
                                        />
                                        <span className="admin-growth-count">{d.count}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h1>Admin Panel</h1>
                <div className="admin-user-info">
                    <span className="admin-role-indicator">{user?.role || "user"}</span>
                    <span>{user?.email}</span>
                </div>
            </div>

            {error && <div className="admin-error">{error}</div>}
            {success && <div className="admin-success">{success}</div>}

            <div className="admin-tabs">
                <button
                    className={`admin-tab ${activeTab === "dashboard" ? "active" : ""}`}
                    onClick={() => setActiveTab("dashboard")}
                >
                    📊 Dashboard
                </button>
                <button
                    className={`admin-tab ${activeTab === "users" ? "active" : ""}`}
                    onClick={() => setActiveTab("users")}
                >
                    👥 Users
                </button>
                <button
                    className={`admin-tab ${activeTab === "reports" ? "active" : ""}`}
                    onClick={() => setActiveTab("reports")}
                >
                    📋 Reports
                </button>
                {isAdminOrSuper && (
                    <button
                        className={`admin-tab ${activeTab === "announcements" ? "active" : ""}`}
                        onClick={() => setActiveTab("announcements")}
                    >
                        📢 Announcements
                    </button>
                )}
                {isAdminOrSuper && (
                    <button
                        className={`admin-tab ${activeTab === "subscriptions" ? "active" : ""}`}
                        onClick={() => setActiveTab("subscriptions")}
                    >
                        💳 Subscriptions
                    </button>
                )}
                {isAdminOrSuper && (
                    <button
                        className={`admin-tab ${activeTab === "logs" ? "active" : ""}`}
                        onClick={() => setActiveTab("logs")}
                    >
                        📝 Logs
                    </button>
                )}
                <button
                    className={`admin-tab ${activeTab === "flagged" ? "active" : ""}`}
                    onClick={() => setActiveTab("flagged")}
                >
                    🚩 Flagged
                </button>
                {isAdminOrSuper && (
                    <button
                        className={`admin-tab ${activeTab === "analytics" ? "active" : ""}`}
                        onClick={() => setActiveTab("analytics")}
                    >
                        📈 Analytics
                    </button>
                )}
            </div>

            <div className="admin-content">
                {activeTab === "dashboard" && (
                    <>
                        <h2>Dashboard Overview</h2>
                        {loading ? <div className="admin-loading">Loading...</div> : renderStats()}
                    </>
                )}
                {activeTab === "users" && renderUsers()}
                {activeTab === "reports" && renderReports()}
                {activeTab === "announcements" && renderAnnouncements()}
                {activeTab === "subscriptions" && renderSubscriptions()}
                {activeTab === "logs" && renderLogs()}
                {activeTab === "flagged" && renderFlagged()}
                {activeTab === "analytics" && renderAnalytics()}
            </div>

            {/* Role Change Modal */}
            {roleModal.open && (
                <div className="admin-modal-overlay" onClick={() => setRoleModal({ user: null, open: false })}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Change Role for {roleModal.user?.email}</h3>
                        <div className="admin-form-group">
                            <label>Current Role: <strong>{roleModal.user?.role}</strong></label>
                            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                                <option value="user">User</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                                <option value="super_admin">Super Admin</option>
                            </select>
                        </div>
                        <div className="admin-modal-actions">
                            <button className="btn-secondary" onClick={() => setRoleModal({ user: null, open: false })}>
                                Cancel
                            </button>
                            <button className="btn-primary" onClick={handleRoleChange} disabled={loading}>
                                {loading ? "Updating..." : "Update Role"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmModal.open && (
                <div className="admin-modal-overlay" onClick={() => setConfirmModal({ ...confirmModal, open: false })}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{confirmModal.title}</h3>
                        <p>{confirmModal.message}</p>
                        <div className="admin-modal-actions">
                            <button className="btn-secondary" onClick={() => setConfirmModal({ ...confirmModal, open: false })}>
                                Cancel
                            </button>
                            <button className="btn-danger" onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, open: false }); }} disabled={loading}>
                                {loading ? "Processing..." : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;