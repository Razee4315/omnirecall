import { useEffect, useMemo, useState } from "preact/hooks";
import {
  activeSessionId,
  chatHistory,
  ChatSession,
  documents,
  exportDialog,
  isCommandPaletteOpen,
  isFullscreen,
  isMaximized,
  isSettingsOpen,
  isShortcutsHelpOpen,
  isSidebarOpen,
  openSearchResult,
  orderedSessions,
  readableDocumentCount,
  searchChatHistory,
  SearchResult,
  sessionActivity,
  setDashboardMode,
  setSidebarOpen,
  sidebarWidth,
  startNewChat,
  chatFolders,
  currentMessages,
} from "../../stores/appStore";
import { chatError } from "../../stores/chatActions";
import { handleTitleBarMouseDown, toggleMaximize } from "../../lib/window";
import {
  BookIcon,
  CloseIcon,
  CollapseIcon,
  CommandIcon,
  DownloadIcon,
  FolderIcon,
  KeyboardIcon,
  LogoMark,
  MenuIcon,
  MessageIcon,
  NewChatIcon,
  PinIcon,
  SearchIcon,
  SettingsIcon,
} from "../icons";
import { FolderManager } from "../common/FolderManager";
import { ModelSelector } from "../common/ModelSelector";
import { TokenCounter } from "../common/TokenCounter";
import { WindowControls } from "../common/WindowControls";
import { ChatComposer, requestComposerFocus } from "../chat/ChatComposer";
import { ChatErrorBanner } from "../chat/ChatErrorBanner";
import { EmptyState } from "../chat/EmptyState";
import { MessageList } from "../chat/MessageList";
import { DocumentsPanel } from "./DocumentsPanel";
import { SessionRow } from "./SessionRow";
import { SidebarResizer } from "./SidebarResizer";

type SidebarTab = "chats" | "folders" | "docs";

const SEARCH_DEBOUNCE_MS = 180;
const TITLE_BAR = "h-11";

