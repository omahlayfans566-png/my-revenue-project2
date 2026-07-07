/**
 * performanceMonitor.js
 *
 * Middleware for monitoring API performance:
 *   - Request duration tracking
 *   - Slow request alerts
 *   - Endpoint usage statistics
 *   - Memory usage monitoring
 */

import logger from "../services/loggingService.js";

class PerformanceMonitor {
    constructor() {
        this.stats = new Map(); // endpoint -> { count, totalTime, maxTime, minTime }
        this.slowRequests = [];
        this.maxSlowRequests = 50;
        this.slowThreshold = parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS) || 2000;
    }

    /**
     * Record a request's performance
     */
    recordRequest(method, path, durationMs, statusCode) {
        const key = `${method}:${path}`;
        const existing = this.stats.get(key) || {
            count: 0,
            totalTime: 0,
            maxTime: 0,
            minTime: Infinity,
            errors: 0,
        };

        existing.count++;
        existing.totalTime += durationMs;
        existing.maxTime = Math.max(existing.maxTime, durationMs);
        existing.minTime = Math.min(existing.minTime, durationMs);
        if (statusCode >= 500) existing.errors++;

        this.stats.set(key, existing);

        // Track slow requests
        if (durationMs > this.slowThreshold) {
            const slowEntry = {
                timestamp: new Date().toISOString(),
                method,
                path,
                durationMs: Math.round(durationMs),
                statusCode,
            };
            this.slowRequests.unshift(slowEntry);
            if (this.slowRequests.length > this.maxSlowRequests) {
                this.slowRequests.pop();
            }

            logger.warn(`Slow request: ${method} ${path} took ${Math.round(durationMs)}ms`, slowEntry);
        }
    }

    /**
     * Get performance statistics
     */
    getStats() {
        const endpointStats = [];
        for (const [key, data] of this.stats) {
            endpointStats.push({
                endpoint: key,
                count: data.count,
                avgTime: Math.round(data.totalTime / data.count),
                maxTime: Math.round(data.maxTime),
                minTime: Math.round(data.minTime === Infinity ? 0 : data.minTime),
                errors: data.errors,
                errorRate: `${((data.errors / data.count) * 100).toFixed(1)}%`,
            });
        }

        return {
            endpoints: endpointStats.sort((a, b) => b.avgTime - a.avgTime),
            slowRequests: this.slowRequests.slice(0, 10),
            totalRequests: endpointStats.reduce((sum, e) => sum + e.count, 0),
            slowThreshold: this.slowThreshold,
        };
    }

    /**
     * Reset all stats
     */
    reset() {
        this.stats.clear();
        this.slowRequests = [];
    }
}

export const performanceMonitor = new PerformanceMonitor();

// ─── Express middleware ────────────────────────────────────────────────────
export const performanceMiddleware = (req, res, next) => {
    const start = Date.now();

    // Capture the original end to intercept
    const originalEnd = res.end;
    res.end = function (...args) {
        const duration = Date.now() - start;
        performanceMonitor.recordRequest(req.method, req.originalUrl || req.url, duration, res.statusCode);
        logger.logRequest(req, res, duration);
        originalEnd.apply(this, args);
    };

    next();
};

// ─── Memory usage monitoring ──────────────────────────────────────────────
export const getMemoryUsage = () => {
    const usage = process.memoryUsage();
    return {
        rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(usage.external / 1024 / 1024)} MB`,
        uptime: `${Math.floor(process.uptime())}s`,
    };
};

export default performanceMonitor;