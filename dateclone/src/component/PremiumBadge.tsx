import { type PremiumTier } from "../services/premiumService";

interface PremiumBadgeProps {
    tier?: PremiumTier | string | null;
    size?: "sm" | "md" | "lg";
    showIcon?: boolean;
}

const TIER_CONFIG: Record<string, { label: string; icon: string }> = {
    basic: { label: "Basic", icon: "✨" },
    gold: { label: "Gold", icon: "⭐" },
    platinum: { label: "Platinum", icon: "💎" },
};

const PremiumBadge = ({ tier, size = "sm", showIcon = true }: PremiumBadgeProps) => {
    if (!tier || !TIER_CONFIG[tier]) return null;

    const config = TIER_CONFIG[tier];
    const fontSize = size === "sm" ? "0.65rem" : size === "md" ? "0.75rem" : "0.85rem";
    const padding = size === "sm" ? "2px 8px" : size === "md" ? "4px 12px" : "6px 16px";

    return (
        <span
            className={`premium-badge ${tier}`}
            style={{ fontSize, padding }}
        >
            {showIcon && <span>{config.icon}</span>}
            {config.label}
        </span>
    );
};

export default PremiumBadge;