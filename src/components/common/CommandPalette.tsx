import { ComponentChild } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
    activeModel,
    activeProvider,
    activeSessionId,
    docsEnabled,
    exportDialog,
    getProviderModels,
    isCommandPaletteOpen,
    isCompareMode,
    isGenerating,
    isSettingsOpen,
    isShortcutsHelpOpen,
    loadSession,
    openSearchResult,
    orderedSessions,
    providers,
    readableDocumentCount,
    searchChatHistory,
    setActiveModel,
    setDashboardMode,
    setDocsEnabled,
    settingsTab,
    startNewChat,
    stopGeneration,
    viewMode,
} from "../../stores/appStore";
import { chatError } from "../../stores/chatActions";
import { pickAndAddDocuments } from "../../lib/documents";
import { quoteClipboard, requestComposerFocus } from "../chat/ChatComposer";
import {
    ClipboardIcon,
    CloseIcon,
    CommandIcon,
    CompareIcon,
    DocumentIcon,
    DownloadIcon,
    ExpandIcon,
    FolderIcon,
    MessageIcon,
    PlusIcon,
    SearchIcon,
    SettingsIcon,
    StopIcon,
    TokenIcon,
    UploadIcon,
} from "../icons";

interface PaletteItem {
    id: string;
    section: "Commands" | "Models" | "Chats" | "Messages";
    label: ComponentChild;
    description?: string;
    icon: ComponentChild;
    run: () => void;
}

interface CommandSpec {
    id: string;
    label: string;
    description: string;
    icon: ComponentChild;
    keywords: string;
    available?: boolean;
    run: () => void;
}

const MAX_MODEL_RESULTS = 6;
const MAX_CHAT_RESULTS = 8;
const MAX_MESSAGE_RESULTS = 20;
const RECENT_CHATS = 5;

function highlight(text: string, matchIndex: number, length: number): ComponentChild {
    const start = Math.max(0, matchIndex - 30);
    const end = matchIndex + length;
    return (
        <>
            {start > 0 && "…"}
            {text.slice(start, matchIndex)}
            <mark>{text.slice(matchIndex, end)}</mark>
            {text.slice(end, end + 60)}
        </>
    );
}

