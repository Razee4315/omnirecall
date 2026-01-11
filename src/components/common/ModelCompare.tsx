import { useState } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { providers } from "../../stores/appStore";
import {
    CompareIcon,
    CloseIcon,
    SpinnerIcon,
    CheckIcon,
    PlusIcon,
} from "../icons";
import { Markdown } from "./Markdown";

interface ModelCompareProps {
    onClose: () => void;
}

export function ModelCompare({ onClose }: ModelCompareProps) {
    const [selectedModels, setSelectedModels] = useState<{ provider: string; model: string }[]>([]);
    const [prompt, setPrompt] = useState("");
    const [responses, setResponses] = useState<{ provider: string; model: string; content: string; isLoading: boolean; error?: string }[]>([]);
    const [isComparing, setIsComparing] = useState(false);

    const addModel = (provider: string, model: string) => {
        if (selectedModels.length >= 4) return; // Max 4 models
        if (selectedModels.some(m => m.provider === provider && m.model === model)) return;
        setSelectedModels([...selectedModels, { provider, model }]);
    };

    const removeModel = (index: number) => {
        setSelectedModels(selectedModels.filter((_, i) => i !== index));
    };

    const handleCompare = async () => {
        if (!prompt.trim() || selectedModels.length < 2) return;

        setIsComparing(true);
        setResponses(selectedModels.map(m => ({
            ...m,
            content: "",
            isLoading: true,
        })));

        // Send requests to all models in parallel
        const promises = selectedModels.map(async (model, index) => {
            const provider = providers.value.find(p => p.id === model.provider);
            if (!provider?.apiKey && provider?.id !== "ollama") {
                setResponses(prev => prev.map((r, i) =>
                    i === index ? { ...r, isLoading: false, error: "No API key" } : r
                ));
                return;
            }

            try {
                let fullResponse = "";
                let unlisten: UnlistenFn | null = null;

                // Create a unique event name for this model
                const eventName = `compare-stream-${index}`;

                unlisten = await listen<{ chunk: string; done: boolean }>(eventName, (event) => {
                    if (!event.payload.done) {
                        fullResponse += event.payload.chunk;
                        setResponses(prev => prev.map((r, i) =>
                            i === index ? { ...r, content: fullResponse } : r
                        ));
                    } else {
                        setResponses(prev => prev.map((r, i) =>
                            i === index ? { ...r, isLoading: false } : r
                        ));
                        if (unlisten) unlisten();
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

            } catch (err: any) {
                setResponses(prev => prev.map((r, i) =>
                    i === index ? { ...r, isLoading: false, error: err?.message || "Failed" } : r
                ));
            }
        });

        await Promise.all(promises);
        setIsComparing(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-6xl h-[80vh] bg-bg-primary border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary">
                    <div className="flex items-center gap-2">
                        <CompareIcon size={20} className="text-accent-primary" />
                        <h2 className="text-lg font-semibold text-text-primary">Compare Models</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-bg-tertiary rounded text-text-tertiary hover:text-text-primary"
                    >
                        <CloseIcon size={18} />
                    </button>
                </div>

                {/* Model Selection */}
                <div className="p-4 border-b border-border">
                    <div className="flex flex-wrap gap-2 mb-3">
                        {selectedModels.map((model, index) => (
                            <div
                                key={`${model.provider}-${model.model}`}
                                className="flex items-center gap-2 px-3 py-1.5 bg-accent-primary/10 border border-accent-primary/30 rounded-lg"
                            >
                                <span className="text-sm text-accent-primary">{model.model}</span>
                                <button
                                    onClick={() => removeModel(index)}
                                    className="text-accent-primary/70 hover:text-accent-primary"
                                >
                                    <CloseIcon size={12} />
                                </button>
                            </div>
                        ))}
                        {selectedModels.length < 4 && (
                            <ModelSelector onSelect={addModel} excludeModels={selectedModels} />
                        )}
                    </div>

                    {/* Prompt Input */}
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={prompt}
                            onInput={(e) => setPrompt((e.target as HTMLInputElement).value)}
                            placeholder="Enter a prompt to compare..."
                            className="flex-1 px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary"
                            onKeyDown={(e) => e.key === "Enter" && handleCompare()}
                        />
                        <button
                            onClick={handleCompare}
                            disabled={!prompt.trim() || selectedModels.length < 2 || isComparing}
                            className={`px-6 py-2.5 rounded-lg font-medium ${prompt.trim() && selectedModels.length >= 2 && !isComparing
                                ? "bg-accent-primary text-white hover:bg-accent-primary/90"
                                : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                                }`}
                        >
                            {isComparing ? <SpinnerIcon size={18} /> : "Compare"}
                        </button>
                    </div>
                </div>

                {/* Results Grid */}
                <div className={`flex-1 overflow-auto p-4 grid gap-4 ${selectedModels.length <= 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"
                    }`}>
                    {responses.map((response) => (
                        <div
                            key={`${response.provider}-${response.model}`}
                            className="flex flex-col border border-border rounded-lg overflow-hidden bg-bg-secondary"
                        >
                            {/* Model Header */}
                            <div className="flex items-center justify-between px-3 py-2 bg-bg-tertiary border-b border-border">
                                <span className="text-sm font-medium text-text-primary truncate">
                                    {response.model}
                                </span>
                                {response.isLoading && <SpinnerIcon size={14} />}
                                {!response.isLoading && !response.error && response.content && (
                                    <CheckIcon size={14} className="text-success" />
                                )}
                            </div>

                            {/* Response Content */}
                            <div className="flex-1 p-3 overflow-auto">
                                {response.error ? (
                                    <div className="text-error text-sm">{response.error}</div>
                                ) : response.content ? (
                                    <Markdown content={response.content} className="text-sm" />
                                ) : response.isLoading ? (
                                    <div className="flex items-center gap-2 text-text-tertiary text-sm">
                                        <SpinnerIcon size={14} />
                                        Generating...
                                    </div>
                                ) : (
                                    <div className="text-text-tertiary text-sm italic">
                                        Waiting for comparison...
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Empty state placeholder cards */}
                    {selectedModels.length > responses.length && Array.from({ length: selectedModels.length - responses.length }).map((_, i) => (
                        <div
                            key={`placeholder-${i}`}
                            className="flex flex-col border border-border border-dashed rounded-lg overflow-hidden bg-bg-secondary/50"
                        >
                            <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">
                                Select models to compare
                            </div>
                        </div>
                    ))}
                </div>

                {/* Instructions */}
                {selectedModels.length < 2 && (
                    <div className="p-4 border-t border-border bg-bg-secondary text-center text-sm text-text-tertiary">
                        Select at least 2 models to compare their responses side-by-side
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
                    <div className="absolute top-full left-0 mt-1 w-64 bg-bg-primary border border-border rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto">
                        {providers.value.map(provider => {
                            const availableModels = provider.models.filter(
                                model => !excludeModels.some(e => e.provider === provider.id && e.model === model)
                            );

                            if (availableModels.length === 0) return null;

                            return (
                                <div key={provider.id}>
                                    <div className="px-3 py-2 text-xs text-text-tertiary font-medium border-b border-border bg-bg-secondary">
                                        {provider.name}
                                        {!provider.apiKey && provider.id !== "ollama" && (
                                            <span className="text-warning ml-1">(no key)</span>
                                        )}
                                    </div>
                                    {availableModels.map(model => (
                                        <button
                                            key={model}
                                            onClick={() => {
                                                onSelect(provider.id, model);
                                                setIsOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary"
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
