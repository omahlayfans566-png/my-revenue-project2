import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../style/register.css";
import { authAPI, setAuthToken, saveUserToLocal } from "../services/apiService";

// ─── African countries ────────────────────────────────────────────────────────
const AFRICAN_COUNTRIES = [
    "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde",
    "Cameroon", "Central African Republic", "Chad", "Comoros", "Congo",
    "Democratic Republic of Congo", "Djibouti", "Egypt", "Equatorial Guinea",
    "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea",
    "Guinea-Bissau", "Ivory Coast", "Kenya", "Lesotho", "Liberia", "Libya",
    "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique",
    "Namibia", "Niger", "Nigeria", "Rwanda", "São Tomé and Príncipe", "Senegal",
    "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan",
    "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
];

// ─── Location hook ────────────────────────────────────────────────────────────
type LocStatus = "idle" | "requesting" | "detecting" | "detected" | "denied" | "unsupported" | "error";
interface LocResult { country: string; state: string; city: string; lat: number; lng: number; }

function useLocation(onResult: (r: LocResult) => void) {
    const [status, setStatus] = useState<LocStatus>("idle");
    const [msg, setMsg] = useState("");
    const busy = useRef(false);

    const detect = useCallback(async () => {
        if (busy.current) return;
        if (!navigator.geolocation) {
            setStatus("unsupported");
            setMsg("Geolocation not supported. Please fill in manually.");
            return;
        }
        busy.current = true;
        setStatus("requesting");
        setMsg("Waiting for permission…");

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                setStatus("detecting");
                setMsg("Pinpointing your location…");
                const { latitude: lat, longitude: lng } = pos.coords;
                try {
                    const r = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
                    );
                    const d = await r.json();
                    const country = (d.countryName ?? "").trim();
                    const state = (d.principalSubdivision ?? "").trim();
                    const city = (d.city || d.locality || "").trim();
                    onResult({ country, state, city, lat, lng });
                    setStatus("detected");
                    setMsg(`📍 ${[city, state, country].filter(Boolean).join(", ")}`);
                } catch {
                    setStatus("error"); setMsg("Couldn't resolve address. Fill in manually or retry.");
                } finally { busy.current = false; }
            },
            (e) => {
                busy.current = false;
                if (e.code === e.PERMISSION_DENIED) { setStatus("denied"); setMsg("Permission denied. Fill in manually."); }
                else { setStatus("error"); setMsg("Location unavailable. Fill in manually or retry."); }
            },
            { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false }
        );
    }, [onResult]);

    useEffect(() => { detect(); }, []); // eslint-disable-line
    return { status, msg, detect };
}


// ─── Reusable UI atoms ────────────────────────────────────────────────────────
const OptionCard = ({ v, label, icon, selected, onClick }: any) => (
    <button type="button" className={`opt-card ${selected ? "selected" : ""}`} onClick={() => onClick(v)}>
        {icon && <span className="opt-icon">{icon}</span>}
        <span className="opt-label">{label}</span>
        {selected && <span className="opt-check">✓</span>}
    </button>
);

const PillSelect = ({ options, value, onChange, multi = false }: any) => {
    const toggle = (v: string) => {
        if (!multi) { onChange(v); return; }
        const arr: string[] = Array.isArray(value) ? value : [];
        onChange(arr.includes(v) ? arr.filter((x: string) => x !== v) : [...arr, v]);
    };
    const isSelected = (v: string) => multi ? (Array.isArray(value) && value.includes(v)) : value === v;
    return (
        <div className="pill-group">
            {options.map(({ v, label }: any) => (
                <button key={v} type="button" className={`pill ${isSelected(v) ? "selected" : ""}`} onClick={() => toggle(v)}>
                    {label}
                </button>
            ))}
        </div>
    );
};

const FieldGroup = ({ label, error, children, hint }: any) => (
    <div className={`rg-field ${error ? "has-error" : ""}`}>
        {label && <label className="rg-label">{label}</label>}
        {hint && <p className="rg-hint">{hint}</p>}
        {children}
        {error && <span className="rg-error"><span>⚠</span>{error}</span>}
    </div>
);

