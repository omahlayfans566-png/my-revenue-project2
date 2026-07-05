import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AppNavbar from "../component/AppNavbar";
import { searchAPI } from "../services/apiService";
import { useSocket } from "../context/SocketContext";
import Skeleton from "../component/Skeleton";
import "../style/search.css";

interface SearchUser {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
    age?: number;
    city?: string;
    country?: string;
    occupation?: string;
    education?: string;
    interests?: string[];
    aboutMe?: string;
    isPremium?: boolean;
    isVerified?: boolean;
    lastLogin?: string;
}

const Search = () => {
    const navigate = useNavigate();
    const { onlineUsers } = useSocket();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const doSearch = useCallback(async (q: string, p: number, append: boolean) => {
        if (q.trim().length < 2) {
            setResults([]);
            setSearched(false);
            return;
        }

        setLoading(true);
        setSearched(true);
        try {
            const res = await searchAPI.search(q, p, 20);
            const users = res.users || [];
            if (append) {
                setResults(prev => [...prev, ...users]);
            } else {
                setResults(users);
            }
            setTotal(res.pagination?.total || 0);
            setHasMore(users.length >= 20 && p < (res.pagination?.pages || 1));
        } catch {
            if (!append) setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPage(1);
            doSearch(val, 1, false);
        }, 400);
    };

    const handleLoadMore = () => {
        const next = page + 1;
        setPage(next);
        doSearch(query, next, true);
    };

    const initials = (u: SearchUser) => `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();

    return (
        <div className="page-wrapper">
            <AppNavbar />
            <div className="search-page">
                <div className="search-header">
                    <h1>Search</h1>
                    <p>Find people by name, username, occupation, or interests</p>
                </div>

                <div className="search-input-wrap">
                    <span className="search-input-icon">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="search-input"
                        placeholder="Search for people…"
                        value={query}
                        onChange={handleInputChange}
                        aria-label="Search users"
                    />
                    {query && (
                        <button className="search-clear-btn" onClick={() => { setQuery(""); setResults([]); setSearched(false); inputRef.current?.focus(); }}>
                            ✕
                        </button>
                    )}
                </div>

                {total > 0 && (
                    <p className="search-results-count">{total} result{total !== 1 ? "s" : ""} found</p>
                )}

                <div className="search-results">
                    {loading && results.length === 0 ? (
                        <div className="search-skeleton-grid">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="search-skeleton-card">
                                    <Skeleton height={180} borderRadius={12} />
                                    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                                        <Skeleton width="60%" height={18} />
                                        <Skeleton width="40%" height={14} />
                                        <Skeleton width="80%" height={14} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : !searched ? (
                        <div className="search-empty-initial">
                            <div className="search-empty-icon">🔍</div>
                            <h3>Search for people</h3>
                            <p>Type a name, username, or interest to find people</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="search-empty">
                            <div className="search-empty-icon">😕</div>
                            <h3>No results found</h3>
                            <p>Try a different search term</p>
                        </div>
                    ) : (
                        <motion.div className="search-grid" layout>
                            <AnimatePresence>
                                {results.map((u, i) => (
                                    <motion.div
                                        key={u._id}
                                        className="search-card"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        onClick={() => navigate(`/profile/${u._id}`)}
                                    >
                                        <div className="search-card-photo">
                                            {u.profilePicture ? (
                                                <img src={u.profilePicture} alt={u.firstName} loading="lazy" />
                                            ) : (
                                                <div className="search-card-ph">{initials(u)}</div>
                                            )}
                                            {onlineUsers.has(u._id) && <span className="search-online-dot" />}
                                            {u.isPremium && <span className="search-premium-badge">✨</span>}
                                            {u.isVerified && <span className="search-verified-badge">✓</span>}
                                        </div>
                                        <div className="search-card-info">
                                            <h3>{u.firstName} {u.lastName}</h3>
                                            <p className="search-card-username">@{u.username}</p>
                                            {u.age && <p className="search-card-age">{u.age} years old</p>}
                                            {(u.city || u.country) && (
                                                <p className="search-card-loc">📍 {[u.city, u.country].filter(Boolean).join(", ")}</p>
                                            )}
                                            {u.occupation && <p className="search-card-occ">💼 {u.occupation}</p>}
                                            {u.education && <p className="search-card-edu">🎓 {u.education.replace("_", " ")}</p>}
                                            {u.interests && u.interests.length > 0 && (
                                                <div className="search-card-interests">
                                                    {u.interests.slice(0, 3).map(t => (
                                                        <span key={t} className="search-tag">{t}</span>
                                                    ))}
                                                    {u.interests.length > 3 && <span className="search-tag-more">+{u.interests.length - 3}</span>}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {hasMore && (
                        <div className="search-load-more">
                            <button className="btn btn-outline" onClick={handleLoadMore} disabled={loading}>
                                {loading ? "Loading…" : "Load More"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Search;