/**
 * Integration tests — Messaging (send, receive, conversation, read receipts, delete)
 * Requires an existing match between two users.
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
    await mongoose.connection.db.collection("users").updateOne(
        { email: userData.email },
        { $set: { emailVerified: true, isMember: true, isActive: true } }
    );
    const login = await request(app)
        .post("/api/auth/login")
        .send({ email: userData.email, password: userData.password });
    return { token: login.body.token, userId: reg.body.user._id };
}

async function createMatch(tA, idA, tB, idB) {
    await request(app).post("/api/matches/like")
        .set("Authorization", `Bearer ${tA}`).send({ likedUserId: idB });
    await request(app).post("/api/matches/like")
        .set("Authorization", `Bearer ${tB}`).send({ likedUserId: idA });
}

beforeAll(async () => {
    await connectTestDB();
    const a = await registerAndLogin(makeUser({ gender: "male", lookingFor: "women" }));
    const b = await registerAndLogin(makeFemaleUser());
    tokenA = a.token; userAId = a.userId;
    tokenB = b.token; userBId = b.userId;
    await createMatch(tokenA, userAId, tokenB, userBId);
});

afterAll(async () => {
    await cleanupUsers(emails);
    await closeTestDB();
});

describe("POST /api/messages/send", () => {
    it("matched user A can send a message to B", async () => {
        const res = await request(app)
            .post("/api/messages/send")
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ toUserId: userBId, content: "Hello from A!" });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.content).toBe("Hello from A!");
    });

    it("message is persisted in MongoDB", async () => {
        const doc = await mongoose.connection.db.collection("messages").findOne({
            fromUserId: new mongoose.Types.ObjectId(userAId),
            toUserId: new mongoose.Types.ObjectId(userBId),
            content: "Hello from A!",
        });
        expect(doc).not.toBeNull();
    });

    it("returns 403 for unmatched users", async () => {
        const c = await registerAndLogin(makeFemaleUser());
        const res = await request(app)
            .post("/api/messages/send")
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ toUserId: c.userId, content: "Should fail" });
        expect(res.status).toBe(403);
    });

    it("returns 400 when content is empty and no image", async () => {
        const res = await request(app)
            .post("/api/messages/send")
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ toUserId: userBId, content: "" });
        expect(res.status).toBe(400);
    });

    it("requires authentication", async () => {
        const res = await request(app)
            .post("/api/messages/send")
            .send({ toUserId: userBId, content: "no auth" });
        expect(res.status).toBe(401);
    });
});

describe("GET /api/messages/conversation/:userId", () => {
    beforeAll(async () => {
        // Send a reply from B
        await request(app)
            .post("/api/messages/send")
            .set("Authorization", `Bearer ${tokenB}`)
            .send({ toUserId: userAId, content: "Hi back from B!" });
    });

    it("A can retrieve conversation with B", async () => {
        const res = await request(app)
            .get(`/api/messages/conversation/${userBId}`)
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.messages)).toBe(true);
        expect(res.body.messages.length).toBeGreaterThanOrEqual(2);

        const contents = res.body.messages.map(m => m.content);
        expect(contents).toContain("Hello from A!");
        expect(contents).toContain("Hi back from B!");
    });

    it("messages are marked as read after retrieval", async () => {
        const unread = await mongoose.connection.db.collection("messages").countDocuments({
            toUserId: new mongoose.Types.ObjectId(userAId),
            fromUserId: new mongoose.Types.ObjectId(userBId),
            isRead: false,
        });
        expect(unread).toBe(0);
    });

    it("returns 403 for non-matched conversation", async () => {
        const c = await registerAndLogin(makeFemaleUser());
        const res = await request(app)
            .get(`/api/messages/conversation/${c.userId}`)
            .set("Authorization", `Bearer ${tokenA}`);
        expect(res.status).toBe(403);
    });
});

describe("GET /api/messages (all conversations)", () => {
    it("returns conversation list for A", async () => {
        const res = await request(app)
            .get("/api/messages")
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.conversations)).toBe(true);

        const convUserIds = res.body.conversations.map(c => c.user?._id?.toString());
        expect(convUserIds).toContain(userBId.toString());
    });
});

describe("DELETE /api/messages/:id (soft delete)", () => {
    it("can soft-delete own message", async () => {
        // Send a message to delete
        const sent = await request(app)
            .post("/api/messages/send")
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ toUserId: userBId, content: "Delete me!" });

        const msgId = sent.body.data._id;

        const del = await request(app)
            .delete(`/api/messages/${msgId}`)
            .set("Authorization", `Bearer ${tokenA}`);

        expect(del.status).toBe(200);

        // Verify it's soft-deleted in DB
        const doc = await mongoose.connection.db.collection("messages").findOne({
            _id: new mongoose.Types.ObjectId(msgId),
        });
        expect(doc.isDeleted).toBe(true);
    });

    it("cannot delete another user's message", async () => {
        const sent = await request(app)
            .post("/api/messages/send")
            .set("Authorization", `Bearer ${tokenB}`)
            .send({ toUserId: userAId, content: "B's message" });

        const msgId = sent.body.data._id;

        const del = await request(app)
            .delete(`/api/messages/${msgId}`)
            .set("Authorization", `Bearer ${tokenA}`); // A tries to delete B's message

        expect(del.status).toBe(403);
    });
});
