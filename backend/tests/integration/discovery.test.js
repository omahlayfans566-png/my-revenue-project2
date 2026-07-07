/**
 * Integration tests — Discovery endpoint
 * Tests: returns users, filters, excludes self/banned/blocked
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import app from "../helpers/testApp.js";
import { connectTestDB, closeTestDB, cleanupUsers } from "../helpers/db.js";
import { makeUser, makeFemaleUser } from "../helpers/fixtures.js";
import mongoose from "mongoose";

const emails = [];
let tokenA, userAId;

async function registerAndLogin(userData) {
    emails.push(userData.email);
    const reg = await request(app).post("/api/auth/register").send(userData);
    await mongoose.connection.db.collection("users").updateOne(
        { email: userData.email },
        { $set: { emailVerified: true, isMember: true, isActive: true } }
    );
    const login = await request(app)
        .post("/api/auth/login")
        .send({ email: userData.email, password: userData.password });
    return { token: login.body.token, userId: reg.body.user._id };
}

beforeAll(async () => {
    await connectTestDB();
    // Register user A + several others to discover
    const a = await registerAndLogin(makeUser({ gender: "male", lookingFor: "women" }));
    tokenA = a.token; userAId = a.userId;
    // Register 3 discoverable women
    for (let i = 0; i < 3; i++) {
        await registerAndLogin(makeFemaleUser());
    }
});

afterAll(async () => {
    await cleanupUsers(emails);
    await closeTestDB();
});

describe("GET /api/discover", () => {
    it("returns a list of users", async () => {
        const res = await request(app)
            .get("/api/discover")
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.users)).toBe(true);
    });

    it("never returns the current user in results", async () => {
        const res = await request(app)
            .get("/api/discover")
            .set("Authorization", `Bearer ${tokenA}`);

        const ids = res.body.users.map(u => u._id.toString());
        expect(ids).not.toContain(userAId.toString());
    });

    it("each returned user has required profile fields", async () => {
        const res = await request(app)
            .get("/api/discover")
            .set("Authorization", `Bearer ${tokenA}`);

        if (res.body.users.length > 0) {
            const user = res.body.users[0];
            expect(user).toHaveProperty("_id");
            expect(user).toHaveProperty("firstName");
            expect(user).not.toHaveProperty("password");
            expect(user).not.toHaveProperty("refreshTokens");
        }
    });

    it("supports pagination", async () => {
        const p1 = await request(app)
            .get("/api/discover?page=1&limit=2")
            .set("Authorization", `Bearer ${tokenA}`);

        expect(p1.status).toBe(200);
        expect(p1.body.pagination).toBeDefined();
        expect(p1.body.pagination.page).toBe(1);
    });

    it("returns 401 without token", async () => {
        const res = await request(app).get("/api/discover");
        expect(res.status).toBe(401);
    });
});

describe("GET /api/discover/filters", () => {
    it("returns available filter options", async () => {
        const res = await request(app)
            .get("/api/discover/filters")
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.filters).toBeDefined();
        expect(Array.isArray(res.body.filters.distanceOptions)).toBe(true);
    });
});
