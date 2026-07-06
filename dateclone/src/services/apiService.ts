/**
 * API Service - Frontend to Backend Communication
 * All requests include JWT token from localStorage
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://dateclone-backend.onrender.com/api";

// Helper to get auth token (internal use only)
const _getToken = (): string | null => sessionStorage.getItem("authToken");

// Helper function for API requests with auth
const apiCall = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };

    const token = _getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    } catch {
        // Network-level failure — server is completely unreachable
        throw new Error(
            "Cannot reach the server. Make sure the backend is running " +
            "(open a terminal in /backend and run: npm run dev)."
        );
    }

    // Parse JSON — works for both success and error responses
    let body: any = {};
    try {
        body = await response.json();
    } catch {
        // Non-JSON response — translate HTTP status codes into human messages
        const statusMessages: Record<number, string> = {
            502: "Backend server is not running. Open a terminal in /backend and run: npm run dev",
            503: "Server is temporarily unavailable. Please try again in a moment.",
            504: "Request timed out. Make sure the backend server is running.",
            500: "Internal server error. Check the backend terminal for details.",
            404: "API endpoint not found. Make sure the backend server is running.",
        };
        const msg = statusMessages[response.status]
            ?? `Unexpected server response (status ${response.status}). Make sure the backend is running.`;
        throw new Error(msg);
    }

    if (!response.ok) {
        // Surface the server's own message directly — includes DB-not-connected, validation errors etc.
        throw new Error(body.message || `Request failed (${response.status})`);
    }

    return body;
};

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

export const authAPI = {
    register: async <T extends object>(formData: T) => {
        return apiCall("/auth/register", {
            method: "POST",
            body: JSON.stringify(formData),
        });
    },

    verifyEmail: async (email: string, token: string) => {
        return apiCall("/auth/verify-email", {
            method: "POST",
            body: JSON.stringify({ email, token }),
        });
    },

    verifyOtp: async (email: string, otp: string) => {
        return apiCall("/auth/verify-otp", {
            method: "POST",
            body: JSON.stringify({ email, otp }),
        });
    },

    resendVerification: async (email: string) => {
        return apiCall("/auth/resend-verification", {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    },

    login: async (email: string, password: string) => {
        return apiCall("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
    },

    getCurrentUser: async () => {
        return apiCall("/auth/me");
    },

    logout: () => {
        sessionStorage.removeItem("authToken");
        sessionStorage.removeItem("user");
    },
};

// ============================================
// PROFILE ENDPOINTS
// ============================================

export const profileAPI = {
    getProfile: async (userId: string) => {
        return apiCall(`/profile/${userId}`);
    },

    updateProfile: async (userId: string, profileData: object) => {
        return apiCall(`/profile/${userId}`, {
            method: "PUT",
            body: JSON.stringify(profileData),
        });
    },

    uploadPhoto: async (userId: string, photoUrl: string) => {
        return apiCall(`/profile/${userId}/photo`, {
            method: "POST",
            body: JSON.stringify({ photoUrl }),
        });
    },

    getAllProfiles: async (filters: Record<string, any> = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiCall(`/profile${queryParams ? `?${queryParams}` : ""}`);
    },

    reportUser: async (userId: string, reason: string) => {
        return apiCall(`/profile/${userId}/report`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        });
    },

    updatePrivacy: async (userId: string, settings: object) => {
        return apiCall(`/profile/${userId}/privacy`, {
            method: "PUT",
            body: JSON.stringify(settings),
        });
    },
};

// ============================================
// MATCHING ENDPOINTS
// ============================================

export const matchAPI = {
    getSuggestions: async () => apiCall("/matches/suggestions"),

    superLikeUser: async (likedUserId: string) =>
        apiCall("/matches/superlike", { method: "POST", body: JSON.stringify({ likedUserId }) }),

    likeUser: async (likedUserId: string) =>
        apiCall("/matches/like", { method: "POST", body: JSON.stringify({ likedUserId }) }),

    passUser: async (passedUserId: string) =>
        apiCall("/matches/pass", { method: "POST", body: JSON.stringify({ passedUserId }) }),

    getMatches: async () => apiCall("/matches/my-matches"),

    getLikesReceived: async () => apiCall("/matches/likes-received"),

    blockUser: async (blockedUserId: string) =>
        apiCall("/matches/block", { method: "POST", body: JSON.stringify({ blockedUserId }) }),

    unmatchUser: async (unmatchedUserId: string) =>
        apiCall("/matches/unmatch", { method: "POST", body: JSON.stringify({ unmatchedUserId }) }),

    getRecentlyJoined: async () => apiCall("/matches/recently-joined"),
    getRecentlyActive: async () => apiCall("/matches/recently-active"),
    getNearby: async () => apiCall("/matches/nearby"),
    getOnline: async () => apiCall("/matches/online"),
    getCompatibility: async (userId: string) => apiCall(`/matches/compatibility/${userId}`),
    getMemberCount: async () => apiCall("/matches/count"),
};

// ============================================
// MESSAGE ENDPOINTS
// ============================================

export const messageAPI = {
    sendMessage: async (toUserId: string, content: string, image: string | null = null, replyTo?: string) => {
        return apiCall("/messages/send", {
            method: "POST",
            body: JSON.stringify({ toUserId, content, image, replyTo }),
        });
    },

    getConversation: async (otherUserId: string, page: number = 1, limit: number = 50) => {
        return apiCall(
            `/messages/conversation/${otherUserId}?page=${page}&limit=${limit}`
        );
    },

    getAllConversations: async (search?: string) => {
        const query = search ? `?search=${encodeURIComponent(search)}` : "";
        return apiCall(`/messages${query}`);
    },

    deleteMessage: async (messageId: string) => {
        return apiCall(`/messages/${messageId}`, {
            method: "DELETE",
        });
    },

    reactToMessage: async (messageId: string, reaction: string) => {
        return apiCall(`/messages/react/${messageId}`, {
            method: "POST",
            body: JSON.stringify({ reaction }),
        });
    },

    searchMessages: async (q: string) => {
        return apiCall(`/messages/search?q=${encodeURIComponent(q)}`);
    },
};

// ============================================
// PAYMENT ENDPOINTS
// ============================================

export const paymentAPI = {
    getPricingPlans: async () => {
        return apiCall("/payment/pricing");
    },

    createPaymentIntent: async (tier: string, duration: number = 1) => {
        return apiCall("/payment/create-intent", {
            method: "POST",
            body: JSON.stringify({ tier, duration }),
        });
    },

    confirmPayment: async (paymentIntentId: string, tier: string, duration: number = 1) => {
        return apiCall("/payment/confirm", {
            method: "POST",
            body: JSON.stringify({ paymentIntentId, tier, duration }),
        });
    },

    getPremiumStatus: async () => {
        return apiCall("/payment/status");
    },

    cancelPremium: async () => {
        return apiCall("/payment/cancel", {
            method: "POST",
        });
    },
};

// ============================================
// PREMIUM ENDPOINTS (Paystack)
// ============================================

export const premiumAPI = {
    getPricing: async () => apiCall("/premium/pricing"),

    initializePaystack: async (plan: string, durationDays: number = 30, isYearly: boolean = false) =>
        apiCall("/premium/initialize-paystack", {
            method: "POST",
            body: JSON.stringify({ plan, durationDays, isYearly }),
        }),

    verifyPaystack: async (reference: string, plan: string, durationDays: number = 30, trxref?: string, isYearly: boolean = false) =>
        apiCall("/premium/verify-paystack", {
            method: "POST",
            body: JSON.stringify({ reference, plan, durationDays, trxref, isYearly }),
        }),

    getStatus: async () => apiCall("/premium/status"),

    cancel: async () =>
        apiCall("/premium/cancel", { method: "POST" }),

    reactivate: async () =>
        apiCall("/premium/reactivate", { method: "POST" }),

    getHistory: async () => apiCall("/premium/history"),

    requestRefund: async (paymentId: string, reason: string) =>
        apiCall("/premium/request-refund", {
            method: "POST",
            body: JSON.stringify({ paymentId, reason }),
        }),

    boost: async () =>
        apiCall("/premium/boost", { method: "POST" }),

    getBoostStatus: async () => apiCall("/premium/boost-status"),

    getAnalytics: async () => apiCall("/premium/analytics"),
};

// ============================================
// SEARCH ENDPOINTS
// ============================================

export const searchAPI = {
    search: async (q: string, page: number = 1, limit: number = 20) => {
        const params = new URLSearchParams({ q, page: String(page), limit: String(limit) });
        return apiCall(`/search?${params.toString()}`);
    },
};

// ============================================
// NOTIFICATION ENDPOINTS
// ============================================

export const notificationAPI = {
    getNotifications: async (page: number = 1, limit: number = 20) => {
        return apiCall(`/notifications?page=${page}&limit=${limit}`);
    },

    getUnreadCount: async () => {
        return apiCall("/notifications/unread-count");
    },

    markAsRead: async (notificationId: string) => {
        return apiCall(`/notifications/${notificationId}/read`, {
            method: "PUT",
        });
    },

    markAllAsRead: async () => {
        return apiCall("/notifications/read-all", {
            method: "PUT",
        });
    },

    deleteNotification: async (notificationId: string) => {
        return apiCall(`/notifications/${notificationId}`, {
            method: "DELETE",
        });
    },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const setAuthToken = (token: string) => {
    sessionStorage.setItem("authToken", token);
};

export const getAuthToken = (): string | null => {
    return sessionStorage.getItem("authToken");
};

export const isAuthenticated = (): boolean => {
    return !!getAuthToken();
};

export const saveUserToLocal = (user: object) => {
    sessionStorage.setItem("user", JSON.stringify(user));
};

export const getUserFromLocal = () => {
    const user = sessionStorage.getItem("user");
    return user ? JSON.parse(user) : null;
};

export const clearAuthData = () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("user");
};

// ============================================
// ADMIN ENDPOINTS
// ============================================

export const adminAPI = {
    // Dashboard
    getDashboard: async () => apiCall("/admin/dashboard"),

    // Users
    getUsers: async (params: Record<string, string | number> = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.set(key, String(value));
        });
        return apiCall(`/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
    },

    getUser: async (userId: string) => apiCall(`/admin/users/${userId}`),

    changeUserRole: async (userId: string, role: string) =>
        apiCall(`/admin/users/${userId}/role`, {
            method: "PATCH",
            body: JSON.stringify({ role }),
        }),

    suspendUser: async (userId: string, reason: string, durationHours: number = 24) =>
        apiCall(`/admin/users/${userId}/suspend`, {
            method: "POST",
            body: JSON.stringify({ reason, durationHours }),
        }),

    unsuspendUser: async (userId: string) =>
        apiCall(`/admin/users/${userId}/unsuspend`, { method: "POST" }),

    banUser: async (userId: string, reason: string) =>
        apiCall(`/admin/users/${userId}/ban`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        }),

    unbanUser: async (userId: string) =>
        apiCall(`/admin/users/${userId}/unban`, { method: "POST" }),

    deleteUser: async (userId: string) =>
        apiCall(`/admin/users/${userId}`, { method: "DELETE" }),

    // Reports
    getReports: async (params: Record<string, string | number> = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.set(key, String(value));
        });
        return apiCall(`/admin/reports${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
    },

    reviewReport: async (reportId: string, data: Record<string, any>) =>
        apiCall(`/admin/reports/${reportId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        }),

    // Announcements
    getAnnouncements: async (params: Record<string, string | number> = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.set(key, String(value));
        });
        return apiCall(`/admin/announcements${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
    },

    createAnnouncement: async (data: Record<string, any>) =>
        apiCall("/admin/announcements", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    // Subscriptions
    getSubscriptions: async (params: Record<string, string | number> = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.set(key, String(value));
        });
        return apiCall(`/admin/subscriptions${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
    },

    // Logs
    getLogs: async (params: Record<string, string | number> = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.set(key, String(value));
        });
        return apiCall(`/admin/logs${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
    },

    // Flagged Content
    getFlaggedContent: async (params: Record<string, string | number> = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.set(key, String(value));
        });
        return apiCall(`/admin/flagged-content${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
    },

    moderateContent: async (userId: string, data: Record<string, any>) =>
        apiCall(`/admin/flagged-content/${userId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        }),

    // Analytics
    getAnalytics: async () => apiCall("/admin/analytics"),

    // User actions
    grantPremium: async (userId: string, tier: string = "gold", durationDays: number = 30) =>
        apiCall(`/admin/users/${userId}/grant-premium`, {
            method: "POST",
            body: JSON.stringify({ tier, durationDays }),
        }),

    revokePremium: async (userId: string) =>
        apiCall(`/admin/users/${userId}/revoke-premium`, { method: "POST" }),

    forceLogout: async (userId: string) =>
        apiCall(`/admin/users/${userId}/force-logout`, { method: "POST" }),

    manualVerify: async (userId: string) =>
        apiCall(`/admin/users/${userId}/verify`, { method: "POST" }),

    sendPasswordReset: async (userId: string) =>
        apiCall(`/admin/users/${userId}/reset-password`, { method: "POST" }),

    editUser: async (userId: string, data: Record<string, any>) =>
        apiCall(`/admin/users/${userId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        }),

    // Email delivery status
    getEmailStatus: async () => apiCall("/admin/email/status"),

    sendTestEmail: async (to: string) =>
        apiCall("/admin/email/test", {
            method: "POST",
            body: JSON.stringify({ to }),
        }),
};

// ============================================
// DISCOVERY ENDPOINTS
// ============================================

export const discoveryAPI = {
    getUsers: async (filters: Record<string, any> = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                queryParams.set(key, String(value));
            }
        });
        return apiCall(`/discover${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
    },

    getFilters: async () => apiCall("/discover/filters"),

    updateLocation: async (latitude: number, longitude: number) =>
        apiCall("/discover/location", {
            method: "POST",
            body: JSON.stringify({ latitude, longitude }),
        }),
};

export default {
    authAPI,
    profileAPI,
    matchAPI,
    messageAPI,
    paymentAPI,
    notificationAPI,
    adminAPI,
    discoveryAPI,
};
