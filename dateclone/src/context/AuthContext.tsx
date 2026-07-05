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
    profilePicture?: string;
    isPremium?: boolean;
    premiumTier?: string;
    premiumExpires?: string;
    isMember?: boolean;
    isActive?: boolean;
    role?: string;
    isAdmin?: boolean;
    memberSince?: string;
    profileCompletion?: number;
    emailVerified?: boolean;
    // Full profile fields — populated after /auth/me or profile update
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
    religionImportance?: string;
    relationshipGoal?: string;
    relationshipValue?: string;
    hasChildren?: string;
    wantsChildren?: string;
    smoking?: string;
    drinking?: string;
    minAge?: number;
    maxAge?: number;
    preferredCountry?: string;
    preferredDistance?: string;
    interests?: string[];
    languages?: string[];
    photos?: string[];
    // Allow any extra fields returned by the backend without TS errors
    [key: string]: unknown;
}

interface AuthContextValue {
    user: AuthUser | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    updateLocalUser: (updates: Partial<AuthUser>) => void;
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
                // Only clear auth on a genuine 401/403 (invalid/expired token).
                // Keep the user logged in if the server/DB is simply unreachable.
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
                // Otherwise: keep cached user from sessionStorage so the app still
                // works while the server is starting up or DB is connecting.
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // ── Automatic logout on tab close / refresh / navigate away ──────────
    // sessionStorage is cleared when the browser tab is closed, but it
    // persists across page reloads (F5).  The beforeunload handler clears
    // auth data just before the page unloads, so on the next page load
    // the token is gone and the user is redirected to login.
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (getAuthToken()) {
                clearAuthData();
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const res = await authAPI.login(email, password);
        setAuthToken(res.token);
        saveUserToLocal(res.user);
        setUser(res.user);
    }, []);

    const logout = useCallback(() => {
        clearAuthData();
        setUser(null);
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const res = await authAPI.getCurrentUser();
            setUser(res.user);
            saveUserToLocal(res.user);
        } catch {
            logout();
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
                refreshUser,
                updateLocalUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
