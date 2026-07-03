import { useState } from "react";
import Navbar from "../component/Navbar";
import Footer from "../component/Footer";
import "../style/staticPage.css";

const Contact = () => {
    const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.name.trim()) e.name = "Name is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
        if (!form.subject.trim()) e.subject = "Subject is required";
        if (form.message.trim().length < 10) e.message = "Message must be at least 10 characters";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSending(true);
        // Simulate submission delay
        setTimeout(() => {
            setSending(false);
            setSent(true);
        }, 800);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
    };

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="static-page">
                <div className="static-hero">
                    <h1>Contact <span className="grad-text">Us</span></h1>
                    <p>We'd love to hear from you. Send us a message and we'll respond within 24 hours.</p>
                </div>

                <div className="static-content">
                    <div className="contact-layout">

                        {/* Contact info */}
                        <div className="contact-info">
                            <h2>Get in Touch</h2>

                            <div className="contact-item">
                                <span>📧</span>
                                <div>
                                    <strong>Email</strong>
                                    <p>support@dateclone.com</p>
                                </div>
                            </div>

                            <div className="contact-item">
                                <span>📍</span>
                                <div>
                                    <strong>Address</strong>
                                    <p>Lagos, Nigeria</p>
                                </div>
                            </div>

                            <div className="contact-item">
                                <span>🕐</span>
                                <div>
                                    <strong>Support Hours</strong>
                                    <p>Mon–Fri, 9am–6pm WAT</p>
                                </div>
                            </div>

                            <div className="contact-item">
                                <span>💬</span>
                                <div>
                                    <strong>Response Time</strong>
                                    <p>Within 24 hours</p>
                                </div>
                            </div>

                            {/* Quick links */}
                            <div className="contact-quick-links">
                                <p className="contact-quick-title">Quick Links</p>
                                <a href="/faq">📖 Browse FAQ</a>
                                <a href="/about">ℹ️ About DateClone</a>
                                <a href="/premium">✨ Premium Plans</a>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="contact-form-wrap">
                            {sent ? (
                                <div className="contact-success">
                                    <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>✅</div>
                                    <h3>Message Sent!</h3>
                                    <p>Thank you for reaching out. We'll reply to <strong>{form.email}</strong> within 24 hours.</p>
                                    <button
                                        className="btn btn-outline"
                                        style={{ marginTop: 20 }}
                                        onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                                    >
                                        Send Another
                                    </button>
                                </div>
                            ) : (
                                <form className="contact-form" onSubmit={handleSubmit} noValidate>
                                    <div className="ep-row">
                                        <div className={`ep-field ${errors.name ? "has-error" : ""}`}>
                                            <label>Your Name</label>
                                            <input
                                                name="name"
                                                value={form.name}
                                                onChange={handleChange}
                                                placeholder="e.g. Amara Osei"
                                            />
                                            {errors.name && <span className="field-error">{errors.name}</span>}
                                        </div>
                                        <div className={`ep-field ${errors.email ? "has-error" : ""}`}>
                                            <label>Email Address</label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={form.email}
                                                onChange={handleChange}
                                                placeholder="you@example.com"
                                            />
                                            {errors.email && <span className="field-error">{errors.email}</span>}
                                        </div>
                                    </div>

                                    <div className={`ep-field ${errors.subject ? "has-error" : ""}`}>
                                        <label>Subject</label>
                                        <input
                                            name="subject"
                                            value={form.subject}
                                            onChange={handleChange}
                                            placeholder="How can we help?"
                                        />
                                        {errors.subject && <span className="field-error">{errors.subject}</span>}
                                    </div>

                                    <div className={`ep-field ${errors.message ? "has-error" : ""}`}>
                                        <label>Message</label>
                                        <textarea
                                            name="message"
                                            value={form.message}
                                            onChange={handleChange}
                                            rows={5}
                                            placeholder="Tell us more about your question or feedback…"
                                        />
                                        {errors.message && <span className="field-error">{errors.message}</span>}
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        style={{ width: "100%", padding: "14px", fontSize: "1rem" }}
                                        disabled={sending}
                                    >
                                        {sending
                                            ? <><span className="auth-spinner" style={{ width: 18, height: 18, borderWidth: 2, marginRight: 8 }} />Sending…</>
                                            : "Send Message →"}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default Contact;
