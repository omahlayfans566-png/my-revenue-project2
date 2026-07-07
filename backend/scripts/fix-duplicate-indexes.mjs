/**
 * fix-duplicate-indexes.mjs
 * Drops stale Atlas indexes that conflict with the updated Mongoose schema definitions.
 * Run once: node scripts/fix-duplicate-indexes.mjs
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
console.log("Connected.\n");

const db = mongoose.connection.db;

const toDrop = {
    // subscriptions: remove bare userId_1 (superseded by compound userId_1_status_1)
    // and stale paystackReference_1 (will be recreated by Mongoose with sparse:true)
    subscriptions: ["userId_1", "paystackReference_1"],

    // payments: remove bare userId_1 (superseded by compound userId_1_createdAt_-1)
    // and stale paystackReference_1 (will be recreated by Mongoose with unique+sparse)
    payments: ["userId_1", "paystackReference_1"],

    // voiceintroductions: remove bare userId_1 — schema now adds it with unique:true
    voiceintroductions: ["userId_1"],

    // incognitomodes: remove bare userId_1 — schema now adds it with unique:true
    incognitomodes: ["userId_1"],
};

for (const [col, names] of Object.entries(toDrop)) {
    const collection = db.collection(col);
    let existing;
    try {
        existing = await collection.indexes();
    } catch {
        console.log(`  ${col}: collection does not exist yet — skipping`);
        continue;
    }
    const existingNames = existing.map(i => i.name);

    for (const name of names) {
        if (existingNames.includes(name)) {
            await collection.dropIndex(name);
            console.log(`✅ ${col}: dropped "${name}"`);
        } else {
            console.log(`   ${col}: "${name}" not present — skipping`);
        }
    }
}

console.log("\nDone.");
await mongoose.disconnect();
process.exit(0);
