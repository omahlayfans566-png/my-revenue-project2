/**
 * Integration tests — Notifications API
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import app from "../helpers/testApp.js";
import { connectTestDB, closeTestDB, cleanupUsers } from "../helpers/db.js";
import { makeUser, makeFemaleUser } from "../helpers/fixtures.js";
import mongoose from "mongoose";

const emails = [];
let tokenA, userAId, tokenB, userBId;

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
    const a = await registerAndLogin(makeUser({ gender: "male", lookingFor: "women" }));
    const b = await registerAndLogin(makeFemaleUser());
    tokenA = a.token; userAId = a.userId;
    tokenB = b.token; userBId = b.userId;
    // Create a match to generate notifications
    await request(app).post("/api/matches/like")
        .set("Authorization", `Bearer ${tokenA}`).send({ likedUserId: userBId });
    await request(app).post("/api/matches/like")
        .set("Authorization", `Bearer ${tokenB}`).send({ likedUserId: userAId });
    await new Promise(r => setTimeout(r, 500));
});

afterAll(async () => {
    await cleanupUsers(emails);
    await closeTestDB();
});

describe("GET /api/notifications", () => {
    it("returns notification list", async () => {
        const res = await request(app)
            .get("/api/notifications")
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.notifications)).toBe(true);
    });

    it("includes match notification after mutual like", async () => {
        const res = await request(app)
            .get("/api/notifications")
            .set("Authorization", `Bearer ${tokenA}`);

        const types = res.body.notifications.map(n => n.type);
        expect(types).toContain("match");
    });
});

describe("GET /api/notifications/unread-count", () => {
    it("returns unread count", async () => {
        const res = await request(app)
            .get("/api/notifications/unread-count")
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(typeof res.body.count).toBe("number");
        expect(res.body.count).toBeGreaterThanOrEqual(0);
    });
});

describe("PUT /api/notifications/read-all", () => {
    it("marks all notifications as read", async () => {
        const res = await request(app)
            .put("/api/notifications/read-all")
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Unread count should now be 0
        const countRes = await request(app)
            .get("/api/notifications/unread-count")
            .set("Authorization", `Bearer ${tokenA}`);
        expect(countRes.body.count).toBe(0);
    });
});

describe("PUT /api/notifications/:id/read", () => {
    it("marks a single notification as read", async () => {
        // Get a notification first
        const list = await request(app)
            .get("/api/notifications")
            .set("Authorization", `Bearer ${tokenB}`);

        if (list.body.notifications?.length > 0) {
            const notifId = list.body.notifications[0]._id;
            const res = await request(app)
                .put(`/api/notifications/${notifId}/read`)
                .set("Authorization", `Bearer ${tokenB}`);
            expect(res.status).toBe(200);
        }
    });
});

describe("DELETE /api/notifications/:id", () => {
    it("deletes a notification", async () => {
        const list = await request(app)
            .get("/api/notifications")
            .set("Authorization", `Bearer ${tokenA}`);

        if (list.body.notifications?.length > 0) {
            const notifId = list.body.notifications[0]._id;
            const res = await request(app)
                .delete(`/api/notifications/${notifId}`)
                .set("Authorization", `Bearer ${tokenA}`);
            expect(res.status).toBe(200);
        }
    });
});
