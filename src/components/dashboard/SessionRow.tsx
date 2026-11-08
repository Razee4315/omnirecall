import { useEffect, useState } from "preact/hooks";
import {
  activeSessionId,
  chatFolders,
  chatHistory,
  ChatSession,
  deleteChatSession,
  exportDialog,
  loadSession,
  restoreChatSession,
  toggleSessionPinned,
  updateSessionFolder,
  updateSessionTitle,
  visibleThreadCount,
} from "../../stores/appStore";
import { chatError } from "../../stores/chatActions";
import { toast } from "../../stores/toastStore";
import { useClickOutside } from "../../hooks/useClickOutside";
import { selectOnMount } from "../../lib/dom";
import { BranchIcon, CheckIcon, DownloadIcon, EditIcon, FolderIcon, MoreIcon, PinIcon, TrashIcon } from "../icons";

interface SessionRowProps {
  session: ChatSession;
  /// Dragging a row onto a folder files it (where the platform supports it).
  onDragStart?: (sessionId: string, e: DragEvent) => void;
}

/// A chat in the sidebar. Click to open, double-click to rename; everything
/// else (pin, rename, move to folder, export, delete) is in the ⋯ menu.
export function SessionRow({ session, onDragStart }: SessionRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  // Fixed-position coordinates, so the menu isn't clipped by the scrolling list.
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });
  const menuRef = useClickOutside<HTMLDivElement>(() => setMenuOpen(false), menuOpen);
  // A fixed menu would float away from its row if the list scrolled.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      // Scrolling inside the menu itself (a long folder list) is fine.
      if (e.type === "scroll" && menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);
  const isActive = activeSessionId.value === session.id;
  const threads = visibleThreadCount(session);
  const folders = chatFolders.value;

  const open = () => {
    loadSession(session);
    chatError.value = null;
  };

  const startRename = () => {
    setMenuOpen(false);
    setDraft(session.title);
    setRenaming(true);
  };

  const commitRename = () => {
    if (draft.trim()) updateSessionTitle(session.id, draft);
    setRenaming(false);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    const index = chatHistory.value.findIndex(s => s.id === session.id);
    deleteChatSession(session.id);
    toast.action(`Deleted “${session.title.slice(0, 40)}”`, { label: "Undo", onClick: () => restoreChatSession(session, index) }, "info");
  };

  const moveTo = (folderId: string | null) => {
    updateSessionFolder(session.id, folderId);
    setMenuOpen(false);
    const name = folderId ? folders.find(f => f.id === folderId)?.name : "Uncategorized";
    toast.success(`Moved to ${name}`);
  };

  return (
    <div
      draggable={!renaming && !!onDragStart}
      onDragStart={onDragStart ? (e) => onDragStart(session.id, e) : undefined}
      className={`group relative flex items-center h-8 rounded-lg transition-colors ${
        isActive ? "bg-surface-3 text-fg" : menuOpen ? "bg-surface-2" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      {isActive && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-accent" aria-hidden="true" />}

      {renaming ? (
        <input
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          onBlur={commitRename}
          ref={selectOnMount}
          maxLength={120}
          aria-label="Rename chat"
          className="flex-1 min-w-0 mx-1 h-7 px-2 rounded-md bg-canvas border border-accent/60 text-[13px] text-fg outline-none"
        />
      ) : (
        <button
          onClick={open}
          onDblClick={startRename}
          aria-current={isActive ? "true" : undefined}
          title={session.title}
          className="flex-1 min-w-0 h-full flex items-center gap-2 pl-2.5 pr-1 text-left text-[13px] rounded-lg"
        >
          {session.isPinned && <PinIcon size={11} className="flex-shrink-0 text-accent" />}
          <span className="truncate">{session.title}</span>
          {threads > 1 && (
            <span className="ml-auto flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] text-fg-subtle" title={`${threads} branches`}>
              <BranchIcon size={10} />
              {threads}
            </span>
          )}
        </button>
      )}

      {!renaming && (
        <div
          ref={menuRef}
          className="relative flex-shrink-0 pr-1"
          onKeyDown={(e) => {
            if (e.key === "Escape" && menuOpen) {
              e.stopPropagation();
              setMenuOpen(false);
            }
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!menuOpen) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const estimate = 150 + (folders.length > 0 ? 40 + Math.min(folders.length + 1, 5) * 32 : 0);
                const right = window.innerWidth - rect.right;
                setMenuPos(
                  rect.bottom + estimate + 8 > window.innerHeight
                    ? { bottom: window.innerHeight - rect.top + 4, right }
                    : { top: rect.bottom + 4, right },
                );
              }
              setMenuOpen(o => !o);
            }}
            className={`icon-btn icon-btn-sm ${menuOpen ? "opacity-100 bg-surface-3 text-fg" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Actions for ${session.title}`}
            title="More"
          >
            <MoreIcon size={14} />
          </button>

          {menuOpen && (
            <div role="menu" aria-label="Chat actions" className="menu fixed z-[60] w-52" style={menuPos}>
              <button role="menuitem" className="menu-item" onClick={() => { toggleSessionPinned(session.id); setMenuOpen(false); }}>
                <PinIcon size={14} className="text-fg-subtle" />
                {session.isPinned ? "Unpin" : "Pin to top"}
              </button>
              <button role="menuitem" className="menu-item" onClick={startRename}>
                <EditIcon size={14} className="text-fg-subtle" />
                Rename
              </button>
              <button
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  loadSession(session);
                  exportDialog.value = "export";
                }}
              >
                <DownloadIcon size={14} className="text-fg-subtle" />
                Export…
              </button>

              {folders.length > 0 && (
                <>
                  <div className="h-px bg-line my-1" />
                  <div className="menu-label">Move to folder</div>
                  <div className="max-h-40 overflow-y-auto">
                    {[...folders, { id: null as string | null, name: "Uncategorized", color: "" }].map(folder => {
                      const current = (session.folderId ?? null) === folder.id;
                      return (
                        <button
                          key={folder.id ?? "none"}
                          role="menuitemradio"
                          aria-checked={current}
                          className="menu-item"
                          onClick={() => moveTo(folder.id)}
                        >
                          <span style={folder.color ? { color: folder.color } : undefined} className={folder.color ? "" : "text-fg-subtle"}>
                            <FolderIcon size={14} />
                          </span>
                          <span className="truncate flex-1">{folder.name}</span>
                          {current && <CheckIcon size={13} className="text-accent" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="h-px bg-line my-1" />
              <button role="menuitem" className="menu-item !text-danger hover:!bg-danger/10" onClick={handleDelete}>
                <TrashIcon size={14} />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
