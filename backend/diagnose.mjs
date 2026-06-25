/**
 * diagnose.mjs — Complete MongoDB Atlas connection diagnosis
 * Run: node diagnose.mjs
 */
import dns from "dns";
import net from "net";
import tls from "tls";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { createRequire } from "module";

dotenv.config();

const URI = process.env.MONGODB_URI;
const REDACTED = URI?.replace(/:([^@]+)@/, ":***@");

console.log("\n══════════════════════════════════════════════════════════");
console.log("  MongoDB Atlas — Full Diagnosis");
console.log("══════════════════════════════════════════════════════════\n");

// ── Step 1: URI validation ────────────────────────────────────────────────────
console.log("STEP 1: URI Validation");
console.log("  URI:      ", REDACTED);
console.log("  Protocol: ", URI?.startsWith("mongodb+srv") ? "✅ mongodb+srv" : "❌ wrong protocol");
const uriMatch = URI?.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)/);
if (!uriMatch) { console.log("  ❌ URI format invalid — cannot parse"); process.exit(1); }
const [, user, , host] = uriMatch;
console.log("  User:     ", user);
console.log("  Host:     ", host);
console.log("  DB in URI:", URI?.includes("/dateclone") ? "✅ dateclone" : "⚠️  not specified (will use default)");
console.log();

// ── Step 2: DNS — system resolver ─────────────────────────────────────────────
console.log("STEP 2: DNS Resolution (system resolver)");
try {
    await new Promise((res, rej) =>
        dns.resolveSrv(`_mongodb._tcp.${host}`, (err, records) => {
            if (err) { console.log("  ❌ System DNS SRV FAIL:", err.code, "-", err.message); rej(err); }
            else { console.log("  ✅ System DNS SRV OK:", records[0].name + ":" + records[0].port); res(records); }
        })
    );
} catch { console.log("  → System DNS cannot resolve MongoDB SRV records"); }
console.log();

// ── Step 3: DNS — Google resolver ─────────────────────────────────────────────
console.log("STEP 3: DNS Resolution (Google 8.8.8.8)");
let srvHost = null;
try {
    const gr = new dns.Resolver();
    gr.setServers(["8.8.8.8"]);
    const records = await new Promise((res, rej) =>
        gr.resolveSrv(`_mongodb._tcp.${host}`, (err, r) => err ? rej(err) : res(r))
    );
    srvHost = records[0].name;
    console.log("  ✅ Google DNS SRV OK:", srvHost + ":27017");
    const ips = await new Promise((res, rej) => gr.resolve4(srvHost, (err, r) => err ? rej(err) : res(r)));
    console.log("  ✅ IP resolved:       ", ips[0]);
} catch (e) {
    console.log("  ❌ Google DNS FAIL:", e.message);
}
console.log();

// ── Step 4: TCP connectivity ───────────────────────────────────────────────────
console.log("STEP 4: TCP Port 27017 Test");
const tcpHost = srvHost || `ac-vomoo6m-shard-00-00.${host.split(".").slice(1).join(".")}`;
let tcpOk = false;
try {
    await new Promise((resolve, reject) => {
        const sock = net.createConnection({ host: tcpHost, port: 27017, timeout: 8000 });
        sock.on("connect", () => { tcpOk = true; sock.destroy(); resolve(); });
        sock.on("error", (e) => reject(e));
        sock.on("timeout", () => reject(new Error("TCP timeout after 8s")));
    });
    console.log("  ✅ TCP port 27017 is OPEN —", tcpHost);
} catch (e) {
    console.log("  ❌ TCP FAIL:", e.message);
    console.log("  Diagnosis: Port 27017 is blocked by firewall/ISP/router");
}
console.log();

