/**
 * Advanced Features API Service
 * Phase 4 endpoints for Who Liked Me, Visitors, Stories, AI suggestions, etc.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://dateclone-backend.onrender.com/api";

const _getToken = (): string | null => sessionStorage.getItem("authToken");

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
        throw new Error("Cannot reach the server. Make sure the backend is running.");
    }

    let body: any = {};
    try {
        body = await response.json();
    } catch {
        throw new Error(`Unexpected server response (status ${response.status})`);
    }

    if (!response.ok) {
        throw new Error(body.message || `Request failed (${response.status})`);
    }

    return body;
};

// ─── PROFILE COMPLETION ────────────────────────────────────────────────────
export const getProfileCompletion = async () => {
    return apiCall("/advanced/profile-completion");
};

// ─── VISITORS ──────────────────────────────────────────────────────────────
export const getVisitors = async (page = 1, limit = 20) => {
    return apiCall(`/advanced/visitors?page=${page}&limit=${limit}`);
};

export const getVisitorsCount = async () => {
    return apiCall("/advanced/visitors/count");
};

export const recordProfileView = async (profileOwnerId: string) => {
    return apiCall("/advanced/record-view", {
        method: "POST",
        body: JSON.stringify({ profileOwnerId }),
    });
};

// ─── WHO LIKED ME ──────────────────────────────────────────────────────────
export const getWhoLikedMe = async (page = 1, limit = 20) => {
    return apiCall(`/advanced/who-liked-me?page=${page}&limit=${limit}`);
};

// ─── AI PROFILE SUGGESTIONS ─────────────────────────────────────────────────
export const getProfileSuggestions = async () => {
    return apiCall("/advanced/profile-suggestions");
};

// ─── AI ICEBREAKERS ────────────────────────────────────────────────────────
export const getIcebreakers = async (targetUserId: string) => {
    return apiCall(`/advanced/icebreakers/${targetUserId}`);
};

// ─── SMART RECOMMENDATIONS ─────────────────────────────────────────────────
export const getSmartRecommendations = async (limit = 10) => {
    return apiCall(`/advanced/smart-recommendations?limit=${limit}`);
};

// ─── DAILY PICKS ──────────────────────────────────────────────────────────
export const getDailyPicks = async (limit = 10) => {
    return apiCall(`/advanced/daily-picks?limit=${limit}`);
};

// ─── DISTANCE FILTER ──────────────────────────────────────────────────────
export const getUsersByDistance = async (maxDistance = 50, limit = 20) => {
    return apiCall(`/advanced/by-distance?maxDistance=${maxDistance}&limit=${limit}`);
};

// ─── HEIGHT FILTER ────────────────────────────────────────────────────────
export const getUsersByHeight = async (minHeight = 100, maxHeight = 250, limit = 20) => {
    return apiCall(`/advanced/by-height?minHeight=${minHeight}&maxHeight=${maxHeight}&limit=${limit}`);
};

export const updateHeight = async (height: number) => {
    return apiCall("/advanced/height", {
        method: "PUT",
        body: JSON.stringify({ height }),
    });
};

// ─── VERIFICATION BADGE ────────────────────────────────────────────────────
export const getVerificationBadge = async (userId?: string) => {
    const endpoint = userId ? `/advanced/verification-badge/${userId}` : "/advanced/verification-badge";
    return apiCall(endpoint);
};

// ─── BLOCK LIST ──────────────────────────────────────────────────────────
export const getBlockList = async (page = 1, limit = 20) => {
    return apiCall(`/advanced/block-list?page=${page}&limit=${limit}`);
};

export const unblockUser = async (blockedUserId: string) => {
    return apiCall("/advanced/unblock", {
        method: "POST",
        body: JSON.stringify({ blockedUserId }),
    });
};

// ─── BOOST PROFILE ────────────────────────────────────────────────────────
export const boostProfile = async (durationHours = 1) => {
    return apiCall("/advanced/boost", {
        method: "POST",
        body: JSON.stringify({ durationHours }),
    });
};

export const getBoostStatus = async () => {
    return apiCall("/advanced/boost-status");
};

// ─── INCOGNITO MODE ──────────────────────────────────────────────────────
export const toggleIncognitoMode = async (enabled: boolean) => {
    return apiCall("/advanced/incognito", {
        method: "POST",
        body: JSON.stringify({ enabled }),
    });
};

export const getIncognitoStatus = async () => {
    return apiCall("/advanced/incognito-status");
};

// ─── FAKE PROFILE DETECTION ──────────────────────────────────────────────
export const analyzeFakeProfile = async (userId: string) => {
    return apiCall(`/advanced/fake-profile-analysis/${userId}`);
};

// ─── STORIES ──────────────────────────────────────────────────────────────
export const createStory = async (data: {
    mediaUrl: string;
    mediaType?: "image" | "video";
    caption?: string;
    backgroundColor?: string;
    textColor?: string;
}) => {
    return apiCall("/advanced/stories", {
        method: "POST",
        body: JSON.stringify(data),
    });
};

export const getStories = async () => {
    return apiCall("/advanced/stories");
};

export const getMyStories = async () => {
    return apiCall("/advanced/stories/my");
};

export const viewStory = async (storyId: string) => {
    return apiCall(`/advanced/stories/${storyId}/view`, {
        method: "POST",
    });
};

export const deleteStory = async (storyId: string) => {
    return apiCall(`/advanced/stories/${storyId}`, {
        method: "DELETE",
    });
};

// ─── VOICE INTRODUCTION ──────────────────────────────────────────────────
export const uploadVoiceIntroduction = async (data: {
    audioUrl: string;
    duration?: number;
    transcription?: string;
}) => {
    return apiCall("/advanced/voice-introduction", {
        method: "POST",
        body: JSON.stringify(data),
    });
};

export const getMyVoiceIntroduction = async () => {
    return apiCall("/advanced/voice-introduction");
};

export const getVoiceIntroduction = async (userId: string) => {
    return apiCall(`/advanced/voice-introduction/${userId}`);
};

export const deleteVoiceIntroduction = async () => {
    return apiCall("/advanced/voice-introduction", {
        method: "DELETE",
    });
};

export default {
    getProfileCompletion,
    getVisitors,
    getVisitorsCount,
    recordProfileView,
    getWhoLikedMe,
    getProfileSuggestions,
    getIcebreakers,
    getSmartRecommendations,
    getDailyPicks,
    getUsersByDistance,
    getUsersByHeight,
    updateHeight,
    getVerificationBadge,
    getBlockList,
    unblockUser,
    boostProfile,
    getBoostStatus,
    toggleIncognitoMode,
    getIncognitoStatus,
    analyzeFakeProfile,
    createStory,
    getStories,
    getMyStories,
    viewStory,
    deleteStory,
    uploadVoiceIntroduction,
    getMyVoiceIntroduction,
    getVoiceIntroduction,
    deleteVoiceIntroduction,
};