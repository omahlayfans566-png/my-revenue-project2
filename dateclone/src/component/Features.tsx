import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "../style/features.css";

const FEATURES = [
  {
    icon: "🧠",
    title: "Smart Compatibility",
    desc: "Our algorithm matches you based on values, interests, religion, lifestyle, and relationship goals — not just photos.",
  },
  {
    icon: "🌍",
    title: "Pan-African Community",
    desc: "Connect with genuine singles across 25+ African countries. Your next great love story could be a city — or a continent — away.",
  },
  {
    icon: "🔒",
    title: "Safe & Verified",
    desc: "Every profile goes through email verification. Block, report, and privacy controls keep your experience safe and in your control.",
  },
  {
    icon: "💬",
    title: "Meaningful Messaging",
    desc: "Chat only with people you've matched with. No spam, no strangers — just real conversations with people who already like you back.",
  },
  {
    icon: "📍",
    title: "Location-Aware",
    desc: "Auto-detect your location to find matches in your city, state, or anywhere across Africa — your choice, your distance.",
  },
  {
    icon: "✨",
    title: "Premium Boost",
    desc: "Upgrade to Gold or Platinum to see who likes you, send unlimited likes, and get priority visibility on the discover feed.",
  },
];

const Features = () => {
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("features-cards-visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    const current = cardsRef.current;
    if (current) observer.observe(current);
    return () => {
      if (current) observer.unobserve(current);
    };
  }, []);

  return (
    <section className="features-section">
      <div className="features-container">
        {/* Header */}
        <div className="features-header">
          <div className="features-badge">Why DateClone?</div>
          <h2 className="features-title">
            Built for African Singles.<br />
            <span className="features-title-gradient">Designed for Real Connection.</span>
          </h2>
          <p className="features-subtitle">
            We combine cultural intelligence, safety-first design, and smart matching
            to help you find someone truly compatible.
          </p>
        </div>

        {/* Grid */}
        <div className="features-cards" ref={cardsRef}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className="features-card" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="features-card-icon-wrap">
                <span className="features-card-icon">{f.icon}</span>
              </div>
              <h3 className="features-card-title">{f.title}</h3>
              <p className="features-card-desc">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="features-cta-section">
          <div className="features-cta-card">
            <div className="features-cta-icon">❤️</div>
            <h3 className="features-cta-title">Ready to Find Your Match?</h3>
            <p className="features-cta-desc">
              Join thousands of African singles who've found meaningful relationships through DateClone.
            </p>
            <div className="features-cta-buttons">
              <Link to="/register" className="features-cta-btn features-cta-btn-primary">
                Join Free Today
              </Link>
              <Link to="/about" className="features-cta-btn features-cta-btn-secondary">
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;