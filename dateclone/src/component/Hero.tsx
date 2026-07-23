import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import "../style/hero.css";

const FLOATING_HEARTS = [
  { left: "10%", delay: "0s", duration: "8s", size: "1.2rem" },
  { left: "25%", delay: "2.5s", duration: "10s", size: "0.9rem" },
  { left: "40%", delay: "4.2s", duration: "7.5s", size: "1.1rem" },
  { left: "55%", delay: "1.5s", duration: "9s", size: "0.8rem" },
  { left: "70%", delay: "3.8s", duration: "8.5s", size: "1.3rem" },
  { left: "85%", delay: "5.5s", duration: "7s", size: "1rem" },
];

const Hero = () => {
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("hero-stats-visible");
          }
        });
      },
      { threshold: 0.3 }
    );

    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="hero-section" aria-label="DateClone hero">

      {/* Floating decorative hearts */}
      {FLOATING_HEARTS.map((h, i) => (
        <span
          key={i}
          className="hero-float-heart"
          aria-hidden="true"
          style={{
            left: h.left,
            animationDelay: h.delay,
            animationDuration: h.duration,
            fontSize: h.size,
          }}
        >❤️</span>
      ))}

      <div className="hero-container">
        {/* Left Column */}
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-icon">💕</span>
            Africa's #1 Dating Platform
          </div>

          <h1 className="hero-title">
            Find Your{" "}
            <span className="hero-title-gradient">Perfect Match</span>
            {" "}Across Africa
          </h1>

          <p className="hero-subtitle">
            Meet genuine singles, build meaningful relationships, and discover love — right where you are.
          </p>

          <div className="hero-buttons">
            <Link to="/register" className="hero-btn hero-btn-primary">
              Start for Free
              <span className="hero-btn-arrow">→</span>
            </Link>
            <Link to="/about" className="hero-btn hero-btn-secondary">
              How It Works
            </Link>
          </div>

          {/* Trust indicators - floating stats card */}
          <div className="hero-stats" ref={statsRef}>
            <div className="hero-stat-item">
              <span className="hero-stat-icon">👥</span>
              <div className="hero-stat-info">
                <span className="hero-stat-num">2M+</span>
                <span className="hero-stat-label">Members</span>
              </div>
            </div>
            <div className="hero-stat-divider" aria-hidden="true" />
            <div className="hero-stat-item">
              <span className="hero-stat-icon">💍</span>
              <div className="hero-stat-info">
                <span className="hero-stat-num">150K+</span>
                <span className="hero-stat-label">Success Stories</span>
              </div>
            </div>
            <div className="hero-stat-divider" aria-hidden="true" />
            <div className="hero-stat-item">
              <span className="hero-stat-icon">🌍</span>
              <div className="hero-stat-info">
                <span className="hero-stat-num">25+</span>
                <span className="hero-stat-label">Countries</span>
              </div>
            </div>
            <div className="hero-stat-divider" aria-hidden="true" />
            <div className="hero-stat-item">
              <span className="hero-stat-icon">⭐</span>
              <div className="hero-stat-info">
                <span className="hero-stat-num">4.9★</span>
                <span className="hero-stat-label">App Rating</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Decorative artwork */}
        <div className="hero-artwork" aria-hidden="true">
          <div className="hero-artwork-bg">
            <svg className="hero-artwork-svg" viewBox="0 0 400 500" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Decorative heart line path */}
              <path
                d="M200 60 C120 60 40 120 40 200 C40 300 120 340 200 420 C280 340 360 300 360 200 C360 120 280 60 200 60Z"
                stroke="rgba(255,45,122,0.12)"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M200 100 C140 100 80 145 80 210 C80 280 140 310 200 380 C260 310 320 280 320 210 C320 145 260 100 200 100Z"
                stroke="rgba(255,45,122,0.08)"
                strokeWidth="1.5"
                fill="none"
              />
              {/* Floating small hearts on the right */}
              <text x="300" y="150" fontSize="24" fill="rgba(255,45,122,0.15)">❤️</text>
              <text x="330" y="280" fontSize="18" fill="rgba(255,45,122,0.1)">❤️</text>
              <text x="280" y="350" fontSize="20" fill="rgba(255,45,122,0.12)">❤️</text>
              <text x="340" y="200" fontSize="14" fill="rgba(255,45,122,0.08)">❤️</text>
            </svg>
          </div>

          {/* Floating feature card */}
          <div className="hero-feature-card">
            <div className="hero-feature-card-dot" />
            <div className="hero-feature-card-content">
              <span className="hero-feature-card-title">Smart Matching</span>
              <span className="hero-feature-card-desc">AI-powered compatibility</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;