import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "../style/navbar.css";

const NAV_LINKS = [
  { path: "/", label: "Home" },
  { path: "/about", label: "About" },
  { path: "/faq", label: "FAQ" },
  { path: "/premium", label: "Premium" },
  { path: "/contact", label: "Contact" },
];

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const close = () => setMobileMenuOpen(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className={`navbar ${scrolled ? "navbar-scrolled" : ""}`}>
      <Link to="/" className="navbar-logo">
        <span className="navbar-logo-icon">💕</span>
        <span className="navbar-logo-text">DateClone</span>
      </Link>

      {/* Desktop links */}
      <ul className="navbar-links">
        {NAV_LINKS.map(({ path, label }) => (
          <li key={path}>
            <Link
              to={path}
              className={`navbar-link ${isActive(path) ? "active" : ""}`}
            >
              {label}
              {isActive(path) && <span className="navbar-link-underline" />}
            </Link>
          </li>
        ))}
      </ul>

      <div className="navbar-buttons">
        <Link to="/login" className="navbar-btn navbar-btn-login">Log In</Link>
        <Link to="/register" className="navbar-btn navbar-btn-signup">Sign Up Free</Link>
      </div>

      <button
        className={`navbar-hamburger ${mobileMenuOpen ? "active" : ""}`}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
        aria-expanded={mobileMenuOpen}
      >
        <span /><span /><span />
      </button>

      <div className={`navbar-mobile ${mobileMenuOpen ? "active" : ""}`}>
        {NAV_LINKS.map(({ path, label }) => (
          <Link
            key={path}
            to={path}
            className={`navbar-mobile-link ${isActive(path) ? "active" : ""}`}
            onClick={close}
          >
            {label}
          </Link>
        ))}
        <div className="navbar-mobile-divider" />
        <Link to="/login" className="navbar-btn navbar-btn-login" onClick={close}>Log In</Link>
        <Link to="/register" className="navbar-btn navbar-btn-signup" onClick={close}>Sign Up Free</Link>
      </div>
    </nav>
  );
};

export default Navbar;