import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dateclone_jwt_secret_dev";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dateclone_refresh_secret_dev";

// ── Token generation ──────────────────────────────────────────────────────────

/** Short-lived access token — 7 days */
export const generateToken = (userId) =>
    jwt.sign({ userId, type: "access" }, JWT_SECRET, { expiresIn: "7d" });

/** Long-lived refresh token — 30 days */
export const generateRefreshToken = (userId) =>
    jwt.sign({ userId, type: "refresh" }, JWT_REFRESH_SECRET, { expiresIn: "30d" });

// ── Access token guard ────────────────────────────────────────────────────────
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "No token provided. Please log in." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Session expired. Please log in again.",
                code: "TOKEN_EXPIRED",
            });
        }
        return res.status(403).json({
            success: false,
            message: "Invalid token. Please log in again.",
            code: "TOKEN_INVALID",
        });
    }
};

// ── Refresh token guard ───────────────────────────────────────────────────────
export const verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
        if (decoded.type !== "refresh") throw new Error("Not a refresh token");
        return decoded;
    } catch {
        return null;
    }
};
