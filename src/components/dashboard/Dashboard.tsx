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
  activeBranchId,
  currentMessages,
  deleteChatSession,
  addDocument,
  removeDocument,
  ChatMessage,
  ChatSession,
  Document,
  estimateTokens,
  branchFromMessage,
  updateBranchMessages,
  saveChatHistoryNow,
  searchResults,
  stopGeneration,
  isCommandPaletteOpen,
  isMaximized,
} from "../../stores/appStore";
import { useChatSubmit, parseApiError } from "../../hooks/useChatSubmit";
import { useDocumentLoader } from "../../hooks/useDocumentLoader";
import { useDebouncedSearch } from "../../hooks/useDebouncedSearch";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useAutoResize } from "../../hooks/useAutoResize";
import {
  LogoIcon,
  SendIcon,
  SettingsIcon,
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
  RegenerateIcon,
} from "../icons";
import { BranchSelector } from "../common/BranchSelector";
import { Markdown } from "../common/Markdown";
import { TokenCounter } from "../common/TokenCounter";
import { ExportImport } from "../common/ExportImport";
import { FolderManager } from "../common/FolderManager";
import { WindowControls, DragRegion } from "../common/WindowControls";
import { RagDebugPanel } from "../common/RagDebugPanel";
import { DocumentListSkeleton } from "../common/Skeleton";

