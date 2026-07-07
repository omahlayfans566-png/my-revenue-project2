/**
 * PaymentCallback.tsx
 *
 * Paystack redirect-mode callback page.
 * URL: /payment/callback?reference=XXX&trxref=XXX
 *
 * This page is loaded after Paystack redirects the user back from the
 * payment gateway. It reads the reference from the URL, calls the backend
 * to verify the transaction, activates premium, and redirects to /premium.
 *
 * Also handles the inline popup callback — if the user has a pending plan
 * stored in sessionStorage, we read it here.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { premiumAPI } from "../services/apiService";
import { useAuth } from "../context/AuthContext";
import "../style/paymentCallback.css";

type VerifyState =
    | { status: "loading" }
    | { status: "success"; plan: string; message: string }
    | { status: "already_verified"; plan: string }
    | { status: "error"; message: string };

const PaymentCallback = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { refreshUser } = useAuth();
    const [state, setState] = useState<VerifyState>({ status: "loading" });
    const verified = useRef(false); // prevent double-verification on StrictMode remount

    useEffect(() => {
        if (verified.current) return;
        verified.current = true;

        const reference = searchParams.get("reference") || searchParams.get("trxref");
        if (!reference) {
            setState({ status: "error", message: "No payment reference found in the URL. If you completed a payment, please contact support." });
            return;
        }

        // Read plan from sessionStorage (set before Paystack redirect)
        let plan = "gold";
        let durationDays = 30;
        let isYearly = false;
        try {
            const stored = sessionStorage.getItem("pending_payment");
            if (stored) {
                const parsed = JSON.parse(stored);
                plan = parsed.plan || "gold";
                durationDays = parsed.durationDays || 30;
                isYearly = parsed.isYearly || false;
            }
        } catch { /* use defaults */ }

        (async () => {
            try {
                const res = await premiumAPI.verifyPaystack(reference, plan, durationDays, reference, isYearly);
                if (res.success) {
                    sessionStorage.removeItem("pending_payment");
                    await refreshUser();
                    setState({ status: "success", plan, message: res.message || `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan activated!` });
                    // Redirect to premium page after 3 seconds
                    setTimeout(() => navigate("/premium"), 3000);
                } else {
                    setState({ status: "error", message: res.message || "Verification failed." });
                }
            } catch (err: any) {
                const msg: string = err?.message || "Verification failed";
                if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("duplicate")) {
                    // Already verified — not an error, just navigate
                    setState({ status: "already_verified", plan });
                    await refreshUser().catch(() => { });
                    setTimeout(() => navigate("/premium"), 2500);
                } else {
                    setState({ status: "error", message: msg });
                }
            }
        })();
    }, [searchParams, refreshUser, navigate]);

    const handleRetry = () => navigate("/premium");

    return (
        <div className="payment-callback-page">
            <div className="payment-callback-card">
                {state.status === "loading" && (
                    <>
                        <div className="pcb-spinner" />
                        <h2 className="pcb-title">Verifying Payment…</h2>
                        <p className="pcb-sub">Please wait while we confirm your payment with Paystack. Do not close this page.</p>
                    </>
                )}

                {state.status === "success" && (
                    <>
                        <div className="pcb-icon pcb-icon-success">✅</div>
                        <h2 className="pcb-title pcb-title-success">Payment Verified!</h2>
                        <p className="pcb-sub">
                            Your <strong>{state.plan.charAt(0).toUpperCase() + state.plan.slice(1)}</strong> subscription is now active.
                        </p>
                        <p className="pcb-redirect">Redirecting you to your subscription page…</p>
                        <div className="pcb-progress-bar">
                            <div className="pcb-progress-fill" />
                        </div>
                    </>
                )}

                {state.status === "already_verified" && (
                    <>
                        <div className="pcb-icon pcb-icon-success">✅</div>
                        <h2 className="pcb-title pcb-title-success">Already Activated</h2>
                        <p className="pcb-sub">Your subscription is already active. Redirecting…</p>
                    </>
                )}

                {state.status === "error" && (
                    <>
                        <div className="pcb-icon pcb-icon-error">❌</div>
                        <h2 className="pcb-title pcb-title-error">Verification Failed</h2>
                        <p className="pcb-sub pcb-error-msg">{state.message}</p>
                        <div className="pcb-actions">
                            <button className="btn btn-primary" onClick={handleRetry}>
                                ← Back to Premium
                            </button>
                            <a
                                href="mailto:support@dateclone.online?subject=Payment+Issue"
                                className="btn btn-outline"
                            >
                                Contact Support
                            </a>
                        </div>
                        <p className="pcb-note">
                            If money was deducted, your payment is safe. Send us the reference and we'll sort it out.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default PaymentCallback;
