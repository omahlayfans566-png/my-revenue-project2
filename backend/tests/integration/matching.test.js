/**
 * Integration tests — Matching (like, superlike, pass, mutual match, unmatch, block)
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import app from "../helpers/testApp.js";
import { connectTestDB, closeTestDB, cleanupUsers } from "../helpers/db.js";
import { makeUser, makeFemaleUser } from "../helpers/fixtures.js";
import mongoose from "mongoose";

const emails = [];
let tokenA, tokenB, userAId, userBId;

async function registerAndLogin(userData) {
    emails.push(userData.email);
    const reg = await request(app).post("/api/auth/register").send(userData);
    // Manually verify so user is active
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
});

afterAll(async () => {
    await cleanupUsers(emails);
    await closeTestDB();
});

describe("POST /api/matches/like", () => {
    it("A can like B (no match yet)", async () => {
        const res = await request(app)
            .post("/api/matches/like")
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ likedUserId: userBId });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.isMatch).toBe(false);
    });

    it("like is persisted in the database", async () => {
        const doc = await mongoose.connection.db.collection("matches").findOne({
            userId: new mongoose.Types.ObjectId(userAId),
            matchedUserId: new mongoose.Types.ObjectId(userBId),
        });
        expect(doc).not.toBeNull();
        expect(["liked", "matched"]).toContain(doc.status);
    });

    it("returns 400 when liking yourself", async () => {
        const res = await request(app)
            .post("/api/matches/like")
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ likedUserId: userAId });
        expect(res.status).toBe(400);
    });

    it("requires authentication", async () => {
        const res = await request(app)
            .post("/api/matches/like")
            .send({ likedUserId: userBId });
        expect(res.status).toBe(401);
    });
});

describe("Mutual like creates a Match", () => {
    it("B liking A back results in isMatch=true", async () => {
        const res = await request(app)
            .post("/api/matches/like")
            .set("Authorization", `Bearer ${tokenB}`)
            .send({ likedUserId: userAId });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.isMatch).toBe(true);
        expect(res.body.message).toMatch(/match/i);
    });

    it("both Match records have status=matched in DB", async () => {
        const [docAB, docBA] = await Promise.all([
            mongoose.connection.db.collection("matches").findOne({
                userId: new mongoose.Types.ObjectId(userAId),
                matchedUserId: new mongoose.Types.ObjectId(userBId),
                status: "matched",
            }),
            mongoose.connection.db.collection("matches").findOne({
                userId: new mongoose.Types.ObjectId(userBId),
                matchedUserId: new mongoose.Types.ObjectId(userAId),
                status: "matched",
            }),
        ]);
        expect(docAB).not.toBeNull();
        expect(docBA).not.toBeNull();
    });

    it("match notifications created for both users", async () => {
        await new Promise(r => setTimeout(r, 500)); // allow async notification write
        const [na, nb] = await Promise.all([
            mongoose.connection.db.collection("notifications").findOne({
                userId: new mongoose.Types.ObjectId(userAId), type: "match",
            }),
            mongoose.connection.db.collection("notifications").findOne({
                userId: new mongoose.Types.ObjectId(userBId), type: "match",
            }),
        ]);
        expect(na).not.toBeNull();
        expect(nb).not.toBeNull();
    });
});

describe("GET /api/matches/my-matches", () => {
    it("A can see B in their matches list", async () => {
        const res = await request(app)
            .get("/api/matches/my-matches")
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const matchedIds = res.body.matches.map(m => m.user?._id?.toString());
        expect(matchedIds).toContain(userBId.toString());
    });

    it("B can see A in their matches list", async () => {
        const res = await request(app)
            .get("/api/matches/my-matches")
            .set("Authorization", `Bearer ${tokenB}`);

        expect(res.status).toBe(200);
        const matchedIds = res.body.matches.map(m => m.user?._id?.toString());
        expect(matchedIds).toContain(userAId.toString());
    });
});

describe("POST /api/matches/pass", () => {
    it("can pass a third user", async () => {
        const c = await registerAndLogin(makeFemaleUser());
        const res = await request(app)
            .post("/api/matches/pass")
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ passedUserId: c.userId });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe("POST /api/matches/superlike", () => {
    it("can super-like a user", async () => {
        const d = await registerAndLogin(makeFemaleUser());
        const res = await request(app)
            .post("/api/matches/superlike")
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ likedUserId: d.userId });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe("POST /api/matches/unmatch", () => {
    it("removes the match between A and B", async () => {
        const res = await request(app)
            .post("/api/matches/unmatch")
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ unmatchedUserId: userBId });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Match should no longer be in matches list
        const matchesRes = await request(app)
            .get("/api/matches/my-matches")
            .set("Authorization", `Bearer ${tokenA}`);
        const matchedIds = matchesRes.body.matches?.map(m => m.user?._id?.toString()) || [];
        expect(matchedIds).not.toContain(userBId.toString());
    });
});
