import Navbar from "../component/Navbar";
import Footer from "../component/Footer";
import "../style/staticPage.css";

const About = () => (
    <div className="page-wrapper">
        <Navbar />
        <div className="static-page">
            <div className="static-hero">
                <h1>About <span className="grad-text">DateClone</span></h1>
                <p>Connecting hearts across Africa, one match at a time.</p>
            </div>

            <div className="static-content">
                <div className="static-section">
                    <h2>Our Mission</h2>
                    <p>DateClone is Africa's premier dating platform, built to help millions of singles across the continent find genuine, meaningful connections. We believe every African deserves love — and we're here to make that journey easier, safer, and more exciting.</p>
                </div>

                <div className="static-cards">
                    <div className="static-card">
                        <div className="sc-icon">🌍</div>
                        <h3>Pan-African</h3>
                        <p>Available in 25+ African countries, DateClone bridges distances and cultures to bring people together.</p>
                    </div>
                    <div className="static-card">
                        <div className="sc-icon">🔒</div>
                        <h3>Safe & Secure</h3>
                        <p>All profiles are verified. Advanced safety features protect you every step of the way.</p>
                    </div>
                    <div className="static-card">
                        <div className="sc-icon">💡</div>
                        <h3>Smart Matching</h3>
                        <p>Our compatibility algorithm considers interests, values, religion, and relationship goals.</p>
                    </div>
                    <div className="static-card">
                        <div className="sc-icon">💕</div>
                        <h3>Real Love Stories</h3>
                        <p>Over 150,000 couples have found lasting relationships through DateClone since 2023.</p>
                    </div>
                </div>

                <div className="static-section">
                    <h2>Our Story</h2>
                    <p>Founded in Lagos, Nigeria in 2023, DateClone was built by a team of African engineers and designers who saw the need for a dating platform that truly understood African culture, values, and relationships. We're not just another app — we're a community.</p>
                </div>

                <div className="static-stats">
                    <div><h3>2M+</h3><p>Registered Users</p></div>
                    <div><h3>150K+</h3><p>Success Stories</p></div>
                    <div><h3>25+</h3><p>African Countries</p></div>
                    <div><h3>4.8★</h3><p>App Rating</p></div>
                </div>
            </div>
        </div>
        <Footer />
    </div>
);

export default About;