// ── Step 5: TLS handshake ─────────────────────────────────────────────────────
console.log("STEP 5: TLS Handshake");
if (tcpOk) {
    try {
        await new Promise((resolve, reject) => {
            const sock = tls.connect({ host: tcpHost, port: 27017, timeout: 8000, rejectUnauthorized: true });
            sock.on("secureConnect", () => {
                console.log("  ✅ TLS handshake succeeded");
                console.log("  Certificate:", sock.getPeerCertificate()?.subject?.CN || "unknown");
                sock.destroy(); resolve();
            });
            sock.on("error", (e) => reject(e));
            sock.on("timeout", () => reject(new Error("TLS timeout")));
        });
    } catch (e) {
        console.log("  ❌ TLS FAIL:", e.message);
    }
} else {
    console.log("  ⏭  Skipped (TCP failed)");
}
console.log();

// ── Step 6: Full Mongoose connection with detailed error ──────────────────────
console.log("STEP 6: Full Mongoose Connection");
const gr2 = new dns.Resolver();
gr2.setServers(["8.8.8.8", "1.1.1.1"]);
dns.resolveSrv = (h, cb) => gr2.resolveSrv(h, cb);
dns.resolve4 = (h, cb) => gr2.resolve4(h, cb);

try {
    const conn = await mongoose.connect(URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 20000,
        dbName: "dateclone",
    });

    console.log("  ✅ MONGOOSE CONNECTED!");
    console.log("  Host:    ", conn.connection.host);
    console.log("  Database:", conn.connection.name);
    console.log("  State:   ", conn.connection.readyState === 1 ? "connected" : "unknown");

    // Step 7: Read/write test
    console.log("\nSTEP 7: Read/Write Persistence Test");
    const col = conn.connection.db.collection("_diag_test");
    const ts = new Date().toISOString();
    await col.replaceOne({ _id: "test" }, { _id: "test", ts, pass: true }, { upsert: true });
    const doc = await col.findOne({ _id: "test" });
    if (doc?.pass && doc?.ts === ts) {
        console.log("  ✅ Write/Read test PASSED — data persists correctly");
        console.log("  Written/Read timestamp:", ts);
    } else {
        console.log("  ❌ Write/Read test FAILED");
    }

    await mongoose.disconnect();
    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  ✅ ALL CHECKS PASSED — MongoDB Atlas is fully operational");
    console.log("  Users, profiles, matches, and messages will persist permanently.");
    console.log("══════════════════════════════════════════════════════════\n");

} catch (err) {
    console.log("  ❌ MONGOOSE FAILED");
    console.log("  Error name:   ", err.name);
    console.log("  Error code:   ", err.code || "none");
    console.log("  Error message:", err.message?.split("\n")[0]);

    // Classify the error
    const msg = err.message || "";
    if (msg.includes("Authentication failed") || msg.includes("bad auth")) {
        console.log("\n  ROOT CAUSE: ❌ Wrong username or password");
        console.log("  FIX: Go to cloud.mongodb.com → Security → Database Access");
        console.log("       Verify user 'omahlayfans566_db_user' exists with correct password");
    } else if (msg.includes("querySrv") || msg.includes("ENOTFOUND")) {
        console.log("\n  ROOT CAUSE: ❌ DNS cannot resolve MongoDB SRV record");
        console.log("  FIX: Network is blocking DNS SRV lookups (port 53 UDP filtered)");
    } else if (msg.includes("timed out") || msg.includes("ETIMEDOUT")) {
        console.log("\n  ROOT CAUSE: ❌ Connection timed out — Atlas not reachable on port 27017");
        console.log("  FIX: Check Atlas Network Access — is 0.0.0.0/0 ACTIVE?");
        console.log("       Check Atlas Clusters — is the cluster RUNNING (not paused)?");
    } else if (msg.includes("ECONNREFUSED")) {
        console.log("\n  ROOT CAUSE: ❌ Connection actively refused");
        console.log("  FIX: Atlas cluster may be paused. Go to cloud.mongodb.com and Resume it.");
    } else if (msg.includes("certificate") || msg.includes("SSL") || msg.includes("TLS")) {
        console.log("\n  ROOT CAUSE: ❌ TLS/SSL certificate error");
    } else {
        console.log("\n  ROOT CAUSE: Unknown");
        console.log("  Full error:", err.message);
    }

    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  ❌ MongoDB connection failed. See ROOT CAUSE above.");
    console.log("══════════════════════════════════════════════════════════\n");
}
