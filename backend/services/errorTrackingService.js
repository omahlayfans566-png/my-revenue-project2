/**
 * errorTrackingService.js
 *
 * Error tracking and reporting service.
 * Captures errors with context, categorizes them, and provides
 * structured error reporting for debugging and monitoring.
 */

import logger from "./loggingService.js";

class ErrorTracker {
    constructor() {
        this.errorCounts = new Map();
        this.recentErrors = [];
        this.maxRecentErrors = 100;
        this.startTime = Date.now();
    }

    /**
     * Track an error with context
     * @param {Error} error
     * @param {Object} context - Additional context (userId, route, etc.)
     */
    trackError(error, context = {}) {
        const errorKey = error.name || "UnknownError";
        const currentCount = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, currentCount + 1);

        const errorEntry = {
            timestamp: new Date().toISOString(),
            name: error.name,
            message: error.message,
            stack: error.stack?.split("\n").slice(0, 5).join("\n"), // First 5 lines
            code: error.code,
            statusCode: error.statusCode || error.status || 500,
            ...context,
        };

        // Keep recent errors bounded
        this.recentErrors.unshift(errorEntry);
        if (this.recentErrors.length > this.maxRecentErrors) {
            this.recentErrors.pop();
        }

        // Log based on severity
        const statusCode = errorEntry.statusCode;
        if (statusCode >= 500) {
            logger.error(`[${errorKey}] ${error.message}`, errorEntry);
        } else if (statusCode >= 400) {
            logger.warn(`[${errorKey}] ${error.message}`, errorEntry);
        } else {
            logger.info(`[${errorKey}] ${error.message}`, errorEntry);
        }

        return errorEntry;
    }

    /**
     * Get error statistics
     */
    getStats() {
        const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);
        return {
            totalErrors,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            errorsByType: Object.fromEntries(this.errorCounts),
            recentErrors: this.recentErrors.slice(0, 10),
        };
    }

    /**
     * Get recent errors
     */
    getRecentErrors(limit = 10) {
        return this.recentErrors.slice(0, limit);
    }

    /**
     * Reset error counts
     */
    reset() {
        this.errorCounts.clear();
        this.recentErrors = [];
    }
}

export const errorTracker = new ErrorTracker();

// ─── Express error tracking middleware ─────────────────────────────────────
export const errorTrackingMiddleware = (err, req, res, next) => {
    errorTracker.trackError(err, {
        userId: req.user?.userId,
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userAgent: req.headers["user-agent"]?.substring(0, 100),
    });
    next(err);
};

// ─── Application error types ──────────────────────────────────────────────

export class AppError extends Error {
    constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message = "Validation failed", details = []) {
        super(message, 400, "VALIDATION_ERROR");
        this.name = "ValidationError";
        this.details = details;
    }
}

export class AuthenticationError extends AppError {
    constructor(message = "Authentication required") {
        super(message, 401, "AUTHENTICATION_ERROR");
        this.name = "AuthenticationError";
    }
}

export class AuthorizationError extends AppError {
    constructor(message = "Insufficient permissions") {
        super(message, 403, "AUTHORIZATION_ERROR");
        this.name = "AuthorizationError";
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Resource not found") {
        super(message, 404, "NOT_FOUND");
        this.name = "NotFoundError";
    }
}

export class RateLimitError extends AppError {
    constructor(message = "Too many requests") {
        super(message, 429, "RATE_LIMIT_ERROR");
        this.name = "RateLimitError";
    }
}

export default errorTracker;