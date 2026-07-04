/**
 * AdminDashboard.tsx — Production-ready Admin Panel
 * Pink design system · RBAC · Full feature set
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminAPI } from "../services/apiService";
import "../style/admin.css";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab =
    | "dashboard" | "users" | "reports" | "moderation"
    | "announcements" | "subscriptions" | "logs" | "analytics";

interface Toast { id: number; type: "success" | "error" | "info"; msg: string; }

// ─── Toast hook ───────────────────────────────────────────────────────────────
const useToast = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const addToast = useCallback((msg: string, type: Toast["type"] = "success") => {
        const id = Date.now();
        setToasts(p => [...p, { id, type, msg }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
    }, []);
    return { toasts, addToast };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString() : "—";
const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleString() : "—";
const initials = (u: any) => `${u?.firstName?.[0] ?? ""}${u?.lastName?.[0] ?? ""}`.toUpperCase();

const StatusBadge = ({ user }: { user: any }) => {
    if (user.isBanned) return <span className="adm-badge adm-badge-banned">Banned</span>;
    if (user.suspendedAt) return <span className="adm-badge adm-badge-suspended">Suspended</span>;
    if (!user.emailVerified) return <span className="adm-badge adm-badge-pending">Unverified</span>;
    if (user.isPremium) return <span className="adm-badge adm-badge-premium">Premium</span>;
    return <span className="adm-badge adm-badge-active">Active</span>;
};

const RoleBadge = ({ role }: { role: string }) => (
    <span className={`adm-badge adm-badge-${role}`}>{role.replace("_", " ")}</span>
);

// ─── Confirm Modal ────────────────────────────────────────────────────────────
const ConfirmModal = ({ title, message, danger, onConfirm, onClose }: {
    title: string; message: string; danger?: boolean;
    onConfirm: () => void; onClose: () => void;
}) => (
    <div className="adm-overlay" onClick={onClose}>
        <div className="adm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="adm-modal-header">
                <h3>{title}</h3>
                <button className="adm-modal-close" onClick={onClose}>✕</button>
            </div>
            <div className="adm-modal-body">
                <p style={{ color: "var(--adm-text)", fontSize: "0.9rem", lineHeight: 1.6 }}>{message}</p>
            </div>
            <div className="adm-modal-footer">
                <button className="adm-btn adm-btn-outline" onClick={onClose}>Cancel</button>
                <button
                    className={`adm-btn ${danger ? "adm-btn-danger" : "adm-btn-primary"}`}
                    onClick={() => { onConfirm(); onClose(); }}
                >
                    Confirm
                </button>
            </div>
        </div>
    </div>
);

// ─── User Detail Modal ────────────────────────────────────────────────────────
const UserModal = ({ user, isSuperAdmin, isAdminOrAbove, onClose, onAction, toast }: {
    user: any; isSuperAdmin: boolean; isAdminOrAbove: boolean;
    onClose: () => void; onAction: (action: string, payload?: any) => Promise<void>;
    toast: (msg: string, type?: Toast["type"]) => void;
}) => {
    const [loading, setLoading] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({
        firstName: user.firstName || "", lastName: user.lastName || "",
        phone: user.phone || "", city: user.city || "",
        country: user.country || "", occupation: user.occupation || "",
    });

    const run = async (action: string, payload?: any) => {
        setLoading(action);
        try { await onAction(action, payload); }
        finally { setLoading(null); }
    };

    return (
        <div className="adm-overlay" onClick={onClose}>
            <div className="adm-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                <div className="adm-modal-header">
                    <h3>User Details</h3>
                    <button className="adm-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="adm-modal-body">
                    {/* Profile header */}
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
                        {user.profilePicture
                            ? <img src={user.profilePicture} alt="" className="adm-avatar" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
                            : <div className="adm-avatar adm-avatar-ph" style={{ width: 64, height: 64, fontSize: "1.3rem", borderRadius: "50%" }}>{initials(user)}</div>}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--adm-dark)" }}>
                                {user.firstName} {user.lastName}
                            </div>
                            <div style={{ fontSize: "0.82rem", color: "var(--adm-muted)" }}>{user.email}</div>
                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                <RoleBadge role={user.role} />
                                <StatusBadge user={user} />
                                {user.isPremium && <span className={`adm-badge adm-badge-${user.premiumTier}`}>{user.premiumTier}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Info grid */}
                    {!editMode ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", fontSize: "0.83rem", marginBottom: 18 }}>
                            {[
                                ["Username", `@${user.username}`], ["Age", user.age || "—"],
                                ["Gender", user.gender || "—"], ["Country", user.country || "—"],
                                ["City", user.city || "—"], ["Occupation", user.occupation || "—"],
                                ["Joined", fmtDate(user.createdAt)], ["Last Login", fmtDate(user.lastLogin)],
                                ["Email Verified", user.emailVerified ? "✅ Yes" : "❌ No"],
                                ["Profile %", `${user.profileCompletion ?? 0}%`],
                                ["Reports", user.reportCount ?? 0], ["Premium Expires", fmtDate(user.premiumExpires)],
                            ].map(([k, v]) => (
                                <div key={String(k)}>
                                    <div style={{ color: "var(--adm-muted)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
                                    <div style={{ fontWeight: 600, color: "var(--adm-dark)", marginTop: 2 }}>{String(v)}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="adm-row" style={{ marginBottom: 18 }}>
                            {(["firstName", "lastName", "phone", "city", "country", "occupation"] as const).map(k => (
                                <div className="adm-field" key={k}>
                                    <label>{k}</label>
                                    <input value={editForm[k]} onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    {isAdminOrAbove && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {editMode ? (
                                <>
                                    <button className="adm-btn adm-btn-primary adm-btn-sm" disabled={!!loading}
                                        onClick={() => run("edit", editForm).then(() => setEditMode(false))}>
                                        {loading === "edit" ? "Saving…" : "Save Changes"}
                                    </button>
                                    <button className="adm-btn adm-btn-outline adm-btn-sm" onClick={() => setEditMode(false)}>Cancel</button>
                                </>
                            ) : (
                                <button className="adm-btn adm-btn-outline adm-btn-sm" onClick={() => setEditMode(true)}>✏️ Edit</button>
                            )}
                            <button className="adm-btn adm-btn-warn adm-btn-sm" disabled={!!loading}
                                onClick={() => run("verify")}>
                                {loading === "verify" ? "…" : "✅ Verify"}
                            </button>
                            <button className="adm-btn adm-btn-outline adm-btn-sm" disabled={!!loading}
                                onClick={() => run("resetPw")}>
                                {loading === "resetPw" ? "…" : "🔑 Reset PW"}
                            </button>
                            <button className="adm-btn adm-btn-warn adm-btn-sm" disabled={!!loading}
                                onClick={() => run("forceLogout")}>
                                {loading === "forceLogout" ? "…" : "⏏ Force Logout"}
                            </button>
                            {!user.isBanned ? (
                                <button className="adm-btn adm-btn-danger adm-btn-sm" disabled={!!loading}
                                    onClick={() => run("ban")}>
                                    {loading === "ban" ? "…" : "🚫 Ban"}
                                </button>
                            ) : (
                                <button className="adm-btn adm-btn-success adm-btn-sm" disabled={!!loading}
                                    onClick={() => run("unban")}>
                                    {loading === "unban" ? "…" : "✅ Unban"}
                                </button>
                            )}
                            {!user.isPremium ? (
                                <button className="adm-btn adm-btn-warn adm-btn-sm" disabled={!!loading}
                                    onClick={() => run("grantPremium")}>
                                    {loading === "grantPremium" ? "…" : "⭐ Grant Premium"}
                                </button>
                            ) : (
                                <button className="adm-btn adm-btn-outline adm-btn-sm" disabled={!!loading}
                                    onClick={() => run("revokePremium")}>
                                    {loading === "revokePremium" ? "…" : "Remove Premium"}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main AdminDashboard ──────────────────────────────────────────────────────
const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { toasts, addToast } = useToast();
    const [tab, setTab] = useState<Tab>("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Role helpers
    const role = (user as any)?.role ?? "user";
    const isAdmin = ["admin", "super_admin", "moderator"].includes(role);
    const isSuperAdmin = role === "super_admin";
    const isAdminOrAbove = role === "admin" || role === "super_admin";
    const isMod = isAdmin;

    // Shared state
    const [loading, setLoading] = useState(false);
    const [confirm, setConfirm] = useState<any>(null);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    // ── Dashboard ──────────────────────────────────────────────────────────────
    const [stats, setStats] = useState<any>(null);

    // ── Users ──────────────────────────────────────────────────────────────────
    const [users, setUsers] = useState<any[]>([]);
    const [usersPag, setUsersPag] = useState<any>(null);
    const [usersPage, setUsersPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    // ── Reports ────────────────────────────────────────────────────────────────
    const [reports, setReports] = useState<any[]>([]);
    const [reportsPag, setReportsPag] = useState<any>(null);
    const [reportsPage, setReportsPage] = useState(1);
    const [reportStatus, setReportStatus] = useState("pending");

    // ── Moderation ─────────────────────────────────────────────────────────────
    const [flagged, setFlagged] = useState<any[]>([]);
    const [flaggedPag, setFlaggedPag] = useState<any>(null);
    const [flaggedPage, setFlaggedPage] = useState(1);

    // ── Announcements ──────────────────────────────────────────────────────────
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [annForm, setAnnForm] = useState({ title: "", content: "", type: "info", audience: "all" });

    // ── Subscriptions ──────────────────────────────────────────────────────────
    const [subs, setSubs] = useState<any[]>([]);
    const [subsPag, setSubsPag] = useState<any>(null);
    const [subsPage, setSubsPage] = useState(1);

    // ── Logs ───────────────────────────────────────────────────────────────────
    const [logs, setLogs] = useState<any[]>([]);
    const [logsPag, setLogsPag] = useState<any>(null);
    const [logsPage, setLogsPage] = useState(1);

    // ── Analytics ──────────────────────────────────────────────────────────────
    const [analytics, setAnalytics] = useState<any>(null);

    // ── Data loaders ──────────────────────────────────────────────────────────
    const loadDashboard = useCallback(async () => {
        setLoading(true);
        try { const r = await adminAPI.getDashboard(); setStats(r.stats); }
        catch (e: any) { addToast(e.message || "Failed to load dashboard", "error"); }
        finally { setLoading(false); }
    }, []);

    const loadUsers = useCallback(async (page = 1, q = "", st = "") => {
        setLoading(true);
        try {
            const params: any = { page, limit: 20 };
            if (q) params.search = q;
            if (st) params.status = st;
            const r = await adminAPI.getUsers(params);
            setUsers(r.users); setUsersPag(r.pagination);
        } catch (e: any) { addToast(e.message || "Failed to load users", "error"); }
        finally { setLoading(false); }
    }, []);

    const loadReports = useCallback(async (page = 1, status = "pending") => {
        setLoading(true);
        try {
            const r = await adminAPI.getReports({ page, limit: 20, status: status || "all" });
            setReports(r.reports); setReportsPag(r.pagination);
        } catch (e: any) { addToast(e.message || "Failed to load reports", "error"); }
        finally { setLoading(false); }
    }, []);

    const loadFlagged = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const r = await adminAPI.getFlaggedContent({ page, limit: 20 });
            setFlagged(r.users); setFlaggedPag(r.pagination);
        } catch (e: any) { addToast(e.message || "Failed to load flagged", "error"); }
        finally { setLoading(false); }
    }, []);

    const loadAnnouncements = useCallback(async () => {
        try { const r = await adminAPI.getAnnouncements({ limit: 50 }); setAnnouncements(r.announcements); }
        catch { /* silent */ }
    }, []);

    const loadSubs = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const r = await adminAPI.getSubscriptions({ page, limit: 20 });
            setSubs(r.subscriptions); setSubsPag(r.pagination);
        } catch (e: any) { addToast(e.message || "Failed to load subscriptions", "error"); }
        finally { setLoading(false); }
    }, []);

    const loadLogs = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const r = await adminAPI.getLogs({ page, limit: 50 });
            setLogs(r.logs); setLogsPag(r.pagination);
        } catch (e: any) { addToast(e.message || "Failed to load logs", "error"); }
        finally { setLoading(false); }
    }, []);

    const loadAnalytics = useCallback(async () => {
        setLoading(true);
        try { const r = await adminAPI.getAnalytics(); setAnalytics(r.analytics); }
        catch (e: any) { addToast(e.message || "Failed to load analytics", "error"); }
        finally { setLoading(false); }
    }, []);

    // ── Tab effect ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isAdmin) { navigate("/dashboard"); return; }
        switch (tab) {
            case "dashboard": loadDashboard(); break;
            case "users": loadUsers(usersPage, search, statusFilter); break;
            case "reports": loadReports(reportsPage, reportStatus); break;
            case "moderation": loadFlagged(flaggedPage); break;
            case "announcements": loadAnnouncements(); break;
            case "subscriptions": loadSubs(subsPage); break;
            case "logs": loadLogs(logsPage); break;
            case "analytics": loadAnalytics(); break;
        }
    }, [tab, usersPage, reportsPage, flaggedPage, subsPage, logsPage]);

    // ── User actions ───────────────────────────────────────────────────────────
    const handleUserAction = useCallback(async (action: string, userId: string, payload?: any) => {
        try {
            switch (action) {
                case "ban": await adminAPI.banUser(userId, payload?.reason || "Admin action"); break;
                case "unban": await adminAPI.unbanUser(userId); break;
                case "suspend": await adminAPI.suspendUser(userId, payload?.reason, payload?.hours ?? 24); break;
                case "unsuspend": await adminAPI.unsuspendUser(userId); break;
                case "delete": await adminAPI.deleteUser(userId); break;
                case "role": await adminAPI.changeUserRole(userId, payload.role); break;
                case "grantPremium": await adminAPI.grantPremium(userId, payload?.tier ?? "gold", payload?.days ?? 30); break;
                case "revokePremium": await adminAPI.revokePremium(userId); break;
                case "forceLogout": await adminAPI.forceLogout(userId); break;
                case "verify": await adminAPI.manualVerify(userId); break;
                case "resetPw": await adminAPI.sendPasswordReset(userId); break;
                case "edit": await adminAPI.editUser(userId, payload); break;
            }
            addToast("Action completed successfully", "success");
            loadUsers(usersPage, search, statusFilter);
            if (selectedUser?._id === userId) {
                const r = await adminAPI.getUser(userId);
                setSelectedUser(r.user);
            }
        } catch (e: any) {
            addToast(e.message || "Action failed", "error");
        }
    }, [usersPage, search, statusFilter, selectedUser]);

    if (!isAdmin) {
        return (
            <div className="adm-denied">
                <div style={{ fontSize: "3rem" }}>🔒</div>
                <h2>Access Denied</h2>
                <p>You do not have permission to access the admin panel.</p>
                <button className="adm-btn adm-btn-primary" onClick={() => navigate("/dashboard")}>
                    Back to Dashboard
                </button>
            </div>
        );
    }

    // ── Sidebar nav items ──────────────────────────────────────────────────────
    const NAV = [
        { id: "dashboard", icon: "📊", label: "Dashboard" },
        { id: "users", icon: "👥", label: "Users", badge: usersPag?.total },
        { id: "reports", icon: "🚩", label: "Reports", badge: stats?.pendingReports || undefined },
        { id: "moderation", icon: "🛡️", label: "Moderation" },
        ...(isAdminOrAbove ? [
            { id: "announcements", icon: "📢", label: "Announcements" },
            { id: "subscriptions", icon: "💳", label: "Subscriptions" },
            { id: "logs", icon: "📝", label: "Audit Logs" },
            { id: "analytics", icon: "📈", label: "Analytics" },
        ] : []),
    ] as const;

    const PAGE_TITLES: Record<Tab, string> = {
        dashboard: "Dashboard", users: "User Management", reports: "Reports",
        moderation: "Content Moderation", announcements: "Announcements",
        subscriptions: "Subscriptions", logs: "Audit Logs", analytics: "Analytics",
    };

    // ── Stat card colors ───────────────────────────────────────────────────────
    const STAT_COLORS = [
        "#FFF1F6", "#ECFDF5", "#EFF6FF", "#FFFBEB",
        "#F5F3FF", "#FEF2F2", "#ECFDF5", "#FFF1F6",
        "#FFFBEB", "#F0F9FF",
    ];

    // ── Render sections ────────────────────────────────────────────────────────
    const renderDashboard = () => {
        if (loading && !stats) return (
            <div className="adm-stats-grid">
                {Array(10).fill(0).map((_, i) => (
                    <div key={i} className="adm-stat">
                        <div className="adm-skel" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <div className="adm-skel" style={{ height: 22, width: "60%", marginBottom: 6 }} />
                            <div className="adm-skel" style={{ height: 13, width: "40%" }} />
                        </div>
                    </div>
                ))}
            </div>
        );
        if (!stats) return null;
        const cards = [
            { label: "Total Users", value: stats.totalUsers, icon: "👥" },
            { label: "Members", value: stats.totalMembers, icon: "✅" },
            { label: "New Today", value: stats.newUsersToday, icon: "🌱" },
            { label: "Active (30d)", value: stats.activeUsers30d, icon: "⚡" },
            { label: "Online Now", value: stats.onlineUsers, icon: "🟢" },
            { label: "Premium", value: stats.premiumUsers, icon: "⭐" },
            { label: "Banned", value: stats.bannedUsers, icon: "🚫" },
            { label: "Pending Reports", value: stats.pendingReports, icon: "📋" },
            { label: "Revenue (30d)", value: `$${(stats.revenue30d || 0).toFixed(0)}`, icon: "💰" },
            { label: "Total Revenue", value: `$${(stats.totalRevenue || 0).toFixed(0)}`, icon: "🏦" },
        ];
        return (
            <div className="adm-stats-grid">
                {cards.map((c, i) => (
                    <div className="adm-stat" key={i}>
                        <div className="adm-stat-icon" style={{ background: STAT_COLORS[i] }}>{c.icon}</div>
                        <div className="adm-stat-body">
                            <span className="adm-stat-val">{c.value}</span>
                            <span className="adm-stat-lbl">{c.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderUsers = () => (
        <div className="adm-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "18px 20px" }}>
                <div className="adm-toolbar">
                    <div className="adm-search">
                        <span className="adm-search-icon">🔍</span>
                        <input placeholder="Search name, email, username…"
                            value={search} onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { setUsersPage(1); loadUsers(1, search, statusFilter); } }} />
                    </div>
                    <select className="adm-filter-select" value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setUsersPage(1); loadUsers(1, search, e.target.value); }}>
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="banned">Banned</option>
                        <option value="suspended">Suspended</option>
                        <option value="premium">Premium</option>
                    </select>
                    <button className="adm-btn adm-btn-primary adm-btn-sm"
                        onClick={() => { setUsersPage(1); loadUsers(1, search, statusFilter); }}>
                        Search
                    </button>
                </div>
            </div>
            <div className="adm-table-wrap">
                <table className="adm-table">
                    <thead>
                        <tr>
                            <th>User</th><th>Role</th><th>Status</th>
                            <th>Joined</th><th>Last Login</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && users.length === 0
                            ? Array(5).fill(0).map((_, i) => (
                                <tr key={i}>
                                    {Array(6).fill(0).map((_, j) => (
                                        <td key={j}><div className="adm-skel" style={{ height: 14, width: j === 0 ? 160 : 80 }} /></td>
                                    ))}
                                </tr>
                            ))
                            : users.length === 0
                                ? <tr className="adm-empty-row"><td colSpan={6}>No users found</td></tr>
                                : users.map(u => (
                                    <tr key={u._id} style={{ cursor: "pointer" }} onClick={() => setSelectedUser(u)}>
                                        <td>
                                            <div className="adm-user-cell">
                                                {u.profilePicture
                                                    ? <img src={u.profilePicture} alt="" className="adm-avatar" />
                                                    : <div className="adm-avatar adm-avatar-ph">{initials(u)}</div>}
                                                <div>
                                                    <div className="adm-user-name">{u.firstName} {u.lastName}</div>
                                                    <div className="adm-user-email">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><RoleBadge role={u.role} /></td>
                                        <td><StatusBadge user={u} /></td>
                                        <td style={{ fontSize: "0.8rem", color: "var(--adm-muted)" }}>{fmtDate(u.createdAt)}</td>
                                        <td style={{ fontSize: "0.8rem", color: "var(--adm-muted)" }}>{fmtDate(u.lastLogin)}</td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div className="adm-btn-group">
                                                <button className="adm-btn adm-btn-outline adm-btn-xs"
                                                    onClick={() => setSelectedUser(u)}>View</button>
                                                {isAdminOrAbove && (
                                                    !u.isBanned
                                                        ? <button className="adm-btn adm-btn-danger adm-btn-xs"
                                                            onClick={() => setConfirm({ title: "Ban User", message: `Ban ${u.email}?`, danger: true, onConfirm: () => handleUserAction("ban", u._id) })}>
                                                            Ban
                                                        </button>
                                                        : <button className="adm-btn adm-btn-success adm-btn-xs"
                                                            onClick={() => handleUserAction("unban", u._id)}>Unban</button>
                                                )}
                                                {isSuperAdmin && (
                                                    <button className="adm-btn adm-btn-warn adm-btn-xs"
                                                        onClick={() => setConfirm({
                                                            title: "Delete User", message: `Soft-delete ${u.email}? They will be hidden from the platform.`,
                                                            danger: true, onConfirm: () => handleUserAction("delete", u._id),
                                                        })}>Del</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                    </tbody>
                </table>
            </div>
            {usersPag && (
                <div className="adm-pager">
                    <span>{usersPag.total} total users</span>
                    <div className="adm-pager-btns">
                        <button className="adm-pager-btn" disabled={usersPage <= 1}
                            onClick={() => { setUsersPage(usersPage - 1); }}>←</button>
                        <button className="adm-pager-btn active">{usersPage}</button>
                        <button className="adm-pager-btn" disabled={usersPage >= usersPag.pages}
                            onClick={() => { setUsersPage(usersPage + 1); }}>→</button>
                    </div>
                    <span>Page {usersPage} of {usersPag.pages}</span>
                </div>
            )}
        </div>
    );

    const renderReports = () => (
        <div className="adm-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "18px 20px" }}>
                <div className="adm-toolbar">
                    <select className="adm-filter-select" value={reportStatus}
                        onChange={e => { setReportStatus(e.target.value); setReportsPage(1); loadReports(1, e.target.value); }}>
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="action_taken">Action Taken</option>
                        <option value="dismissed">Dismissed</option>
                        <option value="all">All</option>
                    </select>
                </div>
            </div>
            <div className="adm-table-wrap">
                <table className="adm-table">
                    <thead>
                        <tr><th>Reporter</th><th>Reported User</th><th>Reason</th><th>Date</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {reports.length === 0
                            ? <tr className="adm-empty-row"><td colSpan={6}>No reports found</td></tr>
                            : reports.map(r => (
                                <tr key={r._id}>
                                    <td style={{ fontSize: "0.82rem" }}>{r.reporter?.firstName} {r.reporter?.lastName}</td>
                                    <td>
                                        <div className="adm-user-cell" style={{ gap: 6 }}>
                                            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                                                {r.reportedUser?.firstName} {r.reportedUser?.lastName}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ fontSize: "0.8rem", color: "var(--adm-muted)", maxWidth: 200 }}>{r.reason}</td>
                                    <td style={{ fontSize: "0.78rem", color: "var(--adm-muted)" }}>{fmtDate(r.createdAt)}</td>
                                    <td><span className={`adm-badge adm-badge-${r.status === "pending" ? "pending" : "active"}`}>{r.status}</span></td>
                                    <td>
                                        {r.status === "pending" && (
                                            <div className="adm-btn-group">
                                                <button className="adm-btn adm-btn-success adm-btn-xs"
                                                    onClick={async () => { await adminAPI.reviewReport(r._id, { status: "dismissed", actionTaken: "none" }); loadReports(reportsPage, reportStatus); addToast("Report dismissed"); }}>
                                                    Dismiss
                                                </button>
                                                <button className="adm-btn adm-btn-warn adm-btn-xs"
                                                    onClick={async () => { await adminAPI.reviewReport(r._id, { status: "reviewed", actionTaken: "warning" }); loadReports(reportsPage, reportStatus); addToast("Warning issued"); }}>
                                                    Warn
                                                </button>
                                                <button className="adm-btn adm-btn-danger adm-btn-xs"
                                                    onClick={() => setConfirm({
                                                        title: "Ban Reported User", message: "Ban this user for violating community guidelines?", danger: true,
                                                        onConfirm: async () => { await adminAPI.reviewReport(r._id, { status: "action_taken", actionTaken: "ban" }); loadReports(reportsPage, reportStatus); addToast("User banned"); }
                                                    })}>
                                                    Ban
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
            {reportsPag && (
                <div className="adm-pager">
                    <span>{reportsPag.total} reports</span>
                    <div className="adm-pager-btns">
                        <button className="adm-pager-btn" disabled={reportsPage <= 1} onClick={() => setReportsPage(reportsPage - 1)}>←</button>
                        <button className="adm-pager-btn active">{reportsPage}</button>
                        <button className="adm-pager-btn" disabled={reportsPage >= reportsPag.pages} onClick={() => setReportsPage(reportsPage + 1)}>→</button>
                    </div>
                    <span>Page {reportsPage} of {reportsPag.pages}</span>
                </div>
            )}
        </div>
    );

    const renderModeration = () => (
        <div className="adm-card" style={{ overflow: "hidden" }}>
            <div className="adm-table-wrap">
                <table className="adm-table">
                    <thead>
                        <tr><th>User</th><th>Reports</th><th>Flagged</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {flagged.length === 0
                            ? <tr className="adm-empty-row"><td colSpan={6}>No flagged users</td></tr>
                            : flagged.map(u => (
                                <tr key={u._id}>
                                    <td>
                                        <div className="adm-user-cell">
                                            <div className="adm-avatar adm-avatar-ph" style={{ width: 32, height: 32 }}>{initials(u)}</div>
                                            <div>
                                                <div className="adm-user-name">{u.firstName} {u.lastName}</div>
                                                <div className="adm-user-email">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ background: "#FEF2F2", color: "#991B1B", padding: "3px 9px", borderRadius: 20, fontWeight: 700, fontSize: "0.78rem" }}>
                                            {u.reportCount}
                                        </span>
                                    </td>
                                    <td>{u.flaggedForReview ? "🚩 Yes" : "—"}</td>
                                    <td><StatusBadge user={u} /></td>
                                    <td style={{ fontSize: "0.78rem", color: "var(--adm-muted)" }}>{fmtDate(u.createdAt)}</td>
                                    <td>
                                        <div className="adm-btn-group">
                                            <button className="adm-btn adm-btn-success adm-btn-xs"
                                                onClick={async () => { await adminAPI.moderateContent(u._id, { clearReports: true }); loadFlagged(flaggedPage); addToast("Flags cleared"); }}>
                                                Clear
                                            </button>
                                            {!u.isBanned && (
                                                <button className="adm-btn adm-btn-danger adm-btn-xs"
                                                    onClick={() => setConfirm({
                                                        title: "Ban User", message: `Ban ${u.email}?`, danger: true,
                                                        onConfirm: () => handleUserAction("ban", u._id)
                                                    })}>
                                                    Ban
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
            {flaggedPag && (
                <div className="adm-pager">
                    <span>{flaggedPag.total} flagged users</span>
                    <div className="adm-pager-btns">
                        <button className="adm-pager-btn" disabled={flaggedPage <= 1} onClick={() => setFlaggedPage(flaggedPage - 1)}>←</button>
                        <button className="adm-pager-btn active">{flaggedPage}</button>
                        <button className="adm-pager-btn" disabled={flaggedPage >= flaggedPag.pages} onClick={() => setFlaggedPage(flaggedPage + 1)}>→</button>
                    </div>
                    <span>Page {flaggedPage} of {flaggedPag.pages}</span>
                </div>
            )}
        </div>
    );

    const renderAnnouncements = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {isAdminOrAbove && (
                <div className="adm-ann-form">
                    <h4>📢 Send Announcement</h4>
                    <div className="adm-field">
                        <label>Title</label>
                        <input placeholder="Announcement title"
                            value={annForm.title} onChange={e => setAnnForm(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div className="adm-field">
                        <label>Message</label>
                        <textarea placeholder="Write your announcement…"
                            value={annForm.content} onChange={e => setAnnForm(p => ({ ...p, content: e.target.value }))} />
                    </div>
                    <div className="adm-row">
                        <div className="adm-field">
                            <label>Type</label>
                            <select value={annForm.type} onChange={e => setAnnForm(p => ({ ...p, type: e.target.value }))}>
                                <option value="info">ℹ️ Info</option>
                                <option value="warning">⚠️ Warning</option>
                                <option value="update">🆕 Update</option>
                                <option value="maintenance">🔧 Maintenance</option>
                                <option value="promotion">🎉 Promotion</option>
                            </select>
                        </div>
                        <div className="adm-field">
                            <label>Audience</label>
                            <select value={annForm.audience} onChange={e => setAnnForm(p => ({ ...p, audience: e.target.value }))}>
                                <option value="all">All Users</option>
                                <option value="premium">Premium Only</option>
                                <option value="free">Free Users</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button className="adm-btn adm-btn-primary" disabled={!annForm.title.trim() || !annForm.content.trim() || loading}
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    await adminAPI.createAnnouncement({ ...annForm, status: "sent" });
                                    addToast("Announcement sent!");
                                    setAnnForm({ title: "", content: "", type: "info", audience: "all" });
                                    loadAnnouncements();
                                } catch (e: any) { addToast(e.message || "Failed", "error"); }
                                finally { setLoading(false); }
                            }}>
                            {loading ? "Sending…" : "Send Announcement"}
                        </button>
                    </div>
                </div>
            )}
            <div className="adm-card" style={{ overflow: "hidden" }}>
                <div className="adm-table-wrap">
                    <table className="adm-table">
                        <thead>
                            <tr><th>Title</th><th>Type</th><th>Audience</th><th>Sent By</th><th>Date</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {announcements.length === 0
                                ? <tr className="adm-empty-row"><td colSpan={6}>No announcements yet</td></tr>
                                : announcements.map(a => (
                                    <tr key={a._id}>
                                        <td style={{ fontWeight: 600, fontSize: "0.875rem" }}>{a.title}</td>
                                        <td><span className={`adm-badge adm-badge-${a.type}`}>{a.type}</span></td>
                                        <td style={{ fontSize: "0.82rem" }}>{a.audience}</td>
                                        <td style={{ fontSize: "0.82rem" }}>{a.sentBy?.firstName} {a.sentBy?.lastName}</td>
                                        <td style={{ fontSize: "0.78rem", color: "var(--adm-muted)" }}>{a.sentAt ? fmtDate(a.sentAt) : "Draft"}</td>
                                        <td><span className={`adm-badge adm-badge-${a.status}`}>{a.status}</span></td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderSubscriptions = () => (
        <div className="adm-card" style={{ overflow: "hidden" }}>
            <div className="adm-table-wrap">
                <table className="adm-table">
                    <thead>
                        <tr><th>User</th><th>Email</th><th>Tier</th><th>Expires</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {subs.length === 0
                            ? <tr className="adm-empty-row"><td colSpan={6}>No premium subscriptions</td></tr>
                            : subs.map(s => (
                                <tr key={s._id}>
                                    <td className="adm-user-name">{s.firstName} {s.lastName}</td>
                                    <td style={{ fontSize: "0.82rem", color: "var(--adm-muted)" }}>{s.email}</td>
                                    <td><span className={`adm-badge adm-badge-${s.premiumTier}`}>{s.premiumTier}</span></td>
                                    <td style={{ fontSize: "0.8rem" }}>{fmtDate(s.premiumExpires)}</td>
                                    <td>{s.isPremium ? <span className="adm-badge adm-badge-active">Active</span> : <span className="adm-badge adm-badge-free">Expired</span>}</td>
                                    <td>
                                        {isAdminOrAbove && (
                                            <button className="adm-btn adm-btn-danger adm-btn-xs"
                                                onClick={() => handleUserAction("revokePremium", s._id)}>
                                                Revoke
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
            {subsPag && (
                <div className="adm-pager">
                    <span>{subsPag.total} subscriptions</span>
                    <div className="adm-pager-btns">
                        <button className="adm-pager-btn" disabled={subsPage <= 1} onClick={() => setSubsPage(subsPage - 1)}>←</button>
                        <button className="adm-pager-btn active">{subsPage}</button>
                        <button className="adm-pager-btn" disabled={subsPage >= subsPag.pages} onClick={() => setSubsPage(subsPage + 1)}>→</button>
                    </div>
                    <span>Page {subsPage} of {subsPag.pages}</span>
                </div>
            )}
        </div>
    );

    const renderLogs = () => (
        <div className="adm-card" style={{ overflow: "hidden" }}>
            <div className="adm-table-wrap">
                <table className="adm-table">
                    <thead>
                        <tr><th>Admin</th><th>Action</th><th>Target</th><th>Details</th><th>IP</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                        {logs.length === 0
                            ? <tr className="adm-empty-row"><td colSpan={6}>No logs found</td></tr>
                            : logs.map(l => (
                                <tr key={l._id}>
                                    <td style={{ fontSize: "0.82rem", fontWeight: 600 }}>{l.admin?.firstName} {l.admin?.lastName}</td>
                                    <td><code style={{ fontSize: "0.75rem", background: "var(--adm-surface)", padding: "2px 6px", borderRadius: 6 }}>{l.action}</code></td>
                                    <td style={{ fontSize: "0.78rem", color: "var(--adm-muted)" }}>{l.targetType}</td>
                                    <td style={{ fontSize: "0.78rem", color: "var(--adm-muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {l.details?.targetEmail || l.details?.title || l.details?.newRole || "—"}
                                    </td>
                                    <td style={{ fontSize: "0.75rem", color: "var(--adm-muted)" }}>{l.ipAddress || "—"}</td>
                                    <td style={{ fontSize: "0.75rem", color: "var(--adm-muted)" }}>{fmtDateTime(l.createdAt)}</td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
            {logsPag && (
                <div className="adm-pager">
                    <span>{logsPag.total} log entries</span>
                    <div className="adm-pager-btns">
                        <button className="adm-pager-btn" disabled={logsPage <= 1} onClick={() => setLogsPage(logsPage - 1)}>←</button>
                        <button className="adm-pager-btn active">{logsPage}</button>
                        <button className="adm-pager-btn" disabled={logsPage >= logsPag.pages} onClick={() => setLogsPage(logsPage + 1)}>→</button>
                    </div>
                    <span>Page {logsPage} of {logsPag.pages}</span>
                </div>
            )}
        </div>
    );

    const renderAnalytics = () => {
        if (!analytics) return <div style={{ padding: 40, textAlign: "center", color: "var(--adm-muted)" }}>Loading analytics…</div>;
        const maxGrowth = Math.max(...(analytics.userGrowth?.map((d: any) => d.count) || [1]));
        return (
            <div className="adm-analytics-grid">
                <div className="adm-card" style={{ padding: 20 }}>
                    <div className="adm-chart-label">Users by Role</div>
                    <div className="adm-kv-list">
                        {analytics.usersByRole?.map((r: any) => (
                            <div key={r._id} className="adm-kv-row">
                                <span className="adm-kv-key"><RoleBadge role={r._id} /></span>
                                <span className="adm-kv-val">{r.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="adm-card" style={{ padding: 20 }}>
                    <div className="adm-chart-label">Gender Distribution</div>
                    <div className="adm-kv-list">
                        {analytics.usersByGender?.map((g: any) => (
                            <div key={g._id} className="adm-kv-row">
                                <span className="adm-kv-key">{g._id || "Unknown"}</span>
                                <span className="adm-kv-val">{g.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="adm-card adm-analytics-wide" style={{ padding: 20 }}>
                    <div className="adm-chart-label">Top Countries</div>
                    {analytics.usersByCountry?.map((c: any) => (
                        <div key={c._id} className="adm-bar-row">
                            <span className="adm-bar-name">{c._id}</span>
                            <div className="adm-bar-track">
                                <div className="adm-bar-fill" style={{ width: `${(c.count / (analytics.usersByCountry[0]?.count || 1)) * 100}%` }} />
                            </div>
                            <span className="adm-bar-val">{c.count}</span>
                        </div>
                    ))}
                </div>
                <div className="adm-card adm-analytics-wide" style={{ padding: 20 }}>
                    <div className="adm-chart-label">User Growth — Last 30 Days</div>
                    {analytics.userGrowth?.map((d: any) => (
                        <div key={d._id} className="adm-bar-row">
                            <span className="adm-bar-name" style={{ fontSize: "0.72rem" }}>{d._id}</span>
                            <div className="adm-bar-track">
                                <div className="adm-bar-fill" style={{ width: `${(d.count / maxGrowth) * 100}%` }} />
                            </div>
                            <span className="adm-bar-val">{d.count}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // ── Main render ────────────────────────────────────────────────────────────
    return (
        <div className="adm-shell">
            {/* Sidebar */}
            <aside className={`adm-sidebar ${sidebarOpen ? "open" : ""}`}>
                <div className="adm-sidebar-logo">
                    <h2>DateClone 💕</h2>
                    <p>Admin Panel</p>
                </div>
                <nav className="adm-nav">
                    {NAV.map(item => (
                        <button key={item.id}
                            className={`adm-nav-item ${tab === item.id ? "active" : ""}`}
                            onClick={() => { setTab(item.id as Tab); setSidebarOpen(false); }}>
                            <span className="adm-nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                            {"badge" in item && item.badge && item.badge > 0
                                ? <span className="adm-nav-badge">{item.badge}</span> : null}
                        </button>
                    ))}
                </nav>
                <div className="adm-sidebar-footer">
                    <div className="adm-sidebar-user">
                        <div className="adm-avatar adm-avatar-ph" style={{ width: 36, height: 36 }}>{initials(user)}</div>
                        <div className="adm-sidebar-user-info">
                            <div className="adm-sidebar-user-name">{user?.firstName} {user?.lastName}</div>
                            <div className="adm-sidebar-user-role">{role}</div>
                        </div>
                    </div>
                    <button className="adm-btn adm-btn-outline" style={{ width: "100%", marginTop: 8, fontSize: "0.82rem" }}
                        onClick={() => { logout(); navigate("/"); }}>
                        🚪 Sign Out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="adm-main">
                <div className="adm-topbar">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button className="adm-topbar-btn" onClick={() => setSidebarOpen(!sidebarOpen)}
                            style={{ display: "none" }} id="adm-hamburger">☰</button>
                        <span className="adm-topbar-title">{PAGE_TITLES[tab]}</span>
                    </div>
                    <div className="adm-topbar-right">
                        <button className="adm-topbar-btn" onClick={() => navigate("/dashboard")} title="Back to App">
                            ← App
                        </button>
                        <div className="adm-avatar adm-avatar-ph" style={{ width: 34, height: 34, fontSize: "0.75rem" }}>
                            {initials(user)}
                        </div>
                    </div>
                </div>

                <div className="adm-page">
                    <div className="adm-page-header">
                        <div>
                            <h1>{PAGE_TITLES[tab]}</h1>
                            {tab === "users" && usersPag && <p>{usersPag.total} total users registered</p>}
                            {tab === "reports" && reportsPag && <p>{reportsPag.total} reports found</p>}
                        </div>
                        {tab === "users" && (
                            <button className="adm-btn adm-btn-outline adm-btn-sm"
                                onClick={() => loadUsers(usersPage, search, statusFilter)}>
                                ↺ Refresh
                            </button>
                        )}
                    </div>

                    {tab === "dashboard" && renderDashboard()}
                    {tab === "users" && renderUsers()}
                    {tab === "reports" && renderReports()}
                    {tab === "moderation" && renderModeration()}
                    {tab === "announcements" && renderAnnouncements()}
                    {tab === "subscriptions" && renderSubscriptions()}
                    {tab === "logs" && renderLogs()}
                    {tab === "analytics" && renderAnalytics()}
                </div>
            </main>

            {/* Toast notifications */}
            <div className="adm-toast-wrap">
                {toasts.map(t => (
                    <div key={t.id} className={`adm-toast adm-toast-${t.type}`}>
                        {t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}
                        {t.msg}
                    </div>
                ))}
            </div>

            {/* Confirmation modal */}
            {confirm && (
                <ConfirmModal
                    title={confirm.title} message={confirm.message} danger={confirm.danger}
                    onConfirm={confirm.onConfirm}
                    onClose={() => setConfirm(null)}
                />
            )}

            {/* User detail modal */}
            {selectedUser && (
                <UserModal
                    user={selectedUser}
                    isSuperAdmin={isSuperAdmin}
                    isAdminOrAbove={isAdminOrAbove}
                    onClose={() => setSelectedUser(null)}
                    toast={addToast}
                    onAction={async (action, payload) => {
                        await handleUserAction(action, selectedUser._id, payload);
                    }}
                />
            )}
        </div>
    );
};

export default AdminDashboard;
