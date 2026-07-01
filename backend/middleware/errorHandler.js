export const errorHandler = (err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    console.error(`[Error ${status}]`, err.message);
    res.status(status).json({
        success: false,
        message: process.env.NODE_ENV === "production"
            ? "Something went wrong"
            : err.message || "Internal Server Error",
    });
};
