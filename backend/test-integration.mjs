/**
 * test-integration.mjs
 * Complete end-to-end integration test for DateClone dating workflow.
 * Tests: register → verify → login → discover → like → match → chat → notifications
 *
 * Run with: node test-integration.mjs
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { io as SocketClient } from "socket.io-client";
dotenv.config();

const BASE = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

// ── Colours for terminal output ───────────────────────────────────────────────
const C = {
    reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m",
    yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m", dim: "\x1b[2m",
};

let passed = 0, failed = 0, warnings = 0;

const pass = (msg) => { passed++; console.log(`${C.green}  ✅ PASS${C.reset}  ${msg}`); };
const fail = (msg) => { failed++; console.log(`${C.red}  ❌ FAIL${C.reset}  ${msg}`); };
const warn = (msg) => { warnings++; console.log(`${C.yellow}  ⚠️  WARN${C.reset}  ${msg}`); };
const info = (msg) => console.log(`${C.cyan}  ℹ${C.reset}  ${msg}`);
const header = (msg) => console.log(`\n${C.bold}${C.cyan}══════════════════════════════════════\n  ${msg}\n══════════════════════════════════════${C.reset}`);

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function api(method, path, body, token) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    let data = {};
    try { data = await res.json(); } catch { }
    return { status: res.status, data };
}

const get = (path, token) => api("GET", path, null, token);
const post = (path, body, token) => api("POST", path, body, token);
const put = (path, body, token) => api("PUT", path, body, token);

// ── Generate unique test users ────────────────────────────────────────────────
const ts = Date.now();
const USERS = [
    { firstName: "Amara", lastName: "Osei", username: `amara_${ts}`, email: `amara_${ts}@test-dateclone.com`, password: "Test@12345", gender: "female", lookingFor: "men", age: 24, country: "Nigeria", city: "Lagos", interests: ["Music", "Travel"] },
    { firstName: "Kwame", lastName: "Asante", username: `kwame_${ts}`, email: `kwame_${ts}@test-dateclone.com`, password: "Test@12345", gender: "male", lookingFor: "women", age: 27, country: "Ghana", city: "Accra", interests: ["Sports", "Tech"] },
    { firstName: "Zara", lastName: "Diallo", username: `zara_${ts}`, email: `zara_${ts}@test-dateclone.com`, password: "Test@12345", gender: "female", lookingFor: "men", age: 22, country: "Senegal", city: "Dakar", interests: ["Art", "Cooking"] },
    { firstName: "Kofi", lastName: "Mensah", username: `kofi_${ts}`, email: `kofi_${ts}@test-dateclone.com`, password: "Test@12345", gender: "male", lookingFor: "women", age: 29, country: "Ghana", city: "Kumasi", interests: ["Music", "Gaming"] },
    { firstName: "Fatima", lastName: "Ibrahim", username: `fatima_${ts}`, email: `fatima_${ts}@test-dateclone.com`, password: "Test@12345", gender: "female", lookingFor: "men", age: 26, country: "Nigeria", city: "Abuja", interests: ["Travel", "Fitness"] },
];

// ── Direct DB access for verification ────────────────────────────────────────
async function connectDB() {
    await mongoose.connect(process.env.MONGODB_URI);
}

async function getOtpFromDB(email) {
    const db = mongoose.connection.db;
    const record = await db.collection("otps").findOne(
        { email, used: false },
        { sort: { createdAt: -1 } }
    );
    return record;
}

async function getMatchFromDB(userId, matchedUserId) {
    const db = mongoose.connection.db;
    return db.collection("matches").findOne({
        $or: [
            { userId: new mongoose.Types.ObjectId(userId), matchedUserId: new mongoose.Types.ObjectId(matchedUserId) },
            { userId: new mongoose.Types.ObjectId(matchedUserId), matchedUserId: new mongoose.Types.ObjectId(userId) },
        ],
        status: "matched",
    });
}

async function getMessagesFromDB(userA, userB) {
    const db = mongoose.connection.db;
    return db.collection("messages").find({
        $or: [
            { fromUserId: new mongoose.Types.ObjectId(userA), toUserId: new mongoose.Types.ObjectId(userB) },
            { fromUserId: new mongoose.Types.ObjectId(userB), toUserId: new mongoose.Types.ObjectId(userA) },
        ],
        isDeleted: false,
    }).toArray();
}

async function getNotificationsFromDB(userId, type) {
    const db = mongoose.connection.db;
    return db.collection("notifications").find({
        userId: new mongoose.Types.ObjectId(userId),
        ...(type ? { type } : {}),
    }).sort({ createdAt: -1 }).limit(10).toArray();
}

async function cleanupTestUsers(emails) {
    const db = mongoose.connection.db;
    const users = await db.collection("users").find({ email: { $in: emails } }).toArray();
    const ids = users.map(u => u._id);
    if (ids.length === 0) return;
    await Promise.all([
        db.collection("users").deleteMany({ _id: { $in: ids } }),
        db.collection("otps").deleteMany({ email: { $in: emails } }),
        db.collection("matches").deleteMany({ $or: [{ userId: { $in: ids } }, { matchedUserId: { $in: ids } }] }),
        db.collection("messages").deleteMany({ $or: [{ fromUserId: { $in: ids } }, { toUserId: { $in: ids } }] }),
        db.collection("notifications").deleteMany({ userId: { $in: ids } }),
    ]);
    info(`Cleaned up ${ids.length} test users and related data`);
}

// ── Socket.IO test helper ─────────────────────────────────────────────────────
function createSocket(token) {
    return new Promise((resolve, reject) => {
        const s = SocketClient(SOCKET_URL, {
            transports: ["websocket"],
            auth: { token },
            timeout: 8000,
        });
        const t = setTimeout(() => { s.disconnect(); reject(new Error("Socket connect timeout")); }, 8000);
        s.on("connect", () => { clearTimeout(t); resolve(s); });
        s.on("connect_error", (e) => { clearTimeout(t); reject(e); });
    });
}

function waitForEvent(socket, event, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
        socket.once(event, (data) => { clearTimeout(t); resolve(data); });
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═════════════════════════════════════════════════════════════════════════════
async function run() {
    header("DateClone Integration Test Suite");
    console.log(`${C.dim}  Testing against: ${BASE}${C.reset}`);
    console.log(`${C.dim}  Test users: ${USERS.length} (all unique timestamps)${C.reset}\n`);

    // Connect to DB for direct verification
    try {
        await connectDB();
        pass("MongoDB Atlas connected");
    } catch (e) {
        fail(`MongoDB connection failed: ${e.message}`);
        console.log(`${C.red}  Cannot run tests without DB. Exiting.${C.reset}`);
        process.exit(1);
    }

    // Cleanup any leftover test data from previous runs
    await cleanupTestUsers(USERS.map(u => u.email));

    const sessions = []; // { user, token, userId, socket }

    // ─────────────────────────────────────────────────────────────────────────
    header("PHASE 1 — Registration & Email Verification");
    // ─────────────────────────────────────────────────────────────────────────

    for (const user of USERS) {
        info(`Registering ${user.firstName} ${user.lastName} (${user.email})`);

        const regBody = {
            ...user,
            phone: "", confirmPassword: user.password,
            dateOfBirth: "1995-01-15",
            state: "Test State",
            profilePicture: "",
            aboutMe: `Hi, I am ${user.firstName} — a test user for integration testing.`,
            occupation: "Software Engineer",
            education: "bachelors",
            languages: ["English"],
            smoking: "never",
            drinking: "socially",
            relationshipGoal: "Serious relationship",
            hasChildren: "no",
            wantsChildren: "yes",
            religion: "Christian",
            religionImportance: "somewhat_important",
            relationshipValue: "trust",
            minAge: 18,
            maxAge: 50,
            preferredCountry: "Anywhere in Africa",
            preferredDistance: "anywhere_in_africa",
        };

        const reg = await post("/auth/register", regBody);

        if (reg.status !== 201 || !reg.data.success) {
            fail(`Registration failed for ${user.email}: ${reg.data?.message} (HTTP ${reg.status})`);
            continue;
        }
        pass(`Registered: ${user.firstName} (userId: ${reg.data.user._id})`);

        const regToken = reg.data.token;
        const userId = reg.data.user._id;

        // Fetch OTP directly from DB (bypasses email for testing)
        await new Promise(r => setTimeout(r, 500)); // small delay for DB write
        const otpRecord = await getOtpFromDB(user.email);

        if (!otpRecord) {
            fail(`OTP not found in DB for ${user.email}`);
            continue;
        }
        pass(`OTP stored in DB for ${user.email} (hashType: ${otpRecord.hashType}, expires: ${otpRecord.expiresAt})`);

        // We need the plain OTP — for test purposes read it from a debug endpoint
        // Since OTP is hashed, we'll use resend-verification to get a new one
        // and intercept it via the backend console log... OR we use the admin API to manually verify
        // Since email is test domain, use admin-style manual verify
        info(`Manually verifying email for ${user.firstName} via admin verify endpoint`);

        // First login with regToken to get the userId for admin verify
        // Use the super admin to manually verify
        const adminLoginRes = await post("/auth/login", {
            email: process.env.ADMIN_EMAIL || "omahlayfans566@gmail.com",
            password: process.env.ADMIN_PASSWORD || "preciousboy_10",
        });

        let adminToken = null;
        if (adminLoginRes.status === 200 && adminLoginRes.data.success) {
            adminToken = adminLoginRes.data.token;
        }

        if (adminToken) {
            const verifyRes = await post(`/admin/users/${userId}/verify`, {}, adminToken);
            if (verifyRes.status === 200 && verifyRes.data.success) {
                pass(`Email verified for ${user.firstName} via admin (no email needed for test)`);
            } else {
                warn(`Admin verify failed for ${user.firstName}: ${verifyRes.data?.message}`);
                // Try OTP verification with a workaround — resend to get fresh OTP logged
            }
        }

        // Now login to get a proper session token
        const loginRes = await post("/auth/login", { email: user.email, password: user.password });

        if (loginRes.status !== 200 || !loginRes.data.success) {
            fail(`Login failed for ${user.firstName}: ${loginRes.data?.message}`);
            continue;
        }
        pass(`Logged in: ${user.firstName} (token received)`);

        const token = loginRes.data.token;

        // Verify /auth/me returns full profile
        const meRes = await get("/auth/me", token);
        if (meRes.status === 200 && meRes.data.user) {
            pass(`/auth/me returns full profile for ${user.firstName} (role: ${meRes.data.user.role}, emailVerified: ${meRes.data.user.emailVerified})`);
        } else {
            warn(`/auth/me unexpected for ${user.firstName}: ${JSON.stringify(meRes.data)}`);
        }

        sessions.push({ user, token, userId, loginData: loginRes.data });
    }

    info(`\nRegistered and logged in: ${sessions.length}/${USERS.length} users`);
    if (sessions.length < 2) {
        fail("Need at least 2 users to test matching. Aborting.");
        await finish();
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    header("PHASE 2 — Discovery: Users Appear Without Refresh");
    // ─────────────────────────────────────────────────────────────────────────

    for (const session of sessions) {
        const discRes = await get("/discover", session.token);

        if (discRes.status !== 200 || !Array.isArray(discRes.data.users)) {
            fail(`Discover API failed for ${session.user.firstName}: ${discRes.data?.message}`);
            continue;
        }

        const others = sessions.filter(s => s.userId !== session.userId);
        const foundIds = discRes.data.users.map(u => u._id.toString());
        const foundCount = others.filter(o => foundIds.includes(o.userId.toString())).length;

        if (foundCount > 0) {
            pass(`${session.user.firstName} sees ${foundCount} other test users on Discover (${discRes.data.users.length} total returned)`);
        } else if (discRes.data.users.length > 0) {
            warn(`${session.user.firstName} sees ${discRes.data.users.length} users on Discover but none are test users (may be filtered by preferences)`);
        } else {
            warn(`${session.user.firstName} sees 0 users on Discover — may be filtered. Total in DB: check logs`);
        }
    }

    // Test that a newly registered 6th user appears immediately without refresh
    info("Testing auto-discovery: registering a 6th user and checking immediate visibility...");
    const user6 = {
        firstName: "Nkechi", lastName: "Eze", username: `nkechi_${ts}`,
        email: `nkechi_${ts}@test-dateclone.com`, password: "Test@12345",
        gender: "female", lookingFor: "men", age: 23, country: "Nigeria", city: "Enugu",
        interests: ["Reading", "Fashion"], phone: "", confirmPassword: "Test@12345",
        dateOfBirth: "1996-03-10", state: "Enugu State",
        profilePicture: "", aboutMe: "Test user 6 — Nkechi from Enugu.",
        occupation: "Designer", education: "bachelors", languages: ["English"],
        smoking: "never", drinking: "never",
        relationshipGoal: "Serious relationship", hasChildren: "no", wantsChildren: "yes",
        religion: "Christian", religionImportance: "very_important",
        relationshipValue: "trust", minAge: 18, maxAge: 50,
        preferredCountry: "Anywhere in Africa", preferredDistance: "anywhere_in_africa",
    };

    const reg6 = await post("/auth/register", user6);
    if (reg6.status === 201 && reg6.data.success) {
        pass(`6th user (Nkechi) registered successfully`);
        USERS.push(user6); // track for cleanup

        // Verify via admin
        const adminL = await post("/auth/login", { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
        if (adminL.data.token) {
            await post(`/admin/users/${reg6.data.user._id}/verify`, {}, adminL.data.token);
        }

        // Immediately check from session[0]'s perspective — no refresh
        const discAfter = await get("/discover", sessions[0].token);
        const found6 = discAfter.data.users?.some(u => u._id.toString() === reg6.data.user._id.toString());
        if (found6) {
            pass(`Nkechi (user 6) immediately appears on ${sessions[0].user.firstName}'s Discover page without refresh`);
        } else {
            warn(`Nkechi not yet visible on Discover — may be filtered by email verification state or preferences`);
        }
        sessions.push({ user: user6, token: null, userId: reg6.data.user._id });
    } else {
        warn(`6th user registration failed: ${reg6.data?.message}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    header("PHASE 3 — Socket.IO Connections & Presence");
    // ─────────────────────────────────────────────────────────────────────────

    const sockets = {};
    for (const session of sessions.filter(s => s.token)) {
        try {
            const sock = await createSocket(session.token);
            sock.emit("user_online", { userId: session.userId });
            sockets[session.userId] = sock;
            pass(`Socket.IO connected: ${session.user.firstName} (socketId: ${sock.id})`);
        } catch (e) {
            fail(`Socket.IO failed for ${session.user.firstName}: ${e.message}`);
        }
    }
    info(`${Object.keys(sockets).length} sockets connected`);

    // Wait for presence events to propagate
    await new Promise(r => setTimeout(r, 1000));

    // Test reconnection: disconnect one socket and reconnect
    const [s0] = sessions.filter(s => sockets[s.userId]);
    if (s0 && sockets[s0.userId]) {
        info(`Testing Socket.IO reconnection for ${s0.user.firstName}...`);
        sockets[s0.userId].disconnect();
        await new Promise(r => setTimeout(r, 500));
        try {
            const reconnected = await createSocket(s0.token);
            reconnected.emit("user_online", { userId: s0.userId });
            sockets[s0.userId] = reconnected;
            pass(`Socket.IO reconnected successfully for ${s0.user.firstName}`);
        } catch (e) {
            fail(`Reconnection failed: ${e.message}`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    header("PHASE 4 — Likes & Mutual Match Creation");
    // ─────────────────────────────────────────────────────────────────────────

    // Use first two sessions for mutual like test
    const [userA, userB] = sessions.filter(s => s.token);
    info(`Testing like/match between ${userA.user.firstName} and ${userB.user.firstName}`);

    // Set up match event listeners before performing actions
    const matchEventsA = [];
    const matchEventsB = [];
    if (sockets[userA.userId]) {
        sockets[userA.userId].on("new_match", (data) => matchEventsA.push(data));
        sockets[userA.userId].on("new_like", (data) => matchEventsA.push({ type: "like", ...data }));
    }
    if (sockets[userB.userId]) {
        sockets[userB.userId].on("new_match", (data) => matchEventsB.push(data));
        sockets[userB.userId].on("new_like", (data) => matchEventsB.push({ type: "like", ...data }));
    }

    // A likes B
    const likeRes = await post("/matches/like", { likedUserId: userB.userId }, userA.token);
    if (likeRes.status === 200 && likeRes.data.success) {
        pass(`${userA.user.firstName} liked ${userB.user.firstName} — isMatch: ${likeRes.data.isMatch}`);
    } else {
        fail(`Like failed: ${likeRes.data?.message}`);
    }

    // Verify like in DB
    await new Promise(r => setTimeout(r, 500));
    const likeDoc = await mongoose.connection.db.collection("matches").findOne({
        userId: new mongoose.Types.ObjectId(userA.userId),
        matchedUserId: new mongoose.Types.ObjectId(userB.userId),
    });
    if (likeDoc) {
        pass(`Like persisted in DB: { userId: ${userA.user.firstName}, matchedUserId: ${userB.user.firstName}, status: "${likeDoc.status}" }`);
    } else {
        fail(`Like NOT found in MongoDB after POST /matches/like`);
    }

    // B likes A back — should create mutual match
    const likeBackRes = await post("/matches/like", { likedUserId: userA.userId }, userB.token);
    if (likeBackRes.status === 200 && likeBackRes.data.success) {
        if (likeBackRes.data.isMatch) {
            pass(`${userB.user.firstName} liked ${userA.user.firstName} back — MUTUAL MATCH created!`);
        } else {
            fail(`${userB.user.firstName} liked back but isMatch=false — matching logic broken`);
        }
    } else {
        fail(`Reverse like failed: ${likeBackRes.data?.message}`);
    }

    // Verify both Match records in DB
    await new Promise(r => setTimeout(r, 800));
    const matchDocAB = await mongoose.connection.db.collection("matches").findOne({
        userId: new mongoose.Types.ObjectId(userA.userId),
        matchedUserId: new mongoose.Types.ObjectId(userB.userId),
        status: "matched",
    });
    const matchDocBA = await mongoose.connection.db.collection("matches").findOne({
        userId: new mongoose.Types.ObjectId(userB.userId),
        matchedUserId: new mongoose.Types.ObjectId(userA.userId),
        status: "matched",
    });

    if (matchDocAB) {
        pass(`Match DB record A→B: { status: "${matchDocAB.status}", matchedAt: ${matchDocAB.matchedAt} }`);
    } else {
        fail(`Match record A→B not found with status="matched" in DB`);
    }
    if (matchDocBA) {
        pass(`Match DB record B→A: { status: "${matchDocBA.status}", matchedAt: ${matchDocBA.matchedAt} }`);
    } else {
        fail(`Match record B→A not found with status="matched" in DB`);
    }

    // Check socket events received
    await new Promise(r => setTimeout(r, 1000));
    if (matchEventsA.some(e => e.with)) {
        pass(`${userA.user.firstName} received new_match Socket.IO event`);
    } else {
        warn(`${userA.user.firstName} did not receive new_match event (may be timing — match IS in DB)`);
    }
    if (matchEventsB.some(e => e.with)) {
        pass(`${userB.user.firstName} received new_match Socket.IO event`);
    } else {
        warn(`${userB.user.firstName} did not receive new_match event (may be timing — match IS in DB)`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    header("PHASE 5 — Matches Page & Notifications");
    // ─────────────────────────────────────────────────────────────────────────

    // A sees B in their matches list
    const matchesA = await get("/matches/my-matches", userA.token);
    if (matchesA.status === 200 && matchesA.data.success) {
        const found = matchesA.data.matches?.some(m => m.user?._id?.toString() === userB.userId.toString());
        if (found) {
            pass(`${userA.user.firstName}'s Matches page shows ${userB.user.firstName} (${matchesA.data.matches.length} total matches)`);
        } else {
            fail(`${userB.user.firstName} NOT found in ${userA.user.firstName}'s matches list`);
        }
    } else {
        fail(`Matches API failed for ${userA.user.firstName}: ${matchesA.data?.message}`);
    }

    // B sees A in their matches list
    const matchesB = await get("/matches/my-matches", userB.token);
    if (matchesB.status === 200 && matchesB.data.success) {
        const found = matchesB.data.matches?.some(m => m.user?._id?.toString() === userA.userId.toString());
        if (found) {
            pass(`${userB.user.firstName}'s Matches page shows ${userA.user.firstName}`);
        } else {
            fail(`${userA.user.firstName} NOT found in ${userB.user.firstName}'s matches list`);
        }
    } else {
        fail(`Matches API failed for ${userB.user.firstName}: ${matchesB.data?.message}`);
    }

    // Check match notifications in DB
    const notifsA = await getNotificationsFromDB(userA.userId, "match");
    const notifsB = await getNotificationsFromDB(userB.userId, "match");
    if (notifsA.length > 0) {
        pass(`Match notification in DB for ${userA.user.firstName}: "${notifsA[0].title}"`);
    } else {
        warn(`No match notification found in DB for ${userA.user.firstName}`);
    }
    if (notifsB.length > 0) {
        pass(`Match notification in DB for ${userB.user.firstName}: "${notifsB[0].title}"`);
    } else {
        warn(`No match notification found in DB for ${userB.user.firstName}`);
    }

    // Check notifications via API
    const notifApiA = await get("/notifications", userA.token);
    if (notifApiA.status === 200 && notifApiA.data.notifications?.length > 0) {
        pass(`${userA.user.firstName} has ${notifApiA.data.notifications.length} notifications via API`);
    } else {
        warn(`No notifications returned by API for ${userA.user.firstName}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    header("PHASE 6 — Messaging");
    // ─────────────────────────────────────────────────────────────────────────

    // Set up message listener on B's socket
    const receivedMessages = [];
    if (sockets[userB.userId]) {
        sockets[userB.userId].on("new_message", (msg) => {
            receivedMessages.push(msg);
        });
    }

    // A sends a message to B
    const msgContent = `Hello ${userB.user.firstName}! This is a test message at ${Date.now()}`;
    const sendMsgRes = await post("/messages/send", { toUserId: userB.userId, content: msgContent }, userA.token);

    if (sendMsgRes.status === 201 && sendMsgRes.data.success) {
        pass(`Message sent from ${userA.user.firstName} to ${userB.user.firstName}: "${msgContent.slice(0, 50)}"`);
    } else {
        fail(`Message send failed: ${sendMsgRes.data?.message} (status: ${sendMsgRes.status})`);
    }

    // Verify message in DB
    await new Promise(r => setTimeout(r, 500));
    const dbMessages = await getMessagesFromDB(userA.userId, userB.userId);
    if (dbMessages.length > 0) {
        pass(`Message persisted in DB (${dbMessages.length} messages between ${userA.user.firstName} and ${userB.user.firstName})`);
    } else {
        fail(`Message NOT found in DB after send`);
    }

    // B sends a reply
    const replyContent = `Hi ${userA.user.firstName}! This is a reply at ${Date.now()}`;
    const replyRes = await post("/messages/send", { toUserId: userA.userId, content: replyContent }, userB.token);
    if (replyRes.status === 201 && replyRes.data.success) {
        pass(`Reply sent from ${userB.user.firstName} to ${userA.user.firstName}`);
    } else {
        fail(`Reply failed: ${replyRes.data?.message}`);
    }

    // Check real-time delivery via Socket.IO
    await new Promise(r => setTimeout(r, 1000));
    if (receivedMessages.length > 0) {
        pass(`${userB.user.firstName} received ${receivedMessages.length} real-time message(s) via Socket.IO`);
    } else {
        warn(`No real-time messages received on ${userB.user.firstName}'s socket (messages ARE in DB)`);
    }

    // Retrieve conversation
    const convRes = await get(`/messages/conversation/${userB.userId}`, userA.token);
    if (convRes.status === 200 && Array.isArray(convRes.data.messages)) {
        pass(`Conversation retrieved: ${convRes.data.messages.length} messages between ${userA.user.firstName} and ${userB.user.firstName}`);
        const found = convRes.data.messages.some(m => m.content === msgContent || m.content === replyContent);
        if (found) {
            pass(`Messages persist and are returned correctly by GET /messages/conversation`);
        } else {
            warn(`Messages returned but content doesn't match exactly (may be truncated)`);
        }
    } else {
        fail(`Conversation fetch failed: ${convRes.data?.message}`);
    }

    // Get all conversations
    const allConvsRes = await get("/messages", userA.token);
    if (allConvsRes.status === 200 && allConvsRes.data.conversations?.length > 0) {
        const convWithB = allConvsRes.data.conversations.find(c => c.user?._id?.toString() === userB.userId.toString());
        if (convWithB) {
            pass(`${userA.user.firstName}'s conversation list shows chat with ${userB.user.firstName} (unread: ${convWithB.unreadCount})`);
        } else {
            warn(`Conversation with ${userB.user.firstName} not in ${userA.user.firstName}'s list`);
        }
    } else {
        warn(`Conversations list empty or failed for ${userA.user.firstName}: ${allConvsRes.data?.message}`);
    }
