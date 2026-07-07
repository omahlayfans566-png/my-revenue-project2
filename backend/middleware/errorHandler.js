export const errorHandler = (err, _req, res, _next) => {
    // Handle JSON parse errors (malformed request body)
    if (err.type === "entity.parse.failed" || err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON in request body",
        });
    }

    // Handle request entity too large
    if (err.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            message: "Request body too large",
        });
    }

    // Handle multer/file upload errors
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
            success: false,
            message: "File too large. Maximum size is 10MB.",
        });
    }

    const status = err.status || err.statusCode || 500;
    console.error(`[Error ${status}]`, err.message);
    if (process.env.NODE_ENV !== "production") {
        console.error("   Stack:", err.stack?.split("\n").slice(0, 6).join("\n   "));
    }
    res.status(status).json({
        success: false,
        message: status === 500 && process.env.NODE_ENV === "production"
            ? "An internal server error occurred"
            : err.message || "Internal Server Error",
    });
};