/// Group sessions for the sidebar: pinned first, then by recency.
function groupSessions(sessions: ChatSession[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;

  const labelFor = (iso: string) => {
    const t = new Date(iso).getTime();
    if (t >= startOfToday) return "Today";
    if (t >= startOfToday - day) return "Yesterday";
    if (t >= startOfToday - 7 * day) return "Previous 7 days";
    if (t >= startOfToday - 30 * day) return "Previous 30 days";
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, {
      month: "long",
      year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
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

function GroupLabel({ children }: { children: preact.ComponentChildren }) {
  return <div className="section-label flex items-center gap-1.5 px-2.5 pt-3 pb-1">{children}</div>;
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
      <div className="px-2.5 pb-1 pt-0.5 sticky top-0 z-10 bg-surface">
        <label className="field flex items-center gap-2 h-8 px-2.5 cursor-text">
          <SearchIcon size={14} className="text-fg-subtle flex-shrink-0" />
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
            placeholder="Search chats"
            aria-label="Search chats"
            className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-fg-subtle [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button onClick={() => setQuery("")} className="icon-btn icon-btn-sm -mr-1" aria-label="Clear search">
              <CloseIcon size={12} />
            </button>
          )}
        </label>
      </div>

      {debounced ? (
        <div className="px-1.5 pb-2" aria-live="polite">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <div className="text-[13px] text-fg-muted">No chats match “{debounced}”</div>
              <div className="text-2xs text-fg-subtle mt-1">Titles and messages in every branch are searched.</div>
            </div>
          ) : (
            <>
              <GroupLabel>
                {results.length} result{results.length !== 1 ? "s" : ""}
              </GroupLabel>
              <ul className="space-y-px">
                {results.map((result) => (
                  <li key={`${result.sessionId}-${result.branchId}-${result.messageId}`}>
                    <button
                      onClick={() => {
                        openSearchResult(result);
                        chatError.value = null;
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="text-2xs text-fg-subtle truncate">
                        {result.kind === "title" ? "Chat title" : result.sessionTitle}
                      </div>
                      <div className="text-[13px] text-fg line-clamp-2 mt-0.5">{snippet(result, debounced)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-fg-subtle">
            <MessageIcon size={18} />
          </div>
          <div className="text-[13px] text-fg-muted font-medium">No conversations yet</div>
          <div className="text-2xs text-fg-subtle leading-relaxed">Your chats will appear here, grouped by day.</div>
        </div>
      ) : (
        <div className="px-1.5 pb-3">
          {pinned.length > 0 && (
            <section>
              <GroupLabel>
                <PinIcon size={10} /> Pinned
              </GroupLabel>
              <div className="space-y-px">
                {pinned.map(session => <SessionRow key={session.id} session={session} />)}
              </div>
            </section>
          )}
          {groups.map(group => (
            <section key={group.label}>
              <GroupLabel>{group.label}</GroupLabel>
              <div className="space-y-px">
                {group.sessions.map(session => <SessionRow key={session.id} session={session} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

export function Dashboard() {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chats");
  const [resizing, setResizing] = useState(false);
  const sidebarOpen = isSidebarOpen.value;
  const docCount = readableDocumentCount.value;
  const session = chatHistory.value.find(s => s.id === activeSessionId.value);
  const framed = !isMaximized.value && !isFullscreen.value;

  const tabs: { id: SidebarTab; label: string; icon: preact.ComponentChild; count: number }[] = [
    { id: "chats", label: "Chats", icon: <MessageIcon size={14} />, count: chatHistory.value.length },
    { id: "folders", label: "Folders", icon: <FolderIcon size={14} />, count: chatFolders.value.length },
    { id: "docs", label: "Docs", icon: <BookIcon size={14} />, count: documents.value.length },
  ];

  const handleNewChat = () => {
    startNewChat();
    chatError.value = null;
    requestComposerFocus();
  };

  // Ctrl+B toggles the sidebar, as in most editors.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
        e.preventDefault();
        setSidebarOpen(!isSidebarOpen.value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const titleBarDrag = (e: MouseEvent) => handleTitleBarMouseDown(e, () => void toggleMaximize());

  return (
    <div
      className={`relative h-full w-full flex overflow-hidden bg-canvas text-fg ${
        framed ? "rounded-[10px] border border-line-strong" : ""
      }`}
    >
      {/* Sidebar. `inert` keeps the collapsed sidebar out of the tab order. */}
      <aside
        aria-label="Chats, folders and documents"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        style={{ width: sidebarOpen ? sidebarWidth.value : 0 }}
        className={`relative flex-shrink-0 bg-surface border-r border-line ${sidebarOpen ? "" : "border-r-0"} ${
          resizing ? "" : "transition-[width] duration-200 ease-out"
        }`}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="h-full flex flex-col" style={{ width: sidebarWidth.value }}>
            <div className={`${TITLE_BAR} flex items-center gap-2 pl-3 pr-1.5 flex-shrink-0 select-none`} onMouseDown={titleBarDrag}>
              <LogoMark size={22} />
              <span className="text-[13px] font-semibold tracking-[-0.01em]">OmniRecall</span>
              <div className="flex-1 self-stretch" />
              <button
                onClick={() => setSidebarOpen(false)}
                className="icon-btn"
                aria-label="Close sidebar"
                title="Close sidebar (Ctrl+B)"
              >
                <MenuIcon size={15} />
              </button>
            </div>

            <div className="px-2.5 pb-2 flex-shrink-0">
              <button
                onClick={handleNewChat}
                className="group w-full flex items-center gap-2 h-9 px-2.5 rounded-xl border border-line bg-canvas/60 hover:bg-surface-2 hover:border-line-strong text-[13px] font-medium text-fg transition-colors"
                title="New chat (Ctrl+N)"
              >
                <NewChatIcon size={15} className="text-accent" />
                New chat
                <span className="ml-auto flex gap-0.5 opacity-70 group-hover:opacity-100">
                  <span className="kbd">Ctrl</span>
                  <span className="kbd">N</span>
                </span>
              </button>
            </div>

            <div className="px-2.5 pb-2 flex-shrink-0">
              <div className="grid grid-cols-3 p-0.5 rounded-lg bg-canvas/70 border border-line" role="tablist" aria-label="Sidebar">
                {tabs.map(tab => {
                  const selected = sidebarTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      id={`sidebar-tab-${tab.id}`}
                      aria-selected={selected}
                      aria-controls="sidebar-panel"
                      onClick={() => setSidebarTab(tab.id)}
                      className={`flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-all ${
                        selected ? "bg-surface-3 text-fg shadow-soft" : "text-fg-subtle hover:text-fg-muted"
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div id="sidebar-panel" role="tabpanel" aria-labelledby={`sidebar-tab-${sidebarTab}`} className="flex-1 min-h-0 overflow-y-auto">
              {sidebarTab === "chats" && <ChatsPanel />}
              {sidebarTab === "folders" && <FolderManager />}
              {sidebarTab === "docs" && <DocumentsPanel />}
            </div>

            <div className="flex items-center gap-1 p-2 border-t border-line flex-shrink-0">
              <button onClick={() => (isSettingsOpen.value = true)} className="btn btn-ghost flex-1 justify-start px-2" title="Settings (Ctrl+,)">
                <SettingsIcon size={15} />
                Settings
              </button>
              <button onClick={() => (isCommandPaletteOpen.value = true)} className="icon-btn" title="Command palette (Ctrl+K)" aria-label="Command palette">
                <CommandIcon size={15} />
              </button>
              <button onClick={() => (isShortcutsHelpOpen.value = true)} className="icon-btn" title="Keyboard shortcuts (Ctrl+/)" aria-label="Keyboard shortcuts">
                <KeyboardIcon size={15} />
              </button>
            </div>
          </div>
        </div>
        {sidebarOpen && <SidebarResizer onDragging={setResizing} />}
      </aside>

      {/* Conversation */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header
          className={`${TITLE_BAR} flex items-center gap-1 pl-2 flex-shrink-0 select-none`}
          onMouseDown={titleBarDrag}
        >
          {!sidebarOpen && (
            <>
              <button onClick={() => setSidebarOpen(true)} className="icon-btn" aria-label="Open sidebar" title="Open sidebar (Ctrl+B)">
                <MenuIcon size={15} />
              </button>
              <button onClick={handleNewChat} className="icon-btn" aria-label="New chat" title="New chat (Ctrl+N)">
                <NewChatIcon size={15} />
              </button>
              <div className="w-px h-4 bg-line mx-1" />
            </>
          )}
          <ModelSelector />

          {/* Title: also part of the drag area. */}
          <div className="flex-1 min-w-0 self-stretch flex items-center justify-center px-3">
            {session && currentMessages.value.length > 0 && (
              <span className="truncate text-xs text-fg-subtle max-w-[420px]" title={session.title}>
                {session.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 pr-1">
            {currentMessages.value.length > 0 && <TokenCounter showLabel />}
            {session && (
              <button onClick={() => (exportDialog.value = "export")} className="icon-btn" title="Export chat" aria-label="Export chat">
                <DownloadIcon size={15} />
              </button>
            )}
            <button
              onClick={() => void setDashboardMode(false)}
              className="icon-btn"
              title="Compact view (Spotlight)"
              aria-label="Switch to compact Spotlight view"
            >
              <CollapseIcon size={15} />
            </button>
          </div>
          <div className="w-px h-4 bg-line" />
          <WindowControls isMaximized={isMaximized.value} />
        </header>

        <MessageList compact={false} emptyState={<EmptyState compact={false} />} />
        <ChatErrorBanner compact={false} />
        <ChatComposer compact={false} placeholder={docCount > 0 ? "Ask about your documents…" : "Message OmniRecall…"} />
      </main>
    </div>
  );
}
