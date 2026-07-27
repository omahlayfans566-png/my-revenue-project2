/**
 * Global Error Handler - Production Safe
 * NEVER exposes stack traces, internal server details, or database errors
 */

export const errorHandler = (err, _req, res, _next) => {
    // Handle JSON parse errors (malformed request body)
    if (err.type === "entity.parse.failed" || (err instanceof SyntaxError && err.status === 400 && "body" in err)) {
        return res.status(400).json({
            success: false,
            message: "Invalid request data. Please check your input and try again.",
        });
    }

    // Handle request entity too large
    if (err.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            message: "The uploaded file is too large. Please reduce the file size and try again.",
        });
    }

    // Handle multer/file upload errors
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
            success: false,
            message: "The uploaded file exceeds the maximum allowed size (10MB).",
        });
    }

    // Handle MongoDB errors gracefully
    if (err.name === "MongoError" || err.name === "MongoServerError") {
        console.error("[Database Error]", err.message);
        return res.status(500).json({
            success: false,
            message: "We're experiencing a temporary issue. Please try again shortly.",
        });
    }

    // Handle Mongoose validation errors
    if (err.name === "ValidationError") {
        return res.status(400).json({
            success: false,
            message: "Some required information is missing or invalid. Please check your input.",
        });
    }

    // Handle CastError (invalid ObjectId, etc.)
    if (err.name === "CastError") {
        return res.status(400).json({
            success: false,
            message: "Invalid request parameter.",
        });
    }

    const status = err.status || err.statusCode || 500;

    // Log for debugging but never expose to client
    console.error(`[Error ${status}]`, err.message);
    if (process.env.NODE_ENV !== "production") {
        console.error("   Stack:", err.stack?.split("\n").slice(0, 3).join("\n   "));
    }

    // Production-safe messages only - no stack traces, no internal details
    const friendlyMessages = {
        400: "We couldn't process your request. Please check your input.",
        401: "Please log in to continue.",
        403: "You don't have permission to perform this action.",
        404: "The requested resource was not found.",
        409: "This action conflicts with the current state. Please try again.",
        413: "The uploaded content is too large.",
        429: "Too many requests. Please wait a moment and try again.",
        500: "We're experiencing a temporary issue. Please try again shortly.",
        502: "Our service is temporarily unavailable. Please try again later.",
        503: "Our service is temporarily unavailable. Please try again later.",
    };

    // Custom error messages from our app (they're already safe)
    const message = err.isUserFriendly
        ? err.message
        : friendlyMessages[status] || "Something went wrong. Please try again.";

    res.status(status).json({
        success: false,
        message,
    });
};