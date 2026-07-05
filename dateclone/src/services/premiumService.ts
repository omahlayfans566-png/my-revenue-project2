/**
 * Premium Service - Gating logic for premium features
 * Centralizes all premium feature checks in one place
 */

import { useAuth, type AuthUser } from "../context/AuthContext";

// ─── Premium Tiers ─────────────────────────────────────────────────────────────
export type PremiumTier = "basic" | "gold" | "platinum";

export interface PremiumPlan {
  id: PremiumTier;
  name: string;
  price: number; // in Naira (NGN)
  priceUSD: number;
  durationDays: number;
  features: string[];
  color: string;
  popular?: boolean;
}

export const PREMIUM_PLANS: PremiumPlan[] = [
  {
    id: "basic",
    name: "Basic",
    price: 2999,
    priceUSD: 3.99,
    durationDays: 30,
    color: "#ff4081",
    features: [
      "Unlimited likes",
      "See who liked you",
      "Undo swipe",
      "5 Super Likes per day",
      "Remove ads",
    ],
  },
  {
    id: "gold",
    name: "Gold",
    price: 5999,
    priceUSD: 7.99,
    durationDays: 30,
    color: "#ffd700",
    popular: true,
    features: [
      "Everything in Basic",
      "Advanced filters",
      "Incognito mode",
      "Read receipts",
      "10 Super Likes per day",
      "Profile Boost once a week",
    ],
  },
  {
    id: "platinum",
    name: "Platinum",
    price: 9999,
    priceUSD: 12.99,
    durationDays: 30,
    color: "#e040fb",
    features: [
      "Everything in Gold",
      "Priority ranking",
      "Unlimited Super Likes",
      "Passport mode (any location)",
      "See profile visitors",
      "Message before matching",
      "24/7 Priority support",
    ],
  },
];

// ─── Free Tier Limits ──────────────────────────────────────────────────────────
export const FREE_LIMITS = {
  dailyLikes: 10,
  dailySuperLikes: 1,
  filters: ["age", "gender", "distance"],
  canSeeWhoLikedYou: false,
  canUndoSwipe: false,
  canUseIncognito: false,
  canUsePassport: false,
  canSeeReadReceipts: false,
  canBoost: false,
  maxPhotos: 6,
};

// ─── Premium Feature Checks ────────────────────────────────────────────────────
export const hasPremiumFeature = (
  user: AuthUser | null,
  feature: keyof typeof FREE_LIMITS | string
): boolean => {
  if (!user) return false;
  if (!user.isPremium) return false;

  // Check if premium is expired
  if (user.premiumExpires && new Date(user.premiumExpires) < new Date()) {
    return false;
  }

  // Platinum gets everything
  if (user.premiumTier === "platinum") return true;

  // Gold gets everything except passport, priority, visitors
  if (user.premiumTier === "gold") {
    const goldExcluded = ["canUsePassport", "canBoost", "priorityRanking"];
    if (goldExcluded.includes(feature)) return false;
    return true;
  }

  // Basic gets limited premium features
  if (user.premiumTier === "basic") {
    const basicFeatures = [
      "dailyLikes",
      "dailySuperLikes",
      "canSeeWhoLikedYou",
      "canUndoSwipe",
    ];
    return basicFeatures.includes(feature);
  }

  return false;
};

// ─── Hook for premium checks ───────────────────────────────────────────────────
export const usePremium = () => {
  const { user } = useAuth();

  const isPremium = user?.isPremium ?? false;
  const tier = (user?.premiumTier as PremiumTier) ?? "basic";
  const isExpired =
    user?.premiumExpires
      ? new Date(user.premiumExpires) < new Date()
      : false;

  const can = (feature: keyof typeof FREE_LIMITS | string): boolean => {
    return hasPremiumFeature(user, feature);
  };

  const getRemainingDays = (): number => {
    if (!user?.premiumExpires) return 0;
    const diff = new Date(user.premiumExpires).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getPlan = (): PremiumPlan | undefined => {
    return PREMIUM_PLANS.find((p) => p.id === tier);
  };

  return {
    isPremium,
    tier,
    isExpired,
    can,
    getRemainingDays,
    getPlan,
    user,
  };
};

// ─── Paystack Integration ──────────────────────────────────────────────────────
export const PAYSTACK_PUBLIC_KEY =
  import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "";

export interface PaystackConfig {
  key: string;
  email: string;
  amount: number; // in kobo (multiply NGN by 100)
  ref: string;
  metadata: {
    userId: string;
    tier: PremiumTier;
    durationDays: number;
  };
  callback: (response: { reference: string; status: string }) => void;
  onClose: () => void;
}

export const initializePaystackPayment = (config: PaystackConfig): void => {
  if (!(window as any).PaystackPop) {
    console.error("Paystack SDK not loaded");
    return;
  }

  const handler = (window as any).PaystackPop.setup({
    key: config.key,
    email: config.email,
    amount: config.amount,
    ref: config.ref,
    metadata: config.metadata,
    callback: config.callback,
    onClose: config.onClose,
  });

  handler.openIframe();
};

export default {
  PREMIUM_PLANS,
  FREE_LIMITS,
  hasPremiumFeature,
  usePremium,
  initializePaystackPayment,
};