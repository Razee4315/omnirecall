import { useEffect, useMemo, useState } from "preact/hooks";
import {
  activeSessionId,
  chatHistory,
  ChatSession,
  currentMessages,
  currentQuery,
  exportDialog,
  isCommandPaletteOpen,
  isMaximized,
  isOnline,
  isSettingsOpen,
  openSearchResult,
  orderedSessions,
  readableDocumentCount,
  searchChatHistory,
  SearchResult,
  sessionActivity,
  setDashboardMode,
  startNewChat,
} from "../../stores/appStore";
import { chatError } from "../../stores/chatActions";
import { pickAndAddDocuments } from "../../lib/documents";
import {
  CloseIcon,
  CollapseIcon,
  CommandIcon,
  DownloadIcon,
  FolderIcon,
  LogoIcon,
  MenuIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from "../icons";
import { FolderManager } from "../common/FolderManager";
import { ModelSelector } from "../common/ModelSelector";
import { TokenCounter } from "../common/TokenCounter";
import { WindowControls, DragRegion } from "../common/WindowControls";
import { ChatComposer, requestComposerFocus } from "../chat/ChatComposer";
import { ChatErrorBanner } from "../chat/ChatErrorBanner";
import { DocsToggle } from "../chat/DocsToggle";
import { MessageList } from "../chat/MessageList";
import { DocumentsPanel } from "./DocumentsPanel";
import { SessionRow } from "./SessionRow";

type SidebarTab = "chats" | "folders" | "docs";

const SIDEBAR_TABS: { id: SidebarTab; label: string }[] = [
  { id: "chats", label: "Chats" },
  { id: "folders", label: "Folders" },
  { id: "docs", label: "Docs" },
];

const QUICK_PROMPTS = [
  "Summarize the key points",
  "Explain this in simple terms",
  "Compare and contrast",
  "Write a brief analysis",
];

const SEARCH_DEBOUNCE_MS = 200;
const headerButton =
  "p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary";

/// Group sessions for the sidebar: pinned first, then by the day of their
/// last activity, newest first.
function groupSessions(sessions: ChatSession[]) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const labelFor = (iso: string) => {
    const date = new Date(iso);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    });
  };

  const pinned: ChatSession[] = [];
  // `sessions` is already ordered by activity, so groups come out in order.
  const groups: { label: string; sessions: ChatSession[] }[] = [];
  for (const session of sessions) {
    if (session.isPinned) {
      pinned.push(session);
      continue;
    }
    const label = labelFor(sessionActivity(session));
    const group = groups[groups.length - 1];
    if (group && group.label === label) group.sessions.push(session);
    else groups.push({ label, sessions: [session] });
  }
  return { pinned, groups };
}

function snippet(result: SearchResult, query: string) {
  const start = Math.max(0, result.matchIndex - 24);
  const end = result.matchIndex + query.length;
  return (
    <>
      {start > 0 && "…"}
      {result.content.slice(start, result.matchIndex)}
      <mark>{result.content.slice(result.matchIndex, end)}</mark>
      {result.content.slice(end, end + 60)}
    </>
  );
}

