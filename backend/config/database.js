import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const CONNECTION_OPTIONS = {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
};

const redactMongoUri = (uri) =>
    uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:<redacted>@");

const _logAtlasHelp = (errMsg = "") => {
    console.error("   Action required:");
    if (errMsg.includes("Authentication") || errMsg.includes("bad auth")) {
        console.error("   → Wrong password. Check: cloud.mongodb.com → Security → Database Access");
    } else {
        console.error("   [1] cloud.mongodb.com → Clusters → is cluster RUNNING? (not paused)");
        console.error("   [2] Security → Network Access → 0.0.0.0/0 must be ACTIVE");
        console.error("   [3] Connect to mobile hotspot if home router blocks port 27017");
    }
    console.error("   ⚡ Server will run in memory mode until MongoDB connects.\n");
    // Auto-retry after 30 seconds
    setTimeout(() => connectDB(), 30000);
};

export const connectDB = async () => {
    const uri = process.env.MONGODB_URI;
    const fallbackUri = process.env.MONGODB_URI_DIRECT || process.env.MONGODB_FALLBACK_URI;

    if (!uri) {
        console.error("❌ MONGODB_URI is not set in backend/.env");
        return null;   // non-throwing — server continues in memory mode
    }

    console.log("\nConnecting to MongoDB Atlas...");
    console.log(`URI: ${redactMongoUri(uri)}`);

    let connection;
    try {
        connection = await mongoose.connect(uri, CONNECTION_OPTIONS);
    } catch (error) {
        const isSrvError =
            error?.message?.includes("querySrv") || error?.message?.includes("ECONNREFUSED") || error?.message?.includes("ENOTFOUND");

        if (isSrvError && fallbackUri) {
            console.warn("Primary URI failed. Trying fallback direct URI...");
            try {
                connection = await mongoose.connect(fallbackUri, CONNECTION_OPTIONS);
            } catch (fallbackErr) {
                console.error("❌ All MongoDB connection attempts failed.");
                console.error("   Error:", fallbackErr.message?.slice(0, 120));
                _logAtlasHelp(error.message);
                return null;
            }
        } else {
            console.error("❌ MongoDB connection failed.");
            console.error("   Error:", error.message?.slice(0, 120));
            _logAtlasHelp(error.message);
            return null;   // non-throwing
        }
    }

    try {
        const { host, name } = connection.connection;
        await connection.connection.db.admin().ping();
        const pingCollection = connection.connection.db.collection("_startup_checks");
        await pingCollection.updateOne(
            { _id: "mongoose-connection" },
            { $set: { ok: true, checkedAt: new Date() } },
            { upsert: true }
        );
        console.log(`✅ MongoDB connected: ${host}`);
        console.log(`   Database: ${name}`);
        console.log("   Read/Write test: PASSED — data persists permanently.\n");
        return connection;
    } catch (testErr) {
        console.warn("⚠️  MongoDB connected but read/write test failed:", testErr.message);
        return connection;
    }
};

mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  MongoDB disconnected — will auto-reconnect...");
});

mongoose.connection.on("reconnected", () => {
    console.log("✅ MongoDB reconnected successfully.");
    // Re-establish the startup ping check after reconnection
    try {
        const db = mongoose.connection.db;
        if (db) {
            db.admin().ping().then(() => {
                console.log("   Read/Write check after reconnection: PASSED");
            }).catch(() => {});
        }
    } catch {}
});

mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB connection error:", err.message?.slice(0, 120));
});

export const isMongoConnected = () => mongoose.connection.readyState === 1;
