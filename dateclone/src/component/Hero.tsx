import { Link } from "react-router-dom";
import "../style/hero.css";

const HEARTS = [
  { left: "8%", delay: "0s", duration: "7s" },
  { left: "22%", delay: "1.8s", duration: "9s" },
  { left: "38%", delay: "3.5s", duration: "6.5s" },
  { left: "58%", delay: "0.9s", duration: "8s" },
  { left: "74%", delay: "2.8s", duration: "7.5s" },
  { left: "88%", delay: "4.2s", duration: "6s" },
];

const Hero = () => {
  return (
    <section className="hero" aria-label="Hero section">

      {/* Floating hearts — outside the content card, inside the section */}
      {HEARTS.map((h, i) => (
        <span
          key={i}
          className="heart"
          aria-hidden="true"
          style={{
            left: h.left,
            animationDelay: h.delay,
            animationDuration: h.duration,
          }}
        >
          ❤️
        </span>
      ))}

      {/* Glass content card */}
      <div className="hero-content">
        <h1>Connecting Hearts&nbsp;Across&nbsp;Africa</h1>

        <p>
          Meet genuine singles, build meaningful relationships,
          and discover love near you.
        </p>

        <div className="hero-buttons">
          <Link to="/register" className="join-btn">
            Join Free
          </Link>
          <Link to="/register" className="explore-btn">
            Explore Members
          </Link>
        </div>
      </div>

    </section>
  );
};

export default Hero;
