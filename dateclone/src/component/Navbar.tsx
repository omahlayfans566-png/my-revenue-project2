import { useState } from "react";
import { Link } from "react-router-dom";
import "../style/navbar.css";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="logo">DateClone</div>

      {/* Desktop Navigation Links */}
      <ul className="nav-links">
        <li>Home</li>
        <li>About</li>
        <li>Members</li>
        <li>Premium</li>
      </ul>

      {/* Desktop Navigation Buttons */}
      <div className="nav-buttons">
        <Link to="/login" className="login-btn">
          Login
        </Link>
        <Link to="/register" className="signup-btn">
          Sign Up
        </Link>
      </div>

      {/* Hamburger Menu Button (Mobile Only) */}
      <button
        className={`hamburger-menu ${mobileMenuOpen ? "active" : ""}`}
        onClick={toggleMobileMenu}
        aria-label="Toggle mobile menu"
        aria-expanded={mobileMenuOpen}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Mobile Navigation Menu */}
      <div className={`mobile-nav ${mobileMenuOpen ? "active" : ""}`}>
        <li onClick={closeMobileMenu}>Home</li>
        <li onClick={closeMobileMenu}>About</li>
        <li onClick={closeMobileMenu}>Members</li>
        <li onClick={closeMobileMenu}>Premium</li>
        <Link to="/login" className="login-btn" onClick={closeMobileMenu}>
          Login
        </Link>
        <Link to="/register" className="signup-btn" onClick={closeMobileMenu}>
          Sign Up
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
