import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";
import {
    authAPI,
    getAuthToken,
    setAuthToken,
    saveUserToLocal,
    getUserFromLocal,
    clearAuthData,
} from "../services/apiService";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    displayName?: string;
    profilePicture?: string;
    coverPhoto?: string;
    isPremium?: boolean;
    premiumTier?: string;
    premiumExpires?: string;
    isMember?: boolean;
    isActive?: boolean;
    isVerified?: boolean;
    role?: string;
    isAdmin?: boolean;
    memberSince?: string;
    profileCompletion?: number;
    emailVerified?: boolean;
    twoFactorEnabled?: boolean;
    // Full profile fields
    aboutMe?: string;
    occupation?: string;
    education?: string;
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    age?: number;
    dateOfBirth?: string;
    gender?: string;
    lookingFor?: string;
    religion?: string;
    tribe?: string;
    religionImportance?: string;
    relationshipGoal?: string;
    relationshipValue?: string;
    hasChildren?: string;
    wantsChildren?: string;
    smoking?: string;
    drinking?: string;
    hobbies?: string[];
    height?: number;
    weight?: number;
    zodiacSign?: string;
    personalityType?: string;
    favoriteMusic?: string[];
    favoriteMovies?: string[];
    favoriteSports?: string[];
    pets?: string;
    lifestyle?: string;
    minAge?: number;
    maxAge?: number;
    preferredCountry?: string;
    preferredDistance?: string;
    interests?: string[];
    languages?: string[];
    photos?: string[];
    // Allow any extra fields
    [key: string]: unknown;
}

interface AuthContextValue {
    user: AuthUser | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (email: string, password: string, rememberMe?: boolean) => Promise<any>;
    logout: () => Promise<void>;
    logoutAll: () => Promise<void>;
    refreshUser: () => Promise<void>;
    updateLocalUser: (updates: Partial<AuthUser>) => void;
    verify2FA: (userId: string, otp: string) => Promise<void>;
    requires2FA: boolean;
    pendingUserId: string | null;
    pendingTempToken: string | null;
    cancel2FA: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<AuthUser | null>(getUserFromLocal());
    const [loading, setLoading] = useState(true);
    const [requires2FA, setRequires2FA] = useState(false);
    const [pendingUserId, setPendingUserId] = useState<string | null>(null);
    const [pendingTempToken, setPendingTempToken] = useState<string | null>(null);

    // On mount: validate stored token against the server
    useEffect(() => {
        const init = async () => {
            const token = getAuthToken();
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const res = await authAPI.getCurrentUser();
                setUser(res.user);
                saveUserToLocal(res.user);
            } catch (err: any) {
                const msg = (err.message || "").toLowerCase();
                const isAuthError =
                    msg.includes("invalid token") ||
                    msg.includes("no token") ||
                    msg.includes("unauthorized") ||
                    msg.includes("403") ||
                    msg.includes("401");
                if (isAuthError) {
                    clearAuthData();
                    setUser(null);
                }
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const login = useCallback(async (email: string, password: string, rememberMe: boolean = false) => {
        const res = await authAPI.login(email, password, rememberMe);

        // Check if 2FA is required
        if (res.requires2FA) {
            setRequires2FA(true);
            setPendingUserId(res.userId);
            setPendingTempToken(res.tempToken);
            return { requires2FA: true };
        }

        setAuthToken(res.token);
        if (res.refreshToken) {
            sessionStorage.setItem("refreshToken", res.refreshToken);
        }
        saveUserToLocal(res.user);
        setUser(res.user);
        return { requires2FA: false, user: res.user };
    }, []);

    const verify2FA = useCallback(async (userId: string, otp: string) => {
        const res = await authAPI.verify2FA(userId, otp, pendingTempToken || undefined);
        setAuthToken(res.token);
        if (res.refreshToken) {
            sessionStorage.setItem("refreshToken", res.refreshToken);
        }
        saveUserToLocal(res.user);
        setUser(res.user);
        setRequires2FA(false);
        setPendingUserId(null);
        setPendingTempToken(null);
    }, [pendingTempToken]);

    const cancel2FA = useCallback(() => {
        setRequires2FA(false);
        setPendingUserId(null);
        setPendingTempToken(null);
    }, []);

    const logout = useCallback(async () => {
        const refreshToken = sessionStorage.getItem("refreshToken");
        try {
            await authAPI.logout(refreshToken || undefined);
        } catch { /* silent */ }
        clearAuthData();
        sessionStorage.removeItem("refreshToken");
        setUser(null);
        setRequires2FA(false);
        setPendingUserId(null);
        setPendingTempToken(null);
    }, []);

    const logoutAll = useCallback(async () => {
        try {
            await authAPI.logoutAll();
        } catch { /* silent */ }
        clearAuthData();
        sessionStorage.removeItem("refreshToken");
        setUser(null);
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const res = await authAPI.getCurrentUser();
            setUser(res.user);
            saveUserToLocal(res.user);
            return res.user;
        } catch {
            logout();
            return null;
        }
    }, [logout]);

    const updateLocalUser = useCallback((updates: Partial<AuthUser>) => {
        setUser((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, ...updates };
            saveUserToLocal(updated);
            return updated;
        });
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                loading,
                login,
                logout,
                logoutAll,
                refreshUser,
                updateLocalUser,
                verify2FA,
                requires2FA,
                pendingUserId,
                pendingTempToken,
                cancel2FA,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};