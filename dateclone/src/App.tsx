import React, { lazy, Suspense, useEffect, type ReactNode, type ErrorInfo } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./App.css";

// Lazy load pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Premium = lazy(() => import("./pages/Premium"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Discover = lazy(() => import("./pages/Discover"));
const Matches = lazy(() => import("./pages/Matches"));
const Chat = lazy(() => import("./pages/Chat"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Profile = lazy(() => import("./pages/Profile"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const Settings = lazy(() => import("./pages/Settings"));
const ProfileWizard = lazy(() => import("./component/ProfileWizard"));
const ViewProfile = lazy(() => import("./pages/ViewProfile"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const PaymentCallback = lazy(() => import("./pages/PaymentCallback"));

import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";

// ─── Loading Fallback ──────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="page-loader">
    <div className="page-loader-spinner">
      <div className="spinner-ring" />
      <div className="spinner-ring spinner-ring-2" />
    </div>
    <p className="page-loader-text">Loading…</p>
  </div>
);

// ─── Error Boundary ────────────────────────────────────────────────────────────
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

// ─── Route Guards ──────────────────────────────────────────────────────────────
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

// AdminRoute: requires authentication + admin/moderator/super_admin role
const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const role = user?.role ?? "";
  const isAdmin = user?.isAdmin || ["admin", "super_admin", "moderator"].includes(role);
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// ─── Routes ────────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/premium" element={<Premium />} />

        {/* Paystack payment callback — public, handles redirect from payment gateway */}
        <Route path="/payment/callback" element={<PaymentCallback />} />

        {/* Public-only */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <Register />
            </PublicOnlyRoute>
          }
        />

        {/* Protected */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/discover"
          element={
            <ProtectedRoute>
              <Discover />
            </ProtectedRoute>
          }
        />
        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <Matches />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:userId"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <ViewProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wizard"
          element={
            <ProtectedRoute>
              <ProfileWizard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

// ─── PWA Components ─────────────────────────────────────────────────────────
import PwaInstallPrompt from "./component/PwaInstallPrompt";
import PwaUpdateNotifier from "./component/PwaUpdateNotifier";
import OnlineStatusManager from "./component/OnlineStatusManager";
import SkipToContent from "./component/SkipToContent";
import { useDocumentTitle } from "./hooks/useDocumentTitle";
import { registerOfflineSync } from "./services/offlineQueue";
import { useSocket } from "./context/SocketContext";

// ─── App Inner ─────────────────────────────────────────────────────────────────
function AppInner() {
  const { unreadMessageCount } = useSocket();
  useDocumentTitle(unreadMessageCount);

  // Register offline sync on mount
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

// ─── App ───────────────────────────────────────────────────────────────────────
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