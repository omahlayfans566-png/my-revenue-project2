import { Link } from "react-router-dom";
import "../style/features.css";

const FEATURES = [
  {
    icon: "🧠",
    title: "Smart Compatibility",
    desc: "Our algorithm matches you based on values, interests, religion, lifestyle, and relationship goals — not just photos.",
    accent: "var(--red-500, #ff1744)",
    bg: "rgba(255,23,68,0.06)",
  },
  {
    icon: "🌍",
    title: "Pan-African Community",
    desc: "Connect with genuine singles across 25+ African countries. Your next great love story could be a city — or a continent — away.",
    accent: "#10b981",
    bg: "rgba(16,185,129,0.06)",
  },
  {
    icon: "🔒",
    title: "Safe & Verified",
    desc: "Every profile goes through email verification. Block, report, and privacy controls keep your experience safe and in your control.",
    accent: "#3b82f6",
    bg: "rgba(59,130,246,0.06)",
  },
  {
    icon: "💬",
    title: "Meaningful Messaging",
    desc: "Chat only with people you've matched with. No spam, no strangers — just real conversations with people who already like you back.",
    accent: "#8b5cf6",
    bg: "rgba(139,92,246,0.06)",
  },
  {
    icon: "📍",
    title: "Location-Aware",
    desc: "Auto-detect your location to find matches in your city, state, or anywhere across Africa — your choice, your distance.",
    accent: "#f59e0b",
    bg: "rgba(245,158,11,0.06)",
  },
  {
    icon: "✨",
    title: "Premium Boost",
    desc: "Upgrade to Gold or Platinum to see who likes you, send unlimited likes, and get priority visibility on the discover feed.",
    accent: "#ff1744",
    bg: "rgba(255,23,68,0.06)",
  },
];

const Features = () => (
  <section className="features-section">
    <div className="features-container">
      {/* Header */}
      <div className="features-header">
        <span className="features-eyebrow">Why DateClone?</span>
        <h2 className="features-title">
          Built for African Singles.<br />
          <span className="grad-text">Designed for Real Connection.</span>
        </h2>
        <p className="features-subtitle">
          We combine cultural intelligence, safety-first design, and smart matching
          to help you find someone truly compatible.
        </p>
      </div>

      {/* Grid */}
      <div className="features-grid">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="feature-card"
            style={{ "--feature-accent": f.accent, "--feature-bg": f.bg } as any}
          >
            <div className="feature-icon-wrap">
              <span className="feature-icon">{f.icon}</span>
            </div>
            <h3 className="feature-card-title">{f.title}</h3>
            <p className="feature-card-desc">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="features-cta">
        <Link to="/register" className="btn btn-primary btn-lg">
          Join Free Today
        </Link>
        <Link to="/about" className="btn btn-outline btn-lg">
          Learn More
        </Link>
      </div>
    </div>
  </section>
);

export default Features;
