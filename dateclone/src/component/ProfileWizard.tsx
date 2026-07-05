import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { profileAPI } from "../services/apiService";
import "../style/profileWizard.css";

// ─── Steps ────────────────────────────────────────────────────────────────────
const STEPS = [
    { id: "photos", label: "Photos", icon: "📸" },
    { id: "bio", label: "About You", icon: "📝" },
    { id: "interests", label: "Interests", icon: "🎯" },
    { id: "preferences", label: "Preferences", icon: "⚙️" },
    { id: "goals", label: "Goals", icon: "💞" },
    { id: "lifestyle", label: "Lifestyle", icon: "🌿" },
];

const INTEREST_OPTIONS = [
    "Travel", "Music", "Fitness", "Cooking", "Reading", "Movies",
    "Photography", "Dancing", "Hiking", "Art", "Gaming", "Yoga",
    "Sports", "Fashion", "Technology", "Nature", "Animals", "Volunteering",
    "Wine", "Coffee", "Food", "Beach", "Camping", "Meditation",
];

const RELATIONSHIP_GOALS = [
    "casual", "dating", "serious_relationship", "marriage",
    "friendship", "open_to_anything", "not_sure_yet",
];

const ProfileWizard = () => {
    const navigate = useNavigate();
    const { user, updateLocalUser } = useAuth();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [completed, setCompleted] = useState(false);

    // Form state
    const [photos, setPhotos] = useState<string[]>([user?.profilePicture || ""].filter(Boolean));
    const [bio, setBio] = useState(user?.aboutMe || "");
    const [interests, setInterests] = useState<string[]>(user?.interests || []);
    const [gender, setGender] = useState(user?.gender || "");
    const [lookingFor, setLookingFor] = useState(user?.lookingFor || "");
    const [relationshipGoal, setRelationshipGoal] = useState(user?.relationshipGoal || "");
    const [smoking, setSmoking] = useState(user?.smoking || "");
    const [drinking, setDrinking] = useState(user?.drinking || "");
    const [occupation, setOccupation] = useState(user?.occupation || "");
    const [education, setEducation] = useState(user?.education || "");
    const [religion, setReligion] = useState(user?.religion || "");

    const isLastStep = step === STEPS.length - 1;
    const progress = Math.round(((step + 1) / STEPS.length) * 100);

    const toggleInterest = (interest: string) => {
        setInterests(prev =>
            prev.includes(interest)
                ? prev.filter(i => i !== interest)
                : [...prev, interest]
        );
    };

    const handlePhotoUpload = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onloadend = () => {
                const url = reader.result as string;
                setPhotos(prev => [...prev, url]);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const removePhoto = (idx: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== idx));
    };

    const handleNext = async () => {
        if (step < STEPS.length - 1) {
            setStep(s => s + 1);
            return;
        }
        // Save all data
        await handleSave();
    };

    const handleSkip = () => {
        if (step < STEPS.length - 1) {
            setStep(s => s + 1);
        } else {
            navigate("/dashboard");
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const profileData: Record<string, any> = {
                aboutMe: bio,
                interests,
                gender,
                lookingFor,
                relationshipGoal,
                smoking,
                drinking,
                occupation,
                education,
                religion,
            };
            if (photos.length > 0) {
                profileData.profilePicture = photos[0];
                profileData.photos = photos;
            }
            const res = await profileAPI.updateProfile(user._id, profileData);
            if (res.user) {
                updateLocalUser(res.user);
            }
            setCompleted(true);
            setTimeout(() => navigate("/dashboard"), 1500);
        } catch (err) {
            console.error("[Wizard Save]", err);
        } finally {
            setLoading(false);
        }
    };

    if (completed) {
        return (
            <div className="wizard-complete">
                <div className="wizard-complete-icon">🎉</div>
                <h2>Profile Complete!</h2>
                <p>Your profile is now ready. Let's find your match!</p>
                <div className="discover-spinner" />
            </div>
        );
    }

    const currentStep = STEPS[step];

    return (
        <div className="wizard-overlay">
            <div className="wizard-container">
                {/* Progress bar */}
                <div className="wizard-progress">
                    <div className="wizard-progress-bar">
                        <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="wizard-progress-text">{progress}%</span>
                </div>

                {/* Step indicator */}
                <div className="wizard-steps">
                    {STEPS.map((s, i) => (
                        <div key={s.id}
                            className={`wizard-step-dot ${i === step ? "active" : i < step ? "done" : ""}`}
                            onClick={() => i < step && setStep(i)}>
                            <span className="wizard-step-icon">{i < step ? "✓" : s.icon}</span>
                            <span className="wizard-step-label">{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Step content */}
                <div className="wizard-content">
                    <h2 className="wizard-title">{currentStep.icon} {currentStep.label}</h2>

                    {step === 0 && (
                        <div className="wizard-photos">
                            <p className="wizard-desc">Upload your best photos to get more matches!</p>
                            <div className="photo-grid">
                                {photos.map((p, i) => (
                                    <div key={i} className="photo-upload-item">
                                        <img src={p} alt={`Photo ${i + 1}`} />
                                        <button className="photo-remove" onClick={() => removePhoto(i)}>✕</button>
                                    </div>
                                ))}
                                {photos.length < 6 && (
                                    <div className="photo-upload-item photo-upload-add" onClick={handlePhotoUpload}>
                                        <span>+</span>
                                        <span className="photo-upload-label">Add Photo</span>
                                    </div>
                                )}
                            </div>
                            <p className="wizard-hint">Add at least 1 photo. You can add up to 6.</p>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="wizard-bio">
                            <p className="wizard-desc">Write a short bio to tell people about yourself.</p>
                            <textarea
                                className="wizard-textarea"
                                placeholder="I love traveling, trying new foods, and hiking on weekends. Looking for someone who shares my sense of adventure! 🚀"
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                maxLength={500}
                                rows={5}
                            />
                            <p className="wizard-hint">{bio.length}/500 characters</p>
                            <div className="wizard-input-group">
                                <label>Occupation</label>
                                <input type="text" placeholder="e.g. Software Engineer"
                                    value={occupation} onChange={e => setOccupation(e.target.value)} />
                            </div>
                            <div className="wizard-input-group">
                                <label>Education</label>
                                <select value={education} onChange={e => setEducation(e.target.value)}>
                                    <option value="">Select education</option>
                                    <option value="high_school">High School</option>
                                    <option value="some_college">Some College</option>
                                    <option value="bachelors">Bachelor's</option>
                                    <option value="masters">Master's</option>
                                    <option value="phd">PhD</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="wizard-interests">
                            <p className="wizard-desc">Select your interests to find better matches.</p>
                            <div className="interest-grid">
                                {INTEREST_OPTIONS.map(i => (
                                    <button key={i}
                                        className={`interest-chip ${interests.includes(i) ? "active" : ""}`}
                                        onClick={() => toggleInterest(i)}>
                                        {i}
                                    </button>
                                ))}
                            </div>
                            <p className="wizard-hint">{interests.length} selected</p>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="wizard-preferences">
                            <p className="wizard-desc">Set your dating preferences.</p>
                            <div className="wizard-input-group">
                                <label>I am</label>
                                <select value={gender} onChange={e => setGender(e.target.value)}>
                                    <option value="">Select gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="wizard-input-group">
                                <label>Looking for</label>
                                <select value={lookingFor} onChange={e => setLookingFor(e.target.value)}>
                                    <option value="">Select preference</option>
                                    <option value="men">Men</option>
                                    <option value="women">Women</option>
                                    <option value="both">Both</option>
                                </select>
                            </div>
                            <div className="wizard-input-group">
                                <label>Religion</label>
                                <select value={religion} onChange={e => setReligion(e.target.value)}>
                                    <option value="">Select religion</option>
                                    <option value="Christianity">Christianity</option>
                                    <option value="Islam">Islam</option>
                                    <option value="Hinduism">Hinduism</option>
                                    <option value="Buddhism">Buddhism</option>
                                    <option value="Judaism">Judaism</option>
                                    <option value="Traditional">Traditional</option>
                                    <option value="Other">Other</option>
                                    <option value="None">None</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="wizard-goals">
                            <p className="wizard-desc">What are you looking for?</p>
                            <div className="goal-grid">
                                {RELATIONSHIP_GOALS.map(g => (
                                    <button key={g}
                                        className={`goal-card ${relationshipGoal === g ? "active" : ""}`}
                                        onClick={() => setRelationshipGoal(g)}>
                                        <span className="goal-icon">
                                            {g === "casual" ? "😊" : g === "dating" ? "💕" : g === "serious_relationship" ? "💑" : g === "marriage" ? "💍" : g === "friendship" ? "🤝" : g === "open_to_anything" ? "🌟" : "🤔"}
                                        </span>
                                        <span className="goal-label">{g.replace(/_/g, " ")}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="wizard-lifestyle">
                            <p className="wizard-desc">A few lifestyle details.</p>
                            <div className="wizard-input-group">
                                <label>Smoking</label>
                                <select value={smoking} onChange={e => setSmoking(e.target.value)}>
                                    <option value="">Select</option>
                                    <option value="never">Never</option>
                                    <option value="socially">Socially</option>
                                    <option value="occasionally">Occasionally</option>
                                    <option value="regularly">Regularly</option>
                                </select>
                            </div>
                            <div className="wizard-input-group">
                                <label>Drinking</label>
                                <select value={drinking} onChange={e => setDrinking(e.target.value)}>
                                    <option value="">Select</option>
                                    <option value="never">Never</option>
                                    <option value="socially">Socially</option>
                                    <option value="frequently">Frequently</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="wizard-actions">
                    <button className="btn btn-outline" onClick={handleSkip} disabled={loading}>
                        Skip {isLastStep ? "→" : ""}
                    </button>
                    <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
                        {loading ? <span className="auth-spinner" /> : isLastStep ? "Complete ✓" : "Next →"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileWizard;