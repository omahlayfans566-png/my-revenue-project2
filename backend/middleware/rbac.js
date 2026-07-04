/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Usage:
 *   - authorize("admin")          → only admins and super_admins
 *   - authorize("super_admin")    → only super_admins
 *   - authorize("moderator")      → moderators, admins, and super_admins
 */

const ROLE_HIERARCHY = {
    user: 0,
    moderator: 1,
    admin: 2,
    super_admin: 3,
};

/**
 * Middleware factory — returns a middleware that checks if the authenticated
 * user has at least the required role level.
 */
export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        // `authenticateToken` must run before this middleware
        if (!req.user || !req.user.userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        // req.user.role is set by the route handler after fetching from DB,
        // OR it can be embedded in the JWT if we choose. For now we fetch
        // the user in the route and attach role to req.user.
        // This middleware expects req.user.role to be populated.
        if (!req.user.role) {
            return res.status(403).json({
                success: false,
                message: "Access denied. No role assigned.",
            });
        }

        const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
        const minLevel = Math.min(
            ...allowedRoles.map((r) => ROLE_HIERARCHY[r] ?? 0)
        );

        if (userLevel < minLevel) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Insufficient permissions.",
            });
        }

        next();
    };
};

/**
 * Middleware that loads the user from DB and attaches role + full user doc to req.
 * Place after authenticateToken and before authorize.
 */
export const loadUser = async (req, res, next) => {
    try {
        const { User } = await import("../models/User.js");
        const user = await User.findById(req.user.userId).select(
            "role isAdmin isBanned isActive email firstName lastName username profilePicture"
        );
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }
        if (user.isBanned) {
            return res.status(403).json({
                success: false,
                message: "Account suspended.",
            });
        }
        req.user.role = user.role;
        req.userDoc = user;
        next();
    } catch (err) {
        console.error("[loadUser]", err);
        return res.status(500).json({
            success: false,
            message: "Failed to load user.",
        });
    }
};

/**
 * Check if user has a specific role (utility function for use in route handlers).
 */
export const hasRole = (userRole, requiredRole) => {
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const reqLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
    return userLevel >= reqLevel;
};

export default { authorize, loadUser, hasRole };