/// Ctrl+K: one box that runs commands, switches model, opens chats and
/// searches message text.
export function CommandPalette() {
    const panelRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const open = isCommandPaletteOpen.value;
    useFocusTrap(panelRef, open);

    useEffect(() => {
        if (open) {
            setQuery("");
            setSelectedIndex(0);
        }
    }, [open]);

    const close = () => {
        isCommandPaletteOpen.value = false;
    };

    const needle = query.trim().toLowerCase();
    const sessions = orderedSessions.value;
    const hasSession = activeSessionId.value !== null;
    const generating = isGenerating.value;
    const inDashboard = viewMode.value === "dashboard";
    const docCount = readableDocumentCount.value;
    const docsOn = docsEnabled.value;

    const items = useMemo<PaletteItem[]>(() => {
        const commands: CommandSpec[] = [
            {
                id: "new-chat", label: "New Chat", description: "Start a new conversation", keywords: "create start clear",
                icon: <PlusIcon size={16} />,
                run: () => {
                    startNewChat();
                    chatError.value = null;
                    requestComposerFocus();
                },
            },
            {
                id: "stop", label: "Stop Generating", description: "Stop the current response", keywords: "cancel abort",
                icon: <StopIcon size={16} />, available: generating, run: stopGeneration,
            },
            {
                id: "add-documents", label: "Add Documents", description: "Attach files to ask questions about", keywords: "file upload pdf attach",
                icon: <FolderIcon size={16} />, run: () => void pickAndAddDocuments(),
            },
            {
                id: "toggle-docs", label: docsOn ? "Turn Documents Off for This Chat" : "Turn Documents On for This Chat",
                description: "Choose whether attached documents are sent with messages", keywords: "context rag attach",
                icon: <DocumentIcon size={16} />, available: docCount > 0, run: () => setDocsEnabled(!docsOn),
            },
            {
                id: "quote-clipboard", label: "Quote Clipboard", description: "Paste the clipboard into the message as a quote", keywords: "paste copy selection",
                icon: <ClipboardIcon size={16} />, run: () => void quoteClipboard(),
            },
            {
                id: "toggle-dashboard", label: inDashboard ? "Switch to Spotlight" : "Open Dashboard",
                description: inDashboard ? "Back to the compact window" : "History, folders and documents", keywords: "expand view mode compact",
                icon: <ExpandIcon size={16} />, run: () => void setDashboardMode(!inDashboard),
            },
            {
                id: "compare-models", label: "Compare Models", description: "Send one prompt to several models", keywords: "side-by-side multi",
                icon: <CompareIcon size={16} />, run: () => (isCompareMode.value = true),
            },
            {
                id: "export-chat", label: "Export This Chat", description: "Save as JSON or Markdown", keywords: "download save backup",
                icon: <DownloadIcon size={16} />, available: hasSession, run: () => (exportDialog.value = "export"),
            },
            {
                id: "import-chats", label: "Import Chats", description: "Restore a backup or import a chat", keywords: "restore backup upload",
                icon: <UploadIcon size={16} />, run: () => (exportDialog.value = "import"),
            },
            {
                id: "open-settings", label: "Open Settings", description: "API keys, theme, shortcuts and data", keywords: "preferences config api key",
                icon: <SettingsIcon size={16} />,
                run: () => {
                    settingsTab.value = "providers";
                    isSettingsOpen.value = true;
                },
            },
            {
                id: "theme", label: "Change Theme", description: "Open appearance settings", keywords: "dark light appearance color",
                icon: <SettingsIcon size={16} />,
                run: () => {
                    settingsTab.value = "appearance";
                    isSettingsOpen.value = true;
                },
            },
            {
                id: "shortcuts", label: "Keyboard Shortcuts", description: "See every shortcut and slash command", keywords: "help keys hotkeys",
                icon: <CommandIcon size={16} />, run: () => (isShortcutsHelpOpen.value = true),
            },
        ];

        const result: PaletteItem[] = commands
            .filter(cmd => cmd.available !== false)
            .filter(cmd => !needle || `${cmd.label} ${cmd.description} ${cmd.keywords}`.toLowerCase().includes(needle))
            .map(cmd => ({
                id: cmd.id, section: "Commands", label: cmd.label, description: cmd.description, icon: cmd.icon, run: cmd.run,
            }));

        if (needle) {
            let modelCount = 0;
            for (const provider of providers.value) {
                if (!provider.apiKey && provider.id !== "ollama") continue;
                for (const model of getProviderModels(provider.id)) {
                    if (modelCount >= MAX_MODEL_RESULTS) break;
                    if (activeProvider.value === provider.id && activeModel.value === model) continue;
                    if (!`${provider.name} ${model}`.toLowerCase().includes(needle)) continue;
                    modelCount++;
                    result.push({
                        id: `model-${provider.id}-${model}`, section: "Models", label: model,
                        description: `Switch to ${provider.name}`, icon: <TokenIcon size={16} />,
                        run: () => setActiveModel(provider.id, model),
                    });
                }
            }
        }

        const chats = needle
            ? sessions.filter(s => s.title.toLowerCase().includes(needle)).slice(0, MAX_CHAT_RESULTS)
            : sessions.slice(0, RECENT_CHATS);
        for (const session of chats) {
            result.push({
                id: `chat-${session.id}`, section: "Chats", label: session.title,
                description: `${session.messages.length} messages`, icon: <MessageIcon size={16} />,
                run: () => {
                    loadSession(session);
                    chatError.value = null;
                },
            });
        }

        if (needle.length >= 2) {
            const hits = searchChatHistory(needle, MAX_MESSAGE_RESULTS + MAX_CHAT_RESULTS)
                .filter(hit => hit.kind !== "title")
                .slice(0, MAX_MESSAGE_RESULTS);
            for (const hit of hits) {
                result.push({
                    id: `msg-${hit.sessionId}-${hit.branchId}-${hit.messageId}`, section: "Messages",
                    label: highlight(hit.content, hit.matchIndex, needle.length),
                    description: `${hit.kind === "user" ? "You" : "Assistant"} · ${hit.sessionTitle}`,
                    icon: <SearchIcon size={16} />,
                    run: () => {
                        openSearchResult(hit);
                        chatError.value = null;
                    },
                });
            }
        }
        return result;
    }, [needle, sessions, hasSession, generating, inDashboard, docCount, docsOn, providers.value, activeModel.value]);

    // A new query changes the list; start again from the top.
    useEffect(() => setSelectedIndex(0), [needle]);

    // Keep the keyboard-selected row scrolled into view.
    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    if (!open) return null;

    const runItem = (item: PaletteItem | undefined) => {
        if (!item) return;
        close();
        item.run();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, items.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && !e.isComposing) {
            e.preventDefault();
            runItem(items[selectedIndex]);
        }
    };

    const activeItem = items[selectedIndex];

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center px-3 pt-[12vh] bg-black/50 backdrop-blur-sm"
            onClick={close}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Command palette"
                className="w-full max-w-xl bg-bg-primary border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                    <SearchIcon size={18} className="text-text-tertiary flex-shrink-0" />
                    <input
                        type="text"
                        value={query}
                        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                        placeholder="Run a command, switch model, or search chats..."
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="palette-results"
                        aria-activedescendant={activeItem ? `palette-${selectedIndex}` : undefined}
                        aria-label="Command palette search"
                        className="flex-1 min-w-0 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none text-sm"
                    />
                    <button
                        onClick={close}
                        className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary"
                        aria-label="Close command palette"
                    >
                        <CloseIcon size={14} />
                    </button>
                </div>

                <div ref={listRef} id="palette-results" role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-2">
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-text-tertiary text-sm">Nothing matches “{query.trim()}”</div>
                    ) : (
                        items.map((item, index) => (
                            <div key={item.id}>
                                {(index === 0 || items[index - 1].section !== item.section) && (
                                    <div className="text-xs text-text-tertiary px-2 pt-2 pb-1 font-medium">{item.section}</div>
                                )}
                                {/* Not focusable: the input keeps focus and drives selection. */}
                                <div
                                    id={`palette-${index}`}
                                    role="option"
                                    aria-selected={selectedIndex === index}
                                    data-index={index}
                                    onClick={() => runItem(item)}
                                    onMouseMove={() => setSelectedIndex(index)}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${
                                        selectedIndex === index ? "bg-accent-primary/10" : ""
                                    }`}
                                >
                                    <span className={selectedIndex === index ? "text-accent-primary" : "text-text-tertiary"}>{item.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm truncate ${selectedIndex === index ? "text-accent-primary" : "text-text-primary"}`}>
                                            {item.label}
                                        </div>
                                        {item.description && (
                                            <div className="text-xs text-text-tertiary truncate">{item.description}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-bg-secondary text-xs text-text-tertiary">
                    <span><kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded">↑↓</kbd> Navigate</span>
                    <span><kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded">Enter</kbd> Select</span>
                    <span><kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded">Esc</kbd> Close</span>
                </div>
            </div>
        </div>
    );
}
