import Navbar from "../component/Navbar";
import Footer from "../component/Footer";
import "../style/staticPage.css";

const Terms = () => (
    <div className="page-wrapper">
        <Navbar />
        <div className="static-page">
            <div className="static-hero"><h1>Terms of <span className="grad-text">Service</span></h1><p>Last updated: June 2026</p></div>
            <div className="static-content">
                <div className="legal-content">
                    {[
                        ["1. Acceptance of Terms", "By accessing or using DateClone, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services."],
                        ["2. Eligibility", "You must be at least 18 years old to use DateClone. By registering, you confirm that you are 18 or older."],
                        ["3. User Accounts", "You are responsible for maintaining the confidentiality of your account credentials. You agree not to share your login details with others."],
                        ["4. Acceptable Use", "You agree not to use DateClone for any illegal purpose, to harass other users, to post false or misleading information, or to attempt to gain unauthorized access to other accounts."],
                        ["5. Privacy", "Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and share information about you."],
                        ["6. Premium Subscriptions", "Premium subscriptions are billed on a recurring basis. You may cancel at any time, but no refunds are issued for partial billing periods."],
                        ["7. Termination", "We reserve the right to terminate accounts that violate these terms, engage in abusive behavior, or use the platform for fraudulent purposes."],
                        ["8. Limitation of Liability", "DateClone is not responsible for the actions of other users. We provide a platform for connection but cannot guarantee the behavior of individuals you meet."],
                        ["9. Changes", "We may update these terms periodically. Continued use of DateClone after changes constitutes acceptance of the new terms."],
                        ["10. Contact", "Questions about these terms? Email us at legal@dateclone.com"],
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

export default Terms;
