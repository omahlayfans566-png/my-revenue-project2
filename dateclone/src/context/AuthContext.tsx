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
    isMember?: boolean;
    isActive?: boolean;
    memberSince?: string;
    profileCompletion?: number;
    emailVerified?: boolean;
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

    // On mount: validate stored token
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
            } catch {
                clearAuthData();
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        init();
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
