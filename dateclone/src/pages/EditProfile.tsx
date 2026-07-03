import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { profileAPI } from "../services/apiService";
import { useAuth } from "../context/AuthContext";
import "../style/editProfile.css";

// All editable fields with their safe defaults
const BLANK_FORM = {
    firstName: "",
    lastName: "",
    aboutMe: "",
    occupation: "",
    education: "",
    city: "",
    country: "",
    state: "",
    religion: "",
    relationshipGoal: "",
    smoking: "",
    drinking: "",
    minAge: 18,
    maxAge: 80,
    profilePicture: "",
    interests: [] as string[],
    languages: [] as string[],
    lookingFor: "",
    hasChildren: "",
    wantsChildren: "",
    religionImportance: "",
};

type FormState = typeof BLANK_FORM;

const EditProfile = () => {
    const { user, refreshUser, updateLocalUser } = useAuth();
    const navigate = useNavigate();

    const [form, setForm] = useState<FormState>(BLANK_FORM);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    // ── On mount: fetch the FULL profile from the API ──────────────────────
    // The auth context only stores a stripped user object (login response).
    // We must fetch from GET /profile/:id to get all profile fields including
    // city, occupation, interests, etc. so the form pre-fills correctly.
    useEffect(() => {
        if (!user?._id) return;

        const fetchProfile = async () => {
            setFetching(true);
            try {
                const res = await profileAPI.getProfile(user._id);
                const p = res.user;

                // Populate form with every field that exists on the stored profile.
                // Fall back to the auth user for the core identity fields,
                // then fall back to safe defaults.
                setForm({
                    firstName: p.firstName ?? user.firstName ?? "",
                    lastName: p.lastName ?? user.lastName ?? "",
                    aboutMe: p.aboutMe ?? "",
                    occupation: p.occupation ?? "",
                    education: p.education ?? "",
                    city: p.city ?? "",
                    country: p.country ?? "",
                    state: p.state ?? "",
                    religion: p.religion ?? "",
                    relationshipGoal: p.relationshipGoal ?? "",
                    smoking: p.smoking ?? "",
                    drinking: p.drinking ?? "",
                    minAge: p.minAge ?? 18,
                    maxAge: p.maxAge ?? 80,
                    profilePicture: p.profilePicture ?? "",
                    interests: Array.isArray(p.interests) ? p.interests : [],
                    languages: Array.isArray(p.languages) ? p.languages : [],
                    lookingFor: p.lookingFor ?? "",
                    hasChildren: p.hasChildren ?? "",
                    wantsChildren: p.wantsChildren ?? "",
                    religionImportance: p.religionImportance ?? "",
                });
            } catch {
                // If fetch fails fall back to whatever is in the auth context
                const u = user as any;
                setForm({
                    firstName: u.firstName ?? "",
                    lastName: u.lastName ?? "",
                    aboutMe: u.aboutMe ?? "",
                    occupation: u.occupation ?? "",
                    education: u.education ?? "",
                    city: u.city ?? "",
                    country: u.country ?? "",
                    state: u.state ?? "",
                    religion: u.religion ?? "",
                    relationshipGoal: u.relationshipGoal ?? "",
                    smoking: u.smoking ?? "",
                    drinking: u.drinking ?? "",
                    minAge: u.minAge ?? 18,
                    maxAge: u.maxAge ?? 80,
                    profilePicture: u.profilePicture ?? "",
                    interests: Array.isArray(u.interests) ? u.interests : [],
                    languages: Array.isArray(u.languages) ? u.languages : [],
                    lookingFor: u.lookingFor ?? "",
                    hasChildren: u.hasChildren ?? "",
                    wantsChildren: u.wantsChildren ?? "",
                    religionImportance: u.religionImportance ?? "",
                });
            } finally {
                setFetching(false);
            }
        };

        fetchProfile();
    }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Generic change handler ─────────────────────────────────────────────
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    // ── Submit ─────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?._id) return;

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const res = await profileAPI.updateProfile(user._id, form);

            // Update the auth context with the full returned user so other
            // pages (Profile, Dashboard) immediately reflect the new data.
            if (res.user) {
                updateLocalUser(res.user);
            }

            // Also refresh from server to keep sessionStorage fully in sync
            await refreshUser();

            setSuccess("Profile updated successfully! ✓");
            setTimeout(() => navigate("/profile"), 1500);
        } catch (err: any) {
            setError(err.message || "Update failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Loading skeleton ───────────────────────────────────────────────────
    if (fetching) {
        return (
            <div className="page-wrapper">
                <AppNavbar />
                <div className="edit-profile-page">
                    <div className="edit-profile-card ep-loading">
                        <div className="ep-loading-inner">
                            <span className="auth-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                            <p>Loading your profile…</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="edit-profile-page">
                <div className="edit-profile-card">
                    <div className="edit-profile-header">
                        <button className="ep-back" onClick={() => navigate("/profile")}>← Back</button>
                        <h1>Edit Profile</h1>
                    </div>

                    {success && <div className="ep-success">{success}</div>}
                    {error && <div className="ep-error">{error}</div>}

                    <form onSubmit={handleSubmit} className="ep-form">

                        {/* ── Basic Info ──────────────────────────────────── */}
                        <div className="ep-section-title">Basic Info</div>
                        <div className="ep-row">
                            <div className="ep-field">
                                <label>First Name</label>
                                <input
                                    name="firstName"
                                    value={form.firstName}
                                    onChange={handleChange}
                                    placeholder="First name"
                                />
                            </div>
                            <div className="ep-field">
                                <label>Last Name</label>
                                <input
                                    name="lastName"
                                    value={form.lastName}
                                    onChange={handleChange}
                                    placeholder="Last name"
                                />
                            </div>
                        </div>

                        <div className="ep-field">
                            <label>About Me</label>
                            <textarea
                                name="aboutMe"
                                value={form.aboutMe}
                                onChange={handleChange}
                                rows={4}
                                placeholder="Tell people about yourself…"
                                maxLength={500}
                            />
                            <span className="ep-char-count">{form.aboutMe.length}/500</span>
                        </div>

                        <div className="ep-row">
                            <div className="ep-field">
                                <label>Occupation</label>
                                <input
                                    name="occupation"
                                    value={form.occupation}
                                    onChange={handleChange}
                                    placeholder="e.g. Software Engineer"
                                />
                            </div>
                            <div className="ep-field">
                                <label>Education</label>
                                <select name="education" value={form.education} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="high_school">High School</option>
                                    <option value="some_college">Some College</option>
                                    <option value="bachelors">Bachelor's</option>
                                    <option value="masters">Master's</option>
                                    <option value="phd">PhD</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        {/* Profile picture URL */}
                        <div className="ep-field">
                            <label>Profile Picture URL</label>
                            <input
                                name="profilePicture"
                                value={form.profilePicture}
                                onChange={handleChange}
                                placeholder="https://… (paste a direct image link)"
                            />
                            {form.profilePicture && (
                                <div className="ep-photo-preview">
                                    <img
                                        src={form.profilePicture}
                                        alt="Preview"
                                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* ── Location ────────────────────────────────────── */}
                        <div className="ep-section-title">Location</div>
                        <div className="ep-row">
                            <div className="ep-field">
                                <label>City</label>
                                <input
                                    name="city"
                                    value={form.city}
                                    onChange={handleChange}
                                    placeholder="e.g. Lagos"
                                />
                            </div>
                            <div className="ep-field">
                                <label>State / Province</label>
                                <input
                                    name="state"
                                    value={form.state}
                                    onChange={handleChange}
                                    placeholder="e.g. Lagos State"
                                />
                            </div>
                            <div className="ep-field">
                                <label>Country</label>
                                <input
                                    name="country"
                                    value={form.country}
                                    onChange={handleChange}
                                    placeholder="e.g. Nigeria"
                                />
                            </div>
                        </div>

                        {/* ── Lifestyle ───────────────────────────────────── */}
                        <div className="ep-section-title">Lifestyle</div>
                        <div className="ep-row">
                            <div className="ep-field">
                                <label>Religion</label>
                                <select name="religion" value={form.religion} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="Christian">Christian</option>
                                    <option value="Muslim">Muslim</option>
                                    <option value="Traditional">Traditional</option>
                                    <option value="Agnostic">Agnostic</option>
                                    <option value="Atheist">Atheist</option>
                                    <option value="Other">Other</option>
                                    <option value="Prefer not to say">Prefer not to say</option>
                                </select>
                            </div>
                            <div className="ep-field">
                                <label>Relationship Goal</label>
                                <select name="relationshipGoal" value={form.relationshipGoal} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="Marriage">Marriage</option>
                                    <option value="Serious relationship">Serious relationship</option>
                                    <option value="Long-term dating">Long-term dating</option>
                                    <option value="Casual dating">Casual dating</option>
                                    <option value="Friendship">Friendship first</option>
                                </select>
                            </div>
                        </div>

                        <div className="ep-row">
                            <div className="ep-field">
                                <label>Smoking</label>
                                <select name="smoking" value={form.smoking} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="never">Never</option>
                                    <option value="socially">Socially</option>
                                    <option value="occasionally">Occasionally</option>
                                    <option value="regularly">Regularly</option>
                                </select>
                            </div>
                            <div className="ep-field">
                                <label>Drinking</label>
                                <select name="drinking" value={form.drinking} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="never">Never</option>
                                    <option value="socially">Socially</option>
                                    <option value="frequently">Frequently</option>
                                </select>
                            </div>
                        </div>

                        <div className="ep-row">
                            <div className="ep-field">
                                <label>Has Children</label>
                                <select name="hasChildren" value={form.hasChildren} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                    <option value="prefer_not_to_say">Prefer not to say</option>
                                </select>
                            </div>
                            <div className="ep-field">
                                <label>Wants Children</label>
                                <select name="wantsChildren" value={form.wantsChildren} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                    <option value="maybe">Maybe</option>
                                </select>
                            </div>
                        </div>

                        {/* ── Match Preferences ───────────────────────────── */}
                        <div className="ep-section-title">Match Preferences</div>
                        <div className="ep-row">
                            <div className="ep-field">
                                <label>Interested In</label>
                                <select name="lookingFor" value={form.lookingFor} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="men">Men</option>
                                    <option value="women">Women</option>
                                    <option value="both">Everyone</option>
                                </select>
                            </div>
                            <div className="ep-field">
                                <label>Religion Importance</label>
                                <select name="religionImportance" value={form.religionImportance} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="very_important">Very important</option>
                                    <option value="somewhat_important">Somewhat important</option>
                                    <option value="not_important">Not important</option>
                                </select>
                            </div>
                        </div>

                        <div className="ep-row">
                            <div className="ep-field">
                                <label>Min Age Preference</label>
                                <input
                                    type="number"
                                    name="minAge"
                                    value={form.minAge}
                                    onChange={handleChange}
                                    min={18}
                                    max={80}
                                />
                            </div>
                            <div className="ep-field">
                                <label>Max Age Preference</label>
                                <input
                                    type="number"
                                    name="maxAge"
                                    value={form.maxAge}
                                    onChange={handleChange}
                                    min={18}
                                    max={80}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary ep-submit"
                            disabled={loading}
                        >
                            {loading
                                ? <><span className="auth-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />&nbsp;Saving…</>
                                : "Save Changes"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditProfile;
