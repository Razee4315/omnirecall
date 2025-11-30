import { useState, useRef, useEffect } from "preact/hooks";
import {
  viewMode,
  activeModel,
  activeSpace,
  clipboardText,
  includeClipboard,
  isGenerating,
  streamingContent,
  currentQuery,
  isSettingsOpen,
} from "../../stores/appStore";
import {
  LogoIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  ExpandIcon,
  ClipboardIcon,
  CloseIcon,
  SpinnerIcon,
  CopyIcon,
  RefreshIcon,
  ChevronDownIcon,
} from "../icons";
import { clsx } from "clsx";

export function Spotlight() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [sources, setSources] = useState<{ name: string; page: number }[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!currentQuery.value.trim() || isGenerating.value) return;

    isGenerating.value = true;
    setResponse(null);
    streamingContent.value = "";

    // Simulate streaming response
    const mockResponse = `Based on the documents in your "${activeSpace.value?.name || "Quick Notes"}" space, here's what I found:

The information you're looking for relates to several key points:

1. **Primary Finding**: The analysis shows significant patterns in the data that align with your query about "${currentQuery.value.slice(0, 50)}..."

2. **Supporting Evidence**: Multiple sources corroborate this finding, with particularly strong evidence from the indexed documents.

3. **Recommendations**: Based on this analysis, consider reviewing the highlighted sections for more detailed information.

This summary is generated from your local documents using RAG (Retrieval-Augmented Generation).`;

    // Simulate streaming
    for (let i = 0; i < mockResponse.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      streamingContent.value = mockResponse.slice(0, i + 1);
    }

    setResponse(mockResponse);
    setSources([
      { name: "Document1.pdf", page: 3 },
      { name: "Document2.pdf", page: 7 },
    ]);
    isGenerating.value = false;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = async () => {
    if (response) {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    currentQuery.value = "";
    setResponse(null);
    setSources([]);
    streamingContent.value = "";
    inputRef.current?.focus();
  };

  return (
    <div className="h-full w-full flex items-start justify-center pt-[15vh]">
      <div className="w-full max-w-[650px] mx-4 animate-fade-in">
        <div className="glass rounded-xl border border-border shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <LogoIcon size={24} className="text-accent-primary" />
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-bg-tertiary transition-colors text-sm text-text-secondary">
                <span>{activeModel.value}</span>
                <ChevronDownIcon size={14} />
              </button>
              <div className="w-px h-4 bg-border" />
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-bg-tertiary transition-colors text-sm text-text-secondary">
                <span>{activeSpace.value?.name || "Quick Notes"}</span>
                <ChevronDownIcon size={14} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => (isSettingsOpen.value = true)}
                className="p-2 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
                title="Settings (Ctrl+,)"
              >
                <SettingsIcon size={18} />
              </button>
              <button
                onClick={() => (viewMode.value = "dashboard")}
                className="p-2 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
                title="Expand to Dashboard"
              >
                <ExpandIcon size={18} />
              </button>
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              <SearchIcon size={20} className="text-text-tertiary mt-2.5" />
              <textarea
                ref={inputRef}
                value={currentQuery.value}
                onInput={(e) =>
                  (currentQuery.value = (e.target as HTMLTextAreaElement).value)
                }
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your documents..."
                className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary resize-none outline-none text-base leading-relaxed min-h-[44px] max-h-[120px]"
                rows={1}
                disabled={isGenerating.value}
              />
              <button
                onClick={handleSubmit}
                disabled={!currentQuery.value.trim() || isGenerating.value}
                className={clsx(
                  "p-2 rounded-lg transition-all",
                  currentQuery.value.trim() && !isGenerating.value
                    ? "bg-accent-primary text-white hover:bg-accent-primary/90"
                    : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                )}
              >
                {isGenerating.value ? (
                  <SpinnerIcon size={20} />
                ) : (
                  <SendIcon size={20} />
                )}
              </button>
            </div>
          </div>

          {/* Clipboard Chip */}
          {clipboardText.value && (
            <div className="px-4 pb-3">
              <button
                onClick={() => (includeClipboard.value = !includeClipboard.value)}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all w-full",
                  includeClipboard.value
                    ? "bg-accent-primary/10 border border-accent-primary/30 text-accent-primary"
                    : "bg-bg-tertiary border border-transparent text-text-secondary hover:border-border"
                )}
              >
                <ClipboardIcon size={16} />
                <span className="truncate flex-1 text-left">
                  {includeClipboard.value ? "Including: " : "Include clipboard: "}
                  "{clipboardText.value.slice(0, 60)}
                  {clipboardText.value.length > 60 ? "..." : ""}"
                </span>
                {includeClipboard.value && (
                  <CloseIcon
                    size={14}
                    className="flex-shrink-0 hover:text-white"
                  />
                )}
              </button>
            </div>
          )}

          {/* Response Area */}
          {(streamingContent.value || response) && (
            <div className="border-t border-border">
              <div className="p-4 max-h-[50vh] overflow-y-auto">
                <div className="prose prose-sm prose-invert max-w-none">
                  <div className="text-text-primary whitespace-pre-wrap leading-relaxed">
                    {streamingContent.value || response}
                    {isGenerating.value && (
                      <span className="inline-block w-2 h-4 bg-accent-primary ml-0.5 animate-pulse-subtle" />
                    )}
                  </div>
                </div>

                {/* Sources */}
                {sources.length > 0 && !isGenerating.value && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="text-xs text-text-tertiary mb-2">Sources</div>
                    <div className="flex flex-wrap gap-2">
                      {sources.map((source, i) => (
                        <button
                          key={i}
                          className="px-2 py-1 bg-bg-tertiary rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
                        >
                          [{i + 1}] {source.name}, p.{source.page}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Response Actions */}
              {response && !isGenerating.value && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                    >
                      <CopyIcon size={14} />
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={() => (viewMode.value = "dashboard")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                    >
                      <ExpandIcon size={14} />
                      Expand
                    </button>
                    <button
                      onClick={handleClear}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                    >
                      <RefreshIcon size={14} />
                      New Query
                    </button>
                  </div>
                  <div className="text-xs text-text-tertiary">
                    Tokens: ~1,234
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Keyboard Hints */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-text-tertiary">
          <span>
            <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary">
              Enter
            </kbd>{" "}
            to send
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary">
              Esc
            </kbd>{" "}
            to close
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary">
              Ctrl+,
            </kbd>{" "}
            settings
          </span>
        </div>
      </div>
    </div>
  );
}
