import "../style/hero.css";

const Hero = () => {
  return (
    <section className="hero">
      <div className="hero-content">
        <span className="heart" style={{ left: "10%" }}>
          ❤️
        </span>
        <span className="heart" style={{ left: "25%", animationDelay: "2s" }}>
          ❤️
        </span>
        <span className="heart" style={{ left: "40%", animationDelay: "4s" }}>
          ❤️
        </span>
        <span className="heart" style={{ left: "60%", animationDelay: "1s" }}>
          ❤️
        </span>
        <span className="heart" style={{ left: "80%", animationDelay: "3s" }}>
          ❤️
        </span>

        <h1>Connecting Hearts Across Africa</h1>

        <p>
          Meet genuine singles, build meaningful relationships and discover love
          near you.
        </p>

        <div className="hero-buttons">
          <button className="join-btn">Join Free</button>
          <button className="explore-btn">Explore Members</button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
