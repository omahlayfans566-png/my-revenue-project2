export const requestLogger = (req, _res, next) => {
    if (process.env.NODE_ENV !== "production") {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
};
