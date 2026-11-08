import { useState, useRef, useEffect } from "preact/hooks";
import {
    chatFolders,
    addChatFolder,
    updateChatFolder,
    deleteChatFolder,
    toggleFolderCollapse,
    sessionsByFolder,
    updateSessionFolder,
    ChatFolder,
    ChatSession,
} from "../../stores/appStore";
import { confirmAction } from "../../stores/confirmStore";
import { SessionRow } from "../dashboard/SessionRow";
import {
    FolderIcon,
    FolderOpenIcon,
    PlusIcon,
    CloseIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    EditIcon,
    TrashIcon,
    CheckIcon,
} from "../icons";
import { selectOnMount } from "../../lib/dom";

const FOLDER_COLORS = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#ec4899", // pink
];

/// Folders tab: create, rename and delete folders, and file chats into them
/// with each chat's "Move to folder" menu (or by dragging, where supported).
export function FolderManager() {
    const [isAddingFolder, setIsAddingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null | undefined>(undefined);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isAddingFolder) inputRef.current?.focus();
    }, [isAddingFolder]);

    const handleAddFolder = () => {
        const name = newFolderName.trim();
        if (!name) return;
        addChatFolder({
            id: crypto.randomUUID(),
            name,
            color: FOLDER_COLORS[chatFolders.value.length % FOLDER_COLORS.length],
            createdAt: new Date().toISOString(),
            isCollapsed: false,
        });
        setNewFolderName("");
        setIsAddingFolder(false);
    };

    const handleSaveEdit = () => {
        if (editingFolderId && editingName.trim()) {
            updateChatFolder(editingFolderId, { name: editingName.trim() });
        }
        setEditingFolderId(null);
        setEditingName("");
    };

    const handleDeleteFolder = async (folder: ChatFolder, chatCount: number) => {
        const confirmed = await confirmAction({
            title: `Delete “${folder.name}”?`,
            message: chatCount > 0
                ? `Its ${chatCount} chat${chatCount === 1 ? "" : "s"} will move to Uncategorized. No chats are deleted.`
                : "The folder is empty.",
            confirmLabel: "Delete folder",
            danger: true,
        });
        if (confirmed) deleteChatFolder(folder.id);
    };

    const handleDragStart = (sessionId: string, e: DragEvent) => {
        setDraggedSessionId(sessionId);
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", sessionId);
        }
    };

    const dropTarget = (folderId: string | null) => ({
        onDragOver: (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            setDragOverFolderId(folderId);
        },
        onDragLeave: () => setDragOverFolderId(undefined),
        onDrop: () => {
            if (draggedSessionId) updateSessionFolder(draggedSessionId, folderId);
            setDraggedSessionId(null);
            setDragOverFolderId(undefined);
        },
    });

    const folderSessions = sessionsByFolder.value;
    const uncategorized = folderSessions.get(null) ?? [];

    const renderSessions = (sessions: ChatSession[]) =>
        sessions.map(session => <SessionRow key={session.id} session={session} onDragStart={handleDragStart} />);

    return (
        <div className="px-1.5 pb-3">
            <div className="flex items-center justify-between pl-2.5 pr-1 pt-1 pb-1">
                <span className="section-label">Folders {chatFolders.value.length > 0 && `· ${chatFolders.value.length}`}</span>
                <button onClick={() => setIsAddingFolder(true)} className="icon-btn icon-btn-sm" title="New folder" aria-label="New folder">
                    <PlusIcon size={14} />
                </button>
            </div>

            {isAddingFolder && (
                <div className="flex items-center gap-1 px-1 pb-2 animate-pop-in">
                    <input
                        ref={inputRef}
                        type="text"
                        value={newFolderName}
                        maxLength={80}
                        onInput={(e) => setNewFolderName((e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddFolder();
                            if (e.key === "Escape") {
                                e.stopPropagation();
                                setIsAddingFolder(false);
                            }
                        }}
                        placeholder="Folder name"
                        aria-label="New folder name"
                        className="field h-8 flex-1 min-w-0"
                    />
                    <button onClick={handleAddFolder} disabled={!newFolderName.trim()} className="icon-btn bg-accent !text-accent-fg hover:brightness-110 disabled:opacity-40" aria-label="Create folder">
                        <CheckIcon size={14} />
                    </button>
                    <button onClick={() => setIsAddingFolder(false)} className="icon-btn" aria-label="Cancel">
                        <CloseIcon size={14} />
                    </button>
                </div>
            )}

            {chatFolders.value.length === 0 && !isAddingFolder && (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <div className="w-10 h-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-fg-subtle">
                        <FolderIcon size={18} />
                    </div>
                    <p className="text-[13px] text-fg-muted font-medium">Organize chats into folders</p>
                    <p className="text-2xs text-fg-subtle leading-relaxed">
                        Create a folder, then file chats from their ⋯ menu, or drag them here.
                    </p>
                    <button onClick={() => setIsAddingFolder(true)} className="btn btn-sm btn-secondary mt-1">
                        <PlusIcon size={12} />
                        New folder
                    </button>
                </div>
            )}

            <div className="space-y-0.5">
                {chatFolders.value.map((folder) => {
                    const sessions = folderSessions.get(folder.id) ?? [];
                    const isEditing = editingFolderId === folder.id;
                    return (
                        <div
                            key={folder.id}
                            className={`rounded-xl transition-colors ${dragOverFolderId === folder.id ? "bg-accent/10 ring-1 ring-accent/40" : ""}`}
                            {...dropTarget(folder.id)}
                        >
                            <div className="group flex items-center gap-1.5 h-8 pl-1 pr-1 rounded-lg hover:bg-surface-2">
                                <button
                                    onClick={() => toggleFolderCollapse(folder.id)}
                                    className="icon-btn icon-btn-sm"
                                    aria-expanded={!folder.isCollapsed}
                                    aria-label={`${folder.isCollapsed ? "Expand" : "Collapse"} folder ${folder.name}`}
                                >
                                    {folder.isCollapsed ? <ChevronRightIcon size={13} /> : <ChevronDownIcon size={13} />}
                                </button>

                                <span style={{ color: folder.color }} className="flex-shrink-0">
                                    {folder.isCollapsed ? <FolderIcon size={15} /> : <FolderOpenIcon size={15} />}
                                </span>

                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editingName}
                                        maxLength={80}
                                        ref={selectOnMount}
                                        onInput={(e) => setEditingName((e.target as HTMLInputElement).value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveEdit();
                                            if (e.key === "Escape") {
                                                e.stopPropagation();
                                                setEditingFolderId(null);
                                            }
                                        }}
                                        onBlur={handleSaveEdit}
                                        aria-label="Folder name"
                                        className="flex-1 min-w-0 h-6 px-1.5 rounded-md bg-canvas border border-accent/60 text-[13px] text-fg outline-none"
                                    />
                                ) : (
                                    <span className="flex-1 min-w-0 text-[13px] font-medium text-fg truncate">{folder.name}</span>
                                )}

                                <span className="text-2xs text-fg-subtle tabular-nums group-hover:hidden group-focus-within:hidden px-1">{sessions.length}</span>

                                <div className="hidden group-hover:flex group-focus-within:flex items-center">
                                    <button
                                        onClick={() => {
                                            setEditingFolderId(folder.id);
                                            setEditingName(folder.name);
                                        }}
                                        className="icon-btn icon-btn-sm"
                                        aria-label={`Rename folder ${folder.name}`}
                                        title="Rename"
                                    >
                                        <EditIcon size={12} />
                                    </button>
                                    <button
                                        onClick={() => void handleDeleteFolder(folder, sessions.length)}
                                        className="icon-btn icon-btn-sm hover:!text-danger"
                                        aria-label={`Delete folder ${folder.name}`}
                                        title="Delete"
                                    >
                                        <TrashIcon size={12} />
                                    </button>
                                </div>
                            </div>

                            {!folder.isCollapsed && (
                                <div className="ml-4 pl-2 border-l border-line space-y-px py-0.5">
                                    {sessions.length === 0 ? (
                                        <div className="py-1.5 pl-2 text-2xs text-fg-subtle">Empty. Drag a chat here.</div>
                                    ) : (
                                        renderSessions(sessions)
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {chatFolders.value.length > 0 && uncategorized.length > 0 && (
                <div
                    className={`mt-2 rounded-xl transition-colors ${dragOverFolderId === null ? "bg-accent/10 ring-1 ring-accent/40" : ""}`}
                    {...dropTarget(null)}
                >
                    <div className="section-label flex items-center gap-1.5 px-2.5 pt-2 pb-1">
                        Uncategorized
                        <span className="ml-auto tabular-nums normal-case tracking-normal">{uncategorized.length}</span>
                    </div>
                    <div className="space-y-px">{renderSessions(uncategorized)}</div>
                </div>
            )}
        </div>
    );
}