const StepHeader = ({ icon, title, subtitle }: any) => (
    <div className="step-header">
        <div className="step-icon">{icon}</div>
        <h2 className="step-title">{title}</h2>
        {subtitle && <p className="step-subtitle">{subtitle}</p>}
    </div>
);


// ─── Step config (drives the progress bar) ───────────────────────────────────
const STEPS = [
    { id: 1, label: "You", icon: "👤" },
    { id: 2, label: "Identity", icon: "✨" },
    { id: 3, label: "Location", icon: "📍" },
    { id: 4, label: "Photos", icon: "📸" },
    { id: 5, label: "Lifestyle", icon: "🌿" },
    { id: 6, label: "Goals", icon: "💞" },
    { id: 7, label: "Verify", icon: "✉️" },
];

// ─── Form data type ───────────────────────────────────────────────────────────
interface FD {
    // Step 1
    firstName: string; lastName: string; username: string;
    email: string; phone: string; password: string; confirmPassword: string;
    // Step 2
    dateOfBirth: string; age: number; gender: string; lookingFor: string;
    // Step 3
    country: string; state: string; city: string; latitude: number; longitude: number;
    // Step 4
    profilePicture: string; aboutMe: string; occupation: string;
    education: string; languages: string[];
    // Step 5
    interests: string[]; smoking: string; drinking: string;
    // Step 6
    relationshipGoal: string; hasChildren: string; wantsChildren: string;
    religion: string; religionImportance: string; relationshipValue: string;
    minAge: number; maxAge: number; preferredCountry: string; preferredDistance: string;
}

const BLANK: FD = {
    firstName: "", lastName: "", username: "", email: "", phone: "", password: "", confirmPassword: "",
    dateOfBirth: "", age: 0, gender: "", lookingFor: "",
    country: "", state: "", city: "", latitude: 0, longitude: 0,
    profilePicture: "", aboutMe: "", occupation: "", education: "", languages: [],
    interests: [], smoking: "", drinking: "",
    relationshipGoal: "", hasChildren: "", wantsChildren: "",
    religion: "", religionImportance: "", relationshipValue: "",
    minAge: 18, maxAge: 50, preferredCountry: "", preferredDistance: "",
};


