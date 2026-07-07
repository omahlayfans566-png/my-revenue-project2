/**
 * cacheService.js
 *
 * In-memory caching service with TTL support.
 * Used to reduce database load for frequently accessed data.
 * Falls back gracefully if Redis is not available.
 */

class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.ttlTimers = new Map();
        this.hits = 0;
        this.misses = 0;
        this.maxSize = process.env.CACHE_MAX_SIZE ? parseInt(process.env.CACHE_MAX_SIZE) : 1000;
    }

    /**
     * Get a value from cache
     * @param {string} key
     * @returns {any} cached value or undefined
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return undefined;
        }

        // Check if expired
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.misses++;
            return undefined;
        }

        this.hits++;
        return entry.value;
    }

    /**
     * Set a value in cache with optional TTL
     * @param {string} key
     * @param {any} value
     * @param {number} ttlSeconds - Time to live in seconds
     */
    set(key, value, ttlSeconds = 300) {
        // Enforce max cache size
        if (this.cache.size >= this.maxSize) {
            // Evict oldest entry
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
                this.clearTimer(oldestKey);
            }
        }

        const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
        this.cache.set(key, { value, expiresAt });

        // Set TTL timer
        if (ttlSeconds > 0) {
            this.clearTimer(key);
            const timer = setTimeout(() => {
                this.cache.delete(key);
                this.ttlTimers.delete(key);
            }, ttlSeconds * 1000);
            timer.unref(); // Don't prevent process exit
            this.ttlTimers.set(key, timer);
        }
    }

    /**
     * Delete a key from cache
     * @param {string} key
     */
    delete(key) {
        this.cache.delete(key);
        this.clearTimer(key);
    }

    /**
     * Clear all cache entries matching a pattern
     * @param {string} pattern - e.g., "user:*" to clear all user caches
     */
    clearPattern(pattern) {
        const regex = new RegExp(pattern.replace("*", ".*"));
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.delete(key);
            }
        }
    }

    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
        for (const timer of this.ttlTimers.values()) {
            clearTimeout(timer);
        }
        this.ttlTimers.clear();
    }

    /**
     * Get or set cache value (async factory pattern)
     * @param {string} key
     * @param {Function} factory - async function to produce value if not cached
     * @param {number} ttlSeconds
     * @returns {Promise<any>}
     */
    async getOrSet(key, factory, ttlSeconds = 300) {
        const cached = this.get(key);
        if (cached !== undefined) return cached;

        const value = await factory();
        this.set(key, value, ttlSeconds);
        return value;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: this.hits + this.misses > 0
                ? `${((this.hits / (this.hits + this.misses)) * 100).toFixed(1)}%`
                : "0%",
        };
    }

    clearTimer(key) {
        const timer = this.ttlTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.ttlTimers.delete(key);
        }
    }
}

// Singleton instance
export const cache = new MemoryCache();

// ─── Cache wrapper for database queries ────────────────────────────────────
export const withCache = (queryFn, cacheKey, ttlSeconds = 300) => {
    return async (...args) => {
        const key = typeof cacheKey === "function" ? cacheKey(...args) : cacheKey;
        return cache.getOrSet(key, () => queryFn(...args), ttlSeconds);
    };
};

// ─── Predefined cache helpers ──────────────────────────────────────────────

export const userCache = {
    key: (userId) => `user:${userId}`,
    getUser: (userId) => cache.get(userCache.key(userId)),
    setUser: (userId, data) => cache.set(userCache.key(userId), data, 300),
    invalidate: (userId) => cache.delete(userCache.key(userId)),
};

export const profileCache = {
    key: (profileId) => `profile:${profileId}`,
    getProfile: (profileId) => cache.get(profileCache.key(profileId)),
    setProfile: (profileId, data) => cache.set(profileCache.key(profileId), data, 300),
    invalidate: (profileId) => cache.delete(profileCache.key(profileId)),
};

export const matchCache = {
    key: (userId) => `matches:${userId}`,
    getMatches: (userId) => cache.get(matchCache.key(userId)),
    setMatches: (userId, data) => cache.set(matchCache.key(userId), data, 120),
    invalidate: (userId) => cache.delete(matchCache.key(userId)),
};

export default cache;