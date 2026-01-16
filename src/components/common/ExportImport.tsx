import { useState } from "preact/hooks";
import {
    exportSession,
    importSession,
    chatHistory,
    ChatSession,
} from "../../stores/appStore";
import {
    DownloadIcon,
    UploadIcon,
    CloseIcon,
    CheckIcon,
    DocumentIcon,
    BranchIcon,
} from "../icons";

interface ExportImportProps {
    session?: ChatSession | null;
    onClose?: () => void;
}

export function ExportImport({ session, onClose }: ExportImportProps) {
    const [mode, setMode] = useState<"export" | "import">(session ? "export" : "import");
    const [format, setFormat] = useState<"json" | "md">("json");
    const [importText, setImportText] = useState("");
    const [importResult, setImportResult] = useState<"success" | "error" | null>(null);
    const [exportContent, setExportContent] = useState("");
    const [copied, setCopied] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<string | null>(null); // null = main

    // Get branches for current session
    const getBranches = () => {
        if (!session || !session.branches) return [];
        return [
            { id: null, name: "Main" },
            ...session.branches.map(b => ({ id: b.id, name: b.name }))
        ];
    };
    const branches = getBranches();
    const hasBranches = branches.length > 1;

    const handleExport = () => {
        if (!session) return;
        // Get messages for selected branch or main
        const branchMessages = selectedBranch && session.branchMessages?.[selectedBranch];
        const content = exportSession(session, format, branchMessages || undefined);
        setExportContent(content);
    };

    const handleDownload = () => {
        if (!session || !exportContent) return;

        const blob = new Blob([exportContent], {
            type: format === "json" ? "application/json" : "text/markdown"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${session.title.replace(/[^a-z0-9]/gi, "_")}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(exportContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleImport = () => {
        const result = importSession(importText);
        if (result) {
            setImportResult("success");
            setImportText("");
            setTimeout(() => {
                onClose?.();
            }, 1500);
        } else {
            setImportResult("error");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-bg-primary border border-border rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="flex rounded-lg overflow-hidden border border-border">
                            <button
                                onClick={() => setMode("export")}
                                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${mode === "export"
                                    ? "bg-accent-primary text-white"
                                    : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
                                    }`}
                            >
                                <DownloadIcon size={14} />
                                Export
                            </button>
                            <button
                                onClick={() => setMode("import")}
                                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${mode === "import"
                                    ? "bg-accent-primary text-white"
                                    : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
                                    }`}
                            >
                                <UploadIcon size={14} />
                                Import
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-bg-tertiary rounded text-text-tertiary hover:text-text-primary"
                    >
                        <CloseIcon size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {mode === "export" ? (
                        <div className="space-y-4">
                            {/* Session Selector */}
                            {!session && (
                                <div>
                                    <label className="text-sm text-text-secondary mb-2 block">Select Chat</label>
                                    <select className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary">
                                        <option value="">Choose a chat...</option>
                                        {chatHistory.value.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Format Selection */}
                            <div>
                                <label className="text-sm text-text-secondary mb-2 block">Format</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setFormat("json")}
                                        className={`flex-1 px-3 py-2 rounded-lg border text-sm ${format === "json"
                                            ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                                            : "border-border text-text-secondary hover:bg-bg-tertiary"
                                            }`}
                                    >
                                        JSON
                                    </button>
                                    <button
                                        onClick={() => setFormat("md")}
                                        className={`flex-1 px-3 py-2 rounded-lg border text-sm ${format === "md"
                                            ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                                            : "border-border text-text-secondary hover:bg-bg-tertiary"
                                            }`}
                                    >
                                        Markdown
                                    </button>
                                </div>
                            </div>

                            {/* Branch Selection (only when session has branches) */}
                            {hasBranches && (
                                <div>
                                    <label className="text-sm text-text-secondary mb-2 flex items-center gap-1.5">
                                        <BranchIcon size={12} />
                                        Export Branch
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {branches.map((branch) => (
                                            <button
                                                key={branch.id ?? "main"}
                                                onClick={() => {
                                                    setSelectedBranch(branch.id);
                                                    setExportContent(""); // Reset export when branch changes
                                                }}
                                                className={`px-3 py-1.5 rounded-lg border text-xs ${selectedBranch === branch.id
                                                    ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                                                    : "border-border text-text-secondary hover:bg-bg-tertiary"
                                                    }`}
                                            >
                                                {branch.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Export Button */}
                            {session && !exportContent && (
                                <button
                                    onClick={handleExport}
                                    className="w-full px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 text-sm font-medium"
                                >
                                    Generate Export
                                </button>
                            )}

                            {/* Export Preview */}
                            {exportContent && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-text-secondary">Preview</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleCopy}
                                                className="px-3 py-1.5 text-xs bg-bg-secondary rounded border border-border hover:bg-bg-tertiary"
                                            >
                                                {copied ? "Copied!" : "Copy"}
                                            </button>
                                            <button
                                                onClick={handleDownload}
                                                className="px-3 py-1.5 text-xs bg-accent-primary text-white rounded hover:bg-accent-primary/90"
                                            >
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                    <pre className="p-3 bg-bg-secondary rounded-lg border border-border text-xs text-text-secondary max-h-60 overflow-auto font-mono">
                                        {exportContent.slice(0, 1000)}
                                        {exportContent.length > 1000 && "\n..."}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-text-secondary mb-2 block">
                                    Paste JSON export
                                </label>
                                <textarea
                                    value={importText}
                                    onInput={(e) => {
                                        setImportText((e.target as HTMLTextAreaElement).value);
                                        setImportResult(null);
                                    }}
                                    placeholder='{"id": "...", "title": "...", "messages": [...]}'
                                    className="w-full h-40 px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary text-sm font-mono resize-none outline-none focus:border-accent-primary"
                                />
                            </div>

                            {importResult === "success" && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/20 rounded-lg text-success text-sm">
                                    <CheckIcon size={16} />
                                    Chat imported successfully!
                                </div>
                            )}

                            {importResult === "error" && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
                                    <CloseIcon size={16} />
                                    Invalid format. Please check your JSON.
                                </div>
                            )}

                            <button
                                onClick={handleImport}
                                disabled={!importText.trim()}
                                className={`w-full px-4 py-2 rounded-lg text-sm font-medium ${importText.trim()
                                    ? "bg-accent-primary text-white hover:bg-accent-primary/90"
                                    : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                                    }`}
                            >
                                Import Chat
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Quick export button for use in message actions
interface QuickExportButtonProps {
    session: ChatSession;
    className?: string;
}

export function QuickExportButton({ session, className = "" }: QuickExportButtonProps) {
    const handleQuickExport = async () => {
        const content = exportSession(session, "json");
        await navigator.clipboard.writeText(content);
    };

    return (
        <button
            onClick={handleQuickExport}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors ${className}`}
            title="Copy chat as JSON"
        >
            <DocumentIcon size={12} />
            Export
        </button>
    );
}
