import "../style/features.css";

const Features = () => {
  return (
    <section className="features">

      <h2>Why Choose DateClone?</h2>

      <div className="feature-grid">

        <div className="card">
          <h3>❤️ Smart Matching</h3>
          <p>Find compatible singles across Africa.</p>
        </div>

        <div className="card">
          <h3>🌍 African Community</h3>
          <p>Connect with real people near you.</p>
        </div>

        <div className="card">
          <h3>🔒 Safe Dating</h3>
          <p>Protected accounts and secure messaging.</p>
        </div>

      </div>
    </section>
  );
};

export default Features;