import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/apiService";
import "../style/auth.css";

// ── Error classifier ──────────────────────────────────────────────────────────
const classify = (msg: string): { type: string; text: string } => {
  const m = msg.toLowerCase();

  if (
    m.includes("cannot reach") ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("not running") ||
    m.includes("502") ||
    m.includes("backend server is not running")
  ) {
    return {
      type: "network",
      text: "Backend server is not running. Open a terminal in the /backend folder and run: npm run dev",
    };
  }
  if (m.includes("database not connected") || m.includes("port 27017") || m.includes("503")) {
    return { type: "database", text: "Database connection issue. MongoDB is disconnected; try again shortly." };
  }
  if (m.includes("verify your email") || m.includes("verify your email before")) {
    return { type: "unverified", text: "Please verify your email before logging in." };
  }
  if (m.includes("invalid email or password") || m.includes("incorrect") || m.includes("401")) {
    return { type: "credentials", text: "Incorrect email or password. Please try again." };
  }
  if (m.includes("suspended") || m.includes("banned") || m.includes("403")) {
    return { type: "banned", text: "Your account has been suspended. Contact support." };
  }
  if (m.includes("not found") || m.includes("user not found")) {
    return { type: "credentials", text: "No account found with that email. Sign up first." };
  }
  if (m.includes("400") || m.includes("validation") || m.includes("invalid")) {
    return { type: "validation", text: "Please enter a valid email address and password." };
  }
  // Fallback: show raw message if it's human-readable, else a generic
  const isReadable = msg.length < 120 && !msg.startsWith("{") && !msg.includes("Error:");
  return {
    type: "generic",
    text: isReadable ? msg : "Login failed. Please check your details and try again.",
  };
};

// ── Component ─────────────────────────────────────────────────────────────────
const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation first
    if (!email.trim()) { setError("Please enter your email."); setErrorType("validation"); return; }
    if (!password.trim()) { setError("Please enter your password."); setErrorType("validation"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      setErrorType("validation");
      return;
    }

    setLoading(true);
    setError("");
    setErrorType("");
    setNeedsVerify(false);
    setResendMsg("");

    try {
      await login(email.trim().toLowerCase(), password);
      navigate("/discover", { replace: true });
    } catch (err: any) {
      const raw = err.message || "Login failed";
      const { type, text } = classify(raw);
      setErrorType(type);
      setError(text);
      if (type === "unverified") setNeedsVerify(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendMsg("");
    try {
      await authAPI.resendVerification(email.trim());
      setResendMsg("✓ New verification code sent! Check your email inbox.");
    } catch (err: any) {
      setResendMsg(err.message || "Failed to resend. Try again.");
    } finally {
      setResending(false);
    }
  };

  // ── Icon per error type ───────────────────────────────────────────────────
  const errorIcon: Record<string, string> = {
    network: "📡",
    database: "🗄️",
    credentials: "🔐",
    unverified: "✉️",
    banned: "🚫",
    validation: "⚠️",
    generic: "⚠️",
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Header */}
        <div className="auth-header">
          <Link to="/" className="auth-logo">DateClone 💕</Link>
          <h1>Welcome Back</h1>
          <p>Continue your journey to finding love.</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className={`auth-error auth-error--${errorType || "generic"}`}>
            <span className="auth-error-icon">{errorIcon[errorType] || "⚠️"}</span>
            <span>{error}</span>
          </div>
        )}

        {/* Unverified email nudge */}
        {needsVerify && (
          <div className="auth-verify-nudge">
            <p>
              <strong>Email not verified.</strong> Check your email inbox for the
              verification code, or resend below.
            </p>
            {resendMsg ? (
              <p className={resendMsg.startsWith("✓") ? "auth-nudge-success" : "auth-nudge-error"}>
                {resendMsg}
              </p>
            ) : (
              <button
                type="button"
                className="auth-resend-btn"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? "Sending…" : "Resend verification code"}
              </button>
            )}
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="l-email">Email Address</label>
            <input
              id="l-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="l-pw">Password</label>
            <div className="auth-password-wrap">
              <input
                id="l-pw"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPw(p => !p)}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          <div className="auth-forgot">
            <a href="#">Forgot password?</a>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <><span className="auth-spinner" />&nbsp;Logging in…</> : "Login"}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{" "}
          <Link to="/register" className="auth-link">Sign Up Free</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
