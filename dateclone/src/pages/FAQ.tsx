import { useState } from "react";
import Navbar from "../component/Navbar";
import Footer from "../component/Footer";
import "../style/staticPage.css";

const FAQS = [
    { q: "Is DateClone free to use?", a: "Yes! DateClone has a free plan that lets you browse profiles, like people, and message your matches. Premium plans unlock advanced features." },
    { q: "How does the matching system work?", a: "Our algorithm matches you based on interests, age range, location, relationship goals, religion, and lifestyle preferences. When two people like each other, it's a match!" },
    { q: "Is my personal information safe?", a: "Absolutely. We use industry-standard encryption to protect your data and never sell it to third parties. You can control your privacy settings at any time." },
    { q: "How do I verify my account?", a: "After registering, you'll receive a 6-digit verification code to your email. Enter it on the verification page to activate your account." },
    { q: "Can I delete my account?", a: "Yes. Go to Settings → Danger Zone → Delete Account. All your data will be permanently removed within 30 days." },
    { q: "What countries does DateClone support?", a: "DateClone supports all 54 African countries. We auto-detect your location during registration, but you can manually set any African country." },
    { q: "How do I report a suspicious user?", a: "On any profile, tap the three dots menu and select 'Report'. Our moderation team reviews all reports within 24 hours." },
    { q: "How do I cancel my Premium subscription?", a: "Go to Settings → Premium Membership → Manage → Cancel Subscription. Your premium benefits remain until the end of the billing period." },
];

const FAQ = () => {
    const [open, setOpen] = useState<number | null>(null);
    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="static-page">
                <div className="static-hero">
                    <h1>Frequently Asked <span className="grad-text">Questions</span></h1>
                    <p>Everything you need to know about DateClone.</p>
                </div>
                <div className="static-content">
                    <div className="faq-list">
                        {FAQS.map((item, i) => (
                            <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
                                <button className="faq-question" onClick={() => setOpen(open === i ? null : i)}>
                                    {item.q}
                                    <span className="faq-chevron">{open === i ? "▲" : "▼"}</span>
                                </button>
                                {open === i && <div className="faq-answer"><p>{item.a}</p></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default FAQ;
