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
    activeSessionId,
    currentMessages,
} from "../../stores/appStore";
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

interface FolderManagerProps {
    onSelectSession: (sessionId: string) => void;
}

export function FolderManager({ onSelectSession }: FolderManagerProps) {
    const [isAddingFolder, setIsAddingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null | undefined>(undefined);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isAddingFolder && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isAddingFolder]);

    const handleAddFolder = () => {
        if (!newFolderName.trim()) return;

        const folder: ChatFolder = {
            id: crypto.randomUUID(),
            name: newFolderName.trim(),
            color: FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)],
            createdAt: new Date().toISOString(),
            isCollapsed: false,
        };

        addChatFolder(folder);
        setNewFolderName("");
        setIsAddingFolder(false);
    };

    const handleEditFolder = (folder: ChatFolder) => {
        setEditingFolderId(folder.id);
        setEditingName(folder.name);
    };

    const handleSaveEdit = () => {
        if (editingFolderId && editingName.trim()) {
            updateChatFolder(editingFolderId, { name: editingName.trim() });
        }
        setEditingFolderId(null);
        setEditingName("");
    };

    const handleDragStart = (sessionId: string, e: DragEvent) => {
        setDraggedSessionId(sessionId);
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", sessionId);
        }
    };

    const handleDragOver = (e: DragEvent, folderId: string | null) => {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
        }
        setDragOverFolderId(folderId);
    };

    const handleDragLeave = () => {
        setDragOverFolderId(undefined);
    };

    const handleDropOnFolder = (folderId: string | null) => {
        if (draggedSessionId) {
            updateSessionFolder(draggedSessionId, folderId);
            setDraggedSessionId(null);
        }
        setDragOverFolderId(undefined);
    };

    const folderSessions = sessionsByFolder.value;

    return (
        <div className="flex flex-col h-full">
            {/* Folder Header */}
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
                <span className="text-xs text-text-tertiary font-medium">Folders</span>
                <button
                    onClick={() => setIsAddingFolder(true)}
                    className="p-1 hover:bg-bg-tertiary rounded transition-colors text-text-tertiary hover:text-text-primary"
                    title="New Folder"
                >
                    <PlusIcon size={14} />
                </button>
            </div>

            {/* Add Folder Input */}
            {isAddingFolder && (
                <div className="p-2 border-b border-border">
                    <div className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={newFolderName}
                            onInput={(e) => setNewFolderName((e.target as HTMLInputElement).value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddFolder();
                                if (e.key === "Escape") setIsAddingFolder(false);
                            }}
                            placeholder="Folder name..."
                            className="flex-1 px-2 py-1.5 bg-bg-tertiary border border-border rounded text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary"
                        />
                        <button
                            onClick={handleAddFolder}
                            className="p-1.5 bg-accent-primary text-white rounded hover:bg-accent-primary/90"
                        >
                            <CheckIcon size={12} />
                        </button>
                        <button
                            onClick={() => setIsAddingFolder(false)}
                            className="p-1.5 bg-bg-tertiary rounded hover:bg-border text-text-tertiary"
                        >
                            <CloseIcon size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Folders List */}
            <div className="flex-1 overflow-y-auto">
                {/* Custom Folders */}
                {chatFolders.value.map((folder) => (
                    <FolderItem
                        key={folder.id}
                        folder={folder}
                        sessions={folderSessions.get(folder.id) || []}
                        activeSessionId={activeSessionId.value}
                        isEditing={editingFolderId === folder.id}
                        editingName={editingName}
                        onEditNameChange={setEditingName}
                        onStartEdit={() => handleEditFolder(folder)}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={() => setEditingFolderId(null)}
                        onDelete={() => deleteChatFolder(folder.id)}
                        onToggleCollapse={() => toggleFolderCollapse(folder.id)}
                        onSelectSession={onSelectSession}
                        onDragOver={(e) => handleDragOver(e, folder.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={() => handleDropOnFolder(folder.id)}
                        onSessionDragStart={handleDragStart}
                        isDragOver={dragOverFolderId === folder.id}
                    />
                ))}

                {/* Uncategorized Section */}
                <div
                    className={`border-t border-border transition-colors ${dragOverFolderId === null ? "bg-accent-primary/10" : ""}`}
                    onDragOver={(e) => handleDragOver(e, null)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDropOnFolder(null)}
                >
                    <div className="flex items-center gap-2 px-2 py-2 text-text-tertiary">
                        <FolderIcon size={14} />
                        <span className="text-xs font-medium">Uncategorized</span>
                        <span className="text-xs text-text-tertiary ml-auto">
                            {(folderSessions.get(null) || []).length}
                        </span>
                    </div>
                    <div className="space-y-0.5">
                        {(folderSessions.get(null) || []).map((session) => (
                            <div
                                key={session.id}
                                draggable
                                onDragStart={(e) => handleDragStart(session.id, e)}
                                onClick={() => {
                                    currentMessages.value = session.messages;
                                    activeSessionId.value = session.id;
                                    onSelectSession(session.id);
                                }}
                                className={`px-3 py-2 cursor-grab active:cursor-grabbing transition-colors ${activeSessionId.value === session.id
                                    ? "bg-accent-primary/10 text-accent-primary"
                                    : "hover:bg-bg-tertiary text-text-primary"
                                    }`}
                            >
                                <span className="text-sm truncate block">{session.title}</span>
                                <span className="text-xs text-text-tertiary">
                                    {session.messages.length} messages
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface FolderItemProps {
    folder: ChatFolder;
    sessions: any[];
    activeSessionId: string | null;
    isEditing: boolean;
    editingName: string;
    onEditNameChange: (name: string) => void;
    onStartEdit: () => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onDelete: () => void;
    onToggleCollapse: () => void;
    onSelectSession: (sessionId: string) => void;
    onDragOver: (e: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: () => void;
    onSessionDragStart: (sessionId: string, e: DragEvent) => void;
    isDragOver: boolean;
}

function FolderItem({
    folder,
    sessions,
    activeSessionId,
    isEditing,
    editingName,
    onEditNameChange,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onDelete,
    onToggleCollapse,
    onSelectSession,
    onDragOver,
    onDragLeave,
    onDrop,
    onSessionDragStart,
    isDragOver,
}: FolderItemProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    return (
        <div
            className={`border-b border-border/50 transition-colors ${isDragOver ? "bg-accent-primary/10" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Folder Header */}
            <div className="group flex items-center gap-2 px-2 py-2 hover:bg-bg-tertiary">
                <button
                    onClick={onToggleCollapse}
                    className="text-text-tertiary hover:text-text-primary"
                >
                    {folder.isCollapsed ? (
                        <ChevronRightIcon size={14} />
                    ) : (
                        <ChevronDownIcon size={14} />
                    )}
                </button>

                <span style={{ color: folder.color }}>
                    {folder.isCollapsed ? <FolderIcon size={14} /> : <FolderOpenIcon size={14} />}
                </span>

                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editingName}
                        onInput={(e) => onEditNameChange((e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onSaveEdit();
                            if (e.key === "Escape") onCancelEdit();
                        }}
                        onBlur={onSaveEdit}
                        className="flex-1 px-1 bg-bg-tertiary border border-accent-primary rounded text-sm text-text-primary outline-none"
                    />
                ) : (
                    <span className="flex-1 text-sm text-text-primary truncate">{folder.name}</span>
                )}

                <span className="text-xs text-text-tertiary">{sessions.length}</span>

                {/* Actions - visible on hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onStartEdit();
                        }}
                        className="p-1 hover:bg-bg-secondary rounded text-text-tertiary hover:text-text-primary"
                    >
                        <EditIcon size={12} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="p-1 hover:bg-bg-secondary rounded text-text-tertiary hover:text-error"
                    >
                        <TrashIcon size={12} />
                    </button>
                </div>
            </div>

            {/* Folder Contents */}
            {!folder.isCollapsed && (
                <div className="pl-6 space-y-0.5">
                    {sessions.length === 0 ? (
                        <div className="py-2 text-xs text-text-tertiary italic">
                            Drop chats here
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session.id}
                                draggable
                                onDragStart={(e) => onSessionDragStart(session.id, e)}
                                onClick={() => {
                                    currentMessages.value = session.messages;
                                    onSelectSession(session.id);
                                }}
                                className={`px-2 py-1.5 rounded cursor-pointer transition-colors ${activeSessionId === session.id
                                    ? "bg-accent-primary/10 text-accent-primary"
                                    : "hover:bg-bg-tertiary text-text-primary"
                                    }`}
                            >
                                <span className="text-sm truncate block">{session.title}</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
