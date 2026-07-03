import { useState } from "react";
import Navbar from "../component/Navbar";
import Footer from "../component/Footer";
import "../style/staticPage.css";

const FAQS = [
    {
        q: "Is DateClone free to use?",
        a: "Yes! DateClone has a free plan that lets you browse profiles, like people, and message your matches. Premium plans unlock advanced features like seeing who liked you, unlimited likes, and priority visibility.",
    },
    {
        q: "How does the matching system work?",
        a: "Our algorithm matches you based on interests, age range, location, relationship goals, religion, and lifestyle preferences. When two people like each other, it's a match — and you can start chatting instantly!",
    },
    {
        q: "Is my personal information safe?",
        a: "Absolutely. We use industry-standard encryption to protect your data and never sell it to third parties. You can control your privacy settings — including who sees your profile and your online status — at any time.",
    },
    {
        q: "How do I verify my account?",
        a: "After registering, you'll receive a 6-digit OTP to your registered email. Enter it on the verification page to activate your account. If you don't see it, check your spam folder or request a resend.",
    },
    {
        q: "Can I delete my account?",
        a: "Yes. Go to Settings → Danger Zone → Delete Account. All your data will be permanently removed within 30 days. This action cannot be undone.",
    },
    {
        q: "What countries does DateClone support?",
        a: "DateClone supports all 54 African countries. We auto-detect your location during registration, but you can manually set any African country in your profile settings.",
    },
    {
        q: "How do I report a suspicious user?",
        a: "On any profile page, tap the Report button. Our moderation team reviews all reports within 24 hours. You can also block a user at any time — they won't be notified and won't be able to see your profile.",
    },
    {
        q: "How do I cancel my Premium subscription?",
        a: "Go to Settings → Premium Membership → Manage → Cancel Subscription. Your premium benefits remain active until the end of the current billing period.",
    },
    {
        q: "Can I use DateClone without a photo?",
        a: "You can browse the app, but profiles without photos receive significantly fewer matches. We strongly recommend adding a clear, recent photo — it's the single biggest factor in getting matched!",
    },
    {
        q: "How do the daily like limits work on the free plan?",
        a: "Free members can send up to 20 likes per day. Upgrade to Gold or Platinum for unlimited likes and the ability to see exactly who liked your profile.",
    },
];

const FAQ = () => {
    const [open, setOpen] = useState<number | null>(0);

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="static-page">
                <div className="static-hero">
                    <h1>Frequently Asked <span className="grad-text">Questions</span></h1>
                    <p>Everything you need to know about DateClone. Can't find your answer? <a href="/contact" style={{ color: "#ff1744", fontWeight: 700 }}>Contact us →</a></p>
                </div>

                <div className="static-content">
                    <div className="faq-list">
                        {FAQS.map((item, i) => (
                            <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
                                <button
                                    className="faq-question"
                                    onClick={() => setOpen(open === i ? null : i)}
                                    aria-expanded={open === i}
                                >
                                    <span>{item.q}</span>
                                    <span className="faq-chevron" aria-hidden="true">{open === i ? "▲" : "▼"}</span>
                                </button>
                                {open === i && (
                                    <div className="faq-answer">
                                        <p>{item.a}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="faq-cta">
                        <h3>Still have questions?</h3>
                        <p>Our support team is happy to help you out.</p>
                        <a href="/contact" className="btn btn-primary" style={{ display: "inline-flex", marginTop: 14 }}>
                            Contact Support →
                        </a>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default FAQ;
