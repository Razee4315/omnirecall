import { useState } from "preact/hooks";
import {
  activeSessionId,
  chatFolders,
  chatHistory,
  ChatSession,
  deleteChatSession,
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
import { BranchIcon, CheckIcon, CloseIcon, EditIcon, FolderIcon, PinIcon } from "../icons";
import { selectOnMount } from "../../lib/dom";

const rowAction =
  "p-1 rounded min-w-[24px] min-h-[24px] flex items-center justify-center transition-opacity text-text-tertiary hover:text-text-primary";

/// Keyboard- and mouse-accessible way to file a chat into a folder (the only
/// alternative, dragging, isn't available to everyone or on every platform).
function MoveToFolderMenu({ session }: { session: ChatSession }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  const folders = chatFolders.value;
  if (folders.length === 0) return null;

  const move = (folderId: string | null) => {
    updateSessionFolder(session.id, folderId);
    setOpen(false);
    const name = folderId ? folders.find(f => f.id === folderId)?.name : "Uncategorized";
    toast.success(`Moved to ${name}`);
  };

  const options: { id: string | null; name: string; color?: string }[] = [
    ...folders,
    { id: null, name: "Uncategorized" },
  ];

  return (
    <div
      className="relative"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        className={`${rowAction} ${open ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Move to folder"
        title="Move to folder"
      >
        <FolderIcon size={12} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Move to folder"
          className="absolute right-0 top-full mt-1 z-30 min-w-[160px] max-h-56 overflow-y-auto bg-bg-primary border border-border rounded-lg shadow-xl py-1 animate-fade-in"
        >
          {options.map(option => {
            const current = (session.folderId ?? null) === option.id;
            return (
              <button
                key={option.id ?? "none"}
                role="menuitemradio"
                aria-checked={current}
                onClick={(e) => {
                  e.stopPropagation();
                  move(option.id);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-bg-tertiary ${
                  current ? "text-accent-primary" : "text-text-primary"
                }`}
              >
                <span style={option.color ? { color: option.color } : undefined} className={option.color ? "" : "text-text-tertiary"}>
                  <FolderIcon size={12} />
                </span>
                <span className="truncate flex-1">{option.name}</span>
                {current && <CheckIcon size={12} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SessionRowProps {
  session: ChatSession;
  /// Dragging a row onto a folder files it (where the platform supports it).
  onDragStart?: (sessionId: string, e: DragEvent) => void;
}

/// A chat in the sidebar: open, rename, pin, move to a folder, delete.
export function SessionRow({ session, onDragStart }: SessionRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isActive = activeSessionId.value === session.id;
  const threads = visibleThreadCount(session);
  const hidden = "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";

  const open = () => {
    loadSession(session);
    chatError.value = null;
  };

  const startRename = () => {
    setDraft(session.title);
    setRenaming(true);
  };

  const commitRename = () => {
    if (draft.trim()) updateSessionTitle(session.id, draft);
    setRenaming(false);
  };

  const handleDelete = () => {
    if (!confirmingDelete) {
      // First click arms the button; it disarms itself if not confirmed.
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3000);
      return;
    }
    const index = chatHistory.value.findIndex(s => s.id === session.id);
    deleteChatSession(session.id);
    toast.action("Chat deleted", { label: "Undo", onClick: () => restoreChatSession(session, index) }, "info");
  };

  return (
    <div
      draggable={!renaming && !!onDragStart}
      onDragStart={onDragStart ? (e) => onDragStart(session.id, e) : undefined}
      className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${
        isActive ? "bg-accent-primary/10 text-accent-primary" : "hover:bg-bg-tertiary text-text-primary"
      }`}
    >
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
          className="flex-1 min-w-0 bg-bg-primary border border-accent-primary rounded px-1 py-0.5 text-sm text-text-primary outline-none"
        />
      ) : (
        <button
          onClick={open}
          onDblClick={startRename}
          aria-current={isActive ? "true" : undefined}
          title={session.title}
          className="flex-1 min-w-0 text-left text-sm truncate py-0.5 rounded"
        >
          {session.title}
        </button>
      )}

      {threads > 1 && !renaming && (
        <span
          className="flex items-center gap-0.5 text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full flex-shrink-0"
          title={`${threads} branches`}
        >
          <BranchIcon size={8} />
          {threads}
        </span>
      )}

      {!renaming && (
        <div className="flex items-center flex-shrink-0">
          <button
            onClick={() => toggleSessionPinned(session.id)}
            className={`${rowAction} ${session.isPinned ? "opacity-100 !text-accent-primary" : hidden}`}
            aria-label={session.isPinned ? "Unpin chat" : "Pin chat"}
            aria-pressed={!!session.isPinned}
            title={session.isPinned ? "Unpin" : "Pin"}
          >
            <PinIcon size={12} />
          </button>
          <button onClick={startRename} className={`${rowAction} ${hidden}`} aria-label="Rename chat" title="Rename">
            <EditIcon size={12} />
          </button>
          <MoveToFolderMenu session={session} />
          <button
            onClick={handleDelete}
            className={`${rowAction} ${
              confirmingDelete ? "opacity-100 bg-error/20 !text-error px-1.5" : `${hidden} hover:bg-error/20 hover:!text-error`
            }`}
            aria-label={confirmingDelete ? "Click again to confirm delete" : "Delete chat"}
            title={confirmingDelete ? "Click again to delete" : "Delete"}
          >
            {confirmingDelete ? <span className="text-[10px] font-medium">Delete?</span> : <CloseIcon size={12} />}
          </button>
        </div>
      )}
    </div>
  );
}
