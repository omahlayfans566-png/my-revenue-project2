import { Link } from "react-router-dom";
import "../style/footer.css";

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-section">
                    <h3 className="footer-logo">DateClone 💕</h3>
                    <p className="footer-description">Connect with like-minded people and find meaningful relationships across Africa.</p>
                    <div className="social-links">
                        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-icon">f</a>
                        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-icon">𝕏</a>
                        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-icon">ig</a>
                    </div>
                </div>

                <div className="footer-section">
                    <h4 className="footer-title">Product</h4>
                    <ul className="footer-links">
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/premium">Premium</Link></li>
                        <li><Link to="/about">About</Link></li>
                        <li><Link to="/faq">FAQ</Link></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4 className="footer-title">Company</h4>
                    <ul className="footer-links">
                        <li><Link to="/about">About Us</Link></li>
                        <li><Link to="/contact">Contact</Link></li>
                        <li><a href="#">Blog</a></li>
                        <li><a href="#">Careers</a></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4 className="footer-title">Legal</h4>
                    <ul className="footer-links">
                        <li><Link to="/privacy">Privacy Policy</Link></li>
                        <li><Link to="/terms">Terms of Service</Link></li>
                        <li><a href="#">Cookie Policy</a></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4 className="footer-title">Newsletter</h4>
                    <p className="newsletter-text">Subscribe to get updates</p>
                    <form className="newsletter-form" onSubmit={e => e.preventDefault()}>
                        <input type="email" placeholder="Enter your email" className="newsletter-input" />
                        <button type="submit" className="newsletter-btn">Subscribe</button>
                    </form>
                </div>
            </div>

            <div className="footer-bottom">
                <div className="footer-copyright">
                    <p>&copy; 2026 DateClone. All rights reserved.</p>
                </div>
                <div className="footer-bottom-links">
                    <Link to="/privacy">Privacy</Link>
                    <Link to="/terms">Terms</Link>
                    <Link to="/contact">Contact</Link>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
