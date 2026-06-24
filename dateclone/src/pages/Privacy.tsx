import Navbar from "../component/Navbar";
import Footer from "../component/Footer";
import "../style/staticPage.css";

const Privacy = () => (
    <div className="page-wrapper">
        <Navbar />
        <div className="static-page">
            <div className="static-hero"><h1>Privacy <span className="grad-text">Policy</span></h1><p>Last updated: June 2026</p></div>
            <div className="static-content">
                <div className="legal-content">
                    {[
                        ["Information We Collect", "We collect information you provide during registration (name, email, date of birth, photos, interests), usage data (profiles viewed, likes given), and location data when you grant permission."],
                        ["How We Use Your Information", "We use your information to show you relevant matches, send notifications, improve our services, and communicate important account updates. We never sell your personal data."],
                        ["Profile Visibility", "Your profile is visible to other registered users. You can control who sees your online status and location through Privacy Settings."],
                        ["Data Security", "We use TLS encryption for all data in transit and AES-256 encryption for sensitive stored data. Passwords are hashed using bcrypt and never stored in plain text."],
                        ["Your Rights", "You may access, correct, or delete your personal data at any time through Settings. You may also request a data export by emailing privacy@dateclone.com."],
                        ["Cookies", "We use cookies to keep you logged in and to analyze site performance. You can disable cookies in your browser, but some features may not work correctly."],
                        ["Third Parties", "We share limited data with Stripe for payment processing and Cloudinary for image hosting. Both are bound by strict data protection agreements."],
                        ["Children's Privacy", "DateClone is strictly for users 18 and older. We do not knowingly collect data from minors. If we become aware of any, it is deleted immediately."],
                        ["Changes to This Policy", "We will notify you by email if we make significant changes to this policy."],
                        ["Contact", "Privacy questions? Reach us at privacy@dateclone.com"],
                    ].map(([title, body]) => (
                        <div key={title} className="legal-section">
                            <h3>{title}</h3>
                            <p>{body}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        <Footer />
    </div>
);

export default Privacy;
