import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/apiService";
import "../style/auth.css";

// ── Error classifier ──────────────────────────────────────────────────────────
const classify = (msg: string): { type: string; text: string } => {
  const m = msg.toLowerCase();

  // Network / server unreachable
  if (
    m.includes("cannot reach") ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("not running") ||
    m.includes("backend server is not running") ||
    m.includes("fetch failed") ||
    m.includes("network request failed") ||
    m.includes("typeerror")
  ) {
    return {
      type: "network",
      text: "We're having trouble connecting right now. Please try again in a moment.",
    };
  }

  // Database / server unavailable
  if (m.includes("server unavailable") || m.includes("database not connected") || m.includes("port 27017") || m.includes("503") || m.includes("temporarily unavailable")) {
    return { type: "database", text: "Server unavailable. Please try again later." };
  }

  // No account found
  if (m.includes("no account found") || m.includes("no account found with that email") || m.includes("no account found with that email.")) {
    return { type: "credentials", text: "No account found with this email." };
  }

  // Incorrect password
  if (m.includes("incorrect password") || m.includes("incorrect password. please try again")) {
    return { type: "credentials", text: "Incorrect password." };
  }

  // Account locked
  if (m.includes("account temporarily locked") || m.includes("account locked") || m.includes("429")) {
    return { type: "lockout", text: msg };
  }

  // Suspended / banned
  if (m.includes("suspended") || m.includes("banned") || m.includes("403")) {
    return { type: "banned", text: "Your account has been suspended. Contact support." };
  }

  // Unverified email
  if (m.includes("verify your email") || m.includes("verify your email before") || m.includes("email not verified")) {
    return { type: "unverified", text: "Please verify your email before logging in." };
  }

  // Validation errors
  if (m.includes("valid email") || m.includes("validation") || m.includes("400")) {
    return { type: "validation", text: "Please enter a valid email address and password." };
  }

  // Generic login failure (from backend catch block)
  if (m.includes("login failed") || m.includes("please try again")) {
    return { type: "generic", text: "Login failed. Please try again." };
  }

  // Fallback: show the raw backend message if it's human-readable
  const isReadable = msg.length < 120 && !msg.startsWith("{") && !msg.includes("Error:");
  return {
    type: "generic",
    text: isReadable ? msg : "Login failed. Please try again.",
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
      setResendMsg("We couldn't resend the code right now. Please try again shortly.");
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
