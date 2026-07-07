/**
 * db.js — Test database helpers
 * Uses the real MongoDB Atlas connection (test data is cleaned up after each suite).
 */
import mongoose from "mongoose";
import "dotenv/config";

const TEST_DB_PREFIX = "jest_test_";

export async function connectTestDB() {
    if (mongoose.connection.readyState === 1) return;
    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 20000,
        connectTimeoutMS: 20000,
    });
}

export async function closeTestDB() {
    await mongoose.disconnect();
}

/** Delete all documents belonging to test emails from this run */
export async function cleanupUsers(emails = []) {
    if (!emails.length) return;
    const db = mongoose.connection.db;
    const users = await db.collection("users")
        .find({ email: { $in: emails } })
        .project({ _id: 1 })
        .toArray();
    const ids = users.map(u => u._id);
    if (!ids.length) return;
    await Promise.allSettled([
        db.collection("users").deleteMany({ _id: { $in: ids } }),
        db.collection("otps").deleteMany({ email: { $in: emails } }),
        db.collection("matches").deleteMany({
            $or: [
                { userId: { $in: ids } },
                { matchedUserId: { $in: ids } },
            ],
        }),
        db.collection("messages").deleteMany({
            $or: [
                { fromUserId: { $in: ids } },
                { toUserId: { $in: ids } },
            ],
        }),
        db.collection("notifications").deleteMany({ userId: { $in: ids } }),
    ]);
}
