/**
 * Unit tests — auth middleware (generateToken, authenticateToken, verifyRefreshToken)
 * These are pure unit tests: no DB, no HTTP.
 */
import { describe, it, expect, beforeAll } from "@jest/globals";
import jwt from "jsonwebtoken";
import { generateToken, generateRefreshToken, verifyRefreshToken } from "../../middleware/auth.js";

const SECRET = process.env.JWT_SECRET || "dateclone_jwt_secret_dev";
const FAKE_ID = "507f1f77bcf86cd799439011";

describe("generateToken", () => {
    it("produces a valid JWT", () => {
        const token = generateToken(FAKE_ID);
        expect(typeof token).toBe("string");
        const decoded = jwt.verify(token, SECRET);
        expect(decoded.userId).toBe(FAKE_ID);
        expect(decoded.type).toBe("access");
    });

    it("respects custom expiry", () => {
        const token = generateToken(FAKE_ID, "1h");
        const decoded = jwt.decode(token);
        const now = Math.floor(Date.now() / 1000);
        expect(decoded.exp - now).toBeLessThanOrEqual(3600);
        expect(decoded.exp - now).toBeGreaterThan(3500);
    });
});

describe("generateRefreshToken", () => {
    it("produces a refresh token with type=refresh", () => {
        const token = generateRefreshToken(FAKE_ID);
        expect(typeof token).toBe("string");
        const decoded = verifyRefreshToken(token);
        expect(decoded).not.toBeNull();
        expect(decoded.userId).toBe(FAKE_ID);
        expect(decoded.type).toBe("refresh");
    });
});

describe("verifyRefreshToken", () => {
    it("returns null for access tokens", () => {
        const accessToken = generateToken(FAKE_ID);
        expect(verifyRefreshToken(accessToken)).toBeNull();
    });

    it("returns null for tampered tokens", () => {
        const token = generateRefreshToken(FAKE_ID);
        const tampered = token.slice(0, -3) + "XXX";
        expect(verifyRefreshToken(tampered)).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(verifyRefreshToken("")).toBeNull();
    });
});
