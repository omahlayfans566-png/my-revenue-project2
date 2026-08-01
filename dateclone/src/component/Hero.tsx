import { Link } from "react-router-dom";
import { useEffect, useRef, memo } from "react";
import "../style/hero.css";

const FLOATING_HEARTS = [
  { left: "6%", top: "22%", delay: "0s", dur: "6.5s", size: "16px" },
  { left: "15%", top: "68%", delay: "1.6s", dur: "7.4s", size: "11px" },
  { left: "48%", top: "14%", delay: "2.3s", dur: "8s", size: "14px" },
  { left: "83%", top: "20%", delay: "0.9s", dur: "6.8s", size: "12px" },
  { left: "93%", top: "62%", delay: "2.9s", dur: "7.8s", size: "18px" },
];

const STATS = [
  { icon: "👥", value: "2M+", label: "Active Members" },
  { icon: "💍", value: "150K+", label: "Success Stories" },
  { icon: "🌍", value: "25+", label: "Countries" },
  { icon: "⭐", value: "4.9", label: "App Rating" },
];

const Hero = memo(() => {
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add("hero-stats-visible"); },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="hero-section" aria-label="DateClone hero">
      {/* Background glows */}
      <div className="hero-glow hero-glow-a" aria-hidden="true" />
      <div className="hero-glow hero-glow-b" aria-hidden="true" />
      <div className="hero-glow hero-glow-c" aria-hidden="true" />

      {/* Floating hearts */}
      {FLOATING_HEARTS.map((h, i) => (
        <span key={i} className="hero-float-heart" aria-hidden="true"
          style={{ left: h.left, top: h.top, animationDelay: h.delay, animationDuration: h.dur, fontSize: h.size }}>
          ♥
        </span>
      ))}

      <div className="hero-container">
        {/* ── Left: Copy ── */}
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" aria-hidden="true" />
            Africa's #1 Dating Platform
          </div>

          <h1 className="hero-title">
            Find Your{" "}
            <span className="hero-title-gradient">Perfect Match</span>
            {" "}Across Africa
          </h1>

          <p className="hero-subtitle">
            Meet genuine singles, build meaningful connections, and discover
            love — right where you are.
          </p>

          <div className="hero-buttons">
            <Link to="/register" className="hero-btn hero-btn-primary">
              Start for Free <span className="hero-btn-arrow" aria-hidden="true">→</span>
            </Link>
            <Link to="/about" className="hero-btn hero-btn-secondary">
              <span className="hero-play-icon" aria-hidden="true">▶</span>
              How It Works
            </Link>
          </div>

          {/* Trust strip */}
          <div className="hero-trust" aria-label="Social proof">
            <div className="hero-trust-avatars" aria-hidden="true">
              {["💛", "💜", "❤️", "🧡"].map((e, i) => (
                <span key={i} className="hero-trust-avatar">{e}</span>
              ))}
            </div>
            <p>Join <strong>2M+</strong> singles already finding love.</p>
          </div>
        </div>

        {/* ── Right: UI Composition ── */}
        <div className="hero-visual" aria-hidden="true">
          {/* Central glow orb */}
          <div className="hero-orb" />

          {/* Match card — top center */}
          <div className="hero-card hero-card-match">
            <div className="hero-card-avatars">
              <span className="hero-av hero-av-a">👩🏾</span>
              <span className="hero-match-heart-badge">♥</span>
              <span className="hero-av hero-av-b">👨🏿</span>
            </div>
            <strong>It's a Match!</strong>
            <span>Start a beautiful conversation ✨</span>
          </div>

          {/* Online users — top right */}
          <div className="hero-card hero-card-online">
            <div className="hero-online-row">
              <span className="hero-online-dot" />
              <strong>2,841 online</strong>
            </div>
            <div className="hero-online-faces">
              {["🙋🏾‍♀️", "🙋🏿‍♂️", "🙋🏽‍♀️"].map((e, i) => (
                <span key={i} className="hero-online-face">{e}</span>
              ))}
              <span className="hero-online-more">+120</span>
            </div>
          </div>

          {/* Verified profile — left */}
          <div className="hero-card hero-card-profile">
            <div className="hero-profile-top">
              <span className="hero-profile-av">👩🏾‍💻</span>
              <div>
                <strong>Amara, 26</strong>
                <span>Lagos, Nigeria</span>
              </div>
            </div>
            <div className="hero-verified-badge">✓ Verified Profile</div>
          </div>

          {/* Match % — bottom right */}
          <div className="hero-card hero-card-percent">
            <div className="hero-percent-ring">
              <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle cx="22" cy="22" r="18" className="hero-ring-bg" />
                <circle cx="22" cy="22" r="18" className="hero-ring-fill" />
              </svg>
              <span className="hero-percent-num">94%</span>
            </div>
            <span>Match Score</span>
          </div>

          {/* Like notification — bottom left */}
          <div className="hero-card hero-card-like">
            <span className="hero-like-icon">💕</span>
            <div>
              <strong>Chidi liked you</strong>
              <span>3 mins ago</span>
            </div>
          </div>

          {/* Premium badge — center */}
          <div className="hero-card hero-card-premium">
            <span>👑</span>
            <span>Premium Member</span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="hero-stats" ref={statsRef}>
        {STATS.map((s) => (
          <div className="hero-stat-item" key={s.label}>
            <span className="hero-stat-emoji" aria-hidden="true">{s.icon}</span>
            <div className="hero-stat-info">
              <span className="hero-stat-num">{s.value}</span>
              <span className="hero-stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

Hero.displayName = "Hero";
export default Hero;