export function Dashboard() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"chats" | "folders" | "docs">("chats");
  const [showExport, setShowExport] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showIndexPanel, setShowIndexPanel] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Shared hooks - eliminates code duplication with Spotlight
  const { docsWithContent, loadingDocs, totalDocsLoaded } = useDocumentLoader();
  const { localSearchQuery, setLocalSearchQuery } = useDebouncedSearch(300);
  const { handleSubmit, cleanupStream } = useChatSubmit(docsWithContent, setError);
  const modelSelectorRef = useClickOutside<HTMLDivElement>(() => setShowModelSelect(false), showModelSelect);
  const handleAutoResize = useAutoResize(200);

  // Clean up stream listener on unmount
  useEffect(() => cleanupStream, [cleanupStream]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [currentMessages.value]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleNewChat = () => {
    currentMessages.value = [];
    activeSessionId.value = null;
    activeBranchId.value = null; // Reset branch state for new chat
    setError(null);
    currentQuery.value = "";
    inputRef.current?.focus();
  };

  const handleLoadSession = (session: ChatSession) => {
    // Restore the active branch state
    const branchId = session.activeBranchId || null;
    activeBranchId.value = branchId;

    // Load messages from the active branch or main
    if (branchId && session.branchMessages && session.branchMessages[branchId]) {
      currentMessages.value = session.branchMessages[branchId];
    } else {
      currentMessages.value = session.messages;
    }

    activeSessionId.value = session.id;
    setError(null);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (deleteConfirmId === sessionId) {
      // Second click confirms deletion
      deleteChatSession(sessionId);
      if (activeSessionId.value === sessionId) {
        currentMessages.value = [];
        activeSessionId.value = null;
      }
      setDeleteConfirmId(null);
    } else {
      // First click shows confirmation
      setDeleteConfirmId(sessionId);
      // Auto-reset after 3 seconds if not confirmed
      setTimeout(() => setDeleteConfirmId(prev => prev === sessionId ? null : prev), 3000);
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

  // Regenerate: Create a branch from the user message before this assistant response
  const handleRegenerate = async (assistantMessageId: string) => {
    if (!activeSessionId.value || isGenerating.value) return;

    // Find this message and the user message before it
    const msgIndex = currentMessages.value.findIndex(m => m.id === assistantMessageId);
    if (msgIndex <= 0) return;

    const userMessage = currentMessages.value[msgIndex - 1];
    if (userMessage.role !== "user") return;

    // Create a branch from the user message
    const branchId = branchFromMessage(activeSessionId.value, userMessage.id);
    if (!branchId) return;

    // Now re-submit to get a new response
    const provider = providers.value.find(p => p.id === activeProvider.value);
    if (!provider?.apiKey && provider?.id !== "ollama") return;

    isGenerating.value = true;

    // Create placeholder for assistant message
    const newAssistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: newAssistantId,
      role: "assistant",
      content: "",
      tokenCount: 0,
    };
    currentMessages.value = [...currentMessages.value, assistantMessage];

    try {
      const history = currentMessages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      const documentContext = docsWithContent
        .filter(d => d.content && d.content.length > 0)
        .map(d => ({ name: d.name, content: d.content! }));

      let unlisten: UnlistenFn | null = null;
      let fullResponse = "";

      const regenIdx = currentMessages.value.length - 1;
      unlisten = await listen<{ chunk: string; done: boolean }>("chat-stream", (event) => {
        if (!event.payload.done) {
          fullResponse += event.payload.chunk;
          const msgs = [...currentMessages.value];
          msgs[regenIdx] = { ...msgs[regenIdx], content: fullResponse };
          currentMessages.value = msgs;
        } else {
          // Final update with token count
          const msgs = [...currentMessages.value];
          msgs[regenIdx] = { ...msgs[regenIdx], content: fullResponse, tokenCount: estimateTokens(fullResponse) };
          currentMessages.value = msgs;

          isGenerating.value = false;
          if (unlisten) unlisten();
          // Save to branch
          updateBranchMessages(activeSessionId.value!, activeBranchId.value, currentMessages.value);
          saveChatHistoryNow();
        }
      });

      await invoke("send_message_stream", {
        message: userMessage.content,
        history: history.slice(0, -1), // Exclude the last user message we're re-submitting
        documents: documentContext,
        provider: activeProvider.value,
        model: activeModel.value,
        apiKey: provider?.apiKey || "",
      });
    } catch (err: any) {
      setError(parseApiError(err));
      isGenerating.value = false;
    }
  };

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
                      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                        <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center">
                          <LogoIcon size={20} className="text-text-tertiary" />
                        </div>
                        <div className="text-xs text-text-tertiary">No conversations yet</div>
                        <div className="text-[10px] text-text-tertiary">Start chatting to see your history here</div>
                      </div>
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
                              {/* Branch count badge */}
                              {session.branches.length > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full">
                                  <BranchIcon size={8} />
                                  {session.branches.length + 1}
                                </span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                className={`p-1 rounded transition-all min-w-[24px] min-h-[24px] flex items-center justify-center ${
                                  deleteConfirmId === session.id
                                    ? "opacity-100 bg-error/20 text-error"
                                    : "opacity-0 group-hover:opacity-100 hover:bg-error/20 hover:text-error"
                                }`}
                                aria-label={deleteConfirmId === session.id ? "Click again to confirm delete" : "Delete chat"}
                                title={deleteConfirmId === session.id ? "Click to confirm" : "Delete"}
                              >
                                {deleteConfirmId === session.id ? (
                                  <span className="text-[10px] font-medium">?</span>
                                ) : (
                                  <CloseIcon size={12} />
                                )}
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
                <DocumentListSkeleton count={3} />
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
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <MenuIcon size={18} />
            </button>
            <LogoIcon size={24} className="text-accent-primary" />
            <span className="font-semibold text-text-primary">OmniRecall</span>

            {/* Model Selector */}
            <div className="relative ml-4" ref={modelSelectorRef}>
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
        <div
          className="flex-1 overflow-y-auto p-4 relative"
          ref={messagesContainerRef}
          onScroll={(e) => {
            const el = e.target as HTMLDivElement;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
            setShowScrollBottom(!atBottom && currentMessages.value.length > 3);
          }}
        >
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
              <div className="text-center max-w-lg">
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
                  <LogoIcon size={36} className="text-accent-primary" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome to OmniRecall</h2>
                <p className="text-text-secondary text-sm mb-6 leading-relaxed">
                  {totalDocsLoaded > 0
                    ? `${totalDocsLoaded} document${totalDocsLoaded > 1 ? 's' : ''} loaded and ready. Ask questions about your documents or start a general conversation.`
                    : "Your AI-powered document assistant. Add documents for RAG-powered Q&A, or start chatting right away."}
                </p>

                {/* Quick Start Prompts */}
                <div className="grid grid-cols-2 gap-2 mb-6 text-left">
                  {[
                    { text: "Summarize the key points", icon: "S" },
                    { text: "Explain this in simple terms", icon: "E" },
                    { text: "Compare and contrast", icon: "C" },
                    { text: "Write a brief analysis", icon: "W" },
                  ].map((suggestion) => (
                    <button
                      key={suggestion.text}
                      onClick={() => {
                        currentQuery.value = suggestion.text;
                        inputRef.current?.focus();
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-bg-secondary hover:bg-bg-tertiary hover:border-accent-primary/30 transition-all text-left group"
                    >
                      <span className="w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center text-xs font-bold text-accent-primary flex-shrink-0 group-hover:bg-accent-primary/20 transition-colors">
                        {suggestion.icon}
                      </span>
                      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{suggestion.text}</span>
                    </button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-3">
                  {totalDocsLoaded === 0 && (
                    <button
                      onClick={handleAddDocuments}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors text-sm font-medium shadow-lg shadow-accent-primary/20"
                    >
                      <FolderIcon size={16} />
                      Add Documents
                    </button>
                  )}
                  <button
                    onClick={() => (isCommandPaletteOpen.value = true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-bg-tertiary transition-colors text-sm text-text-secondary"
                  >
                    <CommandIcon size={16} />
                    Commands
                    <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-xs ml-1">Ctrl+K</kbd>
                  </button>
                </div>

                {/* Keyboard Hints */}
                <div className="mt-6 flex items-center justify-center gap-4 text-xs text-text-tertiary">
                  <span><kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded border border-border">Ctrl+N</kbd> New Chat</span>
                  <span><kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded border border-border">Ctrl+Shift+M</kbd> Compare</span>
                  <span><kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded border border-border">?</kbd> Shortcuts</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Branch Selector - Show when there are branches */}
              {(() => {
                const sessionId = activeSessionId.value;
                if (!sessionId) return null;
                const session = chatHistory.value.find(s => s.id === sessionId);
                if (!session || session.branches.length === 0) return null;
                return (
                  <div className="flex justify-center mb-2">
                    <BranchSelector />
                  </div>
                );
              })()}

              {currentMessages.value.map((message, index) => (
                <div
                  key={message.id}
                  className={`group flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-message-reveal`}
                  style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 relative ${message.role === "user"
                      ? "bg-accent-primary text-white"
                      : "bg-bg-secondary text-text-primary border border-border"
                      }`}
                  >
                    {/* Branch indicator - show when viewing a branch */}
                    {message.role === "assistant" && activeBranchId.value && index === 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-accent-primary/70 mb-1.5">
                        <BranchIcon size={10} />
                        <span>Branch</span>
                      </div>
                    )}

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

                      {/* Regenerate button - only on latest assistant message */}
                      {message.role === "assistant" && index === currentMessages.value.length - 1 && !isGenerating.value && (
                        <button
                          onClick={() => handleRegenerate(message.id)}
                          className="p-1 rounded text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
                          title="Regenerate (creates a new branch)"
                        >
                          <RegenerateIcon size={12} />
                        </button>
                      )}

                      {/* Branch button - on all assistant messages except the last */}
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
                        <span className={`text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity ${message.role === "user" ? "text-white/50" : "text-text-tertiary/60"
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

          {/* Scroll to Bottom Button */}
          {showScrollBottom && (
            <button
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="absolute bottom-4 right-6 p-2 rounded-full bg-bg-secondary border border-border shadow-lg hover:bg-bg-tertiary transition-colors z-10"
              aria-label="Scroll to bottom"
              title="Scroll to bottom"
            >
              <ChevronDownIcon size={16} className="text-text-secondary" />
            </button>
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
                onInput={(e) => {
                  currentQuery.value = (e.target as HTMLTextAreaElement).value;
                  handleAutoResize(e);
                }}
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
