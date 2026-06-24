/**
 * API Service - Frontend to Backend Communication
 * All requests include JWT token from localStorage
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Helper function to get auth token
const getAuthToken = () => {
    return localStorage.getItem("authToken");
};

// Helper function for API requests with auth
const apiCall = async (endpoint, options = {}) => {
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    // Add token if available
    const token = getAuthToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "API request failed");
    }

    return response.json();
};

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

export const authAPI = {
    register: async (formData) => {
        return apiCall("/auth/register", {
            method: "POST",
            body: JSON.stringify(formData),
        });
    },

    verifyEmail: async (token) => {
        return apiCall("/auth/verify-email", {
            method: "POST",
            body: JSON.stringify({ token }),
        });
    },

    resendVerification: async (email) => {
        return apiCall("/auth/resend-verification", {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    },

    login: async (email, password) => {
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
    getProfile: async (userId) => {
        return apiCall(`/profile/${userId}`);
    },

    updateProfile: async (userId, profileData) => {
        return apiCall(`/profile/${userId}`, {
            method: "PUT",
            body: JSON.stringify(profileData),
        });
    },

    uploadPhoto: async (userId, photoUrl) => {
        return apiCall(`/profile/${userId}/photo`, {
            method: "POST",
            body: JSON.stringify({ photoUrl }),
        });
    },

    getAllProfiles: async (filters = {}) => {
        const queryParams = new URLSearchParams(filters);
        return apiCall(`/profile?${queryParams}`);
    },
};

// ============================================
// MATCHING ENDPOINTS
// ============================================

export const matchAPI = {
    getSuggestions: async () => {
        return apiCall("/matches/suggestions");
    },

    likeUser: async (likedUserId) => {
        return apiCall("/matches/like", {
            method: "POST",
            body: JSON.stringify({ likedUserId }),
        });
    },

    passUser: async (passedUserId) => {
        return apiCall("/matches/pass", {
            method: "POST",
            body: JSON.stringify({ passedUserId }),
        });
    },

    getMatches: async () => {
        return apiCall("/matches/my-matches");
    },

    getLikesReceived: async () => {
        return apiCall("/matches/likes-received");
    },

    blockUser: async (blockedUserId) => {
        return apiCall("/matches/block", {
            method: "POST",
            body: JSON.stringify({ blockedUserId }),
        });
    },
};

// ============================================
// MESSAGE ENDPOINTS
// ============================================

export const messageAPI = {
    sendMessage: async (toUserId, content, image = null) => {
        return apiCall("/messages/send", {
            method: "POST",
            body: JSON.stringify({ toUserId, content, image }),
        });
    },

    getConversation: async (otherUserId, page = 1, limit = 50) => {
        return apiCall(
            `/messages/conversation/${otherUserId}?page=${page}&limit=${limit}`
        );
    },

    getAllConversations: async () => {
        return apiCall("/messages");
    },

    deleteMessage: async (messageId) => {
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

    createPaymentIntent: async (tier, duration = 1) => {
        return apiCall("/payment/create-intent", {
            method: "POST",
            body: JSON.stringify({ tier, duration }),
        });
    },

    confirmPayment: async (paymentIntentId, tier, duration = 1) => {
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

export const setAuthToken = (token) => {
    localStorage.setItem("authToken", token);
};

export const getAuthToken = () => {
    return localStorage.getItem("authToken");
};

export const isAuthenticated = () => {
    return !!getAuthToken();
};

export const saveUserToLocal = (user) => {
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
    setAuthToken,
    getAuthToken,
    isAuthenticated,
    saveUserToLocal,
    getUserFromLocal,
    clearAuthData,
};
