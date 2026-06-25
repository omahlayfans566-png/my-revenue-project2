import { Link } from "react-router-dom";
import "../style/hero.css";

const HEARTS = [
  { left: "7%", delay: "0s", duration: "8s" },
  { left: "20%", delay: "2.1s", duration: "10s" },
  { left: "35%", delay: "4s", duration: "7s" },
  { left: "52%", delay: "1.1s", duration: "9s" },
  { left: "68%", delay: "3.2s", duration: "8.5s" },
  { left: "82%", delay: "5s", duration: "7.5s" },
  { left: "93%", delay: "0.8s", duration: "11s" },
];

const Hero = () => (
  <section className="hero" aria-label="DateClone hero">

    {HEARTS.map((h, i) => (
      <span
        key={i}
        className="heart"
        aria-hidden="true"
        style={{
          left: h.left,
          ["--delay" as any]: h.delay,
          ["--dur" as any]: h.duration,
          animationDelay: h.delay,
          animationDuration: h.duration,
        }}
      >❤️</span>
    ))}

    <div className="hero-content">
      {/* Eyebrow */}
      <div className="hero-eyebrow">
        <span>💕</span> Africa's #1 Dating Platform
      </div>

      {/* Headline */}
      <h1>
        Find Your Perfect&nbsp;Match <span>Across Africa</span>
      </h1>

      {/* Subheading */}
      <p>
        Meet genuine singles, build meaningful relationships,
        and discover love — right where you are.
      </p>

      {/* CTAs */}
      <div className="hero-buttons">
        <Link to="/register" className="join-btn">
          Start for Free
        </Link>
        <Link to="/about" className="explore-btn">
          How It Works
        </Link>
      </div>

      {/* Social proof */}
      <div className="hero-social-proof" aria-label="Platform stats">
        <div className="hero-stat">
          <span className="hero-stat-val">2M+</span>
          <span className="hero-stat-label">Members</span>
        </div>
        <div className="hero-stat-divider" aria-hidden="true" />
        <div className="hero-stat">
          <span className="hero-stat-val">150K+</span>
          <span className="hero-stat-label">Success Stories</span>
        </div>
        <div className="hero-stat-divider" aria-hidden="true" />
        <div className="hero-stat">
          <span className="hero-stat-val">25+</span>
          <span className="hero-stat-label">Countries</span>
        </div>
        <div className="hero-stat-divider" aria-hidden="true" />
        <div className="hero-stat">
          <span className="hero-stat-val">4.9★</span>
          <span className="hero-stat-label">App Rating</span>
        </div>
      </div>
    </div>

  </section>
);

export default Hero;
