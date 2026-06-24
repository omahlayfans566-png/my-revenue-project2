import { useState } from "react";
import Navbar from "../component/Navbar";
import Footer from "../component/Footer";
import "../style/staticPage.css";

const Contact = () => {
    const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
    const [sent, setSent] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSent(true);
    };

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="static-page">
                <div className="static-hero">
                    <h1>Contact <span className="grad-text">Us</span></h1>
                    <p>We'd love to hear from you. Send us a message!</p>
                </div>

                <div className="static-content">
                    <div className="contact-layout">
                        <div className="contact-info">
                            <h2>Get in Touch</h2>
                            <div className="contact-item"><span>📧</span><div><strong>Email</strong><p>support@dateclone.com</p></div></div>
                            <div className="contact-item"><span>📍</span><div><strong>Address</strong><p>Lagos, Nigeria</p></div></div>
                            <div className="contact-item"><span>🕐</span><div><strong>Hours</strong><p>Mon–Fri, 9am–6pm WAT</p></div></div>
                        </div>

                        <div className="contact-form-wrap">
                            {sent ? (
                                <div className="contact-success">
                                    <div style={{ fontSize: "3rem", marginBottom: 12 }}>✅</div>
                                    <h3>Message Sent!</h3>
                                    <p>Thank you for reaching out. We'll reply within 24 hours.</p>
                                </div>
                            ) : (
                                <form className="contact-form" onSubmit={handleSubmit}>
                                    <div className="ep-row">
                                        <div className="ep-field">
                                            <label>Name</label>
                                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" required />
                                        </div>
                                        <div className="ep-field">
                                            <label>Email</label>
                                            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" required />
                                        </div>
                                    </div>
                                    <div className="ep-field">
                                        <label>Subject</label>
                                        <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="How can we help?" required />
                                    </div>
                                    <div className="ep-field">
                                        <label>Message</label>
                                        <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={5} placeholder="Tell us more…" required />
                                    </div>
                                    <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "14px" }}>Send Message</button>
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
