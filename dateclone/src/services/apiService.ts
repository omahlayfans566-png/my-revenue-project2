/**
 * API Service - Frontend to Backend Communication
 * All requests include JWT token from localStorage
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Helper to get auth token (internal use only)
const _getToken = (): string | null => localStorage.getItem("authToken");

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
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
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
    sendMessage: async (toUserId: string, content: string, image: string | null = null) => {
        return apiCall("/messages/send", {
            method: "POST",
            body: JSON.stringify({ toUserId, content, image }),
        });
    },

    getConversation: async (otherUserId: string, page: number = 1, limit: number = 50) => {
        return apiCall(
            `/messages/conversation/${otherUserId}?page=${page}&limit=${limit}`
        );
    },

    getAllConversations: async () => {
        return apiCall("/messages");
    },

    deleteMessage: async (messageId: string) => {
        return apiCall(`/messages/${messageId}`, {
            method: "DELETE",
        });
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
// UTILITY FUNCTIONS
// ============================================

export const setAuthToken = (token: string) => {
    localStorage.setItem("authToken", token);
};

export const getAuthToken = (): string | null => {
    return localStorage.getItem("authToken");
};

export const isAuthenticated = (): boolean => {
    return !!getAuthToken();
};

export const saveUserToLocal = (user: object) => {
    localStorage.setItem("user", JSON.stringify(user));
};

export const getUserFromLocal = () => {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
};

export const clearAuthData = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
};

export default {
    authAPI,
    profileAPI,
    matchAPI,
    messageAPI,
    paymentAPI,
};
