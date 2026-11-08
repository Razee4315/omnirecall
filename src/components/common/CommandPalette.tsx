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
    PaletteIcon,
    UploadIcon,
} from "../icons";
import { modelLabel } from "../../lib/models";
import { ProviderTile } from "./ProviderTile";

interface PaletteItem {
    id: string;
    section: "Commands" | "Models" | "Chats" | "Messages";
    label: ComponentChild;
    description?: string;
    icon: ComponentChild;
    shortcut?: string;
    run: () => void;
}

interface CommandSpec {
    id: string;
    label: string;
    description: string;
    icon: ComponentChild;
    keywords: string;
    available?: boolean;
    shortcut?: string;
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
                id: "new-chat", label: "New chat", description: "Start a new conversation", keywords: "create start clear", shortcut: "Ctrl N",
                icon: <PlusIcon size={15} />,
                run: () => {
                    startNewChat();
                    chatError.value = null;
                    requestComposerFocus();
                },
            },
            {
                id: "stop", label: "Stop generating", description: "Stop the current response", keywords: "cancel abort", shortcut: "Ctrl .",
                icon: <StopIcon size={15} />, available: generating, run: stopGeneration,
            },
            {
                id: "add-documents", label: "Attach documents", description: "Attach files to ask questions about", keywords: "file upload pdf attach",
                icon: <FolderIcon size={15} />, run: () => void pickAndAddDocuments(),
            },
            {
                id: "toggle-docs", label: docsOn ? "Turn documents off for this chat" : "Turn documents on for this chat",
                description: "Choose whether attached documents are sent with messages", keywords: "context rag attach",
                icon: <DocumentIcon size={15} />, available: docCount > 0, run: () => setDocsEnabled(!docsOn),
            },
            {
                id: "quote-clipboard", label: "Quote clipboard", description: "Paste the clipboard into the message as a quote", keywords: "paste copy selection", shortcut: "Ctrl Shift V",
                icon: <ClipboardIcon size={15} />, run: () => void quoteClipboard(),
            },
            {
                id: "toggle-dashboard", label: inDashboard ? "Switch to compact view" : "Open Dashboard",
                description: inDashboard ? "Back to the compact window" : "History, folders and documents", keywords: "expand view mode compact",
                icon: <ExpandIcon size={15} />, run: () => void setDashboardMode(!inDashboard),
            },
            {
                id: "compare-models", label: "Compare models", description: "Send one prompt to several models", keywords: "side-by-side multi", shortcut: "Ctrl Shift M",
                icon: <CompareIcon size={15} />, run: () => (isCompareMode.value = true),
            },
            {
                id: "export-chat", label: "Export this chat", description: "Save as JSON or Markdown", keywords: "download save backup",
                icon: <DownloadIcon size={15} />, available: hasSession, run: () => (exportDialog.value = "export"),
            },
            {
                id: "import-chats", label: "Import chats", description: "Restore a backup or import a chat", keywords: "restore backup upload",
                icon: <UploadIcon size={15} />, run: () => (exportDialog.value = "import"),
            },
            {
                id: "open-settings", label: "Settings", description: "API keys, theme, shortcuts and data", keywords: "preferences config api key", shortcut: "Ctrl ,",
                icon: <SettingsIcon size={15} />,
                run: () => {
                    settingsTab.value = "providers";
                    isSettingsOpen.value = true;
                },
            },
            {
                id: "theme", label: "Change theme", description: "Open appearance settings", keywords: "dark light appearance color",
                icon: <PaletteIcon size={15} />,
                run: () => {
                    settingsTab.value = "appearance";
                    isSettingsOpen.value = true;
                },
            },
            {
                id: "shortcuts", label: "Keyboard shortcuts", description: "See every shortcut and slash command", keywords: "help keys hotkeys", shortcut: "Ctrl /",
                icon: <CommandIcon size={15} />, run: () => (isShortcutsHelpOpen.value = true),
            },
        ];

        const result: PaletteItem[] = commands
            .filter(cmd => cmd.available !== false)
            .filter(cmd => !needle || `${cmd.label} ${cmd.description} ${cmd.keywords}`.toLowerCase().includes(needle))
            .map(cmd => ({
                id: cmd.id, section: "Commands", label: cmd.label, description: cmd.description, icon: cmd.icon, shortcut: cmd.shortcut, run: cmd.run,
            }));

        if (needle) {
            let modelCount = 0;
            for (const provider of providers.value) {
                if (!provider.apiKey && provider.id !== "ollama") continue;
                for (const model of getProviderModels(provider.id)) {
                    if (modelCount >= MAX_MODEL_RESULTS) break;
                    if (activeProvider.value === provider.id && activeModel.value === model) continue;
                    if (!`${provider.name} ${model} ${modelLabel(model)}`.toLowerCase().includes(needle)) continue;
                    modelCount++;
                    result.push({
                        id: `model-${provider.id}-${model}`, section: "Models", label: modelLabel(model),
                        description: `${provider.name} · ${model}`, icon: <ProviderTile providerId={provider.id} size={15} />,
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
                description: `${session.messages.length} messages`, icon: <MessageIcon size={15} />,
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
                    icon: <SearchIcon size={15} />,
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
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-3 pt-[min(14vh,120px)]" onClick={close}>
            <div className="scrim absolute inset-0" />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Command palette"
                className="dialog relative w-full max-w-[580px]"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                <div className="flex items-center gap-3 px-4 h-[52px] border-b border-line">
                    <SearchIcon size={17} className="text-fg-subtle flex-shrink-0" />
                    <input
                        type="text"
                        value={query}
                        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                        placeholder="Search commands, models, chats and messages…"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="palette-results"
                        aria-activedescendant={activeItem ? `palette-${selectedIndex}` : undefined}
                        aria-label="Command palette search"
                        className="flex-1 min-w-0 bg-transparent text-[15px] text-fg placeholder:text-fg-subtle outline-none"
                    />
                    <span className="kbd">Esc</span>
                </div>

                <div ref={listRef} id="palette-results" role="listbox" aria-label="Results" className="max-h-[min(380px,55vh)] overflow-y-auto p-1.5">
                    {items.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="text-[13px] text-fg-muted">Nothing matches “{query.trim()}”</div>
                            <div className="text-2xs text-fg-subtle mt-1">Try a command name, a model, or words from a chat.</div>
                        </div>
                    ) : (
                        items.map((item, index) => {
                            const selected = selectedIndex === index;
                            return (
                                <div key={item.id}>
                                    {(index === 0 || items[index - 1].section !== item.section) && (
                                        <div className="menu-label">{item.section}</div>
                                    )}
                                    {/* Not focusable: the input keeps focus and drives selection. */}
                                    <div
                                        id={`palette-${index}`}
                                        role="option"
                                        aria-selected={selected}
                                        data-index={index}
                                        onClick={() => runItem(item)}
                                        onMouseMove={() => setSelectedIndex(index)}
                                        className={`flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors ${selected ? "bg-surface-2" : ""}`}
                                    >
                                        <span
                                            className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 border transition-colors ${
                                                selected ? "bg-accent/12 border-accent/25 text-accent" : "bg-surface-2 border-line text-fg-subtle"
                                            }`}
                                        >
                                            {item.icon}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[13px] text-fg truncate">{item.label}</div>
                                            {item.description && <div className="text-2xs text-fg-subtle truncate">{item.description}</div>}
                                        </div>
                                        {item.shortcut && (
                                            <span className="flex gap-0.5 flex-shrink-0">
                                                {item.shortcut.split(" ").map((key) => (
                                                    <span key={key} className="kbd">{key}</span>
                                                ))}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex items-center gap-4 px-4 h-9 border-t border-line text-2xs text-fg-subtle">
                    <span className="flex items-center gap-1"><span className="kbd">↑</span><span className="kbd">↓</span> navigate</span>
                    <span className="flex items-center gap-1"><span className="kbd">Enter</span> run</span>
                    <span className="ml-auto flex items-center gap-1"><span className="kbd">Ctrl</span><span className="kbd">K</span> toggle</span>
                </div>
            </div>
        </div>
    );
}
