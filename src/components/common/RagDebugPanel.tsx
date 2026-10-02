import { useState, useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { documents, providers, refreshDocumentStatus } from "../../stores/appStore";
import { confirmAction } from "../../stores/confirmStore";
import { errorMessage } from "../../lib/errors";
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

/// Developer view of the document search index: size, a test query, and a
/// way to clear it.
export function RagDebugPanel() {
    const [stats, setStats] = useState<IndexStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [testQuery, setTestQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const geminiKey = providers.value.find(p => p.id === "gemini")?.apiKey ?? "";

    const loadStats = async () => {
        setLoading(true);
        try {
            setStats(await invoke<IndexStats>("get_index_stats"));
            setError(null);
        } catch (e) {
            setError(errorMessage(e, "Failed to load index statistics"));
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!testQuery.trim()) return;
        if (!geminiKey) {
            setError("A Gemini API key is required for semantic search.");
            return;
        }
        setSearching(true);
        setError(null);
        try {
            const results = await invoke<SearchResult[]>("semantic_search", {
                query: testQuery,
                apiKey: geminiKey,
                documentIds: documents.value.map(d => d.id),
                topK: 5,
            });
            setSearchResults(results);
        } catch (e) {
            setError(errorMessage(e, "Search failed"));
            setSearchResults(null);
        } finally {
            setSearching(false);
        }
    };

    const handleClearIndex = async () => {
        const confirmed = await confirmAction({
            title: "Clear the search index?",
            message: "Documents stay attached and can be re-indexed from the Docs tab.",
            confirmLabel: "Clear index",
            danger: true,
        });
        if (!confirmed) return;
        try {
            await invoke("clear_index");
            setStats({ chunk_count: 0, indexed: false });
            setSearchResults(null);
            void refreshDocumentStatus();
        } catch (e) {
            setError(errorMessage(e, "Failed to clear the index"));
        }
    };

    useEffect(() => {
        void loadStats();
    }, []);

    return (
        <div className="p-3 bg-bg-secondary rounded-lg border border-border space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-text-primary">Document search index</h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => void loadStats()}
                        disabled={loading}
                        className="p-1.5 hover:bg-bg-tertiary rounded transition-colors text-text-tertiary hover:text-text-primary"
                        title="Refresh"
                        aria-label="Refresh index statistics"
                    >
                        <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => void handleClearIndex()}
                        className="p-1.5 hover:bg-error/20 rounded transition-colors text-text-tertiary hover:text-error"
                        title="Clear index"
                        aria-label="Clear index"
                    >
                        <TrashIcon size={14} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-bg-tertiary rounded-lg">
                    <div className="text-xs text-text-tertiary">Indexed chunks</div>
                    <div className="text-xl font-bold text-text-primary">
                        {loading ? <SpinnerIcon size={16} /> : stats?.chunk_count ?? 0}
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
                                <span className="text-warning">Empty</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="rag-test-query" className="text-xs text-text-tertiary">Test a search over attached documents</label>
                <div className="flex gap-2">
                    <input
                        id="rag-test-query"
                        type="text"
                        value={testQuery}
                        onInput={(e) => setTestQuery((e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void handleSearch();
                        }}
                        placeholder="Enter a test query..."
                        className="flex-1 min-w-0 px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary outline-none focus:border-accent-primary"
                    />
                    <button
                        onClick={() => void handleSearch()}
                        disabled={searching || !testQuery.trim()}
                        className="px-3 py-2 bg-accent-primary text-on-accent rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                        {searching ? <SpinnerIcon size={14} /> : "Search"}
                    </button>
                </div>
            </div>

            {error && (
                <div className="selectable p-2 bg-error/10 border border-error/30 rounded text-xs text-error" role="alert">
                    {error}
                </div>
            )}

            {searchResults !== null && (
                <div className="space-y-2">
                    <div className="text-xs text-text-tertiary">
                        {searchResults.length === 0 ? "No matching chunks" : `Results (${searchResults.length})`}
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                        {searchResults.map((result) => (
                            <div key={`${result.document_name}-${result.chunk_index}`} className="p-2 bg-bg-tertiary rounded border border-border">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-accent-primary truncate">{result.document_name}</span>
                                    <span className="text-xs text-text-tertiary flex-shrink-0">
                                        Score: {(result.score * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className="selectable text-xs text-text-secondary line-clamp-2">{result.content}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="text-xs text-text-tertiary">
                Indexing uses Gemini embeddings and needs a Gemini API key. Documents are split into ~512-token chunks.
            </div>
        </div>
    );
}
