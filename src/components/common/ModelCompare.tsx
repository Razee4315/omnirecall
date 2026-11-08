import { useEffect, useState, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getProviderModels, providers, systemPrompt } from "../../stores/appStore";
import { parseApiError } from "../../lib/errors";
import { useFocusTrap } from "../../hooks/useFocusTrap";
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
import { ProviderTile } from "./ProviderTile";
import { modelLabel } from "../../lib/models";

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
    const panelRef = useRef<HTMLDivElement>(null);
    useFocusTrap(panelRef, true, onClose);

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

    const handleCopyResponse = (content: string) => {
        navigator.clipboard.writeText(content).catch(() => {});
    };

    const handleCopyAll = () => {
        const allText = responses
            .filter(r => r.content && !r.error)
            .map(r => `## ${r.model}\n\n${r.content}`)
            .join("\n\n---\n\n");
        const full = `# Model Comparison\n\n**Prompt:** ${prompt}\n\n---\n\n${allText}`;
        navigator.clipboard.writeText(full).catch(() => {});
    };

    // The run in progress: lets Stop (and closing the dialog) cancel the
    // request in flight and skip the models still queued.
    const runRef = useRef<{ cancelled: boolean; streamId: string | null }>({ cancelled: false, streamId: null });

    const handleStop = () => {
        const run = runRef.current;
        run.cancelled = true;
        if (run.streamId) invoke("stop_generation", { streamId: run.streamId }).catch(() => {});
    };

    useEffect(() => handleStop, []);

    const handleCompare = async () => {
        if (!prompt.trim() || selectedModels.length < 2 || isComparing) return;

        const run = { cancelled: false, streamId: null as string | null };
        runRef.current = run;
        setIsComparing(true);
        setHasCompared(true);
        setResponses(selectedModels.map(m => ({ ...m, content: "", isLoading: true })));

        const update = (index: number, changes: Partial<CompareResponse>) =>
            setResponses(prev => prev.map((r, i) => (i === index ? { ...r, ...changes } : r)));

        // Models run one at a time and each is timed from when its own
        // request starts, so response times are comparable.
        for (let index = 0; index < selectedModels.length; index++) {
            if (run.cancelled) {
                update(index, { isLoading: false, error: "Cancelled" });
                continue;
            }

            const model = selectedModels[index];
            const provider = providers.value.find(p => p.id === model.provider);
            if (!provider?.apiKey && provider?.id !== "ollama") {
                update(index, { isLoading: false, error: "No API key configured" });
                continue;
            }

            // Only events tagged with this request's id are applied, so the
            // main chat (or another model) can never write into this column.
            const streamId = crypto.randomUUID();
            run.streamId = streamId;
            let content = "";
            const startTime = Date.now();
            update(index, { startTime });

            const unlisten = await listen<{ streamId: string; chunk: string }>("chat-stream", (event) => {
                if (event.payload.streamId !== streamId) return;
                content += event.payload.chunk;
                update(index, { content });
            });

            try {
                await invoke("send_message_stream", {
                    streamId,
                    message: prompt,
                    history: [],
                    documents: [],
                    embeddingKey: null,
                    provider: model.provider,
                    model: model.model,
                    apiKey: provider?.apiKey ?? "",
                    baseUrl: provider?.baseUrl || null,
                    systemPrompt: systemPrompt.value.trim() || null,
                });
                update(index, { isLoading: false, endTime: Date.now() });
            } catch (err) {
                update(index, { isLoading: false, error: parseApiError(err), endTime: Date.now() });
            } finally {
                unlisten();
                run.streamId = null;
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="scrim absolute inset-0" />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Model comparison"
                onClick={(e) => e.stopPropagation()}
                className="dialog relative w-full max-w-7xl h-[88vh] flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 h-14 border-b border-line flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/12 text-accent">
                            <CompareIcon size={16} />
                        </span>
                        <div>
                            <h2 className="text-[15px] font-semibold text-fg">Compare models</h2>
                            <p className="text-2xs text-fg-subtle">One prompt, several models, side by side</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasCompared && completedResponses.length > 0 && (
                            <button
                                onClick={handleCopyAll}
                                className="btn btn-sm btn-ghost"
                                title="Copy all responses as Markdown"
                            >
                                <CopyIcon size={14} />
                                <span>Copy All</span>
                            </button>
                        )}
                        {hasCompared && (
                            <button onClick={handleClear} className="btn btn-sm btn-ghost">
                                Clear
                            </button>
                        )}
                        <button onClick={onClose} className="icon-btn" aria-label="Close model comparison">
                            <CloseIcon size={16} />
                        </button>
                    </div>
                </div>

                {/* Model Selection + Prompt */}
                <div className="px-5 py-4 border-b border-line flex-shrink-0">
                    {/* Selected Models */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="section-label mr-1">Models</span>
                        {selectedModels.map((model, index) => {
                            const providerName = providers.value.find(p => p.id === model.provider)?.name || model.provider;
                            return (
                                <div
                                    key={`${model.provider}-${model.model}`}
                                    className="flex items-center gap-2 h-8 pl-1.5 pr-1 rounded-lg border border-line bg-surface-2"
                                    title={`${providerName} · ${model.model}`}
                                >
                                    <ProviderTile providerId={model.provider} size={20} />
                                    <span className="text-[13px] text-fg">{modelLabel(model.model)}</span>
                                    <button
                                        onClick={() => removeModel(index)}
                                        className="icon-btn icon-btn-sm"
                                        aria-label={`Remove ${model.model}`}
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
                            <span className="text-xs text-fg-subtle">Pick at least two models to compare</span>
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
                                className="field rounded-xl px-4 py-3 resize-none text-[13.5px] min-h-[48px] max-h-[120px]"
                                rows={2}
                            />
                        </div>
                        {isComparing && (
                            <button onClick={handleStop} className="btn btn-lg btn-danger h-12">
                                Stop
                            </button>
                        )}
                        <button
                            onClick={handleCompare}
                            disabled={!prompt.trim() || selectedModels.length < 2 || isComparing}
                            className="btn btn-lg btn-primary h-12 px-5"
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
                                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-accent/12 flex items-center justify-center text-accent">
                                    <CompareIcon size={26} />
                                </div>
                                <h3 className="font-display text-[30px] leading-tight text-fg mb-2">Which model answers best?</h3>
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
                                                <span className="text-sm font-medium text-fg truncate" title={response.model}>
                                                    {modelLabel(response.model)}
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
                                                        aria-label="Copy response"
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
                                                    <span className="text-xs text-text-tertiary">
                                                        {response.startTime ? "Generating response..." : "Waiting for the previous model..."}
                                                    </span>
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
                className="flex items-center gap-1.5 h-8 px-3 border border-dashed border-line-strong rounded-lg text-[13px] text-fg-muted hover:border-accent/60 hover:text-accent transition-colors"
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
                    <div className="menu absolute top-full left-0 mt-1.5 w-72 z-20 max-h-80 overflow-y-auto">
                        {providers.value.map(provider => {
                            const availableModels = getProviderModels(provider.id).filter(
                                model => !excludeModels.some(e => e.provider === provider.id && e.model === model)
                            );

                            if (availableModels.length === 0) return null;


                            return (
                                <div key={provider.id}>
                                    <div className="flex items-center gap-2 px-2 pt-2 pb-1">
                                        <ProviderTile providerId={provider.id} size={16} />
                                        <span className="text-xs font-medium text-fg-muted flex-1">{provider.name}</span>
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
                                            className="menu-item pl-8"
                                            title={model}
                                        >
                                            {modelLabel(model)}
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
