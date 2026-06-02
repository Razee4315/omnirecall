import { useState, useRef, useEffect, useMemo } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  viewMode,
  isGenerating,
  currentQuery,
  isSettingsOpen,
  documents,
  chatHistory,
  activeSessionId,
  activeBranchId,
  currentMessages,
  deleteChatSession,
  addChatSession,
  addDocument,
  removeDocument,
  ChatSession,
  Document,
  branchFromMessage,
  loadSession,
  startNewChat,
  updateSessionTitle,
  toggleSessionPinned,
  searchResults,
  stopGeneration,
  isCommandPaletteOpen,
  isMaximized,
  isOnline,
} from "../../stores/appStore";
import { useChatSubmit } from "../../hooks/useChatSubmit";
import { toast } from "../../stores/toastStore";
import { useDocumentLoader } from "../../hooks/useDocumentLoader";
import { useDebouncedSearch } from "../../hooks/useDebouncedSearch";
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
  PinIcon,
  EditIcon,
} from "../icons";
import { BranchSelector } from "../common/BranchSelector";
import { Markdown } from "../common/Markdown";
import { TokenCounter } from "../common/TokenCounter";
import { ExportImport } from "../common/ExportImport";
import { FolderManager } from "../common/FolderManager";
import { ModelSelector } from "../common/ModelSelector";
import { WindowControls, DragRegion } from "../common/WindowControls";
import { RagDebugPanel } from "../common/RagDebugPanel";
import { DocumentListSkeleton } from "../common/Skeleton";

