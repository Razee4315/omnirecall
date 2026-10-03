import { useMemo, useRef, useState } from "preact/hooks";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
    activeBranchId,
    activeSessionId,
    chatHistory,
    exportAllSessions,
    exportDialog,
    exportSession,
    getBranchesForSession,
    importChats,
} from "../../stores/appStore";
import { toast } from "../../stores/toastStore";
import { saveTextFile } from "../../lib/download";
import { errorMessage } from "../../lib/errors";
import { BranchIcon, CloseIcon, DownloadIcon, UploadIcon } from "../icons";

type Format = "json" | "md";

const PREVIEW_CHARS = 1200;

function safeFileName(title: string): string {
    return title.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "chat";
}

export function backupFileName(): string {
    return `omnirecall-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

/// Save every chat and folder as one backup file.
export async function exportAllChats(): Promise<void> {
    const count = chatHistory.value.length;
    try {
        const saved = await saveTextFile(backupFileName(), exportAllSessions(), "json");
        if (saved) toast.success(`Exported ${count} chat${count === 1 ? "" : "s"}`);
    } catch (e) {
        toast.error(errorMessage(e, "Export failed"));
    }
}

/// Export the open chat, or import a chat / restore a backup. Opened from the
/// Dashboard header, the command palette and Settings.
export function ExportImport() {
    const mode = exportDialog.value;
    const panelRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const close = () => {
        exportDialog.value = null;
    };
    useFocusTrap(panelRef, mode !== null, close);

    const sessionId = activeSessionId.value;
    const session = chatHistory.value.find(s => s.id === sessionId) ?? null;
    const [format, setFormat] = useState<Format>("md");
    // Default to the thread the user is looking at.
    const [branchId, setBranchId] = useState<string | null>(activeBranchId.value);
    const [copied, setCopied] = useState(false);
    const [importText, setImportText] = useState("");
    const [importError, setImportError] = useState<string | null>(null);

    const branches = session ? getBranchesForSession(session.id) : [];
    const exportBranch = branches.some(b => b.id === branchId) ? branchId : null;
    // Always derived from the current choices, so what is copied or saved can
    // never be a stale export in a different format.
    const content = useMemo(
        () => (session ? exportSession(session, format, exportBranch) : ""),
        [session, format, exportBranch],
    );

    if (mode === null) return null;

    const handleSave = async () => {
        if (!session) return;
        try {
            const saved = await saveTextFile(`${safeFileName(session.title)}.${format}`, content, format);
            if (saved) {
                toast.success("Chat exported");
                close();
            }
        } catch (e) {
            toast.error(errorMessage(e, "Export failed"));
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Couldn't copy to the clipboard");
        }
    };

    const handleFile = async (e: Event) => {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        try {
            setImportText(await file.text());
            setImportError(null);
        } catch {
            setImportError("That file couldn't be read.");
        }
    };

    const handleImport = () => {
        const result = importChats(importText);
        if (!result.ok) {
            setImportError(result.reason);
            return;
        }
        if (result.sessions === 0) {
            setImportError(
                result.skipped > 0
                    ? "Nothing new to import: every chat in this file is already here."
                    : "The file contains no chats.",
            );
            return;
        }
        const skipped = result.skipped > 0 ? ` (${result.skipped} already present or invalid)` : "";
        toast.success(`Imported ${result.sessions} chat${result.sessions === 1 ? "" : "s"}${skipped}`);
        setImportText("");
        close();
    };

    const tabClass = (active: boolean) =>
        `px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
            active ? "bg-accent-primary text-on-accent" : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
        }`;
    const choiceClass = (active: boolean) =>
        `px-3 py-1.5 rounded-lg border text-xs transition-colors ${
            active
                ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                : "border-border text-text-secondary hover:bg-bg-tertiary"
        }`;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm" onClick={close}>
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Export or import chats"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg max-h-[90vh] flex flex-col bg-bg-primary border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in"
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex rounded-lg overflow-hidden border border-border" role="tablist" aria-label="Export or import">
                        <button role="tab" aria-selected={mode === "export"} onClick={() => (exportDialog.value = "export")} className={tabClass(mode === "export")}>
                            <DownloadIcon size={14} />
                            Export
                        </button>
                        <button role="tab" aria-selected={mode === "import"} onClick={() => (exportDialog.value = "import")} className={tabClass(mode === "import")}>
                            <UploadIcon size={14} />
                            Import
                        </button>
                    </div>
                    <button
                        onClick={close}
                        className="p-1.5 hover:bg-bg-tertiary rounded text-text-tertiary hover:text-text-primary"
                        aria-label="Close"
                    >
                        <CloseIcon size={16} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto">
                    {mode === "export" ? (
                        session ? (
                            <div className="space-y-4">
                                <div>
                                    <div className="text-sm text-text-secondary mb-2">Format</div>
                                    <div className="flex gap-2" role="radiogroup" aria-label="Export format">
                                        <button role="radio" aria-checked={format === "md"} onClick={() => setFormat("md")} className={choiceClass(format === "md")}>
                                            Markdown (readable)
                                        </button>
                                        <button role="radio" aria-checked={format === "json"} onClick={() => setFormat("json")} className={choiceClass(format === "json")}>
                                            JSON (re-importable)
                                        </button>
                                    </div>
                                </div>

                                {branches.length > 1 && (
                                    <div>
                                        <div className="text-sm text-text-secondary mb-2 flex items-center gap-1.5">
                                            <BranchIcon size={12} />
                                            Branch
                                        </div>
                                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Branch to export">
                                            {branches.map((branch) => (
                                                <button
                                                    key={branch.id ?? "main"}
                                                    role="radio"
                                                    aria-checked={exportBranch === branch.id}
                                                    onClick={() => setBranchId(branch.id)}
                                                    className={choiceClass(exportBranch === branch.id)}
                                                >
                                                    {branch.name}
                                                </button>
                                            ))}
                                        </div>
                                        {format === "json" && exportBranch === null && (
                                            <p className="text-[11px] text-text-tertiary mt-1.5">The JSON export of Main includes every branch.</p>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <div className="text-sm text-text-secondary mb-2">Preview</div>
                                    <pre className="p-3 bg-bg-secondary rounded-lg border border-border text-xs text-text-secondary max-h-48 overflow-auto font-mono whitespace-pre-wrap break-words">
                                        {content.slice(0, PREVIEW_CHARS)}
                                        {content.length > PREVIEW_CHARS && "\n…"}
                                    </pre>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => void handleCopy()}
                                        className="flex-1 px-4 py-2 rounded-lg text-sm border border-border text-text-secondary hover:bg-bg-tertiary transition-colors"
                                    >
                                        {copied ? "Copied!" : "Copy"}
                                    </button>
                                    <button
                                        onClick={() => void handleSave()}
                                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary text-on-accent hover:bg-accent-primary/90 transition-colors"
                                    >
                                        Save as…
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-sm text-text-secondary">Open a saved chat to export it on its own.</p>
                                {chatHistory.value.length > 0 && (
                                    <button
                                        onClick={() => void exportAllChats()}
                                        className="mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary text-on-accent hover:bg-accent-primary/90 transition-colors"
                                    >
                                        Export all {chatHistory.value.length} chats
                                    </button>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <label htmlFor="import-json" className="text-sm text-text-secondary">
                                    Choose a backup or exported chat (JSON), or paste it below
                                </label>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-xs bg-bg-secondary border border-border rounded hover:bg-bg-tertiary text-text-secondary"
                                >
                                    <UploadIcon size={12} />
                                    Choose file…
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json,application/json"
                                    onChange={(e) => void handleFile(e)}
                                    className="hidden"
                                    tabIndex={-1}
                                    aria-hidden="true"
                                />
                            </div>
                            <textarea
                                id="import-json"
                                value={importText}
                                onInput={(e) => {
                                    setImportText((e.target as HTMLTextAreaElement).value);
                                    setImportError(null);
                                }}
                                placeholder='{"title": "...", "messages": [...]}'
                                className="w-full h-40 px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary text-xs font-mono resize-none outline-none focus:border-accent-primary"
                            />

                            {importError && (
                                <div className="px-3 py-2 bg-error/10 border border-error/20 rounded-lg text-error text-sm" role="alert">
                                    {importError}
                                </div>
                            )}

                            <p className="text-[11px] text-text-tertiary">
                                Importing adds chats; nothing you already have is replaced.
                            </p>
                            <button
                                onClick={handleImport}
                                disabled={!importText.trim()}
                                className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    importText.trim()
                                        ? "bg-accent-primary text-on-accent hover:bg-accent-primary/90"
                                        : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                                }`}
                            >
                                Import
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
