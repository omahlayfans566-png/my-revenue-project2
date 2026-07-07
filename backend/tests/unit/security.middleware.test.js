/**
 * Unit tests — security middleware (XSS protection, RBAC helpers)
 */
import { describe, it, expect } from "@jest/globals";
import { hasRole } from "../../middleware/rbac.js";

describe("RBAC hasRole", () => {
    it("user cannot access admin", () => {
        expect(hasRole("user", "admin")).toBe(false);
    });

    it("admin can access moderator level", () => {
        expect(hasRole("admin", "moderator")).toBe(true);
    });

    it("super_admin can access everything", () => {
        expect(hasRole("super_admin", "admin")).toBe(true);
        expect(hasRole("super_admin", "moderator")).toBe(true);
        expect(hasRole("super_admin", "user")).toBe(true);
    });

    it("moderator cannot access admin", () => {
        expect(hasRole("moderator", "admin")).toBe(false);
    });

    it("handles unknown roles as user level", () => {
        expect(hasRole("unknown_role", "admin")).toBe(false);
    });
});
