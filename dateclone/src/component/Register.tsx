import { useState, useRef, useEffect } from "react";
import "../style/register.css";

interface FormData {
    // Step 1: Account Information
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;

    // Step 2: Personal Information
    dateOfBirth: string;
    age: number;
    gender: string;
    lookingFor: string;
    country: string;
    state: string;
    city: string;
    latitude: number;
    longitude: number;

    // Step 3: Profile Information
    profilePicture: string;
    aboutMe: string;
    occupation: string;
    education: string;
    languages: string[];

    // Step 4: Interests
    interests: string[];

    // Step 5: Match Preferences
    minAge: number;
    maxAge: number;
    preferredCountry: string;
    preferredDistance: string;

    // Step 6: Relationship & Lifestyle
    relationshipGoal: string;
    hasChildren: string;
    wantsChildren: string;
    smoking: string;
    drinking: string;
    religion: string;
    religionImportance: string;
    relationshipValue: string;

    // Step 7: Verification
    emailVerified: boolean;
}

const Register = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState<FormData>({
        // Step 1
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        // Step 2
        dateOfBirth: "",
        age: 0,
        gender: "",
        lookingFor: "",
        country: "",
        state: "",
        city: "",
        latitude: 0,
        longitude: 0,
        // Step 3
        profilePicture: "",
        aboutMe: "",
        occupation: "",
        education: "",
        languages: [],
        // Step 4
        interests: [],
        // Step 5
        minAge: 18,
        maxAge: 80,
        preferredCountry: "",
        preferredDistance: "",
        // Step 6
        relationshipGoal: "",
        hasChildren: "",
        wantsChildren: "",
        smoking: "",
        drinking: "",
        religion: "",
        religionImportance: "",
        relationshipValue: "",
        // Step 7
        emailVerified: false,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [previewImage, setPreviewImage] = useState<string>("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get user location on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setFormData((prev) => ({
                        ...prev,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    }));
                },
                () => {
                    console.log("Location access denied");
                }
            );
        }
    }, []);

    const interestsOptions = [
        "Music",
        "Sports",
        "Movies",
        "Gaming",
        "Cooking",
        "Reading",
        "Traveling",
        "Fashion",
        "Technology",
        "Fitness",
        "Business",
        "Photography",
    ];

    const validateStep1 = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.firstName.trim())
            newErrors.firstName = "First name is required";
        if (!formData.lastName.trim())
            newErrors.lastName = "Last name is required";
        if (!formData.username.trim())
            newErrors.username = "Username is required";
        if (!formData.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Invalid email format";
        }
        if (!formData.password.trim())
            newErrors.password = "Password is required";
        if (formData.password.length < 8)
            newErrors.password = "Password must be at least 8 characters";
        if (formData.password !== formData.confirmPassword)
            newErrors.confirmPassword = "Passwords do not match";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
        if (!formData.gender) newErrors.gender = "Gender is required";
        if (!formData.lookingFor) newErrors.lookingFor = "Please select who you're looking for";
        if (!formData.country) newErrors.country = "Country is required";
        if (!formData.state) newErrors.state = "State/Province is required";
        if (!formData.city) newErrors.city = "City is required";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep3 = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.profilePicture) newErrors.profilePicture = "Profile picture is required";
        if (!formData.aboutMe.trim()) newErrors.aboutMe = "Please tell us about yourself";
        if (formData.aboutMe.length < 20)
            newErrors.aboutMe = "About me must be at least 20 characters";
        if (!formData.occupation.trim())
            newErrors.occupation = "Occupation is required";
        if (!formData.education) newErrors.education = "Education level is required";
        if (formData.languages.length === 0)
            newErrors.languages = "Select at least one language";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep4 = () => {
        const newErrors: Record<string, string> = {};
        if (formData.interests.length === 0)
            newErrors.interests = "Select at least one interest";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep5 = () => {
        const newErrors: Record<string, string> = {};
        if (formData.minAge < 18) newErrors.minAge = "Minimum age must be 18";
        if (formData.maxAge > 80) newErrors.maxAge = "Maximum age cannot exceed 80";
        if (formData.minAge > formData.maxAge)
            newErrors.maxAge = "Maximum age must be greater than minimum";
        if (!formData.preferredCountry)
            newErrors.preferredCountry = "Preferred country is required";
        if (!formData.preferredDistance)
            newErrors.preferredDistance = "Preferred distance is required";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep6 = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.relationshipGoal)
            newErrors.relationshipGoal = "Relationship goal is required";
        if (!formData.hasChildren)
            newErrors.hasChildren = "Please answer if you have children";
        if (!formData.wantsChildren)
            newErrors.wantsChildren = "Please answer about future children";
        if (!formData.smoking) newErrors.smoking = "Please select smoking preference";
        if (!formData.drinking) newErrors.drinking = "Please select drinking preference";
        if (!formData.religion) newErrors.religion = "Religion is required";
        if (!formData.religionImportance)
            newErrors.religionImportance = "Please rate religion importance";
        if (!formData.relationshipValue)
            newErrors.relationshipValue = "Please select your biggest relationship value";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        let isValid = false;

        switch (currentStep) {
            case 1:
                isValid = validateStep1();
                break;
            case 2:
                isValid = validateStep2();
                break;
            case 3:
                isValid = validateStep3();
                break;
            case 4:
                isValid = validateStep4();
                break;
            case 5:
                isValid = validateStep5();
                break;
            case 6:
                isValid = validateStep6();
                break;
            default:
                isValid = true;
        }

        if (isValid) {
            setCurrentStep(currentStep + 1);
            setErrors({});
            window.scrollTo(0, 0);
        }
    };

    const handlePrevious = () => {
        setCurrentStep(currentStep - 1);
        setErrors({});
        window.scrollTo(0, 0);
    };

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;

        if (name === "dateOfBirth") {
            const dob = new Date(value);
            const today = new Date();
            const age = today.getFullYear() - dob.getFullYear();

            setFormData((prev) => ({
                ...prev,
                [name]: value,
                age: age,
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPreviewImage(result);
                setFormData((prev) => ({
                    ...prev,
                    profilePicture: result,
                }));
                setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.profilePicture;
                    return newErrors;
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleInterestToggle = (interest: string) => {
        setFormData((prev) => ({
            ...prev,
            interests: prev.interests.includes(interest)
                ? prev.interests.filter((i) => i !== interest)
                : [...prev.interests, interest],
        }));
    };

    const handleLanguageToggle = (language: string) => {
        setFormData((prev) => ({
            ...prev,
            languages: prev.languages.includes(language)
                ? prev.languages.filter((l) => l !== language)
                : [...prev.languages, language],
        }));
    };

    const handleSubmit = () => {
        console.log("Form submitted:", formData);
        alert("Registration successful!");
    };

    return (
        <div className="register-container">
            <div className="register-card">
                {/* Progress Bar */}
                <div className="progress-section">
                    <h1 className="register-title">Create Your DateClone Profile</h1>
                    <div className="progress-bar">
                        {[1, 2, 3, 4, 5, 6, 7].map((step) => (
                            <div key={step} className="progress-item">
                                <div
                                    className={`progress-dot ${step <= currentStep ? "active" : ""
                                        }`}
                                >
                                    {step < currentStep ? "✓" : step}
                                </div>
                                <div className="progress-label">
                                    {step === 1
                                        ? "Account"
                                        : step === 2
                                            ? "Personal"
                                            : step === 3
                                                ? "Profile"
                                                : step === 4
                                                    ? "Interests"
                                                    : step === 5
                                                        ? "Preferences"
                                                        : step === 6
                                                            ? "Lifestyle"
                                                            : "Verify"}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form Steps */}
                <div className="form-section">
                    {currentStep === 1 && (
                        <Step1
                            formData={formData}
                            errors={errors}
                            handleInputChange={handleInputChange}
                            showPassword={showPassword}
                            setShowPassword={setShowPassword}
                            showConfirmPassword={showConfirmPassword}
                            setShowConfirmPassword={setShowConfirmPassword}
                        />
                    )}
                    {currentStep === 2 && (
                        <Step2
                            formData={formData}
                            errors={errors}
                            handleInputChange={handleInputChange}
                        />
                    )}
                    {currentStep === 3 && (
                        <Step3
                            formData={formData}
                            errors={errors}
                            handleInputChange={handleInputChange}
                            previewImage={previewImage}
                            fileInputRef={fileInputRef}
                            handlePhotoUpload={handlePhotoUpload}
                            handleLanguageToggle={handleLanguageToggle}
                        />
                    )}
                    {currentStep === 4 && (
                        <Step4
                            formData={formData}
                            errors={errors}
                            interestsOptions={interestsOptions}
                            handleInterestToggle={handleInterestToggle}
                        />
                    )}
                    {currentStep === 5 && (
                        <Step5
                            formData={formData}
                            errors={errors}
                            handleInputChange={handleInputChange}
                        />
                    )}
                    {currentStep === 6 && (
                        <Step6
                            formData={formData}
                            errors={errors}
                            handleInputChange={handleInputChange}
                            handleLanguageToggle={handleLanguageToggle}
                        />
                    )}
                    {currentStep === 7 && (
                        <Step7
                            formData={formData}
                        />
                    )}
                </div>

                {/* Navigation Buttons */}
                <div className="button-group">
                    {currentStep > 1 && (
                        <button className="btn-secondary" onClick={handlePrevious}>
                            ← Previous
                        </button>
                    )}
                    {currentStep < 7 && (
                        <button className="btn-primary" onClick={handleNext}>
                            Next →
                        </button>
                    )}
                    {currentStep === 7 && (
                        <button className="btn-primary" onClick={handleSubmit}>
                            Complete Registration
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Step Components
const Step1 = ({ formData, errors, handleInputChange, showPassword, setShowPassword, showConfirmPassword, setShowConfirmPassword }: any) => (
    <div className="step-content">
        <h2 className="step-title">Basic Account Information</h2>
        <p className="step-subtitle">Let's start with your basic information</p>

        <div className="form-row">
            <div className="form-group">
                <label>First Name *</label>
                <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="John"
                    className={errors.firstName ? "input-error" : ""}
                />
                {errors.firstName && (
                    <span className="error-message">{errors.firstName}</span>
                )}
            </div>

            <div className="form-group">
                <label>Last Name *</label>
                <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Doe"
                    className={errors.lastName ? "input-error" : ""}
                />
                {errors.lastName && (
                    <span className="error-message">{errors.lastName}</span>
                )}
            </div>
        </div>

        <div className="form-group">
            <label>Username *</label>
            <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="johndoe123"
                className={errors.username ? "input-error" : ""}
            />
            {errors.username && (
                <span className="error-message">{errors.username}</span>
            )}
        </div>

        <div className="form-group">
            <label>Email Address *</label>
            <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@example.com"
                className={errors.email ? "input-error" : ""}
            />
            {errors.email && (
                <span className="error-message">{errors.email}</span>
            )}
        </div>

        <div className="form-group">
            <label>Phone Number (Optional)</label>
            <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+234 800 000 0000"
            />
        </div>

        <div className="form-row">
            <div className="form-group">
                <label>Password *</label>
                <div className="password-input-wrapper">
                    <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="••••••••"
                        className={errors.password ? "input-error" : ""}
                    />
                    <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                </div>
                {errors.password && (
                    <span className="error-message">{errors.password}</span>
                )}
            </div>

            <div className="form-group">
                <label>Confirm Password *</label>
                <div className="password-input-wrapper">
                    <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="••••••••"
                        className={errors.confirmPassword ? "input-error" : ""}
                    />
                    <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                        {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                </div>
                {errors.confirmPassword && (
                    <span className="error-message">{errors.confirmPassword}</span>
                )}
            </div>
        </div>
    </div>
);

const Step2 = ({ formData, errors, handleInputChange }: any) => (
    <div className="step-content">
        <h2 className="step-title">Personal Information</h2>
        <p className="step-subtitle">Tell us more about yourself</p>

        <div className="form-row">
            <div className="form-group">
                <label>Date of Birth *</label>
                <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className={errors.dateOfBirth ? "input-error" : ""}
                />
                {errors.dateOfBirth && (
                    <span className="error-message">{errors.dateOfBirth}</span>
                )}
            </div>

            <div className="form-group">
                <label>Age</label>
                <input
                    type="text"
                    value={formData.age || ""}
                    disabled
                    placeholder="Auto-calculated"
                />
            </div>
        </div>

        <div className="form-row">
            <div className="form-group">
                <label>Gender *</label>
                <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className={errors.gender ? "input-error" : ""}
                >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                </select>
                {errors.gender && (
                    <span className="error-message">{errors.gender}</span>
                )}
            </div>

            <div className="form-group">
                <label>Looking For *</label>
                <select
                    name="lookingFor"
                    value={formData.lookingFor}
                    onChange={handleInputChange}
                    className={errors.lookingFor ? "input-error" : ""}
                >
                    <option value="">Select preference</option>
                    <option value="men">Men</option>
                    <option value="women">Women</option>
                    <option value="both">Both</option>
                </select>
                {errors.lookingFor && (
                    <span className="error-message">{errors.lookingFor}</span>
                )}
            </div>
        </div>

        <div className="form-group">
            <label>Country *</label>
            <select
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                className={errors.country ? "input-error" : ""}
            >
                <option value="">Select country</option>
                <option value="Nigeria">Nigeria</option>
                <option value="Ghana">Ghana</option>
                <option value="Kenya">Kenya</option>
                <option value="South Africa">South Africa</option>
                <option value="Egypt">Egypt</option>
            </select>
            {errors.country && (
                <span className="error-message">{errors.country}</span>
            )}
        </div>

        <div className="form-row">
            <div className="form-group">
                <label>State/Province *</label>
                <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="Lagos"
                    className={errors.state ? "input-error" : ""}
                />
                {errors.state && (
                    <span className="error-message">{errors.state}</span>
                )}
            </div>

            <div className="form-group">
                <label>City *</label>
                <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Ikoyi"
                    className={errors.city ? "input-error" : ""}
                />
                {errors.city && (
                    <span className="error-message">{errors.city}</span>
                )}
            </div>
        </div>
    </div>
);

const Step3 = ({
    formData,
    errors,
    handleInputChange,
    previewImage,
    fileInputRef,
    handlePhotoUpload,
    handleLanguageToggle,
}: any) => (
    <div className="step-content">
        <h2 className="step-title">Profile Information</h2>
        <p className="step-subtitle">Complete your profile</p>

        <div className="photo-upload-section">
            <label>Profile Picture *</label>
            <div className="photo-upload-container">
                {previewImage ? (
                    <div className="photo-preview">
                        <img src={previewImage} alt="Profile preview" />
                        <button
                            type="button"
                            className="btn-change-photo"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Change Photo
                        </button>
                    </div>
                ) : (
                    <div
                        className="photo-upload-box"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="upload-icon">📸</div>
                        <p>Click to upload your profile picture</p>
                        <span>JPG, PNG or GIF (Max 5MB)</span>
                    </div>
                )}
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: "none" }}
            />
            {errors.profilePicture && (
                <span className="error-message">{errors.profilePicture}</span>
            )}
        </div>

        <div className="form-group">
            <label>About Me *</label>
            <textarea
                name="aboutMe"
                value={formData.aboutMe}
                onChange={handleInputChange}
                placeholder="Tell us about yourself... e.g., I'm a software developer from Lagos who enjoys travelling and meeting new people."
                rows={4}
                className={errors.aboutMe ? "input-error" : ""}
            />
            {errors.aboutMe && (
                <span className="error-message">{errors.aboutMe}</span>
            )}
        </div>

        <div className="form-row">
            <div className="form-group">
                <label>Occupation *</label>
                <input
                    type="text"
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleInputChange}
                    placeholder="Software Developer"
                    className={errors.occupation ? "input-error" : ""}
                />
                {errors.occupation && (
                    <span className="error-message">{errors.occupation}</span>
                )}
            </div>

            <div className="form-group">
                <label>Education Level *</label>
                <select
                    name="education"
                    value={formData.education}
                    onChange={handleInputChange}
                    className={errors.education ? "input-error" : ""}
                >
                    <option value="">Select education level</option>
                    <option value="high_school">High School</option>
                    <option value="bachelors">Bachelor's Degree</option>
                    <option value="masters">Master's Degree</option>
                    <option value="phd">PhD</option>
                </select>
                {errors.education && (
                    <span className="error-message">{errors.education}</span>
                )}
            </div>
        </div>

        <div className="form-group">
            <label>Languages Spoken *</label>
            <div className="languages-grid">
                {["English", "French", "Hausa", "Yoruba", "Swahili", "Zulu"].map(
                    (lang) => (
                        <label key={lang} className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.languages.includes(lang)}
                                onChange={() => handleLanguageToggle(lang)}
                            />
                            <span>{lang}</span>
                        </label>
                    )
                )}
            </div>
            {errors.languages && (
                <span className="error-message">{errors.languages}</span>
            )}
        </div>
    </div>
);

const Step4 = ({
    formData,
    errors,
    interestsOptions,
    handleInterestToggle,
}: any) => (
    <div className="step-content">
        <h2 className="step-title">Your Interests</h2>
        <p className="step-subtitle">Select the activities you enjoy *</p>

        <div className="interests-grid">
            {interestsOptions.map((interest: string) => (
                <label key={interest} className="interest-card">
                    <input
                        type="checkbox"
                        checked={formData.interests.includes(interest)}
                        onChange={() => handleInterestToggle(interest)}
                    />
                    <span className="interest-label">{interest}</span>
                </label>
            ))}
        </div>

        {errors.interests && (
            <span className="error-message">{errors.interests}</span>
        )}
    </div>
);

const Step5 = ({ formData, errors, handleInputChange }: any) => (
    <div className="step-content">
        <h2 className="step-title">Match Preferences</h2>
        <p className="step-subtitle">Help us find the right match for you</p>

        <div className="form-group">
            <label>Preferred Age Range *</label>
            <div className="age-range-container">
                <div className="age-input">
                    <label>Minimum Age</label>
                    <input
                        type="number"
                        name="minAge"
                        value={formData.minAge}
                        onChange={handleInputChange}
                        min="18"
                        max="80"
                        className={errors.minAge ? "input-error" : ""}
                    />
                </div>
                <span className="age-separator">-</span>
                <div className="age-input">
                    <label>Maximum Age</label>
                    <input
                        type="number"
                        name="maxAge"
                        value={formData.maxAge}
                        onChange={handleInputChange}
                        min="18"
                        max="80"
                        className={errors.maxAge ? "input-error" : ""}
                    />
                </div>
            </div>
            {errors.minAge && (
                <span className="error-message">{errors.minAge}</span>
            )}
            {errors.maxAge && (
                <span className="error-message">{errors.maxAge}</span>
            )}
        </div>

        <div className="form-group">
            <label>Preferred Country *</label>
            <select
                name="preferredCountry"
                value={formData.preferredCountry}
                onChange={handleInputChange}
                className={errors.preferredCountry ? "input-error" : ""}
            >
                <option value="">Select country</option>
                <option value="Nigeria">Nigeria</option>
                <option value="Ghana">Ghana</option>
                <option value="Kenya">Kenya</option>
                <option value="South Africa">South Africa</option>
                <option value="Anywhere in Africa">Anywhere in Africa</option>
            </select>
            {errors.preferredCountry && (
                <span className="error-message">{errors.preferredCountry}</span>
            )}
        </div>

        <div className="form-group">
            <label>Preferred Distance *</label>
            <select
                name="preferredDistance"
                value={formData.preferredDistance}
                onChange={handleInputChange}
                className={errors.preferredDistance ? "input-error" : ""}
            >
                <option value="">Select distance</option>
                <option value="within_10km">Within 10 km</option>
                <option value="within_50km">Within 50 km</option>
                <option value="anywhere_in_africa">Anywhere in Africa</option>
            </select>
            {errors.preferredDistance && (
                <span className="error-message">{errors.preferredDistance}</span>
            )}
        </div>
    </div>
);

const Step6 = ({
    formData,
    errors,
    handleInputChange,
}: any) => (
    <div className="step-content">
        <h2 className="step-title">Lifestyle & Preferences</h2>
        <p className="step-subtitle">Help us understand your lifestyle</p>

        <div className="form-group">
            <label>What are you looking for? *</label>
            <div className="options-grid">
                {[
                    "Serious relationship",
                    "Marriage",
                    "Long-term dating",
                    "Casual dating",
                    "Friendship",
                    "Networking",
                ].map((option) => (
                    <label key={option} className="radio-label">
                        <input
                            type="radio"
                            name="relationshipGoal"
                            value={option}
                            checked={formData.relationshipGoal === option}
                            onChange={handleInputChange}
                        />
                        <span>{option}</span>
                    </label>
                ))}
            </div>
            {errors.relationshipGoal && (
                <span className="error-message">{errors.relationshipGoal}</span>
            )}
        </div>

        <div className="form-row">
            <div className="form-group">
                <label>Do you have children? *</label>
                <select
                    name="hasChildren"
                    value={formData.hasChildren}
                    onChange={handleInputChange}
                    className={errors.hasChildren ? "input-error" : ""}
                >
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
                {errors.hasChildren && (
                    <span className="error-message">{errors.hasChildren}</span>
                )}
            </div>

            <div className="form-group">
                <label>Would you like children in the future? *</label>
                <select
                    name="wantsChildren"
                    value={formData.wantsChildren}
                    onChange={handleInputChange}
                    className={errors.wantsChildren ? "input-error" : ""}
                >
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="maybe">Maybe</option>
                </select>
                {errors.wantsChildren && (
                    <span className="error-message">{errors.wantsChildren}</span>
                )}
            </div>
        </div>

        <div className="form-row">
            <div className="form-group">
                <label>Do you smoke? *</label>
                <select
                    name="smoking"
                    value={formData.smoking}
                    onChange={handleInputChange}
                    className={errors.smoking ? "input-error" : ""}
                >
                    <option value="">Select</option>
                    <option value="never">Never</option>
                    <option value="occasionally">Occasionally</option>
                    <option value="regularly">Regularly</option>
                </select>
                {errors.smoking && (
                    <span className="error-message">{errors.smoking}</span>
                )}
            </div>

            <div className="form-group">
                <label>Do you drink alcohol? *</label>
                <select
                    name="drinking"
                    value={formData.drinking}
                    onChange={handleInputChange}
                    className={errors.drinking ? "input-error" : ""}
                >
                    <option value="">Select</option>
                    <option value="never">Never</option>
                    <option value="socially">Socially</option>
                    <option value="frequently">Frequently</option>
                </select>
                {errors.drinking && (
                    <span className="error-message">{errors.drinking}</span>
                )}
            </div>
        </div>

        <div className="form-row">
            <div className="form-group">
                <label>Religion *</label>
                <select
                    name="religion"
                    value={formData.religion}
                    onChange={handleInputChange}
                    className={errors.religion ? "input-error" : ""}
                >
                    <option value="">Select</option>
                    <option value="Christian">Christian</option>
                    <option value="Muslim">Muslim</option>
                    <option value="Traditional">Traditional</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                </select>
                {errors.religion && (
                    <span className="error-message">{errors.religion}</span>
                )}
            </div>

            <div className="form-group">
                <label>How important is religion in your life? *</label>
                <select
                    name="religionImportance"
                    value={formData.religionImportance}
                    onChange={handleInputChange}
                    className={errors.religionImportance ? "input-error" : ""}
                >
                    <option value="">Select</option>
                    <option value="very_important">Very important</option>
                    <option value="somewhat_important">Somewhat important</option>
                    <option value="not_important">Not important</option>
                </select>
                {errors.religionImportance && (
                    <span className="error-message">{errors.religionImportance}</span>
                )}
            </div>
        </div>

        <div className="form-group">
            <label>Your biggest relationship value? *</label>
            <select
                name="relationshipValue"
                value={formData.relationshipValue}
                onChange={handleInputChange}
                className={errors.relationshipValue ? "input-error" : ""}
            >
                <option value="">Select</option>
                <option value="trust">Trust</option>
                <option value="loyalty">Loyalty</option>
                <option value="communication">Communication</option>
                <option value="respect">Respect</option>
                <option value="honesty">Honesty</option>
            </select>
            {errors.relationshipValue && (
                <span className="error-message">{errors.relationshipValue}</span>
            )}
        </div>
    </div>
);

const Step7 = ({ formData }: any) => (
    <div className="step-content verification-step">
        <h2 className="step-title">Verify Your Email</h2>
        <p className="step-subtitle">Complete your registration</p>

        <div className="verification-box">
            <div className="verification-icon">✉️</div>
            <p>We've sent a verification link to:</p>
            <p className="email-display">{formData.email}</p>
            <p>Click the link in your email to verify your account and start meeting people!</p>

            <div className="verification-info">
                <p>
                    <strong>Didn't receive the email?</strong> Check your spam folder or
                    click below to resend.
                </p>
                <button className="btn-resend">Resend Verification Email</button>
            </div>
        </div>
    </div>
);

export default Register;
