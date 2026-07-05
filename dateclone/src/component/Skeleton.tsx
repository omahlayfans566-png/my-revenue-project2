import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
  variant?: "text" | "circular" | "rectangular";
  count?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 16,
  borderRadius = 8,
  className = "",
  style,
  variant = "text",
  count = 1,
}) => {
  const baseStyle: React.CSSProperties = {
    width,
    height: variant === "text" ? height : variant === "circular" ? width : height,
    borderRadius: variant === "circular" ? "50%" : borderRadius,
    background: "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%)",
    backgroundSize: "200% 100%",
    animation: "skeleton-shimmer 1.5s ease-in-out infinite",
    ...style,
  };

  if (count > 1) {
    return (
      <div className={`skeleton-group ${className}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton" style={baseStyle} />
        ))}
      </div>
    );
  }

  return <div className={`skeleton ${className}`} style={baseStyle} />;
};

// ─── Card Skeleton ─────────────────────────────────────────────────────────────
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-card" style={{
        background: "rgba(255,255,255,0.05)",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <Skeleton height={200} borderRadius={0} />
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton width="60%" height={20} />
          <Skeleton width="40%" height={14} />
          <Skeleton width="80%" height={14} count={2} />
        </div>
      </div>
    ))}
  </>
);

// ─── Profile Card Skeleton ─────────────────────────────────────────────────────
export const ProfileCardSkeleton: React.FC = () => (
  <div className="skeleton-profile-card" style={{
    background: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
  }}>
    <Skeleton height={280} borderRadius={0} />
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
      <Skeleton width={80} height={80} borderRadius="50%" />
      <Skeleton width="50%" height={22} />
      <Skeleton width="30%" height={14} />
    </div>
  </div>
);

// ─── Chat Skeleton ─────────────────────────────────────────────────────────────
export const ChatSkeleton: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} style={{
        display: "flex",
        gap: 10,
        justifyContent: i % 2 === 0 ? "flex-start" : "flex-end",
      }}>
        {i % 2 === 0 && <Skeleton width={36} height={36} borderRadius="50%" />}
        <Skeleton
          width={`${40 + Math.random() * 40}%`}
          height={40}
          borderRadius={16}
        />
        {i % 2 !== 0 && <Skeleton width={36} height={36} borderRadius="50%" />}
      </div>
    ))}
  </div>
);

export default Skeleton;