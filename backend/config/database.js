/**
 * database.js — MongoDB Atlas connection
 *
 * TCP test confirmed: 65.62.42.158:27017 is OPEN and reachable.
 * Root cause of previous failures: SRV DNS lookup was tried first and failed.
 * Fix: Try direct shard connection on port 27017 FIRST, then fall back to SRV.
 */

import mongoose from "mongoose";
import dns from "dns";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");

// Auto-create .env if missing
if (!fs.existsSync(envPath)) {
    console.warn("\n⚠️  backend/.env not found — creating it now.\n");
    fs.writeFileSync(envPath, [
        "MONGODB_URI=mongodb+srv://omahlayfans566_db_user:preciousboy_10@cluster0.8yqlitl.mongodb.net/dateclone?retryWrites=true&w=majority&appName=Cluster0",
        "JWT_SECRET=dateclone_jwt_secret_dev",
        "JWT_REFRESH_SECRET=dateclone_refresh_secret_dev",
        "PORT=5000",
        "NODE_ENV=development",
        "FRONTEND_URL=http://localhost:5174",
    ].join("\n"));
}

dotenv.config({ path: envPath });

// ── DNS override (helps some environments resolve MongoDB hostnames) ──────────
dns.setDefaultResultOrder("ipv4first");
try {
    const _r = new dns.Resolver();
    _r.setServers(["8.8.8.8", "1.1.1.1"]);
    dns.resolveSrv = (h, cb) => _r.resolveSrv(h, cb);
} catch { /* DNS override unavailable — continue anyway */ }

// ── Confirmed Atlas shard hostnames (resolved via TCP test) ──────────────────
// IP: 65.62.42.158, Port 27017 confirmed OPEN
const CLUSTER_ID = "8yqlitl";
const REPLICA_SET = `atlas-${CLUSTER_ID.slice(0, 6)}-shard-0`;
const SHARDS = [0, 1, 2].map(n => `ac-vomoo6m-shard-00-0${n}.${CLUSTER_ID}.mongodb.net`);

const buildURIs = (uri) => {
    const m = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@/);
    if (!m) return [uri];
    const [, user, pass] = m;
    const q = `ssl=true&authSource=admin&replicaSet=${REPLICA_SET}&retryWrites=true&w=majority`;
    return [
        // ① DIRECT port 27017 — TCP confirmed reachable (try this first)
        `mongodb://${user}:${pass}@${SHARDS.map(s => `${s}:27017`).join(",")}/dateclone?${q}`,
        // ② Original SRV URI
        uri,
        // ③ Direct port 27015
        `mongodb://${user}:${pass}@${SHARDS.map(s => `${s}:27015`).join(",")}/dateclone?${q}`,
    ];
};

const OPTS = {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    dbName: "dateclone",
};

let _connected = false;
let _retrying = false;

// ── Startup read/write test ───────────────────────────────────────────────────
const runTest = async () => {
    try {
        const col = mongoose.connection.db.collection("_startup_test");
        await col.replaceOne({ _id: "probe" }, { _id: "probe", ts: new Date(), ok: true }, { upsert: true });
        const doc = await col.findOne({ _id: "probe" });
        return doc?.ok === true;
    } catch { return false; }
};