export function Dashboard() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"chats" | "folders" | "docs">("chats");
  const [showExport, setShowExport] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showIndexPanel, setShowIndexPanel] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Whether the user is scrolled to (near) the bottom. Gates auto-scroll so
  // streaming doesn't yank a user who has scrolled up to read history.
  const isAtBottomRef = useRef(true);

  // Shared hooks - eliminates code duplication with Spotlight
  const { docsWithContent, loadingDocs, totalDocsLoaded } = useDocumentLoader();
  const { localSearchQuery, setLocalSearchQuery } = useDebouncedSearch(300);
  const { handleSubmit, regenerate, retryLast, cleanupStream } = useChatSubmit(docsWithContent, setError);
  const { handleAutoResize, resize } = useAutoResize(200);

  // Keep the textarea height in sync with programmatic value changes (quick
  // prompts, post-submit clear, retry) — onInput alone misses those.
  useEffect(() => {
    resize(inputRef.current);
  }, [currentQuery.value, resize]);

  // Clean up stream listener on unmount
  useEffect(() => cleanupStream, [cleanupStream]);

  // Auto-scroll on new content only when the user is already at the bottom, so
  // streaming doesn't interrupt reading scrolled-up history.
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [currentMessages.value]);

  // Always jump to the bottom when switching into a different conversation.
  useEffect(() => {
    isAtBottomRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [activeSessionId.value]);

  // Group sessions by date once per chatHistory change instead of on every
  // render. This was previously rebuilt inside the JSX IIFE on every signal
  // update — including every streaming chunk — which is O(N) avoidable work.
  const groupedSessions = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();

    const getDateGroup = (dateStr: string) => {
      const ds = new Date(dateStr).toDateString();
      if (ds === todayStr) return "Today";
      if (ds === yesterdayStr) return "Yesterday";
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const pinned: typeof chatHistory.value = [];
    const grouped = chatHistory.value.reduce((acc, session) => {
      if (session.isPinned) {
        pinned.push(session);
        return acc;
      }
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

    return { grouped, sortedGroups, pinned };
  }, [chatHistory.value]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleNewChat = () => {
    startNewChat();
    setError(null);
    inputRef.current?.focus();
  };

  const handleLoadSession = (session: ChatSession) => {
    loadSession(session);
    setError(null);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (deleteConfirmId === sessionId) {
      // Second click confirms deletion. Capture the session first so the toast
      // can offer Undo.
      const deleted = chatHistory.value.find(s => s.id === sessionId);
      deleteChatSession(sessionId);
      if (activeSessionId.value === sessionId) {
        currentMessages.value = [];
        activeSessionId.value = null;
      }
      setDeleteConfirmId(null);
      if (deleted) {
        toast.action("Chat deleted", { label: "Undo", onClick: () => addChatSession(deleted) }, "info");
      }
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

  const handleCopyMessage = async (content: string, messageId: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleBranch = (messageId: string) => {
    if (!activeSessionId.value) return;
    branchFromMessage(activeSessionId.value, messageId);
  };

  const startRename = (session: ChatSession) => {
    setRenamingId(session.id);
    setRenameDraft(session.title);
  };

  const commitRename = () => {
    if (renamingId && renameDraft.trim()) {
      updateSessionTitle(renamingId, renameDraft);
    }
    setRenamingId(null);
    setRenameDraft("");
  };

  // Edit a sent user message and re-ask. Preserves the original turns as a
  // branch (when in a saved session), then drops the user message back into the
  // composer so the user can revise and resend from that point.
  const handleEditMessage = (messageId: string) => {
    if (isGenerating.value) return;
    const idx = currentMessages.value.findIndex(m => m.id === messageId);
    if (idx < 0) return;
    const text = currentMessages.value[idx].content;

    if (activeSessionId.value && idx > 0) {
      // Branch from the message just before this one; the new branch ends right
      // before the user message we're editing.
      const branchId = branchFromMessage(activeSessionId.value, currentMessages.value[idx - 1].id);
      if (branchId) {
        currentMessages.value = currentMessages.value.slice(0, idx);
      } else {
        currentMessages.value = currentMessages.value.slice(0, idx);
      }
    } else {
      // First message or unsaved chat: just truncate to before it.
      currentMessages.value = currentMessages.value.slice(0, idx);
    }
    currentQuery.value = text;
    setError(null);
    inputRef.current?.focus();
  };

  const renderSessionRow = (session: ChatSession) => (
    <div
      key={session.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer?.setData("text/plain", session.id);
        (e.target as HTMLElement).style.opacity = "0.5";
      }}
      onDragEnd={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
      role="button"
      tabIndex={0}
      aria-label={`Open chat ${session.title}`}
      className={`group flex items-center gap-1 px-2 py-2 rounded-lg cursor-grab transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-primary ${activeSessionId.value === session.id
        ? "bg-accent-primary/10 text-accent-primary"
        : "hover:bg-bg-tertiary text-text-primary"
        }`}
      onClick={() => handleLoadSession(session)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleLoadSession(session); }
      }}
    >
      {renamingId === session.id ? (
        <input
          value={renameDraft}
          onInput={(e) => setRenameDraft((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") { setRenamingId(null); setRenameDraft(""); }
          }}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          aria-label="Rename chat"
          className="flex-1 min-w-0 bg-bg-primary border border-accent-primary rounded px-1 py-0.5 text-sm text-text-primary outline-none"
        />
      ) : (
        <span
          className="text-sm truncate flex-1"
          onDblClick={(e) => { e.stopPropagation(); startRename(session); }}
        >
          {session.title}
        </span>
      )}

      {session.branches.length > 0 && renamingId !== session.id && (
        <span className="flex items-center gap-0.5 text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full flex-shrink-0">
          <BranchIcon size={8} />
          {session.branches.length + 1}
        </span>
      )}

      {renamingId !== session.id && (
        <div className="flex items-center flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); toggleSessionPinned(session.id); }}
            className={`p-1 rounded min-w-[24px] min-h-[24px] flex items-center justify-center transition-all ${session.isPinned
              ? "opacity-100 text-accent-primary"
              : "opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary"
              }`}
            aria-label={session.isPinned ? "Unpin chat" : "Pin chat"}
            aria-pressed={!!session.isPinned}
            title={session.isPinned ? "Unpin" : "Pin"}
          >
            <PinIcon size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); startRename(session); }}
            className="p-1 rounded min-w-[24px] min-h-[24px] flex items-center justify-center opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary transition-all"
            aria-label="Rename chat"
            title="Rename"
          >
            <EditIcon size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
            className={`p-1 rounded min-w-[24px] min-h-[24px] flex items-center justify-center transition-all ${deleteConfirmId === session.id
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
      )}
    </div>
  );

  const currentSession = chatHistory.value.find(s => s.id === activeSessionId.value);

  return (
    <div className="h-full w-full flex bg-bg-primary">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-72" : "w-0"} transition-[width] duration-200 ease-out overflow-hidden border-r border-border bg-bg-secondary flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-3 border-b border-border space-y-2">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent-primary text-on-accent text-sm hover:bg-accent-primary/90 transition-colors"
            title="New Chat (Ctrl+N)"
          >
            <PlusIcon size={16} />
            <span>New Chat</span>
            <kbd className="ml-auto px-1.5 py-0.5 bg-white/15 rounded text-[10px] font-mono">Ctrl+N</kbd>
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
              ) : (
                  <div className="space-y-2 px-2">
                    {chatHistory.value.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                        <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center">
                          <LogoIcon size={20} className="text-text-tertiary" />
                        </div>
                        <div className="text-xs text-text-tertiary">No conversations yet</div>
                        <div className="text-[10px] text-text-tertiary">Start chatting to see your history here</div>
                      </div>
                    ) : (
                      <>
                        {groupedSessions.pinned.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1 text-xs text-text-tertiary px-2 py-1 uppercase tracking-wide">
                              <PinIcon size={10} /> Pinned
                            </div>
                            <div className="space-y-0.5">
                              {groupedSessions.pinned.map(renderSessionRow)}
                            </div>
                          </div>
                        )}
                        {groupedSessions.sortedGroups.map(group => (
                          <div key={group}>
                            <div className="text-xs text-text-tertiary px-2 py-1 uppercase tracking-wide">{group}</div>
                            <div className="space-y-0.5">
                              {groupedSessions.grouped[group].map(renderSessionRow)}
                            </div>
                          </div>
                        ))}
                      </>
                  )}
                  </div>
              )}
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
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-secondary drag-region gap-2">
          <div className="flex items-center gap-3 no-drag min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <MenuIcon size={18} />
            </button>
            <LogoIcon size={22} className="text-accent-primary" aria-hidden="true" />
            {/* App name only at wider widths - keeps the header airy when the
                model selector / token counter / doc badge are all visible. */}
            <span className="hidden lg:inline font-semibold text-text-primary">OmniRecall</span>

            {/* Model Selector */}
            <div className="lg:ml-3 ml-1 min-w-0">
              <ModelSelector />
            </div>

            {/* Token Counter */}
            {currentMessages.value.length > 0 && (
              <TokenCounter className="ml-2" />
            )}

            {totalDocsLoaded > 0 && (
              <button
                onClick={() => { setSidebarOpen(true); setSidebarTab("docs"); }}
                className="flex items-center gap-1.5 px-2 py-1 bg-accent-primary/10 rounded-lg hover:bg-accent-primary/20 transition-colors"
                title={`${totalDocsLoaded} document${totalDocsLoaded > 1 ? "s" : ""} loaded — click to manage`}
                aria-label={`Manage ${totalDocsLoaded} loaded document${totalDocsLoaded > 1 ? "s" : ""}`}
              >
                <DocumentIcon size={14} className="text-accent-primary" />
                <span className="text-xs text-accent-primary">{totalDocsLoaded} doc{totalDocsLoaded > 1 ? 's' : ''}</span>
              </button>
            )}

            {!isOnline.value && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-warning/15 text-warning text-xs font-medium"
                title="No internet connection — only local Ollama models will work"
              >
                Offline
              </span>
            )}
          </div>

          {/* Drag Area - invisible but draggable */}
          <DragRegion className="h-full" />

          <div className="flex items-center gap-0.5 no-drag flex-shrink-0">
            {/* Per-chat actions cluster (only visible when there's a session). */}
            {currentSession && (
              <>
                <button
                  onClick={() => setShowExport(true)}
                  className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
                  title="Export chat"
                  aria-label="Export chat"
                >
                  <DownloadIcon size={18} />
                </button>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
              </>
            )}
            {/* App-level actions cluster. */}
            <button
              onClick={() => (isSettingsOpen.value = true)}
              className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Settings (Ctrl+,)"
              aria-label="Settings"
            >
              <SettingsIcon size={18} />
            </button>
            <button
              onClick={handleBackToSpotlight}
              className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
              title="Back to Spotlight (Esc)"
              aria-label="Back to Spotlight"
            >
              <CloseIcon size={16} />
            </button>

            {/* Window Controls */}
            <div className="ml-1 border-l border-border pl-1">
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
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-atomic="false"
          aria-busy={isGenerating.value}
          aria-label="Conversation"
          onScroll={(e) => {
            const el = e.target as HTMLDivElement;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
            isAtBottomRef.current = atBottom;
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
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent-primary text-on-accent hover:bg-accent-primary/90 transition-colors text-sm font-medium shadow-lg shadow-accent-primary/20"
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

              {currentMessages.value.map((message, index) => {
                // Skip the empty assistant placeholder while streaming — the
                // typing indicator stands in for it until the first chunk.
                if (message.role === "assistant" && !message.content) return null;
                return (
                <div
                  key={message.id}
                  className={`group flex flex-col ${message.role === "user" ? "items-end" : "items-start"} animate-message-reveal`}
                  style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 ${message.role === "user"
                      ? "bg-accent-primary text-on-accent"
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
                  </div>

                  {/* Actions live OUTSIDE the bubble (so the bubble hugs its
                      text) and are revealed on hover/focus. */}
                  <div className={`flex items-center gap-0.5 mt-1 px-1 transition-opacity ${
                      copiedMessageId === message.id
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    } ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <button
                      onClick={() => handleCopyMessage(message.content, message.id)}
                      className="p-1 rounded min-w-[24px] min-h-[24px] flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                      title={copiedMessageId === message.id ? "Copied!" : "Copy message"}
                      aria-label="Copy message"
                    >
                      {copiedMessageId === message.id ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                    </button>

                    {message.role === "user" && !isGenerating.value && (
                      <button
                        onClick={() => handleEditMessage(message.id)}
                        className="p-1 rounded min-w-[24px] min-h-[24px] flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                        title="Edit & resend"
                        aria-label="Edit and resend message"
                      >
                        <EditIcon size={12} />
                      </button>
                    )}

                    {message.role === "assistant" && index === currentMessages.value.length - 1 && !isGenerating.value && (
                      <button
                        onClick={() => regenerate(message.id)}
                        className="p-1 rounded min-w-[24px] min-h-[24px] flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                        title="Regenerate response (creates a new branch)"
                        aria-label="Regenerate response"
                      >
                        <RegenerateIcon size={12} />
                      </button>
                    )}

                    {message.role === "assistant" && index < currentMessages.value.length - 1 && (
                      <button
                        onClick={() => handleBranch(message.id)}
                        className="p-1 rounded min-w-[24px] min-h-[24px] flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                        title="Branch conversation from here"
                        aria-label="Branch from this message"
                      >
                        <BranchIcon size={12} />
                      </button>
                    )}

                    {message.tokenCount && message.tokenCount > 10 && (
                      <span className="text-[10px] px-1 text-text-tertiary/60">
                        ~{message.tokenCount} tokens
                      </span>
                    )}
                  </div>
                </div>
                );
              })}

              {isGenerating.value && !currentMessages.value[currentMessages.value.length - 1]?.content && (
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
              onClick={() => { isAtBottomRef.current = true; messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }}
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
          <div className="px-4 py-2 bg-error/10 border-t border-error/20 flex items-center justify-between gap-3" role="alert">
            <p className="text-sm text-error flex-1">{error}</p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/Settings|API key/i.test(error) ? (
                <button
                  onClick={() => (isSettingsOpen.value = true)}
                  className="px-2.5 py-1 rounded text-xs bg-error/20 text-error hover:bg-error/30 transition-colors"
                >
                  Open Settings
                </button>
              ) : (
                <button
                  onClick={() => retryLast()}
                  disabled={isGenerating.value}
                  className="px-2.5 py-1 rounded text-xs bg-error/20 text-error hover:bg-error/30 transition-colors disabled:opacity-50"
                >
                  Try again
                </button>
              )}
              <button
                onClick={() => setError(null)}
                className="p-1 rounded text-error/70 hover:text-error hover:bg-error/10 transition-colors"
                aria-label="Dismiss error"
              >
                <CloseIcon size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border bg-bg-secondary p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 bg-bg-primary rounded-xl border border-border px-4 py-3 focus-within:border-accent-primary transition-colors">
              <textarea
                ref={inputRef}
                value={currentQuery.value}
                onInput={(e) => {
                  currentQuery.value = (e.target as HTMLTextAreaElement).value;
                  handleAutoResize(e);
                }}
                onKeyDown={handleKeyDown}
                placeholder={totalDocsLoaded > 0 ? "Ask about your documents..." : "Type your message..."}
                className="composer-input flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary resize-none outline-none text-sm leading-6 min-h-[24px] max-h-[200px] py-0"
                rows={1}
                disabled={isGenerating.value}
                maxLength={200000}
                aria-label="Chat message input"
                style={{ lineHeight: '24px' }}
              />
              {isGenerating.value ? (
                <button
                  onClick={stopGeneration}
                  className="p-2 rounded-lg bg-error text-white hover:bg-error/90 transition-all flex-shrink-0"
                  title="Stop generating (Ctrl+.)"
                  aria-label="Stop generating"
                >
                  <StopIcon size={18} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!currentQuery.value.trim()}
                  className={`p-2 rounded-lg transition-all flex-shrink-0 ${currentQuery.value.trim()
                    ? "bg-accent-primary text-on-accent hover:bg-accent-primary/90"
                    : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                    }`}
                  title={currentQuery.value.trim() ? "Send (Enter)" : "Type a message to send"}
                  aria-label={currentQuery.value.trim() ? "Send message" : "Send disabled — type a message first"}
                >
                  <SendIcon size={18} />
                </button>
              )}
            </div>
            {/* Footer: character counter (only when getting close to limit) and shortcut hints */}
            <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-text-tertiary">
              <div className="flex items-center gap-3">
                <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded">Enter</kbd> send</span>
                <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded">Shift</kbd>+<kbd className="px-1 py-0.5 bg-bg-tertiary rounded">Enter</kbd> newline</span>
              </div>
              {currentQuery.value.length > 100_000 && (
                <span className={currentQuery.value.length > 180_000 ? "text-warning" : ""}>
                  {currentQuery.value.length.toLocaleString()} / 200,000
                </span>
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
