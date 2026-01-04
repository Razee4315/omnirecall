import { useState, useRef, useEffect } from "preact/hooks";
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
  chatHistory,
  activeSessionId,
  currentMessages,
  addChatSession,
  updateChatSession,
  deleteChatSession,
  addDocument,
  removeDocument,
  loadPersistedData,
  ChatMessage,
  ChatSession,
  Document,
} from "../../stores/appStore";
import {
  LogoIcon,
  SendIcon,
  SettingsIcon,
  SpinnerIcon,
  PlusIcon,
  ChevronDownIcon,
  CloseIcon,
  DocumentIcon,
  FolderIcon,
  MenuIcon,
  CheckIcon,
  TypingIndicator,
} from "../icons";
import { Markdown } from "../common/Markdown";

interface DocumentWithContent extends Document {
  content?: string;
  isLoading?: boolean;
}

export function Dashboard() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [docsWithContent, setDocsWithContent] = useState<DocumentWithContent[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Load persisted data on mount
  useEffect(() => {
    loadPersistedData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [currentMessages.value]);

  // Load document content when documents change (parallel for speed)
  useEffect(() => {
    const loadDocumentContents = async () => {
      if (documents.value.length === 0) {
        setDocsWithContent([]);
        return;
      }

      setLoadingDocs(true);

      // Parallel loading for 3-5x speed
      const loadPromises = documents.value.map(async (doc) => {
        try {
          const content = await invoke<string>("read_document_content", { filePath: doc.path });
          return { ...doc, content };
        } catch {
          return { ...doc, content: "" };
        }
      });

      const docsWithContentArr = await Promise.all(loadPromises);
      setDocsWithContent(docsWithContentArr);
      setLoadingDocs(false);
    };

    loadDocumentContents();
  }, [documents.value]);

  const handleSubmit = async () => {
    if (!currentQuery.value.trim() || isGenerating.value) return;

    const provider = providers.value.find(p => p.id === activeProvider.value);
    if (!provider?.apiKey && provider?.id !== "ollama") {
      setError("Please add your API key in Settings");
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

          // Save to chat history
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
  };

  const handleNewChat = () => {
    currentMessages.value = [];
    activeSessionId.value = null;
    setError(null);
    currentQuery.value = "";
    inputRef.current?.focus();
  };

  const handleLoadSession = (session: ChatSession) => {
    currentMessages.value = session.messages;
    activeSessionId.value = session.id;
    setError(null);
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteChatSession(sessionId);
    if (activeSessionId.value === sessionId) {
      currentMessages.value = [];
      activeSessionId.value = null;
    }
  };

  const handleBackToSpotlight = async () => {
    viewMode.value = "spotlight";
    await invoke("toggle_dashboard", { isDashboard: false });
  };

  const handleAddDocuments = async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
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
      setError("Failed to open file dialog. Please try again.");
    }
  };

  const handleRemoveDocument = (docId: string) => {
    removeDocument(docId);
  };

  const selectModel = (providerId: string, model: string) => {
    activeProvider.value = providerId;
    activeModel.value = model;
    setShowModelSelect(false);
  };

  const totalDocsLoaded = docsWithContent.filter(d => d.content && d.content.length > 0).length;

  return (
    <div className="h-full w-full flex bg-bg-primary">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-200 overflow-hidden border-r border-border bg-bg-secondary flex flex-col`}>
        <div className="p-3 border-b border-border">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent-primary text-white text-sm hover:bg-accent-primary/90 transition-colors"
          >
            <PlusIcon size={16} />
            New Chat
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-xs text-text-tertiary px-2 py-1 mb-1">Chat History</div>
          {chatHistory.value.length === 0 ? (
            <div className="text-xs text-text-tertiary px-2 py-4 text-center">No chats yet</div>
          ) : (
            <div className="space-y-1">
              {chatHistory.value.map(session => (
                <div
                  key={session.id}
                  className={`group flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer transition-colors ${activeSessionId.value === session.id ? "bg-accent-primary/10 text-accent-primary" : "hover:bg-bg-tertiary text-text-primary"
                    }`}
                  onClick={() => handleLoadSession(session)}
                >
                  <span className="text-sm truncate flex-1">{session.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-tertiary rounded transition-opacity"
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents Section */}
        <div className="border-t border-border p-2">
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-xs text-text-tertiary">
              Documents {totalDocsLoaded > 0 && `(${totalDocsLoaded})`}
            </span>
            <button
              onClick={handleAddDocuments}
              className="p-1 hover:bg-bg-tertiary rounded transition-colors text-text-tertiary hover:text-text-primary"
              title="Add Documents"
            >
              <PlusIcon size={14} />
            </button>
          </div>

          {loadingDocs && (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-text-tertiary">
              <SpinnerIcon size={12} />
              Loading...
            </div>
          )}

          {documents.value.length === 0 ? (
            <button
              onClick={handleAddDocuments}
              className="w-full flex flex-col items-center gap-2 px-3 py-4 rounded-lg border border-dashed border-border hover:border-accent-primary hover:bg-accent-primary/5 transition-colors"
            >
              <FolderIcon size={20} className="text-text-tertiary" />
              <span className="text-xs text-text-tertiary">Add documents</span>
            </button>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {documents.value.map(doc => {
                const docWithContent = docsWithContent.find(d => d.id === doc.id);
                const hasContent = docWithContent?.content && docWithContent.content.length > 0;
                return (
                  <div key={doc.id} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-tertiary">
                    <DocumentIcon size={14} className="text-text-tertiary flex-shrink-0" />
                    <span className="text-xs text-text-primary truncate flex-1">{doc.name}</span>
                    {hasContent && <CheckIcon size={12} className="text-success flex-shrink-0" />}
                    <button
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-bg-secondary rounded transition-opacity"
                    >
                      <CloseIcon size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
            >
              <MenuIcon size={18} />
            </button>
            <LogoIcon size={24} className="text-accent-primary" />
            <span className="font-semibold text-text-primary">OmniRecall</span>

            {/* Model Selector */}
            <div className="relative ml-4">
              <button
                onClick={() => setShowModelSelect(!showModelSelect)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-border transition-colors text-sm text-text-secondary"
              >
                <span>{activeModel.value}</span>
                <ChevronDownIcon size={14} />
              </button>

              {showModelSelect && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-bg-primary border border-border rounded-lg shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
                  {providers.value.map(provider => (
                    <div key={provider.id}>
                      <div className="px-3 py-2 text-xs text-text-tertiary font-medium border-b border-border">
                        {provider.name}
                        {!provider.apiKey && provider.id !== "ollama" && (
                          <span className="text-warning ml-1">(no key)</span>
                        )}
                      </div>
                      {provider.models.map(model => (
                        <button
                          key={model}
                          onClick={() => selectModel(provider.id, model)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-tertiary transition-colors ${activeModel.value === model ? "text-accent-primary bg-accent-primary/10" : "text-text-primary"
                            }`}
                        >
                          {model}
                        </button>
                      ))}
                      {provider.id === "ollama" && (
                        <div className="px-3 py-2 border-t border-border mt-1">
                          <input
                            type="text"
                            placeholder="Enter custom model name..."
                            className="w-full px-2 py-1.5 bg-bg-tertiary border border-border rounded text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary"
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
                          <p className="text-xs text-text-tertiary mt-1">Press Enter to use custom model</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {totalDocsLoaded > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-accent-primary/10 rounded-lg">
                <DocumentIcon size={14} className="text-accent-primary" />
                <span className="text-xs text-accent-primary">{totalDocsLoaded} doc{totalDocsLoaded > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => (isSettingsOpen.value = true)}
              className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
            >
              <SettingsIcon size={18} />
            </button>
            <button
              onClick={handleBackToSpotlight}
              className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Back to Spotlight (Esc)"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentMessages.value.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <LogoIcon size={48} className="text-text-tertiary mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-text-primary mb-2">Welcome to OmniRecall</h2>
                <p className="text-text-secondary text-sm max-w-md mb-4">
                  {totalDocsLoaded > 0
                    ? `${totalDocsLoaded} document${totalDocsLoaded > 1 ? 's' : ''} loaded. Ask questions!`
                    : "Add documents to enable RAG, or just chat."}
                </p>
                {totalDocsLoaded === 0 && (
                  <button
                    onClick={handleAddDocuments}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-bg-tertiary transition-colors text-sm text-text-secondary"
                  >
                    <FolderIcon size={16} />
                    Add Documents
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {currentMessages.value.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 ${message.role === "user"
                      ? "bg-accent-primary text-white"
                      : "bg-bg-secondary text-text-primary border border-border"
                      }`}
                  >
                    {message.role === "user" ? (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </div>
                    ) : (
                      <Markdown content={message.content} className="text-sm leading-relaxed" />
                    )}
                  </div>
                </div>
              ))}

              {isGenerating.value && (
                <div className="flex justify-start">
                  <div className="bg-bg-secondary text-text-primary border border-border rounded-xl px-4 py-3">
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
          <div className="px-4 py-2 bg-error/10 border-t border-error/20">
            <p className="text-sm text-error text-center">{error}</p>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border bg-bg-secondary p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-bg-primary rounded-xl border border-border p-3">
              <textarea
                ref={inputRef}
                value={currentQuery.value}
                onInput={(e) => (currentQuery.value = (e.target as HTMLTextAreaElement).value)}
                onKeyDown={handleKeyDown}
                placeholder={totalDocsLoaded > 0 ? "Ask about your documents..." : "Type your message..."}
                className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary resize-none outline-none text-sm leading-relaxed min-h-[24px] max-h-[200px]"
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
                {isGenerating.value ? <SpinnerIcon size={18} /> : <SendIcon size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
