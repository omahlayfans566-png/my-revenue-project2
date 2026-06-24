import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const connectDB = async () => {
    const uri = process.env.MONGODB_URI;

    // Guard: if the URI still has the placeholder, warn and skip
    if (!uri || uri.includes("YOUR_USERNAME") || uri.includes("YOUR_PASSWORD")) {
        console.warn("⚠️  MongoDB URI not configured yet.");
        console.warn("   Open backend/.env and set MONGODB_URI to your MongoDB Atlas connection string.");
        console.warn("   Get a free Atlas cluster at: https://www.mongodb.com/atlas");
        console.warn("   The server will run but all database operations will fail.");
        return;
    }

    try {
        const conn = await mongoose.connect(uri);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        // Do NOT call process.exit() — let the server keep running
        // so the frontend gets proper JSON error responses instead of "Failed to fetch"
        console.warn("   Server will continue running. API calls requiring the database will return 503.");
    }
};
