/**
 * securityMiddleware.js
 *
 * Enhanced security middleware for production:
 *   - XSS protection (input sanitization)
 *   - CSRF token validation
 *   - Request size limiting
 *   - SQL injection prevention (via mongoose)
 *   - Security headers
 *   - Input validation helpers
 */

import helmet from "helmet";
import { AppError } from "../services/errorTrackingService.js";

// ─── XSS Protection: Sanitize user input ──────────────────────────────────
const XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /on\w+\s*=\s*["'][^"']*["']/gi,
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
];

export const sanitizeInput = (value) => {
    if (typeof value === "string") {
        let sanitized = value;
        for (const pattern of XSS_PATTERNS) {
            sanitized = sanitized.replace(pattern, "");
        }
        // Strip HTML tags
        sanitized = sanitized.replace(/<[^>]*>/g, "");
        return sanitized.trim();
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeInput);
    }
    if (value && typeof value === "object") {
        const sanitized = {};
        for (const [key, val] of Object.entries(value)) {
            sanitized[key] = sanitizeInput(val);
        }
        return sanitized;
    }
    return value;
};

// ─── XSS Protection Middleware ─────────────────────────────────────────────
export const xssProtection = (req, _res, next) => {
    if (req.body) {
        req.body = sanitizeInput(req.body);
    }
    if (req.query) {
        req.query = sanitizeInput(req.query);
    }
    if (req.params) {
        req.params = sanitizeInput(req.params);
    }
    next();
};

// ─── CSRF Protection ──────────────────────────────────────────────────────
// Simple token-based CSRF protection
const CSRF_TOKEN_HEADER = "x-csrf-token";

export const csrfProtection = (req, res, next) => {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return next();
    }

    // Skip CSRF for webhook endpoints
    if (req.path?.includes("webhook")) {
        return next();
    }

    // For API routes, validate CSRF token from header
    const csrfToken = req.headers[CSRF_TOKEN_HEADER];
    const sessionToken = req.session?.csrfToken;

    // If no session token exists, generate one (first request)
    if (!sessionToken) {
        if (!req.session) req.session = {};
        req.session.csrfToken = generateCSRFToken();
        return next();
    }

    // Validate token for state-changing requests
    if (csrfToken && csrfToken === sessionToken) {
        return next();
    }

    // In API-only mode, we use token-based auth which is inherently CSRF-safe
    // Skip CSRF check for authenticated API requests
    if (req.headers.authorization?.startsWith("Bearer ")) {
        return next();
    }

    // For cookie-based sessions, require CSRF token
    if (req.session?.userId) {
        return next(new AppError("CSRF token validation failed", 403, "CSRF_ERROR"));
    }

    next();
};

const generateCSRFToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
};

// ─── Security Headers Configuration ───────────────────────────────────────
export const securityHeaders = helmet({
    // Content Security Policy
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "http://res.cloudinary.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https://res.cloudinary.com", "wss://dateclone-backend.onrender.com"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
        },
    },
    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false,
    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: { policy: "same-origin" },
    // HTTP Strict Transport Security
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
    // Prevent MIME type sniffing
    nosniff: true,
    // Prevent clickjacking
    frameguard: { action: "deny" },
    // XSS Filter (legacy)
    xssFilter: true,
    // Referrer Policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

// ─── Request Size Limiting ────────────────────────────────────────────────
export const requestSizeLimiter = (maxSize = "10mb") => {
    return (err, _req, res, next) => {
        if (err.type === "entity.too.large") {
            return res.status(413).json({
                success: false,
                message: `Request body too large. Maximum size is ${maxSize}.`,
            });
        }
        next(err);
    };
};

// ─── Input Validation Helpers ─────────────────────────────────────────────
export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const validatePassword = (password) => {
    if (!password || password.length < 8) return false;
    if (password.length > 128) return false;
    return true;
};

function escapeHtml(text) {
    if (!text) return "";
    const amp = String.fromCharCode(38) + "amp;";
    const lt = String.fromCharCode(38) + "lt;";
    const gt = String.fromCharCode(38) + "gt;";
    const quot = String.fromCharCode(38) + "quot;";
    const apos = String.fromCharCode(38) + "#x27;";
    const sol = String.fromCharCode(38) + "#x2F;";
    const map = {
        [String.fromCharCode(38)]: amp,
        [String.fromCharCode(60)]: lt,
        [String.fromCharCode(62)]: gt,
        [String.fromCharCode(34)]: quot,
        [String.fromCharCode(39)]: apos,
        [String.fromCharCode(47)]: sol,
    };
    const reg = new RegExp("[" + String.fromCharCode(38, 60, 62, 34, 39, 47) + "]", "g");
    return text.replace(reg, (m) => map[m]);
}
export { escapeHtml as sanitizeHtml };

export default {
    xssProtection,
    csrfProtection,
    securityHeaders,
    requestSizeLimiter,
    sanitizeInput,
    validateEmail,
    validatePassword,
    sanitizeHtml,
};