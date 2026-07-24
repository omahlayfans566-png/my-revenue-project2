import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../component/AppNavbar";
import { useAuth } from "../context/AuthContext";
import PremiumBadge from "../component/PremiumBadge";
import Skeleton from "../component/Skeleton";
import { profileAPI } from "../services/apiService";
import "../style/profile.css";

// ─── Types ──────────────────────────────────────────────────────────────────
interface DetailField {
  key: string;
  label: string;
  icon: string;
  format?: (v: any, u?: any) => string;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const PRIMARY = "#FF2E79";
const GOLD_GRADIENT = "linear-gradient(135deg, #f57f17, #fbc02d)";

const INTEREST_ICONS: Record<string, string> = {
  Music: "🎵",
  Movies: "🎬",
  Football: "⚽",
  Photography: "📷",
  Travel: "✈️",
  Food: "🍕",
  Fitness: "💪",
  Gaming: "🎮",
  Business: "💼",
  Technology: "💻",
  Reading: "📚",
  Art: "🎨",
  Fashion: "👗",
  Dancing: "💃",
  Cooking: "🍳",
  Nature: "🌿",
  Animals: "🐾",
  Yoga: "🧘",
  Sports: "🏀",
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const calcCompleteness = (user: any): number => {
  const fields = [
    user.profilePicture,
    user.coverPhoto,
    user.aboutMe || user.bio,
    user.age,
    user.city,
    user.occupation,
    user.education,
    user.gender,
    user.interests?.length > 0,
    user.photos?.length > 0,
    user.relationshipGoal,
    user.dateOfBirth,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const DETAIL_FIELDS: DetailField[] = [
  { key: "age", label: "Age", icon: "🎂", format: (v: any) => `${v} years old` },
  { key: "dateOfBirth", label: "Birthday", icon: "🎈", format: (v: any) => formatDate(v) },
  { key: "gender", label: "Gender", icon: "⚤", format: (v: any) => (v as string).replace("_", " ") },
  { key: "city", label: "Location", icon: "📍", format: (v: any, u: any) => [v as string, u?.country].filter(Boolean).join(", ") },
  { key: "occupation", label: "Occupation", icon: "💼" },
  { key: "education", label: "Education", icon: "🎓", format: (v: any) => (v as string).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) },
  { key: "religion", label: "Religion", icon: "🙏" },
  { key: "relationshipGoal", label: "Relationship Goal", icon: "💞" },
  { key: "height", label: "Height", icon: "📏", format: (v: any) => `${v} cm` },
  { key: "languages", label: "Languages", icon: "🗣️", format: (v: any) => (v as string[]).join(", ") },
  { key: "smoking", label: "Smoking", icon: "🚬", format: (v: any) => (v as string).charAt(0).toUpperCase() + (v as string).slice(1) },
  { key: "drinking", label: "Drinking", icon: "🍷", format: (v: any) => (v as string).charAt(0).toUpperCase() + (v as string).slice(1) },
  { key: "hasChildren", label: "Children", icon: "👶", format: (v: any) => (v as string).replace(/_/g, " ") },
  { key: "lookingFor", label: "Looking For", icon: "💕", format: (v: any) => (v as string).charAt(0).toUpperCase() + (v as string).slice(1) },
  { key: "zodiacSign", label: "Zodiac", icon: "♈", format: (v: any) => (v as string).charAt(0).toUpperCase() + (v as string).slice(1) },
];

// ─── Photo Viewer Modal ─────────────────────────────────────────────────────
const PhotoViewer = ({
  photos,
  initialIndex,
  onClose,
  onDelete,
}: {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
  onDelete?: (idx: number) => void;
}) => {
  const [idx, setIdx] = useState(initialIndex);
  const touchStart = useRef(0);

  const prev = () => setIdx((i) => (i > 0 ? i - 1 : photos.length - 1));
  const next = () => setIdx((i) => (i < photos.length - 1 ? i + 1 : 0));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="photo-viewer-overlay" onClick={onClose}>
      <div className="photo-viewer-content" onClick={(e) => e.stopPropagation()}>
        <button className="photo-viewer-close" onClick={onClose} aria-label="Close">✕</button>
        <button className="photo-viewer-nav photo-viewer-prev" onClick={prev} aria-label="Previous">‹</button>
        <img
          src={photos[idx]}
          alt={`Photo ${idx + 1}`}
          className="photo-viewer-img"
          loading="lazy"
        />
        <button className="photo-viewer-nav photo-viewer-next" onClick={next} aria-label="Next">›</button>
        <div className="photo-viewer-counter">{idx + 1} / {photos.length}</div>
        {onDelete && (
          <button className="photo-viewer-delete" onClick={() => onDelete(idx)} aria-label="Delete photo">
            🗑️ Delete
          </button>
        )}
        <div className="photo-viewer-dots">
          {photos.map((_, i) => (
            <span key={i} className={`photo-viewer-dot ${i === idx ? "active" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main Profile Component ─────────────────────────────────────────────────
const Profile = () => {
  const { user, updateLocalUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [completeness, setCompleteness] = useState(0);
  const [matchesCount, setMatchesCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [photoViewerIdx, setPhotoViewerIdx] = useState(0);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Refresh user data on mount
  useEffect(() => {
    const load = async () => {
      try {
        await refreshUser();
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, []);

  // Compute completeness whenever user data changes
  useEffect(() => {
    if (user) {
      setCompleteness(calcCompleteness(user));
    }
  }, [user]);

  // Fetch match and like counts
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [matchesRes, likesRes]: [any, any] = await Promise.all([
          import("../services/apiService").then((m) => m.matchAPI.getMatches()),
          import("../services/apiService").then((m) => m.matchAPI.getLikesReceived()),
        ]);
        setMatchesCount(matchesRes?.matches?.length || matchesRes?.length || 0);
        setLikesCount(likesRes?.likes?.length || likesRes?.length || 0);
      } catch { /* silent */ }
    };
    if (user) fetchStats();
  }, [user]);

  if (!user) return null;

  const u = user as any;
  const initials = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
  const photos: string[] = u.photos || [];
  const interests: string[] = u.interests || [];
  const coverPhoto = u.coverPhoto;

  // ── Cover Photo Upload ──────────────────────────────────────────────────────
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      alert("Only JPG, PNG, and WEBP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB.");
      return;
    }

    setUploadingCover(true);
    setCoverUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setCoverUploadProgress((p) => Math.min(p + 15, 85));
      }, 300);

      // Convert to base64 for upload
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;

        // Upload via existing profile update API
        const res = await profileAPI.updateProfile(u._id, { coverPhoto: dataUrl });
        if (res?.user) {
          updateLocalUser({ coverPhoto: dataUrl });
        }

        clearInterval(progressInterval);
        setCoverUploadProgress(100);
        setTimeout(() => {
          setUploadingCover(false);
          setCoverUploadProgress(0);
        }, 500);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Cover upload failed:", err);
      setUploadingCover(false);
      setCoverUploadProgress(0);
    }

    // Reset input
    e.target.value = "";
  };

  const handleRemoveCover = async () => {
    if (!window.confirm("Remove cover photo?")) return;
    try {
      await profileAPI.updateProfile(u._id, { coverPhoto: "" });
      updateLocalUser({ coverPhoto: "" });
    } catch (err) {
      console.error("Failed to remove cover:", err);
    }
  };

  // ── Avatar Upload ───────────────────────────────────────────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      alert("Only JPG, PNG, and WEBP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB.");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const res = await profileAPI.updateProfile(u._id, { profilePicture: dataUrl });
        if (res?.user) {
          updateLocalUser({ profilePicture: dataUrl });
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Avatar upload failed:", err);
    }

    e.target.value = "";
  };

  // ── Photo Gallery Delete ────────────────────────────────────────────────────
  const handleDeletePhoto = async (idx: number) => {
    if (!window.confirm("Delete this photo?")) return;
    try {
      const newPhotos = photos.filter((_, i) => i !== idx);
      await profileAPI.updateProfile(u._id, { photos: newPhotos });
      updateLocalUser({ photos: newPhotos });
      setPhotoViewerOpen(false);
    } catch (err) {
      console.error("Failed to delete photo:", err);
    }
  };

  // ── Loading State ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-wrapper">
        <AppNavbar />
        <div className="profile-page profile-loading">
          <div className="profile-loading-cover">
            <Skeleton height={280} borderRadius="0 0 32px 32px" />
          </div>
          <div className="profile-loading-avatar">
            <Skeleton width={120} height={120} variant="circular" />
          </div>
          <div className="profile-loading-info">
            <Skeleton width="40%" height={28} />
            <Skeleton width="25%" height={16} />
          </div>
          <div className="profile-loading-actions">
            <Skeleton height={52} borderRadius={14} count={3} />
          </div>
          <div className="profile-loading-stats">
            <Skeleton height={80} borderRadius={16} count={3} />
          </div>
          <div className="profile-loading-sections">
            <Skeleton height={120} borderRadius={16} count={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`page-wrapper ${visible ? "page-visible" : ""}`}>
      <AppNavbar />
      <div className="profile-page">

        {/* ── Cover Photo ─────────────────────────────────────────────────── */}
        <div className="profile-cover">
          {coverPhoto ? (
            <img
              src={coverPhoto}
              alt="Cover"
              className="profile-cover-img"
              loading="lazy"
            />
          ) : (
            <div className="profile-cover-gradient" />
          )}

          {/* Upload overlay */}
          <div className="profile-cover-actions">
            <button
              className="profile-cover-btn"
              onClick={() => coverInputRef.current?.click()}
              title={coverPhoto ? "Change cover photo" : "Add cover photo"}
              disabled={uploadingCover}
            >
              {uploadingCover ? (
                <span className="profile-cover-spinner" />
              ) : (
                "📷"
              )}
            </button>
            {coverPhoto && (
              <button
                className="profile-cover-btn profile-cover-remove"
                onClick={handleRemoveCover}
                title="Remove cover photo"
              >
                🗑️
              </button>
            )}
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handleCoverUpload}
          />

          {/* Upload progress bar */}
          {uploadingCover && (
            <div className="profile-cover-progress">
              <div
                className="profile-cover-progress-fill"
                style={{ width: `${coverUploadProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* ── Profile Picture ─────────────────────────────────────────────── */}
        <div className="profile-avatar-section">
          <div className="profile-avatar-wrap">
            {u.profilePicture ? (
              <img
                src={u.profilePicture}
                alt="Profile"
                className="profile-avatar"
                onClick={() => {
                  setPhotoViewerIdx(0);
                  setPhotoViewerOpen(true);
                }}
                loading="lazy"
              />
            ) : (
              <div
                className="profile-avatar profile-avatar-placeholder"
                onClick={() => avatarInputRef.current?.click()}
              >
                {initials}
              </div>
            )}

            {/* Edit avatar button */}
            <button
              className="profile-avatar-edit"
              onClick={() => avatarInputRef.current?.click()}
              title="Change profile picture"
            >
              ✏️
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={handleAvatarUpload}
            />

            {/* Verification Badge */}
            {u.isVerified && (
              <div className="profile-verified-badge" title="Verified Account">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#1DA1F2">
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
            )}

            {/* Premium Badge */}
            {u.isPremium && (
              <div className="profile-premium-badge">
                <PremiumBadge tier={u.premiumTier} size="sm" />
              </div>
            )}
          </div>

          {/* ── User Info ──────────────────────────────────────────────────── */}
          <div className="profile-user-info">
            <h1 className="profile-user-name">
              {u.firstName} {u.lastName}
              {u.age && <span className="profile-user-age">, {u.age}</span>}
              {u.isVerified && <span className="profile-user-verified"> ✔️</span>}
            </h1>
            <p className="profile-user-location">
              {[u.city, u.country].filter(Boolean).join(", ") || "📍 Location not set"}
            </p>
          </div>
        </div>

        {/* ── Profile Completion Card ─────────────────────────────────────── */}
        <div className="profile-card profile-completion-card">
          <div className="profile-card-header">
            <span className="profile-card-icon">📊</span>
            <span>Profile Completeness</span>
            <span className="completeness-pct">{completeness}%</span>
          </div>
          <div className="completeness-bar">
            <div
              className="completeness-fill"
              style={{
                width: `${completeness}%`,
                background: completeness === 100
                  ? "linear-gradient(90deg, #00c853, #69f0ae)"
                  : `linear-gradient(90deg, ${PRIMARY}, #ff6b9d)`,
              }}
            />
          </div>
          <p className="completeness-text">
            {completeness === 100
              ? "🎉 Your profile is complete! You're ready to find matches."
              : "Complete your profile to get 3× more matches!"}
          </p>
        </div>

        {/* ── Action Buttons ──────────────────────────────────────────────── */}
        <div className="profile-actions">
          <button
            className="profile-action-btn profile-action-edit"
            onClick={() => navigate("/profile/edit")}
          >
            <span className="profile-action-icon">✏️</span>
            <span className="profile-action-label">Edit Profile</span>
            <span className="profile-action-arrow">→</span>
          </button>
          <button
            className="profile-action-btn profile-action-settings"
            onClick={() => navigate("/settings")}
          >
            <span className="profile-action-icon">⚙️</span>
            <span className="profile-action-label">Settings</span>
            <span className="profile-action-arrow">→</span>
          </button>
          <button
            className={`profile-action-btn ${u.isPremium ? "profile-action-premium-active" : "profile-action-premium"}`}
            onClick={() => navigate("/premium")}
          >
            <span className="profile-action-icon">{u.isPremium ? "👑" : "✨"}</span>
            <span className="profile-action-label">
              {u.isPremium ? "Premium Active" : "Go Premium"}
            </span>
            <span className="profile-action-arrow">→</span>
          </button>
        </div>

        {/* ── Statistics ──────────────────────────────────────────────────── */}
        <div className="profile-stats-row">
          <div className="profile-stat-card">
            <div className="profile-stat-icon" style={{ background: "rgba(255, 46, 121, 0.1)" }}>
              💕
            </div>
            <span className="profile-stat-value">{matchesCount}</span>
            <span className="profile-stat-label">Matches</span>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-icon" style={{ background: "rgba(255, 46, 121, 0.1)" }}>
              ❤️
            </div>
            <span className="profile-stat-value">{likesCount}</span>
            <span className="profile-stat-label">Likes</span>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-icon" style={{ background: "rgba(76, 175, 80, 0.1)" }}>
              ✅
            </div>
            <span className="profile-stat-value">{completeness}%</span>
            <span className="profile-stat-label">Complete</span>
          </div>
        </div>

        {/* ── About Me ────────────────────────────────────────────────────── */}
        <div className="profile-card">
          <div className="profile-card-header">
            <span className="profile-card-icon">📝</span>
            <span>About Me</span>
            <button
              className="profile-card-edit-btn"
              onClick={() => navigate("/profile/edit")}
              title="Edit bio"
            >
              ✏️
            </button>
          </div>
          <p className="profile-bio-text">
            {u.aboutMe || u.bio || (
              <span className="profile-bio-empty">
                No bio yet. Tell people something interesting about yourself.
              </span>
            )}
          </p>
        </div>

        {/* ── Details ─────────────────────────────────────────────────────── */}
        <div className="profile-card">
          <div className="profile-card-header">
            <span className="profile-card-icon">ℹ️</span>
            <span>Details</span>
          </div>
          <div className="profile-details-grid">
            {DETAIL_FIELDS.map(({ key, label, icon, format }) => {
              const val = u[key];
              if (!val || (Array.isArray(val) && val.length === 0)) return null;
              const display = format ? format(val, u) : val;
              return (
                <div key={key} className="profile-detail-item">
                  <span className="profile-detail-icon">{icon}</span>
                  <div className="profile-detail-content">
                    <span className="profile-detail-label">{label}</span>
                    <span className="profile-detail-value">
                      {typeof display === "string" ? display.charAt(0).toUpperCase() + display.slice(1) : display}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Interests ───────────────────────────────────────────────────── */}
        {interests.length > 0 && (
          <div className="profile-card">
            <div className="profile-card-header">
              <span className="profile-card-icon">🏷️</span>
              <span>Interests</span>
            </div>
            <div className="profile-interests">
              {interests.map((tag) => (
                <span key={tag} className="profile-interest-chip">
                  {INTEREST_ICONS[tag] || "•"} {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Languages ───────────────────────────────────────────────────── */}
        {u.languages?.length > 0 && (
          <div className="profile-card">
            <div className="profile-card-header">
              <span className="profile-card-icon">🌐</span>
              <span>Languages</span>
            </div>
            <div className="profile-interests">
              {u.languages.map((l: string) => (
                <span key={l} className="profile-interest-chip">🗣️ {l}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Photos Gallery ──────────────────────────────────────── */}
        <div className="profile-card">
          <div className="profile-card-header">
            <span className="profile-card-icon">📸</span>
            <span>Photos ({photos.length})</span>
          </div>
          <div className="profile-photo-gallery">
            {photos.map((url: string, i: number) => (
              <div
                key={i}
                className="profile-gallery-item"
                onClick={() => {
                  setPhotoViewerIdx(i);
                  setPhotoViewerOpen(true);
                }}
              >
                <img src={url} alt={`Photo ${i + 1}`} loading="lazy" />
                <div className="profile-gallery-item-overlay">
                  <span>👁️</span>
                </div>
              </div>
            ))}
            <button
              className="profile-gallery-add"
              onClick={() => navigate("/profile/edit")}
              title="Add more photos"
            >
              <span className="profile-gallery-add-icon">+</span>
              <span className="profile-gallery-add-label">Add Photo</span>
            </button>
          </div>
        </div>

        {/* ── Premium Banner ─────────────────────────────────────────────── */}
        {!u.isPremium && (
          <div className="profile-premium-banner">
            <div className="profile-premium-banner-header">
              <span className="profile-premium-banner-icon">✨</span>
              <h3>Go Premium</h3>
            </div>
            <p className="profile-premium-banner-text">
              Unlock unlimited likes, see who liked you, profile boosts and more.
            </p>
            <ul className="profile-premium-features">
              <li>✔️ Unlimited Likes</li>
              <li>✔️ See Who Liked You</li>
              <li>✔️ Profile Boost</li>
              <li>✔️ Advanced Filters</li>
              <li>✔️ Read Receipts</li>
            </ul>
            <button
              className="profile-premium-upgrade-btn"
              onClick={() => navigate("/premium")}
            >
              Upgrade Now
            </button>
          </div>
        )}

        {/* ── Photo Viewer Modal ──────────────────────────────────────────── */}
        {photoViewerOpen && (
          <PhotoViewer
            photos={photos.length > 0 ? photos : u.profilePicture ? [u.profilePicture] : []}
            initialIndex={photoViewerIdx}
            onClose={() => setPhotoViewerOpen(false)}
            onDelete={photos.length > 0 ? handleDeletePhoto : undefined}
          />
        )}
      </div>
    </div>
  );
};

export default Profile;