// ─── Main Register component ──────────────────────────────────────────────────
const Register = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [fd, setFd] = useState<FD>(BLANK);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showPw, setShowPw] = useState(false);
    const [showCpw, setShowCpw] = useState(false);
    const [preview, setPreview] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitErr, setSubmitErr] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    // helpers
    const set = (k: keyof FD, v: any) => setFd(p => ({ ...p, [k]: v }));
    const inp = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === "dateOfBirth") {
            const age = new Date().getFullYear() - new Date(value).getFullYear();
            setFd(p => ({ ...p, dateOfBirth: value, age }));
        } else {
            setFd(p => ({ ...p, [name]: value }));
        }
    };

    // location hook
    const onLocResult = useCallback(({ country, state, city, lat, lng }: any) => {
        setFd(p => ({ ...p, country, state, city, latitude: lat, longitude: lng }));
    }, []);
    const loc = useLocation(onLocResult);

    // photo upload
    const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const r = reader.result as string;
            setPreview(r); set("profilePicture", r);
        };
        reader.readAsDataURL(file);
    };

    const toggleArr = (k: "interests" | "languages", v: string) => {
        setFd(p => ({
            ...p,
            [k]: p[k].includes(v) ? p[k].filter((x: string) => x !== v) : [...p[k], v],
        }));
    };

    // ── Validation ──────────────────────────────────────────────────────────────
    const validate = (s: number) => {
        const e: Record<string, string> = {};
        if (s === 1) {
            if (!fd.firstName.trim()) e.firstName = "First name is required";
            if (!fd.lastName.trim()) e.lastName = "Last name is required";
            if (!fd.username.trim()) e.username = "Choose a username";
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fd.email)) e.email = "Enter a valid email";
            if (fd.password.length < 8) e.password = "At least 8 characters";
            if (fd.password !== fd.confirmPassword) e.confirmPassword = "Passwords don't match";
        }
        if (s === 2) {
            if (!fd.dateOfBirth) e.dateOfBirth = "Birthday is required";
            else if (fd.age < 18) e.dateOfBirth = "You must be 18 or older";
            if (!fd.gender) e.gender = "Select your gender";
            if (!fd.lookingFor) e.lookingFor = "Select who you're interested in";
        }
        if (s === 3) {
            if (!fd.country) e.country = "Country is required";
            if (!fd.state) e.state = "State / Province is required";
            if (!fd.city) e.city = "City is required";
        }
        if (s === 4) {
            if (!fd.profilePicture) e.profilePicture = "Add a profile photo";
            if (fd.aboutMe.trim().length < 20) e.aboutMe = "Write at least 20 characters";
            if (!fd.occupation.trim()) e.occupation = "What do you do?";
            if (!fd.education) e.education = "Education level is required";
            if (fd.languages.length === 0) e.languages = "Select at least one language";
        }
        if (s === 5) {
            if (fd.interests.length === 0) e.interests = "Pick at least one interest";
            if (!fd.smoking) e.smoking = "Required";
            if (!fd.drinking) e.drinking = "Required";
        }
        if (s === 6) {
            if (!fd.relationshipGoal) e.relationshipGoal = "What are you looking for?";
            if (!fd.hasChildren) e.hasChildren = "Required";
            if (!fd.wantsChildren) e.wantsChildren = "Required";
            if (!fd.religion) e.religion = "Required";
            if (!fd.religionImportance) e.religionImportance = "Required";
            if (!fd.preferredCountry) e.preferredCountry = "Required";
            if (!fd.preferredDistance) e.preferredDistance = "Required";
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };


    // ── Navigation ───────────────────────────────────────────────────────────────
    const next = async () => {
        if (!validate(step)) return;
        if (step === 6) {
            setSubmitting(true);
            setSubmitErr("");
            try {
                const res = await authAPI.register(fd as unknown as Record<string, unknown>);
                setAuthToken(res.token);
                saveUserToLocal(res.user);
                setStep(7);
                window.scrollTo(0, 0);
            } catch (err: any) {
                const msg = (err.message || "").toLowerCase();
                if (msg.includes("cannot reach") || msg.includes("failed to fetch")) {
                    setSubmitErr("⚠️ Backend server is not running. Open a terminal in /backend and run: npm run dev");
                } else if (msg.includes("already registered") || msg.includes("already taken")) {
                    setSubmitErr(err.message);
                } else {
                    setSubmitErr(err.message || "Registration failed. Please try again.");
                }
            } finally {
                setSubmitting(false);
            }
            return;
        }
        setErrors({});
        setStep(s => s + 1);
        window.scrollTo(0, 0);
    };
    const back = () => { setErrors({}); setStep(s => s - 1); window.scrollTo(0, 0); };
    const pct = Math.round(((step - 1) / 6) * 100);

    // ── Render ───────────────────────────────────────────────────────────────────
    return (
        <div className="rg-shell">
            {/* Top bar */}
            <div className="rg-topbar">
                <Link to="/" className="rg-logo">DateClone 💕</Link>
                <div className="rg-progress-wrap">
                    <div className="rg-progress-track">
                        <div className="rg-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="rg-progress-pct">{pct}%</span>
                </div>
                <div className="rg-step-pills">
                    {STEPS.map(s => (
                        <div key={s.id} className={`rg-step-pill ${s.id === step ? "active" : s.id < step ? "done" : ""}`}>
                            <span className="rsp-icon">{s.id < step ? "✓" : s.icon}</span>
                            <span className="rsp-label">{s.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Card */}
            <div className="rg-card">
                {step === 1 && <S1 fd={fd} errors={errors} inp={inp} showPw={showPw} setShowPw={setShowPw} showCpw={showCpw} setShowCpw={setShowCpw} />}
                {step === 2 && <S2 fd={fd} errors={errors} inp={inp} set={set} />}
                {step === 3 && <S3 fd={fd} errors={errors} inp={inp} set={set} loc={loc} />}
                {step === 4 && <S4 fd={fd} errors={errors} inp={inp} set={set} preview={preview} fileRef={fileRef} onPhoto={onPhoto} toggleArr={toggleArr} />}
                {step === 5 && <S5 fd={fd} errors={errors} set={set} toggleArr={toggleArr} />}
                {step === 6 && <S6 fd={fd} errors={errors} inp={inp} set={set} />}
                {step === 7 && <S7 fd={fd} navigate={navigate} />}

                {/* Bottom nav */}
                {step < 7 && (
                    <div className="rg-nav">
                        {step > 1 && <button className="rg-btn-back" onClick={back}>← Back</button>}
                        <div className="rg-nav-right">
                            {submitErr && <span className="rg-submit-err">{submitErr}</span>}
                            <button className="rg-btn-next" onClick={next} disabled={submitting}>
                                {step === 6 ? (submitting ? <><span className="rg-spinner" /> Saving…</> : "Create Profile →") : "Continue →"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


// ─── Step 1 — Account ─────────────────────────────────────────────────────────
const S1 = ({ fd, errors, inp, showPw, setShowPw, showCpw, setShowCpw }: any) => (
    <div className="rg-step">
        <StepHeader icon="👤" title="Create your account" subtitle="Let's start with the basics. This is how you'll sign in." />
        <div className="rg-row">
            <FieldGroup label="First name" error={errors.firstName}>
                <input className="rg-input" name="firstName" value={fd.firstName} onChange={inp} placeholder="e.g. Amara" />
            </FieldGroup>
            <FieldGroup label="Last name" error={errors.lastName}>
                <input className="rg-input" name="lastName" value={fd.lastName} onChange={inp} placeholder="e.g. Osei" />
            </FieldGroup>
        </div>
        <FieldGroup label="Username" error={errors.username} hint="This is your public display name.">
            <input className="rg-input" name="username" value={fd.username} onChange={inp} placeholder="e.g. amara_osei" />
        </FieldGroup>
        <FieldGroup label="Email address" error={errors.email}>
            <input className="rg-input" type="email" name="email" value={fd.email} onChange={inp} placeholder="you@example.com" autoComplete="email" />
        </FieldGroup>
        <FieldGroup label="Phone number" error={""}>
            <input className="rg-input" type="tel" name="phone" value={fd.phone} onChange={inp} placeholder="+234 800 000 0000 (optional)" />
        </FieldGroup>
        <div className="rg-row">
            <FieldGroup label="Password" error={errors.password}>
                <div className="rg-pw-wrap">
                    <input className="rg-input" type={showPw ? "text" : "password"} name="password" value={fd.password} onChange={inp} placeholder="Min. 8 characters" autoComplete="new-password" />
                    <button type="button" className="rg-eye" onClick={() => setShowPw(!showPw)}>{showPw ? "🙈" : "👁️"}</button>
                </div>
            </FieldGroup>
            <FieldGroup label="Confirm password" error={errors.confirmPassword}>
                <div className="rg-pw-wrap">
                    <input className="rg-input" type={showCpw ? "text" : "password"} name="confirmPassword" value={fd.confirmPassword} onChange={inp} placeholder="Repeat password" autoComplete="new-password" />
                    <button type="button" className="rg-eye" onClick={() => setShowCpw(!showCpw)}>{showCpw ? "🙈" : "👁️"}</button>
                </div>
            </FieldGroup>
        </div>
        <p className="rg-signin-hint">Already have an account? <Link to="/login" className="rg-link">Sign in</Link></p>
    </div>
);


// ─── Step 2 — Identity ────────────────────────────────────────────────────────
const GENDER_OPTS = [
    { v: "male", label: "Man", icon: "👨" },
    { v: "female", label: "Woman", icon: "👩" },
    { v: "other", label: "Non-binary / Other", icon: "🧑" },
];
const LOOKING_OPTS = [
    { v: "men", label: "Men", icon: "👨" },
    { v: "women", label: "Women", icon: "👩" },
    { v: "both", label: "Everyone", icon: "💫" },
];

const S2 = ({ fd, errors, inp, set }: any) => (
    <div className="rg-step">
        <StepHeader icon="✨" title="Tell us about yourself" subtitle="This helps us find the right matches for you." />
        <div className="rg-row">
            <FieldGroup label="Date of birth" error={errors.dateOfBirth} hint="You must be 18 or older.">
                <input className="rg-input" type="date" name="dateOfBirth" value={fd.dateOfBirth} onChange={inp} max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]} />
            </FieldGroup>
            {fd.age > 0 && (
                <FieldGroup label="Your age">
                    <div className="rg-age-badge">{fd.age}</div>
                </FieldGroup>
            )}
        </div>
        <FieldGroup label="I am a…" error={errors.gender}>
            <div className="opt-grid col-3">
                {GENDER_OPTS.map(o => <OptionCard key={o.v} {...o} selected={fd.gender === o.v} onClick={(v: string) => set("gender", v)} />)}
            </div>
        </FieldGroup>
        <FieldGroup label="I'm interested in…" error={errors.lookingFor}>
            <div className="opt-grid col-3">
                {LOOKING_OPTS.map(o => <OptionCard key={o.v} {...o} selected={fd.lookingFor === o.v} onClick={(v: string) => set("lookingFor", v)} />)}
            </div>
        </FieldGroup>
    </div>
);


// ─── Step 3 — Location ────────────────────────────────────────────────────────
const LOC_STATUS_META: Record<string, { color: string; icon: string }> = {
    idle: { color: "neutral", icon: "📍" },
    requesting: { color: "info", icon: "🔐" },
    detecting: { color: "info", icon: "🛰️" },
    detected: { color: "success", icon: "✅" },
    denied: { color: "warning", icon: "🚫" },
    unsupported: { color: "warning", icon: "⚠️" },
    error: { color: "error", icon: "❌" },
};

const S3 = ({ fd, errors, inp, set, loc }: any) => {
    const meta = LOC_STATUS_META[loc.status] ?? LOC_STATUS_META.idle;
    const isLoading = loc.status === "requesting" || loc.status === "detecting";
    return (
        <div className="rg-step">
            <StepHeader icon="📍" title="Where are you based?" subtitle="We'll use this to find matches near you. You can edit anything." />

            {/* Location detection card */}
            <div className={`loc-card loc-card--${meta.color}`}>
                <div className="loc-card-left">
                    <span className="loc-card-icon">{isLoading ? <span className="rg-spinner dark" /> : meta.icon}</span>
                </div>
                <div className="loc-card-body">
                    <p className="loc-card-msg">{loc.msg || "We'll auto-detect your location."}</p>
                </div>
                <button type="button" className="loc-retry-btn" onClick={loc.detect} disabled={isLoading}>
                    {loc.status === "detected" ? "Re-detect" : "Detect"}
                </button>
            </div>

            <FieldGroup label="Country" error={errors.country}>
                <select className="rg-input" name="country" value={fd.country} onChange={inp}>
                    <option value="">Select country</option>
                    {AFRICAN_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </FieldGroup>

            <div className="rg-row">
                <FieldGroup label="State / Province" error={errors.state}>
                    <input className={`rg-input ${loc.status === "detected" && fd.state ? "rg-input--auto" : ""}`} name="state" value={fd.state} onChange={inp} placeholder="e.g. Lagos State" />
                </FieldGroup>
                <FieldGroup label="City" error={errors.city}>
                    <input className={`rg-input ${loc.status === "detected" && fd.city ? "rg-input--auto" : ""}`} name="city" value={fd.city} onChange={inp} placeholder="e.g. Lagos" />
                </FieldGroup>
            </div>
        </div>
    );
};


// ─── Step 4 — Profile ─────────────────────────────────────────────────────────
const EDUCATION_OPTS = [
    { v: "high_school", label: "High School" },
    { v: "some_college", label: "Some College" },
    { v: "bachelors", label: "Bachelor's" },
    { v: "masters", label: "Master's" },
    { v: "phd", label: "PhD" },
];
const LANG_OPTS = ["English", "French", "Arabic", "Hausa", "Yoruba", "Igbo", "Swahili", "Zulu", "Amharic", "Portuguese"];

const S4 = ({ fd, errors, inp, set, preview, fileRef, onPhoto, toggleArr }: any) => (
    <div className="rg-step">
        <StepHeader icon="📸" title="Build your profile" subtitle="Great profiles get 3× more matches. Be authentic!" />

        {/* Photo upload */}
        <FieldGroup label="Profile photo" error={errors.profilePicture} hint="Pick your best, most recent photo.">
            <div className="photo-upload-area" onClick={() => fileRef.current?.click()}>
                {preview
                    ? <img src={preview} alt="Preview" className="photo-preview-img" />
                    : <div className="photo-upload-placeholder"><span>📸</span><p>Tap to upload</p><small>JPG, PNG — max 5 MB</small></div>
                }
                {preview && <div className="photo-overlay">Change photo</div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
        </FieldGroup>

        <FieldGroup label="About me" error={errors.aboutMe} hint="Write 20–300 characters. Be genuine.">
            <textarea className="rg-input rg-textarea" name="aboutMe" value={fd.aboutMe} onChange={inp}
                placeholder="e.g. Lagos-based architect who loves jazz, road trips, and building things — including great conversations." rows={4} maxLength={300} />
            <span className="rg-char-count">{fd.aboutMe.length}/300</span>
        </FieldGroup>

        <div className="rg-row">
            <FieldGroup label="Occupation" error={errors.occupation}>
                <input className="rg-input" name="occupation" value={fd.occupation} onChange={inp} placeholder="e.g. Software Engineer" />
            </FieldGroup>
            <FieldGroup label="Education" error={errors.education}>
                <div className="pill-group">
                    {EDUCATION_OPTS.map(o => (
                        <button key={o.v} type="button" className={`pill ${fd.education === o.v ? "selected" : ""}`} onClick={() => set("education", o.v)}>{o.label}</button>
                    ))}
                </div>
            </FieldGroup>
        </div>

        <FieldGroup label="Languages spoken" error={errors.languages} hint="Select all that apply.">
            <div className="pill-group">
                {LANG_OPTS.map(l => (
                    <button key={l} type="button" className={`pill ${fd.languages.includes(l) ? "selected" : ""}`} onClick={() => toggleArr("languages", l)}>{l}</button>
                ))}
            </div>
        </FieldGroup>
    </div>
);


// ─── Step 5 — Lifestyle ───────────────────────────────────────────────────────
const INTERESTS_OPTS = [
    { v: "Music", icon: "🎵" }, { v: "Sports", icon: "⚽" }, { v: "Movies", icon: "🎬" }, { v: "Gaming", icon: "🎮" },
    { v: "Cooking", icon: "🍳" }, { v: "Reading", icon: "📚" }, { v: "Travel", icon: "✈️" }, { v: "Fashion", icon: "👗" },
    { v: "Tech", icon: "💻" }, { v: "Fitness", icon: "💪" }, { v: "Art", icon: "🎨" }, { v: "Photography", icon: "📷" },
    { v: "Dancing", icon: "💃" }, { v: "Entrepreneurship", icon: "🚀" }, { v: "Nature", icon: "🌿" }, { v: "Spirituality", icon: "🙏" },
];
const SMOKE_OPTS = [{ v: "never", label: "Never" }, { v: "socially", label: "Socially" }, { v: "regularly", label: "Regularly" }];
const DRINK_OPTS = [{ v: "never", label: "Never" }, { v: "socially", label: "Socially" }, { v: "frequently", label: "Frequently" }];

const S5 = ({ fd, errors, set, toggleArr }: any) => (
    <div className="rg-step">
        <StepHeader icon="🌿" title="Your vibe & lifestyle" subtitle="Help matches understand who you are beyond your photos." />
        <FieldGroup label="Interests — pick up to 8" error={errors.interests} hint="These appear on your profile as conversation starters.">
            <div className="interest-grid">
                {INTERESTS_OPTS.map(o => (
                    <button key={o.v} type="button"
                        className={`interest-chip ${fd.interests.includes(o.v) ? "selected" : ""}`}
                        onClick={() => {
                            if (!fd.interests.includes(o.v) && fd.interests.length >= 8) return;
                            toggleArr("interests", o.v);
                        }}
                    >
                        <span>{o.icon}</span>{o.v}
                        {fd.interests.includes(o.v) && <span className="chip-check">✓</span>}
                    </button>
                ))}
            </div>
        </FieldGroup>
        <div className="rg-row">
            <FieldGroup label="Smoking" error={errors.smoking}>
                <PillSelect options={SMOKE_OPTS.map(o => ({ v: o.v, label: o.label }))} value={fd.smoking} onChange={(v: string) => set("smoking", v)} />
            </FieldGroup>
            <FieldGroup label="Drinking" error={errors.drinking}>
                <PillSelect options={DRINK_OPTS.map(o => ({ v: o.v, label: o.label }))} value={fd.drinking} onChange={(v: string) => set("drinking", v)} />
            </FieldGroup>
        </div>
    </div>
);


// ─── Step 6 — Goals ───────────────────────────────────────────────────────────
const GOAL_OPTS = [
    { v: "Marriage", label: "Marriage", icon: "💍" },
    { v: "Serious relationship", label: "Serious relationship", icon: "❤️" },
    { v: "Long-term dating", label: "Long-term dating", icon: "🌹" },
    { v: "Casual dating", label: "Casual dating", icon: "☀️" },
    { v: "Friendship", label: "Friendship first", icon: "🤝" },
    { v: "Networking", label: "Networking", icon: "🔗" },
];
const REL_VAL_OPTS = [
    { v: "trust", label: "Trust" }, { v: "loyalty", label: "Loyalty" },
    { v: "communication", label: "Communication" }, { v: "respect", label: "Respect" },
    { v: "honesty", label: "Honesty" }, { v: "growth", label: "Personal growth" },
];
const RELIGION_OPTS = [
    { v: "Christian", label: "Christian" }, { v: "Muslim", label: "Muslim" },
    { v: "Traditional", label: "Traditional" }, { v: "Agnostic", label: "Agnostic" },
    { v: "Atheist", label: "Atheist" }, { v: "Other", label: "Other" },
    { v: "Prefer not to say", label: "Prefer not to say" },
];
const IMP_OPTS = [{ v: "very_important", label: "Very important" }, { v: "somewhat_important", label: "Somewhat" }, { v: "not_important", label: "Not important" }];
const CHILDREN_OPTS = [{ v: "yes", label: "Yes" }, { v: "no", label: "No" }, { v: "prefer_not_to_say", label: "Prefer not to say" }];
const WANT_CHILDREN_OPTS = [{ v: "yes", label: "Yes" }, { v: "no", label: "No" }, { v: "maybe", label: "Maybe" }];
const PREF_COUNTRY_OPTS = AFRICAN_COUNTRIES.concat(["Anywhere in Africa"]);
const DIST_OPTS = [{ v: "within_10km", label: "Within 10 km" }, { v: "within_50km", label: "Within 50 km" }, { v: "within_country", label: "My country" }, { v: "anywhere_in_africa", label: "Anywhere in Africa" }];

const S6 = ({ fd, errors, inp, set }: any) => (
    <div className="rg-step">
        <StepHeader icon="💞" title="What are you looking for?" subtitle="Honesty here leads to better matches. No judgment." />
        <FieldGroup label="I'm here for…" error={errors.relationshipGoal}>
            <div className="opt-grid col-3">
                {GOAL_OPTS.map(o => <OptionCard key={o.v} {...o} selected={fd.relationshipGoal === o.v} onClick={(v: string) => set("relationshipGoal", v)} />)}
            </div>
        </FieldGroup>
        <div className="rg-row">
            <FieldGroup label="Do you have children?" error={errors.hasChildren}>
                <PillSelect options={CHILDREN_OPTS} value={fd.hasChildren} onChange={(v: string) => set("hasChildren", v)} />
            </FieldGroup>
            <FieldGroup label="Want children someday?" error={errors.wantsChildren}>
                <PillSelect options={WANT_CHILDREN_OPTS} value={fd.wantsChildren} onChange={(v: string) => set("wantsChildren", v)} />
            </FieldGroup>
        </div>
        <div className="rg-row">
            <FieldGroup label="Religion" error={errors.religion}>
                <select className="rg-input" name="religion" value={fd.religion} onChange={inp}>
                    <option value="">Select</option>
                    {RELIGION_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
            </FieldGroup>
            <FieldGroup label="How important is religion to you?" error={errors.religionImportance}>
                <PillSelect options={IMP_OPTS} value={fd.religionImportance} onChange={(v: string) => set("religionImportance", v)} />
            </FieldGroup>
        </div>
        <FieldGroup label="Biggest relationship value">
            <PillSelect options={REL_VAL_OPTS} value={fd.relationshipValue} onChange={(v: string) => set("relationshipValue", v)} multi={false} />
        </FieldGroup>
        <div className="rg-row">
            <FieldGroup label="Preferred match location" error={errors.preferredCountry}>
                <select className="rg-input" name="preferredCountry" value={fd.preferredCountry} onChange={inp}>
                    <option value="">Select</option>
                    {PREF_COUNTRY_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </FieldGroup>
            <FieldGroup label="Max distance" error={errors.preferredDistance}>
                <PillSelect options={DIST_OPTS} value={fd.preferredDistance} onChange={(v: string) => set("preferredDistance", v)} />
            </FieldGroup>
        </div>
        <FieldGroup label="Preferred age range">
            <div className="age-range-row">
                <input className="rg-input" type="number" name="minAge" value={fd.minAge} onChange={inp} min={18} max={80} />
                <span className="age-sep">to</span>
                <input className="rg-input" type="number" name="maxAge" value={fd.maxAge} onChange={inp} min={18} max={80} />
            </div>
        </FieldGroup>
    </div>
);


// ─── Step 7 — Verify ──────────────────────────────────────────────────────────
const S7 = ({ fd, navigate }: any) => {
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
    const [msg, setMsg] = useState("");
    const [cooldown, setCooldown] = useState(0);
    const refs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const onInput = (i: number, v: string) => {
        if (!/^\d*$/.test(v)) return;
        const a = [...otp]; a[i] = v.slice(-1); setOtp(a);
        if (v && i < 5) refs.current[i + 1]?.focus();
    };
    const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus();
    };
    const onPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        const a = [...otp]; digits.split("").forEach((d, i) => { a[i] = d; }); setOtp(a);
        refs.current[Math.min(digits.length, 5)]?.focus();
    };

    const verify = async () => {
        const code = otp.join("");
        if (code.length < 6) { setStatus("error"); setMsg("Enter the full 6-digit code."); return; }
        setStatus("verifying"); setMsg("");
        try {
            const res = await authAPI.verifyOtp(fd.email, code);
            // Persist the new token and member profile using the proper API helpers
            setAuthToken(res.token);
            saveUserToLocal(res.user);
            setStatus("success");
            setMsg(res.message || "Email verified! 🎉 Welcome to DateClone!");
            setTimeout(() => navigate("/discover", { replace: true }), 1800);
        } catch (err: any) {
            setStatus("error");
            setMsg(err.message || "Invalid code. Please try again.");
        }
    };

    const resend = async () => {
        try {
            await authAPI.resendVerification(fd.email);
            setCooldown(60); setStatus("idle"); setMsg("New code sent!");
            setOtp(["", "", "", "", "", ""]); refs.current[0]?.focus();
        } catch (err: any) { setMsg(err.message || "Failed to resend."); }
    };

    return (
        <div className="rg-step verify-step">
            <div className="verify-icon">✉️</div>
            <h2 className="step-title">Check your inbox</h2>
            <p className="step-subtitle">We sent a 6-digit code to <strong>{fd.email}</strong></p>

            {status !== "success" ? (
                <>
                    <div className="otp-inputs" onPaste={onPaste}>
                        {otp.map((d, i) => (
                            <input key={i} ref={el => { refs.current[i] = el; }} type="text" inputMode="numeric"
                                maxLength={1} value={d} autoFocus={i === 0}
                                onChange={e => onInput(i, e.target.value)}
                                onKeyDown={e => onKey(i, e)}
                                className={`otp-box ${status === "error" ? "otp-error" : ""}`} />
                        ))}
                    </div>
                    {msg && <p className={`otp-message ${status === "error" ? "otp-message-error" : "otp-message-info"}`}>{msg}</p>}
                    <button className="rg-btn-next" style={{ width: "100%" }} onClick={verify} disabled={status === "verifying"}>
                        {status === "verifying" ? <><span className="rg-spinner" /> Verifying…</> : "Verify Email →"}
                    </button>
                    <p className="resend-hint">
                        Didn't get it? Check spam or{" "}
                        <button type="button" className="resend-link" onClick={resend} disabled={cooldown > 0}>
                            {cooldown > 0 ? `Resend in ${cooldown}s` : "resend code"}
                        </button>
                    </p>
                </>
            ) : (
                <div className="verify-success">
                    <div className="success-icon">🎉</div>
                    <p className="otp-message otp-message-success">{msg}</p>
                    <p style={{ color: "#888", fontSize: "0.88rem", marginTop: 8 }}>Redirecting to your matches…</p>
                </div>
            )}
        </div>
    );
};

export default Register;
