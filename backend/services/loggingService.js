/**
 * loggingService.js
 *
 * Production-grade logging service with:
 *   - Structured JSON logs
 *   - Log levels (debug, info, warn, error)
 *   - Request/response logging
 *   - Performance tracking
 *   - Error context enrichment
 */

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
};

const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || "info"] || LOG_LEVELS.info;

const sanitizeForLogs = (data) => {
    if (!data) return data;
    const sanitized = { ...data };
    const sensitiveFields = ["password", "token", "authorization", "secret", "key", "credit_card", "ssn"];
    for (const key of Object.keys(sanitized)) {
        if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
            sanitized[key] = "[REDACTED]";
        }
    }
    return sanitized;
};

const formatLogEntry = (level, message, meta = {}) => {
    return JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...sanitizeForLogs(meta),
        pid: process.pid,
        env: process.env.NODE_ENV || "development",
    });
};

export const logger = {
    debug: (message, meta = {}) => {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.debug) {
            console.debug(formatLogEntry("debug", message, meta));
        }
    },

    info: (message, meta = {}) => {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.info) {
            console.info(formatLogEntry("info", message, meta));
        }
    },

    warn: (message, meta = {}) => {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.warn) {
            console.warn(formatLogEntry("warn", message, meta));
        }
    },

    error: (message, meta = {}) => {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.error) {
            console.error(formatLogEntry("error", message, meta));
        }
    },

    fatal: (message, meta = {}) => {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.fatal) {
            console.error(formatLogEntry("fatal", message, meta));
        }
    },

    // Log API request summary
    logRequest: (req, res, durationMs) => {
        const meta = {
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs: Math.round(durationMs),
            userId: req.user?.userId || "anonymous",
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.headers["user-agent"]?.substring(0, 100),
        };

        if (res.statusCode >= 400) {
            logger.warn(`HTTP ${res.statusCode} ${req.method} ${req.originalUrl}`, meta);
        } else {
            logger.info(`HTTP ${res.statusCode} ${req.method} ${req.originalUrl}`, meta);
        }
    },

    // Log database query performance
    logQuery: (queryName, durationMs, metadata = {}) => {
        if (durationMs > 1000) {
            logger.warn(`Slow query [${queryName}] took ${durationMs}ms`, { ...metadata, durationMs });
        } else if (durationMs > 500) {
            logger.info(`Query [${queryName}] took ${durationMs}ms`, { ...metadata, durationMs });
        }
    },
};

// ─── Performance tracking decorator ────────────────────────────────────────
export const trackPerformance = (name) => {
    return (target, propertyKey, descriptor) => {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const start = Date.now();
            try {
                const result = await originalMethod.apply(this, args);
                const duration = Date.now() - start;
                logger.logQuery(name, duration);
                return result;
            } catch (error) {
                const duration = Date.now() - start;
                logger.error(`Error in ${name} after ${duration}ms`, { error: error.message });
                throw error;
            }
        };
        return descriptor;
    };
};

export default logger;