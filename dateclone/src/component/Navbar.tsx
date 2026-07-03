import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../style/navbar.css";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const close = () => setMobileMenuOpen(false);

  return (
    <nav className="navbar">
      <Link to="/" className="logo">DateClone 💕</Link>

      {/* Desktop links */}
      <ul className="nav-links">
        <li><Link to="/" className={isActive("/") ? "active" : ""}>Home</Link></li>
        <li><Link to="/about" className={isActive("/about") ? "active" : ""}>About</Link></li>
        <li><Link to="/faq" className={isActive("/faq") ? "active" : ""}>FAQ</Link></li>
        <li><Link to="/premium" className={isActive("/premium") ? "active" : ""}>Premium</Link></li>
        <li><Link to="/contact" className={isActive("/contact") ? "active" : ""}>Contact</Link></li>
      </ul>

      <div className="nav-buttons">
        <Link to="/login" className="login-btn">Login</Link>
        <Link to="/register" className="signup-btn">Sign Up Free</Link>
      </div>

      <button
        className={`hamburger-menu ${mobileMenuOpen ? "active" : ""}`}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
        aria-expanded={mobileMenuOpen}
      >
        <span /><span /><span />
      </button>

      <div className={`mobile-nav ${mobileMenuOpen ? "active" : ""}`}>
        <Link to="/" className={isActive("/") ? "active" : ""} onClick={close}>Home</Link>
        <Link to="/about" className={isActive("/about") ? "active" : ""} onClick={close}>About</Link>
        <Link to="/faq" className={isActive("/faq") ? "active" : ""} onClick={close}>FAQ</Link>
        <Link to="/premium" className={isActive("/premium") ? "active" : ""} onClick={close}>Premium</Link>
        <Link to="/contact" className={isActive("/contact") ? "active" : ""} onClick={close}>Contact</Link>
        <div className="mobile-nav-divider" />
        <Link to="/login" className="login-btn" onClick={close}>Login</Link>
        <Link to="/register" className="signup-btn" onClick={close}>Sign Up Free</Link>
      </div>
    </nav>
  );
};

export default Navbar;
