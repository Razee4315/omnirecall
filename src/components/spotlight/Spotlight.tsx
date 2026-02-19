import { useState, useRef, useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  viewMode,
  activeModel,
  activeProvider,
  providers,
  isGenerating,
  currentQuery,
  isSettingsOpen,
  activeSessionId,
  currentMessages,
  addDocument,
  Document,
  stopGeneration,
  isCommandPaletteOpen,
} from "../../stores/appStore";
import { useChatSubmit } from "../../hooks/useChatSubmit";
import { useDocumentLoader } from "../../hooks/useDocumentLoader";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useAutoResize } from "../../hooks/useAutoResize";
import {
  LogoIcon,
  SendIcon,
  SettingsIcon,
  ExpandIcon,
  CopyIcon,
  RefreshIcon,
  ChevronDownIcon,
  CloseIcon,
  FolderIcon,
  TypingIndicator,
  CheckIcon,
  StopIcon,
  CommandIcon,
} from "../icons";
import { Markdown } from "../common/Markdown";
import { TokenCounter } from "../common/TokenCounter";

export function Spotlight() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Shared hooks - eliminates code duplication with Dashboard
  const { docsWithContent, totalDocsLoaded } = useDocumentLoader();
  const { handleSubmit, cleanupStream } = useChatSubmit(docsWithContent, setError);
  const modelSelectorRef = useClickOutside<HTMLDivElement>(() => setShowModelSelect(false), showModelSelect);
  const handleAutoResize = useAutoResize(60);

  // Clean up stream listener on unmount
  useEffect(() => cleanupStream, [cleanupStream]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [currentMessages.value]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      invoke("hide_window");
    }
  };

  const handleCopy = async () => {
    const lastAssistant = [...currentMessages.value].reverse().find(m => m.role === "assistant");
    if (lastAssistant) {
      await navigator.clipboard.writeText(lastAssistant.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyMessage = async (content: string, messageId: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleClear = () => {
    currentQuery.value = "";
    currentMessages.value = [];
    activeSessionId.value = null;
    setError(null);
    inputRef.current?.focus();
  };

  const handleExpand = async () => {
    viewMode.value = "dashboard";
    await invoke("toggle_dashboard", { isDashboard: true });
  };

  const handleAddDocuments = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: "Documents",
          extensions: ["pdf", "txt", "md", "docx", "html", "py", "js", "ts", "rs", "java", "cpp", "c", "json", "yaml", "yml", "toml"]
        }]
      });
      if (selected) {
        const files = Array.isArray(selected) ? selected : [selected];
        for (const filePath of files) {
          const fileName = filePath.split(/[/\\]/).pop() || "Unknown";
          const ext = fileName.split(".").pop() || "";
          const newDoc: Document = {
            id: crypto.randomUUID(),
            name: fileName,
            path: filePath,
            size: 0,
            type: ext,
            addedAt: new Date().toISOString(),
          };
          addDocument(newDoc);
        }
      }
    } catch (err) {
      console.error("Failed to add documents:", err);
      setError("Failed to open file picker");
    }
  };

  const selectModel = (providerId: string, model: string) => {
    activeProvider.value = providerId;
    activeModel.value = model;
    setShowModelSelect(false);
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="glass rounded-xl border border-border shadow-2xl overflow-hidden animate-fade-in m-2 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border drag-region">
          <div className="flex items-center gap-2 no-drag">
            <LogoIcon size={18} className="text-accent-primary" />

            <div className="relative" ref={modelSelectorRef}>
              <button
                onClick={() => setShowModelSelect(!showModelSelect)}
                className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-bg-tertiary transition-colors text-xs text-text-secondary"
              >
                <span className="max-w-[100px] truncate">{activeModel.value}</span>
                <ChevronDownIcon size={10} />
              </button>

              {showModelSelect && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-bg-secondary border border-border rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
                  {providers.value.map(provider => (
                    <div key={provider.id}>
                      <div className="px-3 py-1 text-xs text-text-tertiary font-medium">
                        {provider.name}
                      </div>
                      {provider.models.map(model => (
                        <button
                          key={model}
                          onClick={() => selectModel(provider.id, model)}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-tertiary transition-colors ${activeModel.value === model ? "text-accent-primary bg-accent-primary/10" : "text-text-primary"
                            }`}
                        >
                          {model}
                        </button>
                      ))}
                      {provider.id === "ollama" && (
                        <div className="px-3 py-2 border-t border-border mt-1">
                          <input
                            type="text"
                            placeholder="Custom model name..."
                            className="w-full px-2 py-1.5 bg-bg-tertiary border border-border rounded text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const value = (e.target as HTMLInputElement).value.trim();
                                if (value) {
                                  selectModel("ollama", value);
                                  (e.target as HTMLInputElement).value = "";
                                }
                              }
                            }}
                          />
                          <p className="text-xs text-text-tertiary mt-1">Press Enter to use</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Token Counter */}
            {currentMessages.value.length > 0 && (
              <TokenCounter className="ml-1" />
            )}

            {totalDocsLoaded > 0 && (
              <span className="px-1.5 py-0.5 bg-accent-primary/10 rounded text-xs text-accent-primary">
                {totalDocsLoaded} doc{totalDocsLoaded > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 no-drag">
            <button
              onClick={() => (isCommandPaletteOpen.value = true)}
              className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Command Palette (Ctrl+K)"
              aria-label="Command Palette"
            >
              <CommandIcon size={14} />
            </button>
            <button
              onClick={handleAddDocuments}
              className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Add Documents"
              aria-label="Add Documents"
            >
              <FolderIcon size={14} />
            </button>
            <button
              onClick={() => (isSettingsOpen.value = true)}
              className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Settings (Ctrl+,)"
              aria-label="Settings"
            >
              <SettingsIcon size={14} />
            </button>
            <button
              onClick={handleExpand}
              className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Expand to Dashboard"
              aria-label="Expand to Dashboard"
            >
              <ExpandIcon size={14} />
            </button>
            <button
              onClick={() => invoke("hide_window")}
              className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Close (Esc)"
              aria-label="Close window"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {currentMessages.value.length === 0 && !isGenerating.value && !error ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center max-w-xs">
                <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                  <LogoIcon size={22} className="text-accent-primary" />
                </div>
                <p className="text-xs text-text-secondary mb-1 font-medium">
                  {totalDocsLoaded > 0
                    ? `${totalDocsLoaded} document${totalDocsLoaded > 1 ? 's' : ''} ready`
                    : "Ask anything"}
                </p>
                <p className="text-[11px] text-text-tertiary mb-3">
                  {totalDocsLoaded > 0
                    ? "Ask questions about your documents"
                    : "Chat, analyze, or add documents for RAG"}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-text-tertiary">
                  <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border">Enter</kbd> send</span>
                  <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border">Ctrl+K</kbd> commands</span>
                  <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border">Esc</kbd> hide</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {currentMessages.value.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`group flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-message-reveal`}
                  style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
                >
                  <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs relative ${msg.role === "user"
                    ? "bg-accent-primary text-white"
                    : "bg-bg-tertiary text-text-primary"
                    }`}>
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    ) : (
                      <Markdown content={msg.content} className="text-xs leading-relaxed" />
                    )}

                    {/* Message Actions */}
                    {msg.content && (
                      <div className={`flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "justify-end" : "justify-start"
                        }`}>
                        <button
                          onClick={() => handleCopyMessage(msg.content, msg.id)}
                          className={`p-0.5 rounded ${msg.role === "user"
                            ? "text-white/70 hover:text-white"
                            : "text-text-tertiary hover:text-text-primary"
                            }`}
                          title="Copy"
                        >
                          {copiedMessageId === msg.id ? <CheckIcon size={10} /> : <CopyIcon size={10} />}
                        </button>
                        {msg.tokenCount && msg.tokenCount > 10 && (
                          <span className={`text-[10px] ${msg.role === "user" ? "text-white/50" : "text-text-tertiary/60"
                            }`}>
                            ~{msg.tokenCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isGenerating.value && (
                <div className="flex justify-start">
                  <div className="bg-bg-tertiary rounded-lg px-3 py-2.5">
                    <TypingIndicator className="text-accent-primary" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 bg-error/10 border-t border-error/20">
            <p className="text-xs text-error">{error}</p>
          </div>
        )}

        {/* Input Area */}
        <div className="p-2 border-t border-border">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={currentQuery.value}
              onInput={(e) => {
                currentQuery.value = (e.target as HTMLTextAreaElement).value;
                handleAutoResize(e);
              }}
              onKeyDown={handleKeyDown}
              placeholder={totalDocsLoaded > 0 ? "Ask about your docs..." : "Ask anything..."}
              className="flex-1 bg-bg-tertiary rounded-lg px-3 py-2 text-text-primary placeholder:text-text-tertiary resize-none outline-none text-xs leading-relaxed min-h-[32px] max-h-[60px]"
              rows={1}
              disabled={isGenerating.value}
            />
            {isGenerating.value ? (
              <button
                onClick={stopGeneration}
                className="p-2 rounded-lg bg-error text-white hover:bg-error/90 transition-all flex-shrink-0"
                title="Stop generating (Ctrl+.)"
              >
                <StopIcon size={14} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!currentQuery.value.trim()}
                className={`p-2 rounded-lg transition-all flex-shrink-0 ${currentQuery.value.trim()
                  ? "bg-accent-primary text-white hover:bg-accent-primary/90"
                  : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                  }`}
              >
                <SendIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Actions Bar */}
        {currentMessages.value.length > 0 && !isGenerating.value && (
          <div className="flex items-center gap-2 px-2 py-1.5 border-t border-border bg-bg-secondary/50">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <CopyIcon size={10} />
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <RefreshIcon size={10} />
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
