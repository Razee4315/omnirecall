import { useState, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { providers } from "../../stores/appStore";
import {
    CompareIcon,
    CloseIcon,
    SpinnerIcon,
    CheckIcon,
    PlusIcon,
    CopyIcon,
    SendIcon,
} from "../icons";
import { Markdown } from "./Markdown";

interface ModelCompareProps {
    onClose: () => void;
}

interface CompareResponse {
    provider: string;
    model: string;
    content: string;
    isLoading: boolean;
    error?: string;
    startTime?: number;
    endTime?: number;
}

// Provider brand colors for visual distinction
const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    gemini: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
    openai: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
    anthropic: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
    glm: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
    ollama: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30" },
};

function getProviderColor(providerId: string) {
    return PROVIDER_COLORS[providerId] || { bg: "bg-accent-primary/10", text: "text-accent-primary", border: "border-accent-primary/30" };
}

function getWordCount(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export function ModelCompare({ onClose }: ModelCompareProps) {
    const [selectedModels, setSelectedModels] = useState<{ provider: string; model: string }[]>([]);
    const [prompt, setPrompt] = useState("");
    const [responses, setResponses] = useState<CompareResponse[]>([]);
    const [isComparing, setIsComparing] = useState(false);
    const [hasCompared, setHasCompared] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const addModel = (provider: string, model: string) => {
        if (selectedModels.length >= 4) return;
        if (selectedModels.some(m => m.provider === provider && m.model === model)) return;
        setSelectedModels([...selectedModels, { provider, model }]);
    };

    const removeModel = (index: number) => {
        setSelectedModels(selectedModels.filter((_, i) => i !== index));
    };

    const handleClear = () => {
        setResponses([]);
        setPrompt("");
        setHasCompared(false);
        textareaRef.current?.focus();
    };

    const handleCopyResponse = async (content: string) => {
        await navigator.clipboard.writeText(content);
    };

    const handleCopyAll = async () => {
        const allText = responses
            .filter(r => r.content && !r.error)
            .map(r => `## ${r.model}\n\n${r.content}`)
            .join("\n\n---\n\n");
        const full = `# Model Comparison\n\n**Prompt:** ${prompt}\n\n---\n\n${allText}`;
        await navigator.clipboard.writeText(full);
    };

    const handleCompare = async () => {
        if (!prompt.trim() || selectedModels.length < 2) return;

        setIsComparing(true);
        setHasCompared(true);
        setResponses(selectedModels.map(m => ({
            ...m,
            content: "",
            isLoading: true,
            startTime: Date.now(),
        })));

        // Process models sequentially to avoid event listener conflicts
        // (the backend emits to "chat-stream" for all requests)
        for (let index = 0; index < selectedModels.length; index++) {
            const model = selectedModels[index];
            const provider = providers.value.find(p => p.id === model.provider);

            if (!provider?.apiKey && provider?.id !== "ollama") {
                setResponses(prev => prev.map((r, i) =>
                    i === index ? { ...r, isLoading: false, error: "No API key configured", endTime: Date.now() } : r
                ));
                continue;
            }

            const modelStartTime = Date.now();

            try {
                let fullResponse = "";
                let unlisten: UnlistenFn | null = null;
                let isDone = false;

                unlisten = await listen<{ chunk: string; done: boolean }>("chat-stream", (event) => {
                    if (!event.payload.done) {
                        fullResponse += event.payload.chunk;
                        setResponses(prev => prev.map((r, i) =>
                            i === index ? { ...r, content: fullResponse } : r
                        ));
                    } else {
                        isDone = true;
                        setResponses(prev => prev.map((r, i) =>
                            i === index ? { ...r, isLoading: false, endTime: Date.now() } : r
                        ));
                    }
                });

                await invoke("send_message_stream", {
                    message: prompt,
                    history: [],
                    documents: [],
                    provider: model.provider,
                    model: model.model,
                    apiKey: provider?.apiKey || "",
                });

                let waitCount = 0;
                while (!isDone && waitCount < 100) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    waitCount++;
                }

                if (unlisten) unlisten();

                // Ensure endTime is set if stream didn't fire done
                setResponses(prev => prev.map((r, i) =>
                    i === index && r.isLoading ? { ...r, isLoading: false, endTime: Date.now() } : r
                ));

            } catch (err: any) {
                setResponses(prev => prev.map((r, i) =>
                    i === index ? { ...r, isLoading: false, error: err?.message || "Request failed", endTime: Date.now(), startTime: modelStartTime } : r
                ));
            }
        }

        setIsComparing(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleCompare();
        }
    };

    // Grid columns based on model count
    const getGridCols = () => {
        const count = Math.max(selectedModels.length, responses.length);
        if (count <= 2) return "grid-cols-1 md:grid-cols-2";
        if (count === 3) return "grid-cols-1 md:grid-cols-3";
        return "grid-cols-1 md:grid-cols-2 xl:grid-cols-4";
    };

    const completedResponses = responses.filter(r => !r.isLoading && !r.error && r.content);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-7xl h-[85vh] bg-bg-primary border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-secondary">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-accent-primary/10 rounded-lg">
                            <CompareIcon size={20} className="text-accent-primary" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-text-primary">Model Comparison</h2>
                            <p className="text-xs text-text-tertiary">Compare responses from different AI models side-by-side</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasCompared && completedResponses.length > 0 && (
                            <button
                                onClick={handleCopyAll}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
                                title="Copy all responses as Markdown"
                            >
                                <CopyIcon size={14} />
                                <span>Copy All</span>
                            </button>
                        )}
                        {hasCompared && (
                            <button
                                onClick={handleClear}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-bg-tertiary rounded-lg text-text-tertiary hover:text-text-primary transition-colors"
                        >
                            <CloseIcon size={18} />
                        </button>
                    </div>
                </div>

                {/* Model Selection + Prompt */}
                <div className="px-5 py-4 border-b border-border bg-bg-primary">
                    {/* Selected Models */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs text-text-tertiary font-medium uppercase tracking-wide">Models:</span>
                        {selectedModels.map((model, index) => {
                            const colors = getProviderColor(model.provider);
                            const providerName = providers.value.find(p => p.id === model.provider)?.name || model.provider;
                            return (
                                <div
                                    key={`${model.provider}-${model.model}`}
                                    className={`flex items-center gap-2 px-3 py-1.5 ${colors.bg} border ${colors.border} rounded-lg`}
                                >
                                    <span className={`text-[10px] font-bold uppercase ${colors.text}`}>{providerName.split(" ")[0]}</span>
                                    <span className={`text-sm ${colors.text}`}>{model.model}</span>
                                    <button
                                        onClick={() => removeModel(index)}
                                        className={`${colors.text} opacity-60 hover:opacity-100 transition-opacity`}
                                    >
                                        <CloseIcon size={12} />
                                    </button>
                                </div>
                            );
                        })}
                        {selectedModels.length < 4 && (
                            <ModelSelector onSelect={addModel} excludeModels={selectedModels} />
                        )}
                        {selectedModels.length === 0 && (
                            <span className="text-xs text-text-tertiary italic">Select at least 2 models to compare</span>
                        )}
                    </div>

                    {/* Prompt Input */}
                    <div className="flex gap-3 items-end">
                        <div className="flex-1 relative">
                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onInput={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter a prompt to compare across models... (Ctrl+Enter to send)"
                                className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary resize-none text-sm leading-relaxed min-h-[44px] max-h-[120px]"
                                rows={2}
                            />
                        </div>
                        <button
                            onClick={handleCompare}
                            disabled={!prompt.trim() || selectedModels.length < 2 || isComparing}
                            className={`px-5 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${prompt.trim() && selectedModels.length >= 2 && !isComparing
                                ? "bg-accent-primary text-white hover:bg-accent-primary/90 shadow-lg shadow-accent-primary/20"
                                : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                                }`}
                        >
                            {isComparing ? (
                                <>
                                    <SpinnerIcon size={16} />
                                    <span className="text-sm">Comparing...</span>
                                </>
                            ) : (
                                <>
                                    <SendIcon size={16} />
                                    <span className="text-sm">Compare</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Results Area */}
                <div className="flex-1 overflow-auto p-4">
                    {!hasCompared && responses.length === 0 ? (
                        /* Empty State */
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center max-w-md">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
                                    <CompareIcon size={32} className="text-accent-primary" />
                                </div>
                                <h3 className="text-lg font-semibold text-text-primary mb-2">Compare AI Models</h3>
                                <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                                    Select 2-4 models, enter a prompt, and see how different models respond to the same question side-by-side.
                                </p>
                                <div className="grid grid-cols-2 gap-3 text-left">
                                    <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                                        <div className="text-xs font-medium text-text-primary mb-1">Response Quality</div>
                                        <div className="text-xs text-text-tertiary">Compare accuracy and depth of responses</div>
                                    </div>
                                    <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                                        <div className="text-xs font-medium text-text-primary mb-1">Speed Metrics</div>
                                        <div className="text-xs text-text-tertiary">Track response time for each model</div>
                                    </div>
                                    <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                                        <div className="text-xs font-medium text-text-primary mb-1">Side by Side</div>
                                        <div className="text-xs text-text-tertiary">View all responses in a clean grid layout</div>
                                    </div>
                                    <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                                        <div className="text-xs font-medium text-text-primary mb-1">Export Results</div>
                                        <div className="text-xs text-text-tertiary">Copy comparison as formatted Markdown</div>
                                    </div>
                                </div>
                                <div className="mt-6 flex items-center justify-center gap-3 text-xs text-text-tertiary">
                                    <kbd className="px-2 py-1 bg-bg-tertiary rounded border border-border">Ctrl+Enter</kbd>
                                    <span>to compare</span>
                                    <kbd className="px-2 py-1 bg-bg-tertiary rounded border border-border">Esc</kbd>
                                    <span>to close</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Results Grid */
                        <div className={`grid gap-4 h-full ${getGridCols()}`}>
                            {responses.map((response) => {
                                const colors = getProviderColor(response.provider);
                                const wordCount = getWordCount(response.content);
                                const charCount = response.content.length;
                                const duration = response.startTime && response.endTime
                                    ? response.endTime - response.startTime
                                    : null;

                                return (
                                    <div
                                        key={`${response.provider}-${response.model}`}
                                        className={`flex flex-col border rounded-xl overflow-hidden transition-colors ${
                                            response.error ? "border-error/30 bg-error/5" :
                                            response.isLoading ? `${colors.border} bg-bg-secondary` :
                                            "border-border bg-bg-secondary"
                                        }`}
                                    >
                                        {/* Model Header */}
                                        <div className={`flex items-center justify-between px-3 py-2.5 border-b border-border ${colors.bg}`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border}`}>
                                                    {providers.value.find(p => p.id === response.provider)?.name.split(" ")[0] || response.provider}
                                                </span>
                                                <span className="text-sm font-medium text-text-primary truncate">
                                                    {response.model}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {response.isLoading && <SpinnerIcon size={14} className="text-accent-primary" />}
                                                {!response.isLoading && !response.error && response.content && (
                                                    <CheckIcon size={14} className="text-success" />
                                                )}
                                                {!response.isLoading && response.content && (
                                                    <button
                                                        onClick={() => handleCopyResponse(response.content)}
                                                        className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-colors"
                                                        title="Copy response"
                                                    >
                                                        <CopyIcon size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Response Content */}
                                        <div className="flex-1 p-3 overflow-auto">
                                            {response.error ? (
                                                <div className="flex items-start gap-2 p-3 bg-error/10 rounded-lg">
                                                    <span className="text-error text-lg leading-none">!</span>
                                                    <div>
                                                        <div className="text-sm font-medium text-error">Error</div>
                                                        <div className="text-xs text-error/80 mt-0.5">{response.error}</div>
                                                    </div>
                                                </div>
                                            ) : response.content ? (
                                                <Markdown content={response.content} className="text-sm" />
                                            ) : response.isLoading ? (
                                                <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
                                                    <SpinnerIcon size={24} className="text-accent-primary" />
                                                    <span className="text-xs text-text-tertiary">Generating response...</span>
                                                </div>
                                            ) : (
                                                <div className="text-text-tertiary text-sm italic text-center py-8">
                                                    Waiting...
                                                </div>
                                            )}
                                        </div>

                                        {/* Metrics Footer */}
                                        {!response.isLoading && response.content && !response.error && (
                                            <div className="flex items-center gap-3 px-3 py-2 border-t border-border text-[11px] text-text-tertiary bg-bg-primary/50">
                                                {duration !== null && (
                                                    <span className="flex items-center gap-1" title="Response time">
                                                        <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 5V10L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                        {formatDuration(duration)}
                                                    </span>
                                                )}
                                                <span title="Word count">{wordCount} words</span>
                                                <span title="Character count">{charCount} chars</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Summary Bar - shown after comparison */}
                {hasCompared && completedResponses.length > 0 && !isComparing && (
                    <div className="px-5 py-2.5 border-t border-border bg-bg-secondary flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-text-tertiary">
                            <span>{completedResponses.length} of {responses.length} completed</span>
                            {completedResponses.length > 0 && (() => {
                                const fastest = completedResponses
                                    .filter(r => r.startTime && r.endTime)
                                    .sort((a, b) => (a.endTime! - a.startTime!) - (b.endTime! - b.startTime!))[0];
                                const mostWords = completedResponses
                                    .sort((a, b) => getWordCount(b.content) - getWordCount(a.content))[0];
                                return (
                                    <>
                                        {fastest && (
                                            <span>
                                                Fastest: <span className="text-success font-medium">{fastest.model}</span>
                                                {` (${formatDuration(fastest.endTime! - fastest.startTime!)})`}
                                            </span>
                                        )}
                                        {mostWords && (
                                            <span>
                                                Most detailed: <span className="text-accent-primary font-medium">{mostWords.model}</span>
                                                {` (${getWordCount(mostWords.content)} words)`}
                                            </span>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-tertiary">
                            <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded border border-border">Ctrl+Shift+M</kbd>
                            <span>to toggle</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

interface ModelSelectorProps {
    onSelect: (provider: string, model: string) => void;
    excludeModels: { provider: string; model: string }[];
}

function ModelSelector({ onSelect, excludeModels }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded-lg text-sm text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors"
            >
                <PlusIcon size={14} />
                Add Model
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 w-72 bg-bg-primary border border-border rounded-xl shadow-2xl z-20 max-h-80 overflow-y-auto animate-fade-in">
                        {providers.value.map(provider => {
                            const availableModels = provider.models.filter(
                                model => !excludeModels.some(e => e.provider === provider.id && e.model === model)
                            );

                            if (availableModels.length === 0) return null;

                            const colors = getProviderColor(provider.id);

                            return (
                                <div key={provider.id}>
                                    <div className={`px-3 py-2 text-xs font-medium border-b border-border ${colors.bg} flex items-center justify-between`}>
                                        <span className={colors.text}>{provider.name}</span>
                                        {!provider.apiKey && provider.id !== "ollama" && (
                                            <span className="text-warning text-[10px]">no key</span>
                                        )}
                                    </div>
                                    {availableModels.map(model => (
                                        <button
                                            key={model}
                                            onClick={() => {
                                                onSelect(provider.id, model);
                                                setIsOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
                                        >
                                            {model}
                                        </button>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
