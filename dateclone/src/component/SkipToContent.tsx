import "../style/skipToContent.css";

export default function SkipToContent() {
  return (
    <a href="#main-content" className="skip-to-content" tabIndex={0}>
      Skip to main content
    </a>
  );
}