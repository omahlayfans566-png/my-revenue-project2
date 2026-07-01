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

export const connectDB = async () => {
    const uri = process.env.MONGODB_URI;
    const fallbackUri = process.env.MONGODB_URI_DIRECT || process.env.MONGODB_FALLBACK_URI;

    if (!uri) {
        throw new Error("MONGODB_URI is not set in backend/.env");
    }

    console.log("\nConnecting to MongoDB Atlas...");
    console.log(`Primary URI: ${redactMongoUri(uri)}`);

    let connection;
    try {
        connection = await mongoose.connect(uri, CONNECTION_OPTIONS);
    } catch (error) {
        const isSrvError =
            error?.message?.includes("querySrv") || error?.message?.includes("ECONNREFUSED");

        if (isSrvError && fallbackUri) {
            console.warn("Primary MongoDB URI failed during SRV lookup. Retrying with fallback direct URI...");
            console.warn(`Fallback URI: ${redactMongoUri(fallbackUri)}`);
            connection = await mongoose.connect(fallbackUri, CONNECTION_OPTIONS);
        } else {
            if (isSrvError) {
                console.error(
                    "MongoDB SRV DNS lookup failed. Use a direct MongoDB URI in MONGODB_URI or set MONGODB_URI_DIRECT."
                );
            }
            throw error;
        }
    }

    const { host, name } = connection.connection;

    await connection.connection.db.admin().ping();

    const pingCollection = connection.connection.db.collection("_startup_checks");
    await pingCollection.updateOne(
        { _id: "mongoose-connection" },
        { $set: { ok: true, checkedAt: new Date() } },
        { upsert: true }
    );

    console.log(`MongoDB connected: ${host}`);
    console.log(`Database: ${name}`);
    console.log("Mongoose ping and write check passed.\n");

    return connection;
};

mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected.");
});

export const isMongoConnected = () => mongoose.connection.readyState === 1;