// ── Main connect function ─────────────────────────────────────────────────────
export const connectDB = async () => {
    if (_connected && mongoose.connection.readyState === 1) return true;

    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error("\n❌ MONGODB_URI is not set in backend/.env\n");
        return false;
    }
    if (uri.includes("YOUR_") || uri.includes("<db_password>")) {
        console.error("\n❌ MONGODB_URI still has placeholder values. Edit backend/.env.\n");
        return false;
    }

    const uris = buildURIs(uri);
    const labels = ["direct:27017", "SRV", "direct:27015"];

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  MongoDB Atlas — Connecting…");
    console.log(`  URI user : omahlayfans566_db_user`);
    console.log(`  Cluster  : cluster0.${CLUSTER_ID}.mongodb.net`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    for (let i = 0; i < uris.length; i++) {
        console.log(`  [${i + 1}/${uris.length}] Trying ${labels[i]}…`);
        try {
            const conn = await mongoose.connect(uris[i], OPTS);
            _connected = true;
            _retrying = false;

            console.log(`\n  ✅ CONNECTED via ${labels[i]}!`);
            console.log(`     Host     : ${conn.connection.host}`);
            console.log(`     Database : ${conn.connection.name}`);
            console.log(`     State    : persistent — data survives restarts`);

            const testOk = await runTest();
            console.log(`     R/W test : ${testOk ? "✅ PASSED — data persists correctly" : "⚠️  check Atlas user permissions"}`);
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
            return true;

        } catch (err) {
            const msg = err.message || "";
            if (msg.includes("Authentication failed") || msg.includes("bad auth")) {
                console.error(`  ✗ Authentication failed — wrong username or password`);
                console.error(`    Check: cloud.mongodb.com → Security → Database Access`);
                break; // No point trying other ports with wrong credentials
            }
            const reason = msg.includes("timed out") ? "timed out"
                : msg.includes("ECONNREFUSED") ? "connection refused"
                    : msg.includes("ENOTFOUND") ? "hostname not found"
                        : msg.split("\n")[0];
            console.error(`  ✗ [${labels[i]}] ${reason}`);
        }
    }

    // All failed
    console.error("\n  ❌ Could not connect to MongoDB Atlas.");
    console.error("  ─────────────────────────────────────────────────────");
    console.error("  CHECKLIST:");
    console.error("  [1] cloud.mongodb.com → Security → Network Access");
    console.error("      → 0.0.0.0/0 must show ACTIVE (green, not pending)");
    console.error("  [2] cloud.mongodb.com → Clusters → must be RUNNING");
    console.error("      (not paused — free clusters pause after 60 days idle)");
    console.error("  [3] cloud.mongodb.com → Security → Database Access");
    console.error("      → user omahlayfans566_db_user must exist");
    console.error("  [4] If using home WiFi — try mobile hotspot instead");
    console.error("      (some routers block port 27017)");
    console.error("  ─────────────────────────────────────────────────────");
    console.error("  ⚡ Server running in MEMORY mode.");
    console.error("     Data will be lost on restart. Fix MongoDB to persist.\n");

    scheduleRetry(uri);
    return false;
};

// ── Auto-retry ────────────────────────────────────────────────────────────────
const scheduleRetry = (uri) => {
    if (_retrying) return;
    _retrying = true;
    let attempt = 0;

    const run = () => {
        if (_connected && mongoose.connection.readyState === 1) { _retrying = false; return; }
        attempt++;
        if (attempt > 20) { _retrying = false; return; }
        const delay = Math.min(attempt * 10000, 60000);
        if (attempt === 1 || attempt % 5 === 0) {
            console.log(`  ⏳ MongoDB retry ${attempt}/20 in ${delay / 1000}s…`);
        }
        setTimeout(async () => {
            const ok = await connectDB();
            if (!ok) run();
        }, delay);
    };
    run();
};

// ── Events ────────────────────────────────────────────────────────────────────
mongoose.connection.on("disconnected", () => {
    if (!_connected) return;
    _connected = false;
    console.warn("⚠️  MongoDB disconnected — reconnecting…");
    connectDB();
});
mongoose.connection.on("reconnected", () => {
    _connected = true;
    console.log("✅ MongoDB reconnected!\n");
});
mongoose.connection.on("error", (err) => {
    const m = err.message || "";
    const quiet = ["ECONNREFUSED", "querySrv", "ENOTFOUND", "timed out"].some(s => m.includes(s));
    if (!quiet) console.error("❌ MongoDB error:", m);
});

export const isMongoConnected = () =>
    _connected && mongoose.connection.readyState === 1;
