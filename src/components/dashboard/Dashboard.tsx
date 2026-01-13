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
  estimateTokens,
  branchFromMessage,
  searchQuery,
  searchChatHistory,
  searchResults,
  stopGeneration,
  isCommandPaletteOpen,
  isMaximized,
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
  SearchIcon,
  BranchIcon,
  CopyIcon,
  StopIcon,
  DownloadIcon,
  CommandIcon,
} from "../icons";
import { Markdown } from "../common/Markdown";
import { TokenCounter } from "../common/TokenCounter";
import { ExportImport } from "../common/ExportImport";
import { FolderManager } from "../common/FolderManager";
import { WindowControls, DragRegion } from "../common/WindowControls";
import { RagDebugPanel } from "../common/RagDebugPanel";

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
  const [sidebarTab, setSidebarTab] = useState<"chats" | "folders" | "docs">("chats");
  const [docsWithContent, setDocsWithContent] = useState<DocumentWithContent[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [showIndexPanel, setShowIndexPanel] = useState(false);

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

  // Search handler
  useEffect(() => {
    if (localSearchQuery.trim()) {
      searchChatHistory(localSearchQuery);
    } else {
      searchQuery.value = "";
    }
  }, [localSearchQuery]);

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
      tokenCount: estimateTokens(currentQuery.value),
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
      tokenCount: 0,
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
            msgs[idx] = { ...msgs[idx], content: fullResponse, tokenCount: estimateTokens(fullResponse) };
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
              branches: [],
              createdAt: new Date().toISOString(),
              folderId: null,
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

  const handleCopyMessage = async (content: string, messageId: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleBranch = (messageId: string) => {
    if (!activeSessionId.value) return;
    branchFromMessage(activeSessionId.value, messageId);
  };

  const totalDocsLoaded = docsWithContent.filter(d => d.content && d.content.length > 0).length;
  const currentSession = chatHistory.value.find(s => s.id === activeSessionId.value);

  return (
    <div className="h-full w-full flex bg-bg-primary">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-72" : "w-0"} transition-all duration-200 overflow-hidden border-r border-border bg-bg-secondary flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-3 border-b border-border space-y-2">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent-primary text-white text-sm hover:bg-accent-primary/90 transition-colors"
          >
            <PlusIcon size={16} />
            New Chat
          </button>

          {/* Sidebar Tabs */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => setSidebarTab("chats")}
              className={`flex-1 px-2 py-1.5 text-xs ${sidebarTab === "chats" ? "bg-accent-primary/10 text-accent-primary" : "text-text-secondary hover:bg-bg-tertiary"
                }`}
            >
              Chats
            </button>
            <button
              onClick={() => setSidebarTab("folders")}
              className={`flex-1 px-2 py-1.5 text-xs ${sidebarTab === "folders" ? "bg-accent-primary/10 text-accent-primary" : "text-text-secondary hover:bg-bg-tertiary"
                }`}
            >
              Folders
            </button>
            <button
              onClick={() => setSidebarTab("docs")}
              className={`flex-1 px-2 py-1.5 text-xs ${sidebarTab === "docs" ? "bg-accent-primary/10 text-accent-primary" : "text-text-secondary hover:bg-bg-tertiary"
                }`}
            >
              Docs
            </button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto">
          {sidebarTab === "chats" && (
            <>
              {/* Search */}
              <div className="p-2">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-bg-tertiary rounded-lg border border-border">
                  <SearchIcon size={14} className="text-text-tertiary" />
                  <input
                    type="text"
                    value={localSearchQuery}
                    onInput={(e) => setLocalSearchQuery((e.target as HTMLInputElement).value)}
                    placeholder="Search chats..."
                    className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
                  />
                  {localSearchQuery && (
                    <button onClick={() => setLocalSearchQuery("")} className="text-text-tertiary hover:text-text-primary">
                      <CloseIcon size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Results or Chat History */}
              {localSearchQuery && searchResults.value.length > 0 ? (
                <div className="p-2">
                  <div className="text-xs text-text-tertiary px-2 py-1 mb-1">
                    {searchResults.value.length} result{searchResults.value.length !== 1 ? "s" : ""}
                  </div>
                  {searchResults.value.slice(0, 10).map((result) => (
                    <div
                      key={`${result.sessionId}-${result.messageId}`}
                      onClick={() => {
                        const session = chatHistory.value.find(s => s.id === result.sessionId);
                        if (session) handleLoadSession(session);
                        setLocalSearchQuery("");
                      }}
                      className="px-2 py-2 rounded-lg cursor-pointer hover:bg-bg-tertiary"
                    >
                      <div className="text-xs text-text-tertiary truncate">{result.sessionTitle}</div>
                      <div className="text-sm text-text-primary line-clamp-2 mt-0.5">
                        {result.content.slice(Math.max(0, result.matchIndex - 20), result.matchIndex + 50)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (() => {
                // Group chats by date
                const getDateGroup = (dateStr: string) => {
                  const date = new Date(dateStr);
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);

                  if (date.toDateString() === today.toDateString()) return "Today";
                  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
                  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                };

                const grouped = chatHistory.value.reduce((acc, session) => {
                  const group = getDateGroup(session.createdAt);
                  if (!acc[group]) acc[group] = [];
                  acc[group].push(session);
                  return acc;
                }, {} as Record<string, typeof chatHistory.value>);

                const groupOrder = ["Today", "Yesterday"];
                const sortedGroups = Object.keys(grouped).sort((a, b) => {
                  const aIdx = groupOrder.indexOf(a);
                  const bIdx = groupOrder.indexOf(b);
                  if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                  if (aIdx !== -1) return -1;
                  if (bIdx !== -1) return 1;
                  return 0;
                });

                return (
                  <div className="space-y-2 px-2">
                    {chatHistory.value.length === 0 ? (
                      <div className="text-xs text-text-tertiary px-2 py-4 text-center">No chats yet</div>
                    ) : sortedGroups.map(group => (
                      <div key={group}>
                        <div className="text-xs text-text-tertiary px-2 py-1 uppercase tracking-wide">{group}</div>
                        <div className="space-y-0.5">
                          {grouped[group].map(session => (
                            <div
                              key={session.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer?.setData("text/plain", session.id);
                                (e.target as HTMLElement).style.opacity = "0.5";
                              }}
                              onDragEnd={(e) => {
                                (e.target as HTMLElement).style.opacity = "1";
                              }}
                              className={`group flex items-center justify-between px-2 py-2 rounded-lg cursor-grab transition-colors ${activeSessionId.value === session.id
                                ? "bg-accent-primary/10 text-accent-primary"
                                : "hover:bg-bg-tertiary text-text-primary"
                                }`}
                              onClick={() => handleLoadSession(session)}
                            >
                              <span className="text-sm truncate flex-1">{session.title}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-error/20 hover:text-error rounded transition-opacity"
                              >
                                <CloseIcon size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {sidebarTab === "folders" && (
            <FolderManager onSelectSession={(sessionId) => {
              const session = chatHistory.value.find(s => s.id === sessionId);
              if (session) handleLoadSession(session);
            }} />
          )}

          {sidebarTab === "docs" && (
            <div className="p-2">
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
                <div className="space-y-1 max-h-60 overflow-y-auto">
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

              {/* Index Status Button */}
              <button
                onClick={() => setShowIndexPanel(true)}
                className="w-full mt-3 px-3 py-2 text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-lg border border-border transition-colors flex items-center justify-between"
              >
                <span>Index Status</span>
                <span className="text-text-tertiary">→</span>
              </button>
            </div>
          )}
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="p-2 border-t border-border">
          <button
            onClick={() => (isCommandPaletteOpen.value = true)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-bg-tertiary text-text-tertiary text-xs"
          >
            <div className="flex items-center gap-2">
              <CommandIcon size={12} />
              <span>Command Palette</span>
            </div>
            <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-xs">Ctrl+K</kbd>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header with Drag Region */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-secondary drag-region">
          <div className="flex items-center gap-3 no-drag">
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

            {/* Token Counter */}
            {currentMessages.value.length > 0 && (
              <TokenCounter className="ml-2" />
            )}

            {totalDocsLoaded > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-accent-primary/10 rounded-lg">
                <DocumentIcon size={14} className="text-accent-primary" />
                <span className="text-xs text-accent-primary">{totalDocsLoaded} doc{totalDocsLoaded > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Drag Area - invisible but draggable */}
          <DragRegion className="h-full" />

          <div className="flex items-center gap-1 no-drag">
            {currentSession && (
              <button
                onClick={() => setShowExport(true)}
                className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
                title="Export Chat"
              >
                <DownloadIcon size={18} />
              </button>
            )}
            <button
              onClick={() => (isSettingsOpen.value = true)}
              className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Settings"
            >
              <SettingsIcon size={18} />
            </button>
            <button
              onClick={handleBackToSpotlight}
              className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Back to Spotlight"
            >
              <CloseIcon size={16} />
            </button>

            {/* Window Controls */}
            <div className="ml-2 border-l border-border pl-2">
              <WindowControls
                isMaximized={isMaximized.value}
                showFullscreen={false}
              />
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {showIndexPanel ? (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text-primary">Index Status</h2>
                <button
                  onClick={() => setShowIndexPanel(false)}
                  className="p-1.5 hover:bg-bg-tertiary rounded transition-colors text-text-tertiary hover:text-text-primary"
                >
                  <CloseIcon size={16} />
                </button>
              </div>
              <RagDebugPanel />
            </div>
          ) : currentMessages.value.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <LogoIcon size={48} className="text-text-tertiary mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-text-primary mb-2">Welcome to OmniRecall</h2>
                <p className="text-text-secondary text-sm max-w-md mb-4">
                  {totalDocsLoaded > 0
                    ? `${totalDocsLoaded} document${totalDocsLoaded > 1 ? 's' : ''} loaded. Ask questions!`
                    : "Add documents to enable RAG, or just chat."}
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-text-tertiary">
                  <span><kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded">Ctrl+K</kbd> Command</span>
                  <span><kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded">Ctrl+N</kbd> New Chat</span>
                </div>
                {totalDocsLoaded === 0 && (
                  <button
                    onClick={handleAddDocuments}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-bg-tertiary transition-colors text-sm text-text-secondary"
                  >
                    <FolderIcon size={16} />
                    Add Documents
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {currentMessages.value.map((message, index) => (
                <div
                  key={message.id}
                  className={`group flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 relative ${message.role === "user"
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

                    {/* Message Actions - Always visible */}
                    <div className={`flex items-center gap-1 mt-2 ${message.role === "user" ? "justify-end" : "justify-start"
                      }`}>
                      <button
                        onClick={() => handleCopyMessage(message.content, message.id)}
                        className={`p-1 rounded text-xs ${message.role === "user"
                          ? "text-white/60 hover:text-white hover:bg-white/10"
                          : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
                          }`}
                        title="Copy"
                      >
                        {copiedMessageId === message.id ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                      </button>
                      {message.role === "assistant" && index < currentMessages.value.length - 1 && (
                        <button
                          onClick={() => handleBranch(message.id)}
                          className="p-1 rounded text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
                          title="Branch from here"
                        >
                          <BranchIcon size={12} />
                        </button>
                      )}
                      {message.tokenCount && message.tokenCount > 10 && (
                        <span className={`text-xs px-1 ${message.role === "user" ? "text-white/50" : "text-text-tertiary/60"
                          }`}>
                          ~{message.tokenCount} tokens
                        </span>
                      )}
                    </div>
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
            <div className="flex items-center gap-3 bg-bg-primary rounded-xl border border-border px-4 py-3">
              <textarea
                ref={inputRef}
                value={currentQuery.value}
                onInput={(e) => (currentQuery.value = (e.target as HTMLTextAreaElement).value)}
                onKeyDown={handleKeyDown}
                placeholder={totalDocsLoaded > 0 ? "Ask about your documents..." : "Type your message..."}
                className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary resize-none outline-none text-sm leading-6 min-h-[24px] max-h-[200px] py-0"
                rows={1}
                disabled={isGenerating.value}
                style={{ lineHeight: '24px' }}
              />
              {isGenerating.value ? (
                <button
                  onClick={stopGeneration}
                  className="p-2 rounded-lg bg-error text-white hover:bg-error/90 transition-all flex-shrink-0"
                  title="Stop generating (Ctrl+.)"
                >
                  <StopIcon size={18} />
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
                  <SendIcon size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExport && currentSession && (
        <ExportImport session={currentSession} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
