import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { profileAPI } from "../services/apiService";
import { useAuth } from "../context/AuthContext";
import "../style/editProfile.css";

const EditProfile = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const u = user as any;

    const [form, setForm] = useState({
        firstName: u?.firstName ?? "",
        lastName: u?.lastName ?? "",
        aboutMe: u?.aboutMe ?? "",
        occupation: u?.occupation ?? "",
        education: u?.education ?? "",
        city: u?.city ?? "",
        country: u?.country ?? "",
        state: u?.state ?? "",
        religion: u?.religion ?? "",
        relationshipGoal: u?.relationshipGoal ?? "",
        smoking: u?.smoking ?? "",
        drinking: u?.drinking ?? "",
        minAge: u?.minAge ?? 18,
        maxAge: u?.maxAge ?? 80,
    });

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(""); setSuccess("");
        try {
            await profileAPI.updateProfile(u._id, form);
            await refreshUser();
            setSuccess("Profile updated successfully! ✓");
            setTimeout(() => navigate("/profile"), 1500);
        } catch (err: any) {
            setError(err.message || "Update failed.");
        } finally {
            setLoading(false);
        }
    };

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
                        <div className="ep-section-title">Basic Info</div>
                        <div className="ep-row">
                            <div className="ep-field">
                                <label>First Name</label>
                                <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="First name" />
                            </div>
                            <div className="ep-field">
                                <label>Last Name</label>
                                <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Last name" />
                            </div>
                        </div>

                        <div className="ep-field">
                            <label>About Me</label>
                            <textarea name="aboutMe" value={form.aboutMe} onChange={handleChange} rows={4} placeholder="Tell people about yourself…" />
                        </div>

                        <div className="ep-row">
                            <div className="ep-field">
                                <label>Occupation</label>
                                <input name="occupation" value={form.occupation} onChange={handleChange} placeholder="e.g. Engineer" />
                            </div>
                            <div className="ep-field">
                                <label>Education</label>
                                <select name="education" value={form.education} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="high_school">High School</option>
                                    <option value="bachelors">Bachelor's</option>
                                    <option value="masters">Master's</option>
                                    <option value="phd">PhD</option>
                                </select>
                            </div>
                        </div>

                        <div className="ep-section-title">Location</div>
                        <div className="ep-row">
                            <div className="ep-field">
                                <label>City</label>
                                <input name="city" value={form.city} onChange={handleChange} placeholder="e.g. Lagos" />
                            </div>
                            <div className="ep-field">
                                <label>State</label>
                                <input name="state" value={form.state} onChange={handleChange} placeholder="e.g. Lagos State" />
                            </div>
                            <div className="ep-field">
                                <label>Country</label>
                                <input name="country" value={form.country} onChange={handleChange} placeholder="e.g. Nigeria" />
                            </div>
                        </div>

                        <div className="ep-section-title">Lifestyle</div>
                        <div className="ep-row">
                            <div className="ep-field">
                                <label>Religion</label>
                                <select name="religion" value={form.religion} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="Christian">Christian</option>
                                    <option value="Muslim">Muslim</option>
                                    <option value="Traditional">Traditional</option>
                                    <option value="Other">Other</option>
                                    <option value="Prefer not to say">Prefer not to say</option>
                                </select>
                            </div>
                            <div className="ep-field">
                                <label>Relationship Goal</label>
                                <select name="relationshipGoal" value={form.relationshipGoal} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="Serious relationship">Serious relationship</option>
                                    <option value="Marriage">Marriage</option>
                                    <option value="Long-term dating">Long-term dating</option>
                                    <option value="Casual dating">Casual dating</option>
                                    <option value="Friendship">Friendship</option>
                                </select>
                            </div>
                        </div>
                        <div className="ep-row">
                            <div className="ep-field">
                                <label>Smoking</label>
                                <select name="smoking" value={form.smoking} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="never">Never</option>
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

                        <div className="ep-section-title">Match Preferences</div>
                        <div className="ep-row">
                            <div className="ep-field">
                                <label>Min Age</label>
                                <input type="number" name="minAge" value={form.minAge} onChange={handleChange} min={18} max={80} />
                            </div>
                            <div className="ep-field">
                                <label>Max Age</label>
                                <input type="number" name="maxAge" value={form.maxAge} onChange={handleChange} min={18} max={80} />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary ep-submit" disabled={loading}>
                            {loading ? <span className="auth-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : "Save Changes"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditProfile;
