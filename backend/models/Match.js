/**
 * Match.js
 *
 * Tracks swipe actions between users and mutual-match status.
 *
 * Field naming is deliberately route-aligned:
 *   userId        — the user who performed the action (liker)
 *   matchedUserId — the user who was acted upon
 *   status        — "liked" | "superliked" | "rejected" | "matched" | "blocked"
 *
 * A mutual match exists when TWO records have status "matched":
 *   (userId: A, matchedUserId: B, status: "matched")
 *   (userId: B, matchedUserId: A, status: "matched")
 */
import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
    {
        // ── Who acted and who was acted upon ─────────────────────────────────
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        matchedUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // ── Action ────────────────────────────────────────────────────────────
        userLiked: { type: Boolean, default: false },
        userLikedAt: Date,
        status: {
            type: String,
            enum: ["liked", "superliked", "rejected", "matched", "blocked"],
            default: "liked",
        },

        // ── Match timestamps ──────────────────────────────────────────────────
        matchedAt: Date,

        // ── Messaging activity ────────────────────────────────────────────────
        messagesSent: { type: Number, default: 0 },
        lastMessageAt: Date,
    },
    { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────────
// Unique: one record per (actor, target) pair
matchSchema.index({ userId: 1, matchedUserId: 1 }, { unique: true });

// Efficient mutual-match lookup
matchSchema.index({ matchedUserId: 1, status: 1 });
matchSchema.index({ userId: 1, status: 1 });

// Dashboard / Matches page sorting
matchSchema.index({ matchedAt: -1 });
matchSchema.index({ lastMessageAt: -1 });

export const Match = mongoose.model("Match", matchSchema);
