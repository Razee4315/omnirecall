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
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
                <span className="text-xs text-text-tertiary font-medium">Folders</span>
                <button
                    onClick={() => setIsAddingFolder(true)}
                    className="p-1 hover:bg-bg-tertiary rounded transition-colors text-text-tertiary hover:text-text-primary"
                    title="New folder"
                    aria-label="New folder"
                >
                    <PlusIcon size={14} />
                </button>
            </div>

            {isAddingFolder && (
                <div className="p-2 border-b border-border">
                    <div className="flex items-center gap-2">
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
                            placeholder="Folder name..."
                            aria-label="New folder name"
                            className="flex-1 min-w-0 px-2 py-1.5 bg-bg-tertiary border border-border rounded text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary"
                        />
                        <button
                            onClick={handleAddFolder}
                            disabled={!newFolderName.trim()}
                            className="p-1.5 bg-accent-primary text-on-accent rounded hover:bg-accent-primary/90 disabled:opacity-50"
                            aria-label="Create folder"
                        >
                            <CheckIcon size={12} />
                        </button>
                        <button
                            onClick={() => setIsAddingFolder(false)}
                            className="p-1.5 bg-bg-tertiary rounded hover:bg-border text-text-tertiary"
                            aria-label="Cancel"
                        >
                            <CloseIcon size={12} />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {chatFolders.value.length === 0 && !isAddingFolder && (
                    <div className="px-3 py-6 text-center">
                        <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-bg-tertiary flex items-center justify-center">
                            <FolderIcon size={20} className="text-text-tertiary" />
                        </div>
                        <p className="text-xs text-text-secondary mb-1 font-medium">Organize chats into folders</p>
                        <p className="text-[10px] text-text-tertiary leading-relaxed mb-3">
                            Create a folder, then use the folder button on any chat to file it.
                        </p>
                        <button
                            onClick={() => setIsAddingFolder(true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-accent-primary text-on-accent text-xs hover:bg-accent-primary/90 transition-colors"
                        >
                            <PlusIcon size={12} />
                            New folder
                        </button>
                    </div>
                )}

                {chatFolders.value.map((folder) => {
                    const sessions = folderSessions.get(folder.id) ?? [];
                    const isEditing = editingFolderId === folder.id;
                    return (
                        <div
                            key={folder.id}
                            className={`border-b border-border/50 transition-colors ${dragOverFolderId === folder.id ? "bg-accent-primary/10" : ""}`}
                            {...dropTarget(folder.id)}
                        >
                            <div className="group flex items-center gap-2 px-2 py-2 hover:bg-bg-tertiary">
                                <button
                                    onClick={() => toggleFolderCollapse(folder.id)}
                                    className="text-text-tertiary hover:text-text-primary"
                                    aria-expanded={!folder.isCollapsed}
                                    aria-label={`${folder.isCollapsed ? "Expand" : "Collapse"} folder ${folder.name}`}
                                >
                                    {folder.isCollapsed ? <ChevronRightIcon size={14} /> : <ChevronDownIcon size={14} />}
                                </button>

                                <span style={{ color: folder.color }}>
                                    {folder.isCollapsed ? <FolderIcon size={14} /> : <FolderOpenIcon size={14} />}
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
                                        className="flex-1 min-w-0 px-1 bg-bg-tertiary border border-accent-primary rounded text-sm text-text-primary outline-none"
                                    />
                                ) : (
                                    <span className="flex-1 text-sm text-text-primary truncate">{folder.name}</span>
                                )}

                                <span className="text-xs text-text-tertiary">{sessions.length}</span>

                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setEditingFolderId(folder.id);
                                            setEditingName(folder.name);
                                        }}
                                        className="p-1 hover:bg-bg-secondary rounded text-text-tertiary hover:text-text-primary"
                                        aria-label={`Rename folder ${folder.name}`}
                                        title="Rename"
                                    >
                                        <EditIcon size={12} />
                                    </button>
                                    <button
                                        onClick={() => void handleDeleteFolder(folder, sessions.length)}
                                        className="p-1 hover:bg-bg-secondary rounded text-text-tertiary hover:text-error"
                                        aria-label={`Delete folder ${folder.name}`}
                                        title="Delete"
                                    >
                                        <TrashIcon size={12} />
                                    </button>
                                </div>
                            </div>

                            {!folder.isCollapsed && (
                                <div className="pl-5 pr-1 pb-1 space-y-0.5">
                                    {sessions.length === 0 ? (
                                        <div className="py-1.5 pl-1 text-xs text-text-tertiary italic">No chats in this folder</div>
                                    ) : (
                                        renderSessions(sessions)
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {chatFolders.value.length > 0 && (
                    <div
                        className={`transition-colors ${dragOverFolderId === null ? "bg-accent-primary/10" : ""}`}
                        {...dropTarget(null)}
                    >
                        <div className="flex items-center gap-2 px-2 py-2 text-text-tertiary">
                            <FolderIcon size={14} />
                            <span className="text-xs font-medium">Uncategorized</span>
                            <span className="text-xs ml-auto">{uncategorized.length}</span>
                        </div>
                        <div className="px-1 pb-1 space-y-0.5">{renderSessions(uncategorized)}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
