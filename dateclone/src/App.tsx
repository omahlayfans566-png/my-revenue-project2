import React, { lazy, Suspense, useEffect, type ReactNode, type ErrorInfo } from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./App.css";
import { lazyWithRetry } from "./utils/lazyWithRetry";

// Pages (lazyWithRetry auto-retries transient chunk failures → no blank screens)
const Home = lazyWithRetry(() => import("./pages/Home"));
const Login = lazyWithRetry(() => import("./pages/Login"));
const Register = lazyWithRetry(() => import("./pages/Register"));
const About = lazyWithRetry(() => import("./pages/About"));
const Contact = lazyWithRetry(() => import("./pages/Contact"));
const FAQ = lazyWithRetry(() => import("./pages/FAQ"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const Premium = lazyWithRetry(() => import("./pages/Premium"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Discover = lazyWithRetry(() => import("./pages/Discover"));
const Matches = lazyWithRetry(() => import("./pages/Matches"));
const Chat = lazyWithRetry(() => import("./pages/Chat"));
const ArchivedChats = lazyWithRetry(() => import("./pages/ArchivedChats"));
const Notifications = lazyWithRetry(() => import("./pages/Notifications"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const EditProfile = lazyWithRetry(() => import("./pages/EditProfile"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const ProfileWizard = lazyWithRetry(() => import("./component/ProfileWizard"));
const ViewProfile = lazyWithRetry(() => import("./pages/ViewProfile"));
const AdminDashboard = lazyWithRetry(() => import("./pages/AdminDashboard"));
const PaymentCallback = lazyWithRetry(() => import("./pages/PaymentCallback"));

// PWA components
const PwaInstallPrompt = lazy(() => import("./component/PwaInstallPrompt"));
const PwaUpdateNotifier = lazy(() => import("./component/PwaUpdateNotifier"));
const OnlineStatusManager = lazy(() => import("./component/OnlineStatusManager"));
const SkipToContent = lazy(() => import("./component/SkipToContent"));

import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider, useSocket } from "./context/SocketContext";
import { useDocumentTitle } from "./hooks/useDocumentTitle";
import { registerOfflineSync } from "./services/offlineQueue";

// ─── PageLoader ──────────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="page-loader">
    <div className="page-loader-spinner">
      <div className="spinner-ring" />
      <div className="spinner-ring spinner-ring-2" />
    </div>
    <p className="page-loader-text">Loading…</p>
  </div>
);

// ─── Error Boundaries ────────────────────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-boundary">
            <div className="error-boundary-content">
              <span className="error-boundary-icon">⚠️</span>
              <h2>Something went wrong</h2>
              <p>{this.state.error?.message || "An unexpected error occurred."}</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

// Keyed by `location.pathname` so React remounts it fresh on every navigation.
// A previous page's error state is never carried into the next page — this is
// the fix for the "blank screen until manual refresh" bug.
class LazyErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[LazyErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-boundary" style={{ minHeight: "50vh" }}>
            <div className="error-boundary-content">
              <span className="error-boundary-icon">🔄</span>
              <h2>Failed to load page</h2>
              <p>{this.state.error?.message || "The page could not be loaded. Please try again."}</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

// ─── Route Guards ────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PublicOnlyRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const role = user?.role ?? "";
  const isAdmin = user?.isAdmin || ["admin", "super_admin", "moderator"].includes(role);
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// ─── Routes ──────────────────────────────────────────────────────────────────
// RouteBoundary keys LazyErrorBoundary by pathname: every navigation remounts
// a clean boundary so no stale error can ever blank the app.
const RouteBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  return <LazyErrorBoundary key={location.pathname}>{children}</LazyErrorBoundary>;
};

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<RouteBoundary><Home /></RouteBoundary>} />
        <Route path="/about" element={<RouteBoundary><About /></RouteBoundary>} />
        <Route path="/contact" element={<RouteBoundary><Contact /></RouteBoundary>} />
        <Route path="/faq" element={<RouteBoundary><FAQ /></RouteBoundary>} />
        <Route path="/terms" element={<RouteBoundary><Terms /></RouteBoundary>} />
        <Route path="/privacy" element={<RouteBoundary><Privacy /></RouteBoundary>} />
        <Route path="/premium" element={<RouteBoundary><Premium /></RouteBoundary>} />
        <Route path="/payment/callback" element={<RouteBoundary><PaymentCallback /></RouteBoundary>} />
        <Route path="/login" element={<PublicOnlyRoute><RouteBoundary><Login /></RouteBoundary></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RouteBoundary><Register /></RouteBoundary></PublicOnlyRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><RouteBoundary><Dashboard /></RouteBoundary></ProtectedRoute>} />
        <Route path="/discover" element={<ProtectedRoute><RouteBoundary><Discover /></RouteBoundary></ProtectedRoute>} />
        <Route path="/matches" element={<ProtectedRoute><RouteBoundary><Matches /></RouteBoundary></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><RouteBoundary><Chat /></RouteBoundary></ProtectedRoute>} />
        <Route path="/chat/:userId" element={<ProtectedRoute><RouteBoundary><Chat /></RouteBoundary></ProtectedRoute>} />
        <Route path="/chat/archived" element={<ProtectedRoute><RouteBoundary><ArchivedChats /></RouteBoundary></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><RouteBoundary><Notifications /></RouteBoundary></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><RouteBoundary><Profile /></RouteBoundary></ProtectedRoute>} />
        <Route path="/profile/edit" element={<ProtectedRoute><RouteBoundary><EditProfile /></RouteBoundary></ProtectedRoute>} />
        <Route path="/profile/:userId" element={<ProtectedRoute><RouteBoundary><ViewProfile /></RouteBoundary></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><RouteBoundary><Settings /></RouteBoundary></ProtectedRoute>} />
        <Route path="/wizard" element={<ProtectedRoute><RouteBoundary><ProfileWizard /></RouteBoundary></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><RouteBoundary><AdminDashboard /></RouteBoundary></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

// ─── App Inner ───────────────────────────────────────────────────────────────
function AppInner() {
  const { unreadMessageCount } = useSocket();
  useDocumentTitle(unreadMessageCount);

  useEffect(() => {
    const cleanup = registerOfflineSync();
    return cleanup;
  }, []);

  return (
    <>
      <SkipToContent />
      <main id="main-content">
        <AppRoutes />
      </main>
      <OnlineStatusManager />
      <PwaInstallPrompt />
      <PwaUpdateNotifier />
    </>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: "12px",
                background: "#1a1a2e",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.1)",
              },
              success: {
                iconTheme: { primary: "#ff4081", secondary: "#fff" },
              },
              error: {
                iconTheme: { primary: "#ff1744", secondary: "#fff" },
              },
            }}
          />
          <AppInner />
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;