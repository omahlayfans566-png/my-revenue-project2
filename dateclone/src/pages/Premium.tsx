import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../component/Navbar";
import Footer from "../component/Footer";
import AppNavbar from "../component/AppNavbar";
import { useAuth } from "../context/AuthContext";
import { paymentAPI } from "../services/apiService";
import "../style/premium.css";

const plans = [
    {
        id: "gold",
        name: "Gold",
        emoji: "⭐",
        price: "$9.99",
        period: "/month",
        color: "#f57f17",
        gradient: "linear-gradient(135deg, #f57f17, #fbc02d)",
        features: [
            "✓ See who likes you",
            "✓ Advanced filters",
            "✓ Message anyone",
            "✓ Unlimited likes",
            "✓ Read receipts",
        ],
    },
    {
        id: "platinum",
        name: "Platinum",
        emoji: "💎",
        price: "$19.99",
        period: "/month",
        color: "#7b1fa2",
        gradient: "linear-gradient(135deg, #7b1fa2, #ab47bc)",
        features: [
            "✓ All Gold features",
            "✓ Priority visibility",
            "✓ Verified badge",
            "✓ Instant messaging",
            "✓ Hide your profile",
            "✓ Rematch feature",
            "✓ 24/7 support",
        ],
        popular: true,
    },
];

const Premium = () => {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState("");

    const handleSubscribe = async (tier: string) => {
        if (!isAuthenticated) { navigate("/register"); return; }
        setLoading(tier); setError("");
        try {
            const res = await paymentAPI.createPaymentIntent(tier);
            // In production: redirect to Stripe checkout with res.clientSecret
            alert(`Payment intent created for ${tier}! In production, Stripe would open here.\nClient secret: ${res.clientSecret?.slice(0, 20)}…`);
        } catch (e: any) {
            setError(e.message || "Failed to initiate payment.");
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="page-wrapper">
            {isAuthenticated ? <AppNavbar /> : <Navbar />}

            <div className="premium-page">
                <div className="premium-hero">
                    <h1>Upgrade to <span className="grad-text">Premium</span></h1>
                    <p>Unlock all features and find your perfect match faster.</p>
                </div>

                {user?.isPremium && (
                    <div className="premium-active-banner">
                        ✨ You're on <strong>{user.premiumTier?.toUpperCase()}</strong>! Enjoy all premium features.
                    </div>
                )}

                {error && <div className="premium-error">{error}</div>}

                <div className="premium-cards">
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            className={`premium-card ${plan.popular ? "popular" : ""}`}
                        >
                            {plan.popular && <div className="premium-popular-badge">Most Popular</div>}
                            <div className="premium-card-header" style={{ background: plan.gradient }}>
                                <div className="pc-emoji">{plan.emoji}</div>
                                <h2>{plan.name}</h2>
                                <div className="pc-price">{plan.price}<span>{plan.period}</span></div>
                            </div>
                            <div className="premium-card-body">
                                <ul>
                                    {plan.features.map((f) => (
                                        <li key={f}>{f}</li>
                                    ))}
                                </ul>
                                <button
                                    className="premium-cta"
                                    style={{ background: plan.gradient }}
                                    onClick={() => handleSubscribe(plan.id)}
                                    disabled={loading === plan.id}
                                >
                                    {loading === plan.id ? <span className="auth-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : `Get ${plan.name}`}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Free tier */}
                <div className="premium-free">
                    <h3>Free Plan — Always Free</h3>
                    <div className="premium-free-features">
                        <span>✓ Browse profiles</span>
                        <span>✓ Limited likes per day</span>
                        <span>✓ Basic matching</span>
                        <span>✓ Message matches</span>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
};

export default Premium;
