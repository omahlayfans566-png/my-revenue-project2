import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import AppNavbar from "../component/AppNavbar";
import { useAuth } from "../context/AuthContext";
import { premiumAPI } from "../services/apiService";
import { PREMIUM_PLANS, YEARLY_PLANS, type PremiumPlan, initializePaystackPayment, PAYSTACK_PUBLIC_KEY } from "../services/premiumService";
import "../style/premium.css";

const Premium = () => {
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
    const [selectedPlan, setSelectedPlan] = useState<string>("gold");
    const [isYearly, setIsYearly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundPaymentId, setRefundPaymentId] = useState<string>("");
    const [refundReason, setRefundReason] = useState("");
    const [analytics, setAnalytics] = useState<any>(null);
    const [boostStatus, setBoostStatus] = useState<any>(null);
    const [boosting, setBoosting] = useState(false);

    const plans = isYearly ? YEARLY_PLANS : PREMIUM_PLANS;

    useEffect(() => {
        loadStatus();
        loadAnalytics();
        loadBoostStatus();
    }, []);

    const loadStatus = async () => {
        try {
            const [statusRes, historyRes] = await Promise.allSettled([
                premiumAPI.getStatus(),
                premiumAPI.getHistory(),
            ]);
            if (statusRes.status === "fulfilled") setStatus(statusRes.value);
            if (historyRes.status === "fulfilled") setHistory(historyRes.value.payments || []);
        } catch { /* silent */ }
    };

    const loadAnalytics = async () => {
        try {
            const res = await premiumAPI.getAnalytics();
            if (res.success) setAnalytics(res.analytics);
        } catch { /* silent */ }
    };

    const loadBoostStatus = async () => {
        try {
            const res = await premiumAPI.getBoostStatus();
            if (res.success) setBoostStatus(res);
        } catch { /* silent */ }
    };

    const handleSubscribe = async (plan: PremiumPlan) => {
        if (!user) {
            toast.error("Please log in first");
            return;
        }

        setLoading(true);
        try {
            const res = await premiumAPI.initializePaystack(plan.id, plan.durationDays, isYearly);
            const { reference, amount, email, metadata } = res.data;

            // Store the pending plan so the callback page knows which plan to verify
            sessionStorage.setItem("pending_payment", JSON.stringify({
                plan: plan.id,
                durationDays: plan.durationDays,
                isYearly,
                reference,
            }));

            initializePaystackPayment({
                key: PAYSTACK_PUBLIC_KEY,
                email,
                amount,
                ref: reference,
                callbackUrl: res.data.callbackUrl,
                metadata: { ...metadata, isYearly },
                callback: async (response) => {
                    toast.success("Payment received! Activating premium…");
                    try {
                        const verifyRes = await premiumAPI.verifyPaystack(
                            response.reference,
                            plan.id,
                            plan.durationDays,
                            response.reference,
                            isYearly
                        );
                        if (verifyRes.success) {
                            toast.success(`✨ ${verifyRes.message}`);
                            sessionStorage.removeItem("pending_payment");
                            await refreshUser();
                            loadStatus();
                            loadAnalytics();
                        }
                    } catch (err: any) {
                        toast.error(err.message || "Verification failed. Contact support.");
                    }
                    setLoading(false);
                },
                onClose: () => {
                    toast("Payment cancelled", { icon: "ℹ️" });
                    sessionStorage.removeItem("pending_payment");
                    setLoading(false);
                },
            });
        } catch (err: any) {
            toast.error(err.message || "Failed to initialize payment");
            sessionStorage.removeItem("pending_payment");
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm("Are you sure you want to cancel your subscription? Premium will remain active until the end of the billing period.")) return;
        setLoading(true);
        try {
            const res = await premiumAPI.cancel();
            toast.success(res.message);
            loadStatus();
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel");
        } finally {
            setLoading(false);
        }
    };

    const handleReactivate = async () => {
        setLoading(true);
        try {
            const res = await premiumAPI.reactivate();
            toast.success(res.message);
            loadStatus();
        } catch (err: any) {
            toast.error(err.message || "Failed to reactivate");
        } finally {
            setLoading(false);
        }
    };

    const handleBoost = async () => {
        setBoosting(true);
        try {
            const res = await premiumAPI.boost();
            toast.success(res.message);
            loadBoostStatus();
        } catch (err: any) {
            toast.error(err.message || "Failed to boost profile");
        } finally {
            setBoosting(false);
        }
    };

    const handleRefund = async () => {
        if (!refundPaymentId || !refundReason.trim()) {
            toast.error("Please select a payment and provide a reason");
            return;
        }
        setLoading(true);
        try {
            const res = await premiumAPI.requestRefund(refundPaymentId, refundReason);
            toast.success(res.message);
            setShowRefundModal(false);
            setRefundReason("");
            setRefundPaymentId("");
            await refreshUser();
            loadStatus();
            loadAnalytics();
        } catch (err: any) {
            toast.error(err.message || "Refund failed");
        } finally {
            setLoading(false);
        }
    };

    const isPremium = user?.isPremium && status?.isPremium;
    const daysLeft = status?.subscription?.endDate
        ? Math.max(0, Math.ceil((new Date(status.subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    const savingsText = (plan: PremiumPlan) => {
        if (!plan.monthlyEquivalent) return null;
        const monthlyPlan = PREMIUM_PLANS.find(p => p.id === plan.id);
        if (!monthlyPlan) return null;
        const monthlyCost = monthlyPlan.price * 12;
        const yearlyCost = plan.price;
        const savings = monthlyCost - yearlyCost;
        const percent = Math.round((savings / monthlyCost) * 100);
        return `Save ${percent}% — pay ₦${plan.monthlyEquivalent.toLocaleString()}/mo equivalent`;
    };

    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="premium-page">
                <div className="premium-header">
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {isPremium ? "✨ Your Premium" : "Upgrade to Premium 💎"}
                    </motion.h1>
                    <p className="premium-subtitle">
                        {isPremium
                            ? `You're on the ${status?.tier?.toUpperCase() || user?.premiumTier?.toUpperCase()} plan`
                            : "Unlock the full dating experience"}
                    </p>
                    {isPremium && daysLeft > 0 && (
                        <div className="premium-days-badge">
                            {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
                        </div>
                    )}
                </div>

                {/* Active subscription info */}
                {isPremium && status?.subscription && (
                    <motion.div
                        className="premium-active-card"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <div className="premium-active-header">
                            <span className="premium-active-plan">
                                {status.subscription.plan.toUpperCase()} Plan
                            </span>
                            <span className={`premium-active-status ${status.subscription.status}`}>
                                {status.subscription.status}
                            </span>
                        </div>
                        <div className="premium-active-details">
                            <div className="premium-active-item">
                                <span>Started</span>
                                <span>{new Date(status.subscription.startDate).toLocaleDateString()}</span>
                            </div>
                            <div className="premium-active-item">
                                <span>Expires</span>
                                <span>{new Date(status.subscription.endDate).toLocaleDateString()}</span>
                            </div>
                            <div className="premium-active-item">
                                <span>Auto-renew</span>
                                <span>{status.subscription.autoRenew ? "✅ On" : "❌ Off"}</span>
                            </div>
                        </div>
                        <div className="premium-active-actions">
                            {status.subscription.autoRenew ? (
                                <button className="btn btn-outline" onClick={handleCancel} disabled={loading}>
                                    Cancel Subscription
                                </button>
                            ) : status.subscription.status === "cancelled" && daysLeft > 0 ? (
                                <button className="btn btn-primary" onClick={handleReactivate} disabled={loading}>
                                    Reactivate Auto-Renew
                                </button>
                            ) : null}
                            <button className="btn btn-outline" onClick={() => setShowHistory(!showHistory)}>
                                {showHistory ? "Hide" : "View"} History
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Premium Analytics Card */}
                {isPremium && analytics && (
                    <motion.div
                        className="premium-analytics-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h3>📊 Premium Analytics</h3>
                        <div className="premium-analytics-grid">
                            <div className="premium-analytic-item">
                                <span className="pa-label">Total Spent</span>
                                <span className="pa-value">₦{analytics.totalSpent?.toLocaleString() || 0}</span>
                            </div>
                            <div className="premium-analytic-item">
                                <span className="pa-label">Days Premium</span>
                                <span className="pa-value">{analytics.daysSincePremium || 0}d</span>
                            </div>
                            <div className="premium-analytic-item">
                                <span className="pa-label">Likes Received</span>
                                <span className="pa-value">{analytics.totalLikesReceived || 0}</span>
                            </div>
                            <div className="premium-analytic-item">
                                <span className="pa-label">Total Matches</span>
                                <span className="pa-value">{analytics.totalMatches || 0}</span>
                            </div>
                            <div className="premium-analytic-item">
                                <span className="pa-label">Profile Views</span>
                                <span className="pa-value">{analytics.profileViews || 0}</span>
                            </div>
                            <div className="premium-analytic-item">
                                <span className="pa-label">Payments</span>
                                <span className="pa-value">{analytics.totalPayments || 0}</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Boost Card */}
                {isPremium && (
                    <motion.div
                        className="premium-boost-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="premium-boost-content">
                            <div className="premium-boost-icon">🚀</div>
                            <div className="premium-boost-text">
                                <h3>Profile Boost</h3>
                                <p>
                                    {boostStatus?.isBoosted
                                        ? `Your profile is boosted until ${new Date(boostStatus.boostEndsAt).toLocaleString()}`
                                        : user?.premiumTier === "platinum"
                                            ? "Boost your profile to get seen by more people! Unlimited boosts."
                                            : `Boost your profile! ${boostStatus?.remainingBoosts || 0} boost${boostStatus?.remainingBoosts !== 1 ? "s" : ""} remaining this week.`}
                                </p>
                            </div>
                            <button
                                className={`btn ${boostStatus?.isBoosted ? "btn-outline" : "btn-primary"}`}
                                onClick={handleBoost}
                                disabled={boosting || boostStatus?.isBoosted}
                            >
                                {boosting ? "Boosting…" : boostStatus?.isBoosted ? "✅ Boosted" : "🚀 Boost Now"}
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Payment History */}
                <AnimatePresence>
                    {showHistory && history.length > 0 && (
                        <motion.div
                            className="premium-history"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <h3>Payment History</h3>
                            <div className="premium-history-list">
                                {history.map((p: any) => (
                                    <div key={p._id} className="premium-history-item">
                                        <div className="phi-left">
                                            <span className="phi-plan">{p.plan?.toUpperCase() || "Premium"}</span>
                                            <span className="phi-date">{new Date(p.createdAt).toLocaleDateString()}</span>
                                            {p.metadata?.isYearly && <span className="phi-yearly-badge">Yearly</span>}
                                        </div>
                                        <div className="phi-right">
                                            <span className="phi-amount">₦{p.amount?.toLocaleString()}</span>
                                            <span className={`phi-status ${p.status}`}>{p.status}</span>
                                            {p.status === "success" && !p.refundedAt && (
                                                <button
                                                    className="phi-refund-btn"
                                                    onClick={() => {
                                                        setRefundPaymentId(p._id);
                                                        setShowRefundModal(true);
                                                    }}
                                                    title="Request refund"
                                                >
                                                    ↩️
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Monthly / Yearly toggle */}
                {!isPremium && (
                    <div className="premium-billing-toggle">
                        <button
                            className={`pbt-btn ${!isYearly ? "active" : ""}`}
                            onClick={() => setIsYearly(false)}
                        >
                            Monthly
                        </button>
                        <button
                            className={`pbt-btn ${isYearly ? "active" : ""}`}
                            onClick={() => setIsYearly(true)}
                        >
                            Yearly <span className="pbt-save-badge">Save 33%</span>
                        </button>
                    </div>
                )}

                {/* Plans grid */}
                {!isPremium && (
                    <div className="premium-plans">
                        {plans.map((plan, i) => (
                            <motion.div
                                key={`${plan.id}-${isYearly ? "yearly" : "monthly"}`}
                                className={`premium-plan-card ${selectedPlan === plan.id ? "selected" : ""} ${plan.popular ? "popular" : ""}`}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                onClick={() => setSelectedPlan(plan.id)}
                            >
                                {plan.popular && <div className="plan-popular-badge">Most Popular</div>}
                                <div className="plan-header" style={{ background: `linear-gradient(135deg, ${plan.color}22, ${plan.color}44)` }}>
                                    <h3 className="plan-name">{plan.name}</h3>
                                    <div className="plan-price">
                                        <span className="plan-currency">₦</span>
                                        <span className="plan-amount">{plan.price.toLocaleString()}</span>
                                        <span className="plan-period">/{isYearly ? "year" : "month"}</span>
                                    </div>
                                    <p className="plan-price-usd">≈ ${plan.priceUSD}/{isYearly ? "yr" : "mo"}</p>
                                    {isYearly && plan.monthlyEquivalent && (
                                        <p className="plan-price-equivalent">₦{plan.monthlyEquivalent.toLocaleString()}/mo equivalent</p>
                                    )}
                                </div>
                                <div className="plan-features">
                                    {plan.features.map((f, fi) => (
                                        <div key={fi} className="plan-feature">
                                            <span className="plan-feature-check">✓</span>
                                            <span>{f}</span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className={`btn plan-select-btn ${plan.popular ? "btn-primary" : "btn-outline"}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSubscribe(plan);
                                    }}
                                    disabled={loading}
                                    style={{ width: "100%" }}
                                >
                                    {loading && selectedPlan === plan.id ? (
                                        <><span className="auth-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Processing…</>
                                    ) : (
                                        `Choose ${plan.name}`
                                    )}
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Premium features list */}
                <div className="premium-features-section">
                    <h2>✨ All Premium Features</h2>
                    <div className="premium-features-grid">
                        {[
                            { icon: "❤️", title: "Unlimited Likes", desc: "Like as many profiles as you want" },
                            { icon: "👁️", title: "See Who Liked You", desc: "View your admirers instantly" },
                            { icon: "↩️", title: "Undo Swipe", desc: "Take back your last swipe" },
                            { icon: "🔍", title: "Advanced Filters", desc: "Find exactly what you're looking for" },
                            { icon: "🕶️", title: "Incognito Mode", desc: "Browse profiles invisibly" },
                            { icon: "🌍", title: "Passport Mode", desc: "Match with people anywhere" },
                            { icon: "🚀", title: "Profile Boost", desc: "Get seen by more people" },
                            { icon: "⭐", title: "Super Likes", desc: "Stand out from the crowd" },
                            { icon: "📖", title: "Read Receipts", desc: "See when messages are read" },
                            { icon: "👤", title: "Profile Visitors", desc: "See who viewed your profile" },
                            { icon: "🏆", title: "Priority Ranking", desc: "Appear first in searches" },
                            { icon: "💬", title: "Priority Support", desc: "Get help faster" },
                        ].map((f, i) => (
                            <motion.div
                                key={i}
                                className="premium-feature-item"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                viewport={{ once: true }}
                            >
                                <span className="pfi-icon">{f.icon}</span>
                                <h4>{f.title}</h4>
                                <p>{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Refund Modal */}
            <AnimatePresence>
                {showRefundModal && (
                    <motion.div
                        className="premium-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowRefundModal(false)}
                    >
                        <motion.div
                            className="premium-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h3>Request Refund</h3>
                            <p className="premium-modal-sub">
                                Refunds are processed within 5-10 business days. Premium features will be revoked immediately.
                            </p>
                            <div className="premium-modal-field">
                                <label>Reason for refund</label>
                                <textarea
                                    placeholder="Tell us why you're requesting a refund…"
                                    value={refundReason}
                                    onChange={e => setRefundReason(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className="premium-modal-actions">
                                <button className="btn btn-outline" onClick={() => setShowRefundModal(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="btn"
                                    style={{ background: "#ef4444", color: "white" }}
                                    onClick={handleRefund}
                                    disabled={loading || !refundReason.trim()}
                                >
                                    {loading ? "Processing…" : "Request Refund"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Premium;