/**
 * API Service - Frontend to Backend Communication
 * All requests include JWT token from localStorage
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://my-revenue-project2.onrender.com/api";

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

    login: async (email: string, password: string, rememberMe: boolean = false) => {
        return apiCall("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password, rememberMe }),
        });
    },

    verify2FA: async (userId: string, otp: string, tempToken?: string) => {
        return apiCall("/auth/verify-2fa", {
            method: "POST",
            body: JSON.stringify({ userId, otp, tempToken }),
        });
    },

    getCurrentUser: async () => {
        return apiCall("/auth/me");
    },

    refreshToken: async (refreshToken: string) => {
        return apiCall("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
        });
    },

    logout: async (refreshToken?: string) => {
        try {
            if (refreshToken) {
                await apiCall("/auth/logout", {
                    method: "POST",
                    body: JSON.stringify({ refreshToken }),
                });
            }
        } catch { /* ignore */ }
        sessionStorage.removeItem("authToken");
        sessionStorage.removeItem("refreshToken");
        sessionStorage.removeItem("user");
    },

    logoutAll: async () => {
        return apiCall("/auth/logout-all", { method: "POST" });
    },

    changePassword: async (currentPassword: string, newPassword: string) => {
        return apiCall("/auth/change-password", {
            method: "POST",
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    },

    forgotPassword: async (email: string) => {
        return apiCall("/auth/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    },

    resetPassword: async (token: string, password: string) => {
        return apiCall("/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({ token, password }),
        });
    },

    changeEmail: async (newEmail: string) => {
        return apiCall("/auth/change-email", {
            method: "POST",
            body: JSON.stringify({ newEmail }),
        });
    },

    confirmEmailChange: async (token: string) => {
        return apiCall("/auth/confirm-email-change", {
            method: "POST",
            body: JSON.stringify({ token }),
        });
    },

    enable2FA: async () => {
        return apiCall("/auth/enable-2fa", { method: "POST" });
    },

    confirmEnable2FA: async (otp: string) => {
        return apiCall("/auth/confirm-enable-2fa", {
            method: "POST",
            body: JSON.stringify({ otp }),
        });
    },

    disable2FA: async (password: string) => {
        return apiCall("/auth/disable-2fa", {
            method: "POST",
            body: JSON.stringify({ password }),
        });
    },

    getSessions: async () => {
        return apiCall("/auth/sessions");
    },

    removeSession: async (token: string) => {
        return apiCall(`/auth/sessions/${encodeURIComponent(token)}`, {
            method: "DELETE",
        });
    },

    getLoginHistory: async (page: number = 1) => {
        return apiCall(`/auth/login-history?page=${page}`);
    },

    getActivityLog: async (page: number = 1) => {
        return apiCall(`/auth/activity-log?page=${page}`);
    },

    deleteAccount: async (password: string) => {
        return apiCall("/auth/delete-account", {
            method: "DELETE",
            body: JSON.stringify({ password }),
        });
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
    sendMessage: async (toUserId: string, content: string, image: string | null = null, options: Record<string, any> = {}) => {
        return apiCall("/messages/send", {
            method: "POST",
            body: JSON.stringify({ toUserId, content, image, ...options }),
        });
    },

    getConversation: async (otherUserId: string, page: number = 1, limit: number = 50) => {
        return apiCall(
            `/messages/conversation/${otherUserId}?page=${page}&limit=${limit}`
        );
    },

    getAllConversations: async (search?: string, includeArchived?: boolean) => {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (includeArchived) params.set("includeArchived", "true");
        const query = params.toString() ? `?${params.toString()}` : "";
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

    forwardMessage: async (messageId: string, targetUserId: string) => {
        return apiCall("/messages/forward", {
            method: "POST",
            body: JSON.stringify({ messageId, targetUserId }),
        });
    },

    pinConversation: async (targetUserId: string, pinned: boolean) => {
        return apiCall("/messages/pin", {
            method: "POST",
            body: JSON.stringify({ targetUserId, pinned }),
        });
    },

    archiveConversation: async (targetUserId: string, archived: boolean) => {
        return apiCall("/messages/archive", {
            method: "POST",
            body: JSON.stringify({ targetUserId, archived }),
        });
    },

    getMediaGallery: async (otherUserId: string, page: number = 1, limit: number = 20) => {
        return apiCall(`/messages/media/${otherUserId}?page=${page}&limit=${limit}`);
    },

    searchMessages: async (q: string, page: number = 1, limit: number = 30) => {
        return apiCall(`/messages/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`);
    },

    exportChatBackup: async () => {
        return apiCall("/messages/export/backup");
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

    // Analytics
    getDetailedAnalytics: async () => apiCall("/admin/analytics/detailed"),

    // Revenue
    getRevenue: async () => apiCall("/admin/revenue"),

    // Permanent delete
    permanentDeleteUser: async (userId: string) =>
        apiCall(`/admin/users/${userId}/permanent`, { method: "DELETE" }),

    // Restore user
    restoreUser: async (userId: string) =>
        apiCall(`/admin/users/${userId}/restore`, { method: "POST" }),

    // Deleted users
    getDeletedUsers: async (params: Record<string, string | number> = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.set(key, String(value));
        });
        return apiCall(`/admin/users/deleted/list${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
    },

    // Chat moderation
    getChatMessages: async (params: Record<string, string | number> = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.set(key, String(value));
        });
        return apiCall(`/admin/chat/messages${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
    },

    deleteChatMessage: async (messageId: string, reason: string = "") =>
        apiCall(`/admin/chat/messages/${messageId}`, {
            method: "DELETE",
            body: JSON.stringify({ reason }),
        }),

    warnChatUser: async (messageId: string, reason: string = "") =>
        apiCall(`/admin/chat/messages/${messageId}/warn`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        }),

    // Image moderation
    getFlaggedPhotos: async (params: Record<string, string | number> = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.set(key, String(value));
        });
        return apiCall(`/admin/images/flagged${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
    },

    removePhoto: async (userId: string, photoIndex: number, reason: string = "") =>
        apiCall(`/admin/images/${userId}/${photoIndex}`, {
            method: "DELETE",
            body: JSON.stringify({ reason }),
        }),

    flagUserPhotos: async (userId: string, reason: string = "") =>
        apiCall(`/admin/images/${userId}/flag`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        }),

    // Push notifications
    sendPushNotification: async (data: Record<string, any>) =>
        apiCall("/admin/push", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    // Admin roles & permissions
    getRoles: async () => apiCall("/admin/roles"),

    updateRolePermissions: async (role: string, permissions: string[]) =>
        apiCall(`/admin/roles/${role}`, {
            method: "PUT",
            body: JSON.stringify({ permissions }),
        }),

    getRolePermissions: async (role: string) =>
        apiCall(`/admin/roles/${role}/permissions`),

    // Profile moderation
    getFlaggedProfiles: async (params: Record<string, string | number> = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.set(key, String(value));
        });
        return apiCall(`/admin/profiles/flagged${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
    },

    moderateProfile: async (userId: string, data: Record<string, any>) =>
        apiCall(`/admin/profiles/${userId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        }),

    // Broadcast
    broadcastAnnouncement: async (data: Record<string, any>) =>
        apiCall("/admin/broadcast", {
            method: "POST",
            body: JSON.stringify(data),
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

// ============================================
// MEDIA ENDPOINTS
// ============================================

export const mediaAPI = {
    getPhotos: async () => apiCall("/media/photos"),
    getUserPhotos: async (userId: string) => apiCall(`/media/photos/${userId}`),
    uploadPhoto: async (photoData: object) =>
        apiCall("/media/photos/upload", {
            method: "POST",
            body: JSON.stringify(photoData),
        }),
    deletePhoto: async (photoId: string) =>
        apiCall(`/media/photos/${photoId}`, { method: "DELETE" }),
    setProfilePicture: async (photoId: string) =>
        apiCall(`/media/photos/${photoId}/set-profile`, { method: "POST" }),
    setCoverPhoto: async (photoId: string) =>
        apiCall(`/media/photos/${photoId}/set-cover`, { method: "POST" }),
    reorderPhotos: async (photoIds: string[]) =>
        apiCall("/media/photos/reorder", {
            method: "POST",
            body: JSON.stringify({ photoIds }),
        }),
    getAlbums: async () => apiCall("/media/albums"),
    getUserAlbums: async (userId: string) => apiCall(`/media/albums/${userId}`),
    createAlbum: async (albumData: object) =>
        apiCall("/media/albums", {
            method: "POST",
            body: JSON.stringify(albumData),
        }),
    addPhotoToAlbum: async (albumId: string, photoId: string) =>
        apiCall(`/media/albums/${albumId}/photos`, {
            method: "POST",
            body: JSON.stringify({ photoId }),
        }),
    removePhotoFromAlbum: async (albumId: string, photoId: string) =>
        apiCall(`/media/albums/${albumId}/photos/${photoId}`, { method: "DELETE" }),
    unlockAlbum: async (albumId: string) =>
        apiCall(`/media/albums/${albumId}/unlock`, { method: "POST" }),
    deleteAlbum: async (albumId: string) =>
        apiCall(`/media/albums/${albumId}`, { method: "DELETE" }),
};

// ============================================
// COIN ENDPOINTS
// ============================================

export const coinAPI = {
    getWallet: async () => apiCall("/coins/wallet"),
    getBalance: async () => apiCall("/coins/balance"),
    getTransactions: async (page: number = 1) =>
        apiCall(`/coins/transactions?page=${page}`),
    getPackages: async () => apiCall("/coins/packages"),
    purchase: async (packageIndex: number) =>
        apiCall("/coins/purchase", {
            method: "POST",
            body: JSON.stringify({ packageIndex }),
        }),
    verify: async (reference: string) =>
        apiCall("/coins/verify", {
            method: "POST",
            body: JSON.stringify({ reference }),
        }),
};

// ============================================
// GIFT ENDPOINTS
// ============================================

export const giftAPI = {
    getCatalog: async () => apiCall("/gifts/catalog"),
    sendGift: async (toUserId: string, giftName: string, options: object = {}) =>
        apiCall("/gifts/send", {
            method: "POST",
            body: JSON.stringify({ toUserId, giftName, ...options }),
        }),
    getReceived: async (page: number = 1) =>
        apiCall(`/gifts/received?page=${page}`),
    getSent: async (page: number = 1) =>
        apiCall(`/gifts/sent?page=${page}`),
};

// ============================================
// REFERRAL ENDPOINTS
// ============================================

export const referralAPI = {
    getCode: async () => apiCall("/referrals/code"),
    generateCode: async () =>
        apiCall("/referrals/code/generate", { method: "POST" }),
    useCode: async (code: string) =>
        apiCall("/referrals/use", {
            method: "POST",
            body: JSON.stringify({ code }),
        }),
    getAnalytics: async () => apiCall("/referrals/analytics"),
    getGlobalStats: async () => apiCall("/referrals/global-stats"),
};

// ============================================
// STORY ENDPOINTS
// ============================================

export const safetyAPI = {
    getCategories: async () => apiCall("/safety/categories"),
    getTips: async () => apiCall("/safety/tips"),
    reportUser: async (reportedUserId: string, category: string, description: string = "") =>
        apiCall("/safety/report", {
            method: "POST",
            body: JSON.stringify({ reportedUserId, category, description }),
        }),
    checkFakeProfile: async () =>
        apiCall("/safety/check-fake", { method: "POST" }),
    checkDuplicates: async () =>
        apiCall("/safety/check-duplicates", { method: "POST" }),
    blockUser: async (userId: string) =>
        apiCall(`/safety/block/${userId}`, { method: "POST" }),
    unblockUser: async (userId: string) =>
        apiCall(`/safety/unblock/${userId}`, { method: "POST" }),
    getBlocked: async () => apiCall("/safety/blocked"),
};

export const matchingAPI = {
    getRecommendations: async (limit?: number) => {
        const query = limit ? `?limit=${limit}` : "";
        return apiCall(`/matching/recommendations${query}`);
    },
    getSuggested: async (limit?: number) => {
        const query = limit ? `?limit=${limit}` : "";
        return apiCall(`/matching/suggested${query}`);
    },
    getNearby: async (maxDistance?: number, limit?: number) => {
        const params = new URLSearchParams();
        if (maxDistance) params.set("maxDistance", String(maxDistance));
        if (limit) params.set("limit", String(limit));
        const query = params.toString() ? `?${params.toString()}` : "";
        return apiCall(`/matching/nearby${query}`);
    },
    getTrending: async (limit?: number) => {
        const query = limit ? `?limit=${limit}` : "";
        return apiCall(`/matching/trending${query}`);
    },
    getRecentlyJoined: async (limit?: number) => {
        const query = limit ? `?limit=${limit}` : "";
        return apiCall(`/matching/recently-joined${query}`);
    },
    getMostActive: async (limit?: number) => {
        const query = limit ? `?limit=${limit}` : "";
        return apiCall(`/matching/most-active${query}`);
    },
    getPersonalized: async (limit?: number) => {
        const query = limit ? `?limit=${limit}` : "";
        return apiCall(`/matching/personalized${query}`);
    },
    getCompatibility: async (targetUserId: string) => {
        return apiCall(`/matching/compatibility/${targetUserId}`);
    },
};

export const storyAPI = {
    getStories: async () => apiCall("/stories"),
    getMyStories: async () => apiCall("/stories/my"),
    getUserStories: async (userId: string) => apiCall(`/stories/user/${userId}`),
    createStory: async (storyData: object) =>
        apiCall("/stories/create", {
            method: "POST",
            body: JSON.stringify(storyData),
        }),
    viewStory: async (storyId: string) =>
        apiCall(`/stories/${storyId}/view`, { method: "POST" }),
    reactToStory: async (storyId: string, reaction: string) =>
        apiCall(`/stories/${storyId}/react`, {
            method: "POST",
            body: JSON.stringify({ reaction }),
        }),
    replyToStory: async (storyId: string, message: string) =>
        apiCall(`/stories/${storyId}/reply`, {
            method: "POST",
            body: JSON.stringify({ message }),
        }),
    deleteStory: async (storyId: string) =>
        apiCall(`/stories/${storyId}`, { method: "DELETE" }),
    getArchived: async () => apiCall("/stories/archived"),
    archiveStory: async (storyId: string) =>
        apiCall(`/stories/${storyId}/archive`, { method: "POST" }),
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
    mediaAPI,
    coinAPI,
    giftAPI,
    referralAPI,
    storyAPI,
};
