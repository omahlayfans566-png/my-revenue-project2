/**
 * drop-stale-match-index.mjs
 * One-time migration: drops the old user1_1_user2_1 index from the matches
 * collection that was left over from the original Match schema.
 * The new schema uses {userId, matchedUserId} with its own unique index.
 *
 * Run once: node scripts/drop-stale-match-index.mjs
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("MONGODB_URI not set in .env");
    process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
console.log("Connected to MongoDB Atlas.");

const db = mongoose.connection.db;
const col = db.collection("matches");

// List current indexes so we can see what's there
const indexes = await col.indexes();
console.log("\nCurrent indexes on matches collection:");
indexes.forEach(idx => console.log(" ", JSON.stringify(idx.key), "name:", idx.name));

const STALE_INDEX = "user1_1_user2_1";
const staleExists = indexes.some(idx => idx.name === STALE_INDEX);

if (!staleExists) {
    console.log(`\n✅ Index "${STALE_INDEX}" does not exist — nothing to drop.`);
} else {
    await col.dropIndex(STALE_INDEX);
    console.log(`\n✅ Dropped stale index "${STALE_INDEX}" successfully.`);
}

// Also check for any other old-schema indexes to clean up
const OTHER_STALE = [
    "user1_1", "user2_1", "isMatch_1",
    "users_1", "isMatch_1_matchedAt_-1",
    "user1_1_isMatch_1", "user2_1_isMatch_1",
];
// Refresh index list after first drop
const updatedIndexes = await col.indexes();
for (const name of OTHER_STALE) {
    if (updatedIndexes.some(idx => idx.name === name)) {
        await col.dropIndex(name);
        console.log(`✅ Dropped stale index "${name}"`);
    }
}

console.log("\nMigration complete.");
await mongoose.disconnect();
process.exit(0);
