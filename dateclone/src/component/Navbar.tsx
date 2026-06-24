import { useState } from "react";
import { Link } from "react-router-dom";
import "../style/navbar.css";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <Link to="/" className="logo">DateClone 💕</Link>

      {/* Desktop links */}
      <ul className="nav-links">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/about">About</Link></li>
        <li><Link to="/faq">FAQ</Link></li>
        <li><Link to="/premium">Premium</Link></li>
      </ul>

      <div className="nav-buttons">
        <Link to="/login" className="login-btn">Login</Link>
        <Link to="/register" className="signup-btn">Sign Up</Link>
      </div>

      <button
        className={`hamburger-menu ${mobileMenuOpen ? "active" : ""}`}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <span /><span /><span />
      </button>

      <div className={`mobile-nav ${mobileMenuOpen ? "active" : ""}`}>
        <Link to="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
        <Link to="/about" onClick={() => setMobileMenuOpen(false)}>About</Link>
        <Link to="/faq" onClick={() => setMobileMenuOpen(false)}>FAQ</Link>
        <Link to="/premium" onClick={() => setMobileMenuOpen(false)}>Premium</Link>
        <Link to="/login" className="login-btn" onClick={() => setMobileMenuOpen(false)}>Login</Link>
        <Link to="/register" className="signup-btn" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
      </div>
    </nav>
  );
};

export default Navbar;
