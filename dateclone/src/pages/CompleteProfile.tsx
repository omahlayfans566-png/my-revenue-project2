/**
 * CompleteProfile — Phase 3: Profile Completion Wizard
 *
 * Shown after email verification for users whose profileCompletion < 80.
 * Smart: only shows sections where fields are still empty.
 * Each section is skippable — users can return later.
 * Ends with a celebration screen once ≥80% is reached.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { profileAPI } from "../services/apiService";
import "../style/completeProfile.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface WizardStep {
    id: string;
    icon: string;
    title: string;
    subtitle: string;
    optional: boolean;
    /** Returns true if the step already has data (user can skip review) */
    isComplete: (u: any) => boolean;
    weight: number; // % contribution to completion
}

// ─── Wizard steps definition ──────────────────────────────────────────────────
const WIZARD_STEPS: WizardStep[] = [
    {
        id: "photo",
        icon: "📸",
        title: "Add your best photo",
        subtitle: "Profiles with photos get 10× more matches.",
        optional: false,
        isComplete: (u) => !!u?.profilePicture,
        weight: 20,
    },
    {
        id: "bio",
        icon: "📝",
        title: "Write your bio",
        subtitle: "Tell people what makes you unique.",
        optional: true,
        isComplete: (u) => !!u?.aboutMe && u.aboutMe.trim().length >= 20,
        weight: 15,
    },
    {
        id: "work",
        icon: "💼",
        title: "Your occupation & education",
        subtitle: "This helps matches find common ground.",
        optional: true,
        isComplete: (u) => !!u?.occupation && !!u?.education,
        weight: 20,
    },
    {
        id: "interests",
        icon: "🎯",
        title: "Pick your interests",
        subtitle: "Choose up to 8 things you love.",
        optional: true,
        isComplete: (u) => Array.isArray(u?.interests) && u.interests.length > 0,
        weight: 10,
    },
    {
        id: "dating",
        icon: "💞",
        title: "Dating preferences",
        subtitle: "Who are you looking for?",
        optional: true,
        isComplete: (u) => !!u?.relationshipGoal,
        weight: 10,
    },
    {
        id: "email",
        icon: "✉️",
        title: "Email verified",
        subtitle: "Your email must be verified to appear in search.",
        optional: false,
        isComplete: (u) => !!u?.emailVerified,
        weight: 0,
    },
];

const INTERESTS_OPTS = [
    { v: "Music", icon: "🎵" }, { v: "Sports", icon: "⚽" }, { v: "Movies", icon: "🎬" },
    { v: "Gaming", icon: "🎮" }, { v: "Cooking", icon: "🍳" }, { v: "Reading", icon: "📚" },
    { v: "Travel", icon: "✈️" }, { v: "Fashion", icon: "👗" }, { v: "Tech", icon: "💻" },
    { v: "Fitness", icon: "💪" }, { v: "Art", icon: "🎨" }, { v: "Photography", icon: "📷" },
    { v: "Dancing", icon: "💃" }, { v: "Entrepreneurship", icon: "🚀" }, { v: "Nature", icon: "🌿" },
    { v: "Spirituality", icon: "🙏" }, { v: "Foodie", icon: "🍕" }, { v: "Cars", icon: "🚗" },
];

const GOAL_OPTS = [
    { v: "Marriage", icon: "💍" }, { v: "Serious relationship", icon: "❤️" },
    { v: "Long-term dating", icon: "🌹" }, { v: "Casual dating", icon: "☀️" },
    { v: "Friendship", icon: "🤝" },
];

const EDUCATION_OPTS = [
    { v: "high_school", label: "High School" }, { v: "some_college", label: "Some College" },
    { v: "bachelors", label: "Bachelor's" }, { v: "masters", label: "Master's" },
    { v: "phd", label: "PhD" }, { v: "other", label: "Other" },
];

// ─── Circular progress ring ───────────────────────────────────────────────────
const CompletionRing = ({ pct }: { pct: number }) => {
    const r = 36;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
        <div className="cp-ring-wrap">
            <svg viewBox="0 0 88 88" className="cp-ring-svg">
                <circle cx="44" cy="44" r={r} className="cp-ring-track" />
                <circle
                    cx="44" cy="44" r={r}
                    className="cp-ring-fill"
                    strokeDasharray={`${dash} ${circ}`}
                    transform="rotate(-90 44 44)"
                />
            </svg>
            <div className="cp-ring-center">
                <span className="cp-ring-pct">{pct}%</span>
                <span className="cp-ring-label">Done</span>
            </div>
        </div>
    );
};

