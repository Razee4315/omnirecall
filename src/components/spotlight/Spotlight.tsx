import { useState, useRef, useEffect, useMemo } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  viewMode,
  activeModel,
  activeProvider,
  providers,
  isGenerating,
  currentQuery,
  isSettingsOpen,
  documents,
  activeSessionId,
  currentMessages,
  addChatSession,
  updateChatSession,
  addDocument,
  loadPersistedData,
  ChatMessage,
  ChatSession,
  Document,
} from "../../stores/appStore";
import {
  LogoIcon,
  SendIcon,
  SettingsIcon,
  ExpandIcon,
  SpinnerIcon,
  CopyIcon,
  RefreshIcon,
  ChevronDownIcon,
  CloseIcon,
  FolderIcon,
  TypingIndicator,
} from "../icons";
import { Markdown } from "../common/Markdown";

interface DocumentWithContent extends Document {
  content?: string;
}

export function Spotlight() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docsWithContent, setDocsWithContent] = useState<DocumentWithContent[]>([]);

  // Load persisted data on mount
  useEffect(() => {
    loadPersistedData();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [currentMessages.value]);

  // Load document contents in parallel for speed
  useEffect(() => {
    const loadDocs = async () => {
      if (documents.value.length === 0) {
        setDocsWithContent([]);
        return;
      }
      // Parallel loading for 3-5x speed improvement
      const loadPromises = documents.value.map(async (doc) => {
        try {
          const content = await invoke<string>("read_document_content", { filePath: doc.path });
          return { ...doc, content };
        } catch {
          return { ...doc, content: "" };
        }
      });
      const loaded = await Promise.all(loadPromises);
      setDocsWithContent(loaded);
    };
    loadDocs();
  }, [documents.value]);

  const handleSubmit = async () => {
    if (!currentQuery.value.trim() || isGenerating.value) return;

    const provider = providers.value.find(p => p.id === activeProvider.value);
    if (!provider?.apiKey && provider?.id !== "ollama") {
      setError("Please add your API key in Settings (click gear icon)");
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: currentQuery.value,
    };

    const newMessages = [...currentMessages.value, userMessage];
    currentMessages.value = newMessages;
    const query = currentQuery.value;
    currentQuery.value = "";
    isGenerating.value = true;
    setError(null);

    // Create placeholder for assistant message
    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };
    currentMessages.value = [...newMessages, assistantMessage];

    try {
      const history = newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      const documentContext = docsWithContent
        .filter(d => d.content && d.content.length > 0)
        .map(d => ({ name: d.name, content: d.content! }));

      // Setup event listener for streaming chunks
      let unlisten: UnlistenFn | null = null;
      let fullResponse = "";

      unlisten = await listen<{ chunk: string; done: boolean }>("chat-stream", (event) => {
        if (!event.payload.done) {
          fullResponse += event.payload.chunk;
          // Update the assistant message in place
          const msgs = [...currentMessages.value];
          const idx = msgs.findIndex(m => m.id === assistantId);
          if (idx !== -1) {
            msgs[idx] = { ...msgs[idx], content: fullResponse };
            currentMessages.value = msgs;
          }
        } else {
          // Stream complete
          isGenerating.value = false;
          if (unlisten) unlisten();

          // Save to persistent chat history
          const updatedMessages = currentMessages.value;
          if (!activeSessionId.value) {
            const newSession: ChatSession = {
              id: crypto.randomUUID(),
              title: userMessage.content.slice(0, 30) + (userMessage.content.length > 30 ? "..." : ""),
              messages: updatedMessages,
              createdAt: new Date().toISOString(),
            };
            addChatSession(newSession);
            activeSessionId.value = newSession.id;
          } else {
            updateChatSession(activeSessionId.value, updatedMessages);
          }
        }
      });

      // Start streaming
      await invoke("send_message_stream", {
        message: query,
        history,
        documents: documentContext,
        provider: activeProvider.value,
        model: activeModel.value,
        apiKey: provider?.apiKey || "",
      });

    } catch (err: any) {
      setError(err?.message || err?.toString() || "Failed to get response");
      isGenerating.value = false;
    }
  };

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

  // Memoized to prevent recalculation on every render
  const totalDocsLoaded = useMemo(
    () => docsWithContent.filter(d => d.content && d.content.length > 0).length,
    [docsWithContent]
  );

  return (
    <div className="h-full w-full flex flex-col">
      <div className="glass rounded-xl border border-border shadow-2xl overflow-hidden animate-fade-in m-2 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border drag-region">
          <div className="flex items-center gap-2 no-drag">
            <LogoIcon size={18} className="text-accent-primary" />

            <div className="relative">
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

            {totalDocsLoaded > 0 && (
              <span className="px-1.5 py-0.5 bg-accent-primary/10 rounded text-xs text-accent-primary">
                {totalDocsLoaded} doc{totalDocsLoaded > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 no-drag">
            <button
              onClick={handleAddDocuments}
              className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Add Documents"
            >
              <FolderIcon size={14} />
            </button>
            <button
              onClick={() => (isSettingsOpen.value = true)}
              className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Settings (Ctrl+,)"
            >
              <SettingsIcon size={14} />
            </button>
            <button
              onClick={handleExpand}
              className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Expand"
            >
              <ExpandIcon size={14} />
            </button>
            <button
              onClick={() => invoke("hide_window")}
              className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Close (Esc)"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {currentMessages.value.length === 0 && !isGenerating.value && !error ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center">
                <p className="text-xs text-text-tertiary mb-2">
                  {totalDocsLoaded > 0
                    ? `Ask about your ${totalDocsLoaded} document${totalDocsLoaded > 1 ? 's' : ''}`
                    : "Ask anything or add documents"}
                </p>
                <p className="text-xs text-text-tertiary">
                  <kbd className="px-1 py-0.5 bg-bg-tertiary rounded">Enter</kbd> send ·
                  <kbd className="px-1 py-0.5 bg-bg-tertiary rounded ml-1">Esc</kbd> hide
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {currentMessages.value.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs ${msg.role === "user"
                    ? "bg-accent-primary text-white"
                    : "bg-bg-tertiary text-text-primary"
                    }`}>
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    ) : (
                      <Markdown content={msg.content} className="text-xs leading-relaxed" />
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
              onInput={(e) => (currentQuery.value = (e.target as HTMLTextAreaElement).value)}
              onKeyDown={handleKeyDown}
              placeholder={totalDocsLoaded > 0 ? "Ask about your docs..." : "Ask anything..."}
              className="flex-1 bg-bg-tertiary rounded-lg px-3 py-2 text-text-primary placeholder:text-text-tertiary resize-none outline-none text-xs leading-relaxed min-h-[32px] max-h-[60px]"
              rows={1}
              disabled={isGenerating.value}
            />
            <button
              onClick={handleSubmit}
              disabled={!currentQuery.value.trim() || isGenerating.value}
              className={`p-2 rounded-lg transition-all flex-shrink-0 ${currentQuery.value.trim() && !isGenerating.value
                ? "bg-accent-primary text-white hover:bg-accent-primary/90"
                : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                }`}
            >
              {isGenerating.value ? <SpinnerIcon size={14} /> : <SendIcon size={14} />}
            </button>
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
