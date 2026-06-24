import "../style/footer.css";

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-container">
                {/* Brand Section */}
                <div className="footer-section">
                    <h3 className="footer-logo">DateClone</h3>
                    <p className="footer-description">
                        Connect with like-minded people and find meaningful relationships.
                    </p>
                    <div className="social-links">
                        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-icon">f</a>
                        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-icon">t</a>
                        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-icon">i</a>
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="social-icon">l</a>
                    </div>
                </div>

                {/* Product Links */}
                <div className="footer-section">
                    <h4 className="footer-title">Product</h4>
                    <ul className="footer-links">
                        <li><a href="#features">Features</a></li>
                        <li><a href="#pricing">Pricing</a></li>
                        <li><a href="#premium">Premium</a></li>
                        <li><a href="#apps">Apps</a></li>
                    </ul>
                </div>

                {/* Company Links */}
                <div className="footer-section">
                    <h4 className="footer-title">Company</h4>
                    <ul className="footer-links">
                        <li><a href="#about">About</a></li>
                        <li><a href="#blog">Blog</a></li>
                        <li><a href="#careers">Careers</a></li>
                        <li><a href="#contact">Contact</a></li>
                    </ul>
                </div>

                {/* Legal Links */}
                <div className="footer-section">
                    <h4 className="footer-title">Legal</h4>
                    <ul className="footer-links">
                        <li><a href="#privacy">Privacy Policy</a></li>
                        <li><a href="#terms">Terms of Service</a></li>
                        <li><a href="#cookies">Cookie Policy</a></li>
                        <li><a href="#disclaimer">Disclaimer</a></li>
                    </ul>
                </div>

                {/* Newsletter */}
                <div className="footer-section">
                    <h4 className="footer-title">Newsletter</h4>
                    <p className="newsletter-text">Subscribe to get updates</p>
                    <form className="newsletter-form">
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className="newsletter-input"
                        />
                        <button type="submit" className="newsletter-btn">
                            Subscribe
                        </button>
                    </form>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="footer-bottom">
                <div className="footer-copyright">
                    <p>&copy; 2024 DateClone. All rights reserved.</p>
                </div>
                <div className="footer-bottom-links">
                    <a href="#privacy">Privacy</a>
                    <a href="#terms">Terms</a>
                    <a href="#cookies">Cookies</a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
