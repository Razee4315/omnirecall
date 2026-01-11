import { useState, useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { providers } from "../../stores/appStore";
import { SpinnerIcon, CheckIcon, AlertIcon, RefreshIcon, TrashIcon } from "../icons";

interface IndexStats {
    chunk_count: number;
    indexed: boolean;
}

interface SearchResult {
    document_name: string;
    content: string;
    score: number;
    chunk_index: number;
}

export function RagDebugPanel() {
    const [stats, setStats] = useState<IndexStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [testQuery, setTestQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const geminiProvider = providers.value.find(p => p.id === "gemini" && p.apiKey);

    const loadStats = async () => {
        setLoading(true);
        try {
            const result = await invoke<IndexStats>("get_index_stats");
            setStats(result);
            setError(null);
        } catch (e: any) {
            setError(e?.message || "Failed to load stats");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!testQuery.trim()) return;
        if (!geminiProvider?.apiKey) {
            setError("Gemini API key required for semantic search");
            return;
        }
        setSearching(true);
        setError(null);
        try {
            const results = await invoke<SearchResult[]>("semantic_search", {
                query: testQuery,
                provider: "gemini",
                apiKey: geminiProvider.apiKey,
                topK: 5,
            });
            setSearchResults(results);
        } catch (e: any) {
            setError(e?.message || "Search failed");
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    const handleClearIndex = async () => {
        if (!confirm("Clear all indexed documents?")) return;
        try {
            await invoke("clear_index");
            setStats({ chunk_count: 0, indexed: false });
            setSearchResults([]);
        } catch (e: any) {
            setError(e?.message || "Failed to clear");
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    return (
        <div className="p-3 bg-bg-secondary rounded-lg border border-border space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-text-primary">Index Status</h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={loadStats}
                        disabled={loading}
                        className="p-1.5 hover:bg-bg-tertiary rounded transition-colors text-text-tertiary hover:text-text-primary"
                        title="Refresh"
                    >
                        <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={handleClearIndex}
                        className="p-1.5 hover:bg-error/20 rounded transition-colors text-text-tertiary hover:text-error"
                        title="Clear Index"
                    >
                        <TrashIcon size={14} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-bg-tertiary rounded-lg">
                    <div className="text-xs text-text-tertiary">Indexed Chunks</div>
                    <div className="text-xl font-bold text-text-primary">
                        {loading ? <SpinnerIcon size={16} className="animate-spin" /> : stats?.chunk_count || 0}
                    </div>
                </div>
                <div className="p-3 bg-bg-tertiary rounded-lg">
                    <div className="text-xs text-text-tertiary">Status</div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                        {stats?.indexed ? (
                            <>
                                <CheckIcon size={14} className="text-success" />
                                <span className="text-success">Ready</span>
                            </>
                        ) : (
                            <>
                                <AlertIcon size={14} className="text-warning" />
                                <span className="text-warning">No Data</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Test Query */}
            <div className="space-y-2">
                <label className="text-xs text-text-tertiary">Test Semantic Search</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={testQuery}
                        onInput={(e) => setTestQuery((e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Enter a test query..."
                        className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary outline-none focus:border-accent-primary"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={searching || !testQuery.trim()}
                        className="px-3 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                        {searching ? <SpinnerIcon size={14} className="animate-spin" /> : "Search"}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-2 bg-error/20 border border-error/30 rounded text-xs text-error">
                    {error}
                </div>
            )}

            {/* Results */}
            {searchResults.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs text-text-tertiary">Results ({searchResults.length})</div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                        {searchResults.map((result, i) => (
                            <div key={i} className="p-2 bg-bg-tertiary rounded border border-border">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-accent-primary">{result.document_name}</span>
                                    <span className="text-xs text-text-tertiary">
                                        Score: {(result.score * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className="text-xs text-text-secondary line-clamp-2">{result.content}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info */}
            <div className="text-xs text-text-tertiary">
                Requires Gemini API key. 512 token chunks.
            </div>
        </div>
    );
}
