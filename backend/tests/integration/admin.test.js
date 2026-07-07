/**
 * Integration tests — Admin API (RBAC, user management, dashboard)
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import app from "../helpers/testApp.js";
import { connectTestDB, closeTestDB, cleanupUsers } from "../helpers/db.js";
import { makeUser } from "../helpers/fixtures.js";
import mongoose from "mongoose";

const emails = [];
let regularToken, adminToken, targetUserId;

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
    // Regular user
    const regular = await registerAndLogin(makeUser());
    regularToken = regular.token;
    targetUserId = regular.userId;

    // Admin user — upgrade via DB directly
    const adminData = makeUser();
    const admin = await registerAndLogin(adminData);
    await mongoose.connection.db.collection("users").updateOne(
        { _id: new mongoose.Types.ObjectId(admin.userId) },
        { $set: { role: "admin", isAdmin: true } }
    );
    // Re-login to get token with admin role
    const adminLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: adminData.email, password: adminData.password });
    adminToken = adminLogin.body.token;
});

afterAll(async () => {
    await cleanupUsers(emails);
    await closeTestDB();
});

describe("GET /api/admin/dashboard — RBAC", () => {
    it("blocks regular users with 403", async () => {
        const res = await request(app)
            .get("/api/admin/dashboard")
            .set("Authorization", `Bearer ${regularToken}`);
        expect(res.status).toBe(403);
    });

    it("allows admin users", async () => {
        const res = await request(app)
            .get("/api/admin/dashboard")
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.stats).toBeDefined();
        expect(typeof res.body.stats.totalUsers).toBe("number");
    });

    it("returns 401 without token", async () => {
        const res = await request(app).get("/api/admin/dashboard");
        expect(res.status).toBe(401);
    });
});

describe("GET /api/admin/users", () => {
    it("admin can list users with pagination", async () => {
        const res = await request(app)
            .get("/api/admin/users?page=1&limit=10")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.users)).toBe(true);
        expect(res.body.pagination).toBeDefined();
    });

    it("admin can search users", async () => {
        const res = await request(app)
            .get("/api/admin/users?search=Test")
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
    });

    it("non-admin cannot access user list", async () => {
        const res = await request(app)
            .get("/api/admin/users")
            .set("Authorization", `Bearer ${regularToken}`);
        expect(res.status).toBe(403);
    });
});

describe("POST /api/admin/users/:id/ban", () => {
    it("admin can ban a user", async () => {
        const res = await request(app)
            .post(`/api/admin/users/${targetUserId}/ban`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ reason: "Integration test ban" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify in DB
        const doc = await mongoose.connection.db.collection("users").findOne({
            _id: new mongoose.Types.ObjectId(targetUserId),
        });
        expect(doc.isBanned).toBe(true);
        expect(doc.banReason).toBe("Integration test ban");
    });

    it("admin can unban a user", async () => {
        const res = await request(app)
            .post(`/api/admin/users/${targetUserId}/unban`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        const doc = await mongoose.connection.db.collection("users").findOne({
            _id: new mongoose.Types.ObjectId(targetUserId),
        });
        expect(doc.isBanned).toBe(false);
    });
});

describe("POST /api/admin/users/:id/suspend", () => {
    it("admin can suspend a user with duration", async () => {
        const res = await request(app)
            .post(`/api/admin/users/${targetUserId}/suspend`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ reason: "Test suspension", durationHours: 24 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("admin can unsuspend", async () => {
        const res = await request(app)
            .post(`/api/admin/users/${targetUserId}/unsuspend`)
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
    });
});

describe("GET /api/admin/reports", () => {
    it("admin can view reports", async () => {
        const res = await request(app)
            .get("/api/admin/reports")
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe("GET /api/admin/logs", () => {
    it("admin can view audit logs", async () => {
        const res = await request(app)
            .get("/api/admin/logs")
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.logs)).toBe(true);
    });
});

describe("Security edge cases", () => {
    it("non-admin cannot delete users", async () => {
        const res = await request(app)
            .delete(`/api/admin/users/${targetUserId}`)
            .set("Authorization", `Bearer ${regularToken}`);
        expect(res.status).toBe(403);
    });

    it("admin email status endpoint is protected", async () => {
        const res = await request(app)
            .get("/api/admin/email/status")
            .set("Authorization", `Bearer ${regularToken}`);
        expect(res.status).toBe(403);
    });
});
