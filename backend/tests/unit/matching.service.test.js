/**
 * Unit tests — matchingService.calculateCompatibility
 * Pure logic tests, no DB required.
 */
import { describe, it, expect } from "@jest/globals";
import { calculateCompatibility } from "../../services/matchingService.js";

const base = () => ({
    _id: "000000000000000000000001",
    interests: [],
    age: 25,
    relationshipGoal: "",
    religion: "",
    wantsChildren: "",
    smoking: "",
    drinking: "",
    profileCompletion: 0,
    isPremium: false,
    memberSince: null,
});

describe("calculateCompatibility", () => {
    it("returns a number between 0 and 100", () => {
        const score = calculateCompatibility(base(), base());
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
    });

    it("increases score for shared interests", () => {
        const u1 = { ...base(), interests: ["Music", "Travel", "Cooking"] };
        const u2 = { ...base(), interests: ["Music", "Travel", "Fitness"] };
        const noShared = calculateCompatibility({ ...base(), interests: ["Gaming"] }, base());
        const shared = calculateCompatibility(u1, u2);
        expect(shared).toBeGreaterThan(noShared);
    });

    it("increases score for matching relationship goal", () => {
        const u1 = { ...base(), relationshipGoal: "Marriage" };
        const u2 = { ...base(), relationshipGoal: "Marriage" };
        const uDiff = { ...base(), relationshipGoal: "Casual dating" };
        expect(calculateCompatibility(u1, u2)).toBeGreaterThan(calculateCompatibility(u1, uDiff));
    });

    it("increases score for premium candidates", () => {
        const premium = { ...base(), isPremium: true };
        const free = { ...base(), isPremium: false };
        expect(calculateCompatibility(base(), premium)).toBeGreaterThan(
            calculateCompatibility(base(), free)
        );
    });

    it("handles completely empty users without crashing", () => {
        expect(() => calculateCompatibility({}, {})).not.toThrow();
    });
});
