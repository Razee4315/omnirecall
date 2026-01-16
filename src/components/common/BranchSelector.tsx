import { useState } from "preact/hooks";
import {
    activeSessionId,
    switchToBranch,
    getBranchesForSession,
    getCurrentBranchInfo,
    deleteBranch,
    renameBranch,
} from "../../stores/appStore";
import { BranchIcon, ChevronDownIcon, CheckIcon, CloseIcon, EditIcon } from "../icons";

interface BranchSelectorProps {
    className?: string;
}

export function BranchSelector({ className = "" }: BranchSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    const sessionId = activeSessionId.value;
    if (!sessionId) return null;

    const branches = getBranchesForSession(sessionId);
    const branchInfo = getCurrentBranchInfo(sessionId);

    // Only show if there are multiple branches
    if (branches.length <= 1) return null;

    const handleSelect = (branchId: string | null) => {
        if (editingId) return; // Don't switch while editing
        switchToBranch(sessionId, branchId);
        setIsOpen(false);
    };

    const handleDelete = (e: Event, branchId: string) => {
        e.stopPropagation();
        if (confirm("Delete this branch?")) {
            deleteBranch(sessionId, branchId);
        }
    };

    const handleStartRename = (e: Event, branchId: string, currentName: string) => {
        e.stopPropagation();
        setEditingId(branchId);
        setEditName(currentName);
    };

    const handleSaveRename = (branchId: string) => {
        if (editName.trim()) {
            renameBranch(sessionId, branchId, editName.trim());
        }
        setEditingId(null);
        setEditName("");
    };

    const handleKeyDown = (e: KeyboardEvent, branchId: string) => {
        if (e.key === "Enter") {
            handleSaveRename(branchId);
        } else if (e.key === "Escape") {
            setEditingId(null);
            setEditName("");
        }
    };

    return (
        <div className={`relative ${className}`}>
            {/* Dropdown Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-tertiary hover:bg-bg-tertiary/80 rounded-lg text-xs text-text-secondary transition-colors border border-transparent hover:border-border"
            >
                <BranchIcon size={12} />
                <span className="font-medium">{branchInfo.name}</span>
                <span className="text-text-tertiary">({branchInfo.index + 1}/{branchInfo.total})</span>
                <ChevronDownIcon size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop to close on click outside */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => { setIsOpen(false); setEditingId(null); }}
                    />

                    {/* Menu */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 min-w-[180px] bg-bg-secondary border border-border rounded-lg shadow-lg overflow-hidden">
                        {branches.map((branch) => (
                            <div
                                key={branch.id ?? "main"}
                                onClick={() => handleSelect(branch.id)}
                                className={`group flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors cursor-pointer
                  ${branch.isActive
                                        ? "bg-accent-primary/10 text-accent-primary"
                                        : "text-text-secondary hover:bg-bg-tertiary"
                                    }`}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <BranchIcon size={12} className="shrink-0" />
                                    {editingId === branch.id && branch.id !== null ? (
                                        <input
                                            type="text"
                                            value={editName}
                                            onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                                            onKeyDown={(e) => handleKeyDown(e, branch.id!)}
                                            onBlur={() => handleSaveRename(branch.id!)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex-1 bg-bg-primary border border-border rounded px-1 py-0.5 text-xs outline-none focus:border-accent-primary"
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="truncate">{branch.name}</span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    {branch.isActive && <CheckIcon size={12} />}

                                    {/* Can't edit/delete Main branch */}
                                    {branch.id !== null && !editingId && (
                                        <>
                                            <button
                                                onClick={(e) => handleStartRename(e, branch.id!, branch.name)}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-accent-primary rounded transition-opacity"
                                                title="Rename"
                                            >
                                                <EditIcon size={10} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(e, branch.id!)}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-error rounded transition-opacity"
                                                title="Delete"
                                            >
                                                <CloseIcon size={10} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