// ─── Success screen ───────────────────────────────────────────────────────────
const SuccessScreen = ({ onContinue }: { onContinue: () => void }) => (
    <div className="cp-success">
        <div className="cp-success-confetti" aria-hidden="true">
            {["💕", "🎉", "✨", "💖", "🌟", "🎊", "💫", "❤️"].map((e, i) => (
                <span key={i} className="cp-confetti-piece" style={{ animationDelay: `${i * 0.12}s`, left: `${8 + i * 11}%` }}>{e}</span>
            ))}
        </div>
        <div className="cp-success-icon">🎉</div>
        <h2>Your profile is looking great!</h2>
        <p>You've completed the essentials. You're now ready to start discovering matches across Africa.</p>
        <div className="cp-success-actions">
            <button className="cp-btn-primary" onClick={onContinue}>
                🔥 Start Discovering →
            </button>
        </div>
    </div>
);

// ─── Main Wizard ──────────────────────────────────────────────────────────────
const CompleteProfile = () => {
    const { user, refreshUser, updateLocalUser } = useAuth();
    const navigate = useNavigate();
    const fileRef = useRef<HTMLInputElement>(null);

    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [stepIdx, setStepIdx] = useState(0);
    const [done, setDone] = useState(false);
    const [saveErr, setSaveErr] = useState("");

    // Local form state for each step
    const [photoPreview, setPhotoPreview] = useState("");
    const [bioText, setBioText] = useState("");
    const [occupation, setOccupation] = useState("");
    const [education, setEducation] = useState("");
    const [interests, setInterests] = useState<string[]>([]);
    const [goalValue, setGoalValue] = useState("");

    // ── Load real profile on mount ────────────────────────────────────────
    useEffect(() => {
        if (!user?._id) return;

        const load = async () => {
            try {
                const res = await profileAPI.getProfile(user._id);
                const p = res.user;
                setProfile(p);
                // Pre-fill with existing values so nothing is lost
                setPhotoPreview(p.profilePicture ?? "");
                setBioText(p.aboutMe ?? "");
                setOccupation(p.occupation ?? "");
                setEducation(p.education ?? "");
                setInterests(Array.isArray(p.interests) ? p.interests : []);
                setGoalValue(p.relationshipGoal ?? "");

                // If already ≥ 80% complete, skip wizard entirely
                if ((p.profileCompletion ?? 0) >= 80) {
                    navigate("/discover", { replace: true });
                    return;
                }
            } catch {
                // Use auth context as fallback
                const u = user as any;
                setProfile(u);
                setPhotoPreview(u.profilePicture ?? "");
                setBioText(u.aboutMe ?? "");
                setOccupation(u.occupation ?? "");
                setEducation(u.education ?? "");
                setInterests(Array.isArray(u.interests) ? u.interests : []);
                setGoalValue(u.relationshipGoal ?? "");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user?._id]); // eslint-disable-line

    // ── Determine which steps to show (only incomplete ones) ──────────────
    const activeSteps = profile
        ? WIZARD_STEPS.filter(s => s.id !== "email" && !s.isComplete(profile))
        : WIZARD_STEPS.filter(s => s.id !== "email");

    const currentStep = activeSteps[stepIdx];

    // ── Compute live completion estimate ──────────────────────────────────
    const basePct = profile?.profileCompletion ?? 0;
    const earnedPct = (() => {
        let e = 0;
        if (photoPreview && !WIZARD_STEPS[0].isComplete(profile)) e += 20;
        if (bioText.trim().length >= 20 && !WIZARD_STEPS[1].isComplete(profile)) e += 15;
        if (occupation && education && !WIZARD_STEPS[2].isComplete(profile)) e += 20;
        if (interests.length > 0 && !WIZARD_STEPS[3].isComplete(profile)) e += 10;
        if (goalValue && !WIZARD_STEPS[4].isComplete(profile)) e += 10;
        return e;
    })();
    const livePct = Math.min(100, basePct + earnedPct);

    // ── Save current step ─────────────────────────────────────────────────
    const saveStep = useCallback(async (skipSave = false) => {
        if (!user?._id || saving) return;
        setSaveErr("");

        if (!skipSave) {
            setSaving(true);
            try {
                const payload: Record<string, any> = {};
                if (currentStep?.id === "photo" && photoPreview) {
                    payload.profilePicture = photoPreview;
                } else if (currentStep?.id === "bio") {
                    if (bioText.trim()) payload.aboutMe = bioText.trim();
                } else if (currentStep?.id === "work") {
                    if (occupation.trim()) payload.occupation = occupation.trim();
                    if (education) payload.education = education;
                } else if (currentStep?.id === "interests") {
                    payload.interests = interests;
                } else if (currentStep?.id === "dating") {
                    if (goalValue) payload.relationshipGoal = goalValue;
                }

                if (Object.keys(payload).length > 0) {
                    const res = await profileAPI.updateProfile(user._id, payload);
                    if (res.user) {
                        setProfile(res.user);
                        updateLocalUser(res.user);
                    }
                }
            } catch (err: any) {
                setSaveErr(err.message || "Save failed. Please try again.");
                setSaving(false);
                return;
            } finally {
                setSaving(false);
            }
        }

        // Advance to next step or show success
        if (stepIdx >= activeSteps.length - 1) {
            await refreshUser();
            setDone(true);
        } else {
            setStepIdx(i => i + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [user?._id, saving, currentStep, stepIdx, activeSteps.length, photoPreview, bioText, occupation, education, interests, goalValue, updateLocalUser, refreshUser]);

    // ── Photo handling ────────────────────────────────────────────────────
    const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const toggleInterest = (v: string) => {
        setInterests(prev =>
            prev.includes(v)
                ? prev.filter(x => x !== v)
                : prev.length < 8 ? [...prev, v] : prev
        );
    };

    // ── Skip to dashboard ──────────────────────────────────────────────────
    const handleSkipAll = () => navigate("/discover", { replace: true });

    // ─────────────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="cp-shell">
                <div className="cp-loader">
                    <span className="cp-spinner" />
                    <p>Loading your profile…</p>
                </div>
            </div>
        );
    }

    // No incomplete steps → redirect
    if (!loading && activeSteps.length === 0 && !done) {
        navigate("/discover", { replace: true });
        return null;
    }

    return (
        <div className="cp-shell">
            {/* Top bar */}
            <div className="cp-topbar">
                <span className="cp-logo">DateClone 💕</span>

                <div className="cp-topbar-center">
                    <CompletionRing pct={livePct} />
                </div>

                <button className="cp-skip-all" onClick={handleSkipAll}>
                    Skip for now
                </button>
            </div>

            {/* Progress pills */}
            {!done && (
                <div className="cp-steps-row">
                    {activeSteps.map((s, i) => (
                        <div
                            key={s.id}
                            className={`cp-step-pill ${i === stepIdx ? "active" : i < stepIdx ? "done" : ""}`}
                        >
                            <span>{i < stepIdx ? "✓" : s.icon}</span>
                            <span className="cp-pill-label">{s.title.split(" ").slice(0, 2).join(" ")}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Card */}
            <div className="cp-card">
                {done ? (
                    <SuccessScreen onContinue={() => navigate("/discover", { replace: true })} />
                ) : (
                    <>
                        {/* Step header */}
                        <div className="cp-step-header">
                            <div className="cp-step-icon">{currentStep?.icon}</div>
                            <h2>{currentStep?.title}</h2>
                            <p>{currentStep?.subtitle}</p>
                        </div>

                        {/* Error */}
                        {saveErr && <div className="cp-error">{saveErr}</div>}

                        {/* Step body */}
                        <div className="cp-step-body">

                            {/* PHOTO */}
                            {currentStep?.id === "photo" && (
                                <div className="cp-photo-section">
                                    <div
                                        className="cp-photo-upload"
                                        onClick={() => fileRef.current?.click()}
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Upload profile photo"
                                    >
                                        {photoPreview ? (
                                            <>
                                                <img src={photoPreview} alt="Your photo" className="cp-photo-preview" />
                                                <div className="cp-photo-change-overlay">
                                                    <span>📸 Change</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="cp-photo-placeholder">
                                                <span className="cp-photo-icon">📸</span>
                                                <p>Tap to upload photo</p>
                                                <small>JPG or PNG · max 5 MB</small>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/*"
                                        style={{ display: "none" }}
                                        onChange={onPhotoChange}
                                    />
                                    <p className="cp-photo-tip">
                                        💡 Clear, well-lit face photos get the most matches
                                    </p>
                                </div>
                            )}

                            {/* BIO */}
                            {currentStep?.id === "bio" && (
                                <div className="cp-bio-section">
                                    <textarea
                                        className="cp-textarea"
                                        placeholder="e.g. Lagos-based architect who loves jazz, road trips, and great food. I believe in deep conversations and even deeper connections."
                                        value={bioText}
                                        onChange={e => setBioText(e.target.value)}
                                        rows={5}
                                        maxLength={400}
                                    />
                                    <div className="cp-char-row">
                                        <span className={bioText.length < 20 ? "cp-char-warn" : "cp-char-ok"}>
                                            {bioText.length}/400 {bioText.length < 20 ? `— need ${20 - bioText.length} more` : "✓"}
                                        </span>
                                    </div>
                                    <div className="cp-bio-tips">
                                        <p>✨ Tips for a great bio:</p>
                                        <ul>
                                            <li>Mention what you do for fun</li>
                                            <li>Share something unique about you</li>
                                            <li>Keep it honest and genuine</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* WORK / EDUCATION */}
                            {currentStep?.id === "work" && (
                                <div className="cp-work-section">
                                    <div className="cp-field">
                                        <label>What do you do?</label>
                                        <input
                                            className="cp-input"
                                            placeholder="e.g. Software Engineer, Teacher, Entrepreneur…"
                                            value={occupation}
                                            onChange={e => setOccupation(e.target.value)}
                                        />
                                    </div>
                                    <div className="cp-field">
                                        <label>Education level</label>
                                        <div className="cp-pill-grid">
                                            {EDUCATION_OPTS.map(o => (
                                                <button
                                                    key={o.v}
                                                    type="button"
                                                    className={`cp-pill ${education === o.v ? "selected" : ""}`}
                                                    onClick={() => setEducation(o.v)}
                                                >
                                                    {o.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* INTERESTS */}
                            {currentStep?.id === "interests" && (
                                <div className="cp-interests-section">
                                    <p className="cp-interests-hint">
                                        Selected: <strong>{interests.length}/8</strong>
                                    </p>
                                    <div className="cp-interest-grid">
                                        {INTERESTS_OPTS.map(o => (
                                            <button
                                                key={o.v}
                                                type="button"
                                                className={`cp-interest-chip ${interests.includes(o.v) ? "selected" : ""} ${!interests.includes(o.v) && interests.length >= 8 ? "disabled" : ""}`}
                                                onClick={() => toggleInterest(o.v)}
                                                disabled={!interests.includes(o.v) && interests.length >= 8}
                                            >
                                                <span>{o.icon}</span>
                                                <span>{o.v}</span>
                                                {interests.includes(o.v) && <span className="cp-chip-check">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* DATING GOALS */}
                            {currentStep?.id === "dating" && (
                                <div className="cp-goals-section">
                                    <div className="cp-goal-grid">
                                        {GOAL_OPTS.map(g => (
                                            <button
                                                key={g.v}
                                                type="button"
                                                className={`cp-goal-card ${goalValue === g.v ? "selected" : ""}`}
                                                onClick={() => setGoalValue(g.v)}
                                            >
                                                <span className="cp-goal-icon">{g.icon}</span>
                                                <span className="cp-goal-label">{g.v}</span>
                                                {goalValue === g.v && <span className="cp-goal-check">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bottom nav */}
                        <div className="cp-nav">
                            {stepIdx > 0 && (
                                <button className="cp-btn-back" onClick={() => setStepIdx(i => i - 1)}>
                                    ← Back
                                </button>
                            )}
                            <div className="cp-nav-right">
                                {currentStep?.optional && (
                                    <button
                                        className="cp-btn-skip"
                                        onClick={() => saveStep(true)}
                                        disabled={saving}
                                    >
                                        Skip for now
                                    </button>
                                )}
                                <button
                                    className="cp-btn-save"
                                    onClick={() => saveStep(false)}
                                    disabled={saving || (currentStep?.id === "photo" && !photoPreview)}
                                >
                                    {saving
                                        ? <><span className="cp-spinner sm" /> Saving…</>
                                        : stepIdx >= activeSteps.length - 1
                                            ? "Finish →"
                                            : "Save & Continue →"}
                                </button>
                            </div>
                        </div>

                        {/* Step counter */}
                        <p className="cp-step-count">
                            Step {stepIdx + 1} of {activeSteps.length}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default CompleteProfile;
