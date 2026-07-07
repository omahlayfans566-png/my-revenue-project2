/**
 * Integration tests — Profile API (get, update, photo)
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import app from "../helpers/testApp.js";
import { connectTestDB, closeTestDB, cleanupUsers } from "../helpers/db.js";
import { makeUser } from "../helpers/fixtures.js";
import mongoose from "mongoose";

const emails = [];
let token, userId;

beforeAll(async () => {
    await connectTestDB();
    const user = makeUser();
    emails.push(user.email);
    const reg = await request(app).post("/api/auth/register").send(user);
    await mongoose.connection.db.collection("users").updateOne(
        { email: user.email },
        { $set: { emailVerified: true, isMember: true, isActive: true } }
    );
    const login = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: user.password });
    token = login.body.token;
    userId = reg.body.user._id;
});

afterAll(async () => {
    await cleanupUsers(emails);
    await closeTestDB();
});

describe("GET /api/profile/:userId", () => {
    it("returns public profile by ID", async () => {
        const res = await request(app)
            .get(`/api/profile/${userId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user._id.toString()).toBe(userId.toString());
        expect(res.body.user).not.toHaveProperty("password");
        expect(res.body.user).not.toHaveProperty("refreshTokens");
    });

    it("returns 404 for unknown ID", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
            .get(`/api/profile/${fakeId}`)
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});

describe("PUT /api/profile/:userId", () => {
    it("updates own profile fields", async () => {
        const res = await request(app)
            .put(`/api/profile/${userId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ aboutMe: "Updated bio for testing!", occupation: "Test Engineer" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("persists update to database", async () => {
        const doc = await mongoose.connection.db.collection("users").findOne({
            _id: new mongoose.Types.ObjectId(userId),
        });
        expect(doc.aboutMe).toBe("Updated bio for testing!");
        expect(doc.occupation).toBe("Test Engineer");
    });

    it("cannot update another user's profile", async () => {
        const other = makeUser();
        emails.push(other.email);
        const otherReg = await request(app).post("/api/auth/register").send(other);

        const res = await request(app)
            .put(`/api/profile/${otherReg.body.user._id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ aboutMe: "Hacked!" });

        expect(res.status).toBe(403);
    });
});

describe("Security — profile endpoint", () => {
    it("does not expose password hash in response", async () => {
        const res = await request(app)
            .get(`/api/profile/${userId}`);
        if (res.status === 200) {
            expect(res.body.user).not.toHaveProperty("password");
        }
    });
});
