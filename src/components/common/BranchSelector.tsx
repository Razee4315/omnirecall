import { useState } from "preact/hooks";
import {
    activeSessionId,
    switchToBranch,
    getBranchesForSession,
    deleteBranch,
    isGenerating,
    renameBranch,
} from "../../stores/appStore";
import { confirmAction } from "../../stores/confirmStore";
import { useClickOutside } from "../../hooks/useClickOutside";
import { BranchIcon, ChevronDownIcon, CheckIcon, CloseIcon, EditIcon } from "../icons";
import { selectOnMount } from "../../lib/dom";

/// Dropdown for switching between the threads of a conversation.
export function BranchSelector() {
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const close = () => {
        setIsOpen(false);
        setEditingId(null);
    };
    const ref = useClickOutside<HTMLDivElement>(close, isOpen);

    const sessionId = activeSessionId.value;
    if (!sessionId) return null;

    const branches = getBranchesForSession(sessionId);
    if (branches.length <= 1) return null;
    const activeIndex = Math.max(0, branches.findIndex(b => b.isActive));
    const active = branches[activeIndex];
    const busy = isGenerating.value;

    const handleSelect = (branchId: string | null) => {
        if (editingId) return;
        switchToBranch(sessionId, branchId);
        close();
    };

    const handleDelete = async (branchId: string, name: string) => {
        const confirmed = await confirmAction({
            title: `Delete branch “${name}”?`,
            message: "Its messages will be permanently removed. The rest of the chat is not affected.",
            confirmLabel: "Delete branch",
            danger: true,
        });
        if (confirmed) deleteBranch(sessionId, branchId);
    };

    const handleSaveRename = (branchId: string) => {
        if (editName.trim()) renameBranch(sessionId, branchId, editName.trim().slice(0, 60));
        setEditingId(null);
        setEditName("");
    };

    return (
        <div
            className="relative"
            ref={ref}
            onKeyDown={(e) => {
                if (e.key === "Escape" && isOpen) {
                    e.stopPropagation();
                    close();
                }
            }}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label={`Branch ${active.name}, ${activeIndex + 1} of ${branches.length}. Switch branch`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-tertiary hover:bg-bg-tertiary/80 rounded-lg text-xs text-text-secondary transition-colors border border-transparent hover:border-border"
            >
                <BranchIcon size={12} />
                <span className="font-medium">{active.name}</span>
                <span className="text-text-tertiary">({activeIndex + 1}/{branches.length})</span>
                <ChevronDownIcon size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div
                    role="menu"
                    aria-label="Conversation branches"
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 min-w-[200px] bg-bg-secondary border border-border rounded-lg shadow-lg overflow-hidden animate-fade-in"
                >
                    {branches.map((branch) => (
                        <div
                            key={branch.id ?? "main"}
                            className={`group flex items-center gap-1 pr-1 text-xs transition-colors ${
                                branch.isActive ? "bg-accent-primary/10 text-accent-primary" : "text-text-secondary hover:bg-bg-tertiary"
                            }`}
                        >
                            {editingId === branch.id && branch.id !== null ? (
                                <input
                                    type="text"
                                    value={editName}
                                    maxLength={60}
                                    ref={selectOnMount}
                                    onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveRename(branch.id!);
                                        if (e.key === "Escape") {
                                            e.stopPropagation();
                                            setEditingId(null);
                                        }
                                    }}
                                    onBlur={() => handleSaveRename(branch.id!)}
                                    aria-label="Branch name"
                                    className="flex-1 min-w-0 m-1.5 bg-bg-primary border border-border rounded px-1 py-0.5 text-xs text-text-primary outline-none focus:border-accent-primary"
                                />
                            ) : (
                                <button
                                    role="menuitemradio"
                                    aria-checked={branch.isActive}
                                    onClick={() => handleSelect(branch.id)}
                                    className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 text-left"
                                >
                                    <BranchIcon size={12} className="shrink-0" />
                                    <span className="truncate flex-1">{branch.name}</span>
                                    {branch.isActive && <CheckIcon size={12} />}
                                </button>
                            )}

                            {/* Main can't be renamed or deleted */}
                            {branch.id !== null && !editingId && (
                                <>
                                    <button
                                        onClick={() => {
                                            setEditingId(branch.id);
                                            setEditName(branch.name);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 hover:text-accent-primary rounded transition-opacity"
                                        title="Rename"
                                        aria-label={`Rename branch ${branch.name}`}
                                    >
                                        <EditIcon size={10} />
                                    </button>
                                    <button
                                        onClick={() => void handleDelete(branch.id!, branch.name)}
                                        disabled={busy}
                                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 hover:text-error rounded transition-opacity"
                                        title="Delete"
                                        aria-label={`Delete branch ${branch.name}`}
                                    >
                                        <CloseIcon size={10} />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