function ChatsPanel() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const history = chatHistory.value;
  const results = useMemo(() => searchChatHistory(debounced), [debounced, history]);
  const { pinned, groups } = useMemo(() => groupSessions(orderedSessions.value), [orderedSessions.value]);

  return (
    <>
      <div className="p-2">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-bg-tertiary rounded-lg border border-border focus-within:border-accent-primary">
          <SearchIcon size={14} className="text-text-tertiary flex-shrink-0" />
          <input
            type="search"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.stopPropagation();
                setQuery("");
              }
            }}
            placeholder="Search chats..."
            aria-label="Search chats"
            className="flex-1 min-w-0 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-text-tertiary hover:text-text-primary"
              aria-label="Clear search"
            >
              <CloseIcon size={12} />
            </button>
          )}
        </div>
      </div>

      {debounced ? (
        <div className="px-2 pb-2" aria-live="polite">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <div className="text-xs text-text-secondary">No chats match “{debounced}”</div>
              <div className="text-[10px] text-text-tertiary mt-1">Titles and messages in every branch are searched.</div>
            </div>
          ) : (
            <>
              <div className="text-xs text-text-tertiary px-2 py-1">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </div>
              <ul className="space-y-0.5">
                {results.map((result) => (
                  <li key={`${result.sessionId}-${result.branchId}-${result.messageId}`}>
                    <button
                      onClick={() => {
                        openSearchResult(result);
                        chatError.value = null;
                      }}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-bg-tertiary"
                    >
                      <div className="text-xs text-text-tertiary truncate">
                        {result.kind === "title" ? "Chat title" : result.sessionTitle}
                      </div>
                      <div className="text-sm text-text-primary line-clamp-2 mt-0.5">{snippet(result, debounced)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
          <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center">
            <LogoIcon size={20} className="text-text-tertiary" />
          </div>
          <div className="text-xs text-text-tertiary">No conversations yet</div>
          <div className="text-[10px] text-text-tertiary">Start chatting to see your history here</div>
        </div>
      ) : (
        <div className="space-y-2 px-2 pb-2">
          {pinned.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-xs text-text-tertiary px-2 py-1 uppercase tracking-wide">
                <PinIcon size={10} /> Pinned
              </div>
              <div className="space-y-0.5">
                {pinned.map(session => <SessionRow key={session.id} session={session} />)}
              </div>
            </div>
          )}
          {groups.map(group => (
            <div key={group.label}>
              <div className="text-xs text-text-tertiary px-2 py-1 uppercase tracking-wide">{group.label}</div>
              <div className="space-y-0.5">
                {group.sessions.map(session => <SessionRow key={session.id} session={session} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chats");
  const docCount = readableDocumentCount.value;
  const hasSession = chatHistory.value.some(s => s.id === activeSessionId.value);

  const handleNewChat = () => {
    startNewChat();
    chatError.value = null;
    requestComposerFocus();
  };

  const emptyState = (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-lg">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
          <LogoIcon size={36} className="text-accent-primary" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome to OmniRecall</h2>
        <p className="text-text-secondary text-sm mb-6 leading-relaxed">
          {docCount > 0
            ? `${docCount} document${docCount > 1 ? "s" : ""} loaded and ready. Ask questions about your documents or start a general conversation.`
            : "Ask anything, or add documents to get answers grounded in your own files."}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-6 text-left">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                currentQuery.value = `${prompt}: `;
                requestComposerFocus();
              }}
              className="px-3 py-2.5 rounded-lg border border-border bg-bg-secondary hover:bg-bg-tertiary hover:border-accent-primary/30 transition-colors text-left text-sm text-text-secondary hover:text-text-primary"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3">
          {docCount === 0 && (
            <button
              onClick={() => void pickAndAddDocuments()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent-primary text-on-accent hover:bg-accent-primary/90 transition-colors text-sm font-medium"
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
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex bg-bg-primary">
      {/* Sidebar. `inert` keeps the collapsed sidebar out of the tab order. */}
      <aside
        aria-label="Chats, folders and documents"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={`${sidebarOpen ? "w-72" : "w-0 border-r-0"} flex-shrink-0 transition-[width] duration-200 ease-out overflow-hidden border-r border-border bg-bg-secondary flex flex-col`}
      >
        <div className="w-72 flex flex-col h-full">
          <div className="p-3 border-b border-border space-y-2">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent-primary text-on-accent text-sm hover:bg-accent-primary/90 transition-colors"
              title="New Chat (Ctrl+N)"
            >
              <PlusIcon size={16} />
              <span>New Chat</span>
              <kbd className="ml-auto px-1.5 py-0.5 bg-black/15 rounded text-[10px] font-mono">Ctrl+N</kbd>
            </button>

            <div className="flex rounded-lg overflow-hidden border border-border" role="tablist" aria-label="Sidebar">
              {SIDEBAR_TABS.map(tab => (
                <button
                  key={tab.id}
                  role="tab"
                  id={`sidebar-tab-${tab.id}`}
                  aria-selected={sidebarTab === tab.id}
                  aria-controls="sidebar-panel"
                  onClick={() => setSidebarTab(tab.id)}
                  className={`flex-1 px-2 py-1.5 text-xs transition-colors ${
                    sidebarTab === tab.id
                      ? "bg-accent-primary/10 text-accent-primary"
                      : "text-text-secondary hover:bg-bg-tertiary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div
            id="sidebar-panel"
            role="tabpanel"
            aria-labelledby={`sidebar-tab-${sidebarTab}`}
            className="flex-1 overflow-y-auto"
          >
            {sidebarTab === "chats" && <ChatsPanel />}
            {sidebarTab === "folders" && <FolderManager />}
            {sidebarTab === "docs" && <DocumentsPanel />}
          </div>

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
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-secondary drag-region">
          <div className="flex items-center gap-2 no-drag min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={headerButton}
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              aria-expanded={sidebarOpen}
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <MenuIcon size={18} />
            </button>
            <LogoIcon size={22} className="text-accent-primary flex-shrink-0" />
            <span className="hidden lg:inline font-semibold text-text-primary">OmniRecall</span>
            <div className="lg:ml-2">
              <ModelSelector />
            </div>
            {currentMessages.value.length > 0 && <TokenCounter />}
            <DocsToggle compact={false} />
            {!isOnline.value && (
              <span
                className="px-2 py-1 rounded-lg bg-warning/15 text-warning text-xs font-medium"
                title="No internet connection — only local Ollama models will work"
              >
                Offline
              </span>
            )}
          </div>

          <DragRegion className="h-full" />

          <div className="flex items-center gap-0.5 no-drag flex-shrink-0">
            {hasSession && (
              <button
                onClick={() => (exportDialog.value = "export")}
                className={headerButton}
                title="Export chat"
                aria-label="Export chat"
              >
                <DownloadIcon size={18} />
              </button>
            )}
            <button
              onClick={() => (isSettingsOpen.value = true)}
              className={headerButton}
              title="Settings (Ctrl+,)"
              aria-label="Settings"
            >
              <SettingsIcon size={18} />
            </button>
            <button
              onClick={() => void setDashboardMode(false)}
              className={headerButton}
              title="Back to compact Spotlight view"
              aria-label="Back to compact Spotlight view"
            >
              <CollapseIcon size={16} />
            </button>

            <div className="ml-1 border-l border-border pl-1">
              <WindowControls isMaximized={isMaximized.value} />
            </div>
          </div>
        </div>

        <MessageList compact={false} emptyState={emptyState} />
        <ChatErrorBanner compact={false} />
        <ChatComposer
          compact={false}
          placeholder={docCount > 0 ? "Ask about your documents..." : "Type your message..."}
        />
      </main>
    </div>
  );
}
