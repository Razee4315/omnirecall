import { useEffect, useRef, useState } from "preact/hooks";
import {
    isCommandPaletteOpen,
    commandPaletteQuery,
    searchChatHistory,
    searchResults,
    chatHistory,
    currentMessages,
    activeSessionId,
    viewMode,
    isSettingsOpen,
    isCompareMode,
} from "../../stores/appStore";
import {
    SearchIcon,
    CloseIcon,
    MessageIcon,
    SettingsIcon,
    PlusIcon,
    CompareIcon,
    FolderIcon,
    ChevronRightIcon,
} from "../icons";
import { invoke } from "@tauri-apps/api/core";

interface Command {
    id: string;
    label: string;
    description?: string;
    icon: preact.JSX.Element;
    category: "action" | "navigation" | "search";
    action: () => void;
    keywords?: string[];
}

export function CommandPalette() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mode, setMode] = useState<"commands" | "search">("commands");

    const commands: Command[] = [
        {
            id: "new-chat",
            label: "New Chat",
            description: "Start a new conversation",
            icon: <PlusIcon size={16} />,
            category: "action",
            keywords: ["create", "start", "conversation"],
            action: () => {
                currentMessages.value = [];
                activeSessionId.value = null;
                isCommandPaletteOpen.value = false;
            },
        },
        {
            id: "search-chats",
            label: "Search Chats",
            description: "Search through all conversations",
            icon: <SearchIcon size={16} />,
            category: "navigation",
            keywords: ["find", "messages", "history"],
            action: () => {
                setMode("search");
                commandPaletteQuery.value = "";
            },
        },
        {
            id: "open-settings",
            label: "Open Settings",
            description: "Configure API keys and preferences",
            icon: <SettingsIcon size={16} />,
            category: "navigation",
            keywords: ["preferences", "config", "api"],
            action: () => {
                isSettingsOpen.value = true;
                isCommandPaletteOpen.value = false;
            },
        },
        {
            id: "toggle-dashboard",
            label: "Toggle Dashboard",
            description: "Switch between spotlight and dashboard",
            icon: <FolderIcon size={16} />,
            category: "navigation",
            keywords: ["expand", "view", "mode"],
            action: async () => {
                if (viewMode.value === "spotlight") {
                    viewMode.value = "dashboard";
                    await invoke("toggle_dashboard", { isDashboard: true });
                } else {
                    viewMode.value = "spotlight";
                    await invoke("toggle_dashboard", { isDashboard: false });
                }
                isCommandPaletteOpen.value = false;
            },
        },
        {
            id: "compare-models",
            label: "Compare Models",
            description: "Compare responses from multiple AI models",
            icon: <CompareIcon size={16} />,
            category: "action",
            keywords: ["side-by-side", "multi", "models"],
            action: () => {
                isCompareMode.value = !isCompareMode.value;
                isCommandPaletteOpen.value = false;
            },
        },
    ];

    // Add recent chats as quick navigation items
    const recentChats: Command[] = chatHistory.value.slice(0, 5).map((session) => ({
        id: `chat-${session.id}`,
        label: session.title,
        description: `${session.messages.length} messages`,
        icon: <MessageIcon size={16} />,
        category: "navigation" as const,
        action: () => {
            currentMessages.value = session.messages;
            activeSessionId.value = session.id;
            isCommandPaletteOpen.value = false;
        },
    }));

    const query = commandPaletteQuery.value.toLowerCase();

    // Filter commands based on query
    const filteredCommands = commands.filter((cmd) => {
        if (!query) return true;
        return (
            cmd.label.toLowerCase().includes(query) ||
            cmd.description?.toLowerCase().includes(query) ||
            cmd.keywords?.some((k) => k.includes(query))
        );
    });

    const filteredRecentChats = recentChats.filter((chat) => {
        if (!query) return true;
        return chat.label.toLowerCase().includes(query);
    });

    const allItems = mode === "search"
        ? searchResults.value
        : [...filteredCommands, ...filteredRecentChats];

    // Focus input on open
    useEffect(() => {
        if (isCommandPaletteOpen.value) {
            inputRef.current?.focus();
            setSelectedIndex(0);
            setMode("commands");
            commandPaletteQuery.value = "";
        }
    }, [isCommandPaletteOpen.value]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isCommandPaletteOpen.value) return;

            if (e.key === "Escape") {
                e.preventDefault();
                if (mode === "search") {
                    setMode("commands");
                    commandPaletteQuery.value = "";
                } else {
                    isCommandPaletteOpen.value = false;
                }
                return;
            }

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
                return;
            }

            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
                return;
            }

            if (e.key === "Enter") {
                e.preventDefault();
                if (mode === "commands" && allItems[selectedIndex]) {
                    (allItems[selectedIndex] as Command).action();
                } else if (mode === "search" && searchResults.value[selectedIndex]) {
                    const result = searchResults.value[selectedIndex];
                    const session = chatHistory.value.find(s => s.id === result.sessionId);
                    if (session) {
                        currentMessages.value = session.messages;
                        activeSessionId.value = session.id;
                        isCommandPaletteOpen.value = false;
                    }
                }
                return;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [allItems.length, selectedIndex, mode]);

    // Handle search mode input
    useEffect(() => {
        if (mode === "search") {
            searchChatHistory(commandPaletteQuery.value);
        }
    }, [commandPaletteQuery.value, mode]);

    if (!isCommandPaletteOpen.value) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
            onClick={() => (isCommandPaletteOpen.value = false)}
        >
            <div
                className="w-full max-w-xl bg-bg-primary border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                    <SearchIcon size={18} className="text-text-tertiary flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={commandPaletteQuery.value}
                        onInput={(e) => (commandPaletteQuery.value = (e.target as HTMLInputElement).value)}
                        placeholder={mode === "search" ? "Search messages..." : "Type a command or search..."}
                        className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none text-sm"
                    />
                    {mode === "search" && (
                        <button
                            onClick={() => {
                                setMode("commands");
                                commandPaletteQuery.value = "";
                            }}
                            className="text-xs text-text-tertiary hover:text-text-primary px-2 py-1 rounded hover:bg-bg-tertiary"
                        >
                            Back
                        </button>
                    )}
                    <button
                        onClick={() => (isCommandPaletteOpen.value = false)}
                        className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary"
                    >
                        <CloseIcon size={14} />
                    </button>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto">
                    {mode === "commands" ? (
                        <>
                            {/* Commands Section */}
                            {filteredCommands.length > 0 && (
                                <div className="p-2">
                                    <div className="text-xs text-text-tertiary px-2 py-1 font-medium">Commands</div>
                                    {filteredCommands.map((cmd, idx) => (
                                        <button
                                            key={cmd.id}
                                            onClick={() => cmd.action()}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${selectedIndex === idx
                                                    ? "bg-accent-primary/10 text-accent-primary"
                                                    : "hover:bg-bg-tertiary text-text-primary"
                                                }`}
                                        >
                                            <span className="text-text-tertiary">{cmd.icon}</span>
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">{cmd.label}</div>
                                                {cmd.description && (
                                                    <div className="text-xs text-text-tertiary">{cmd.description}</div>
                                                )}
                                            </div>
                                            <ChevronRightIcon size={14} className="text-text-tertiary" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Recent Chats Section */}
                            {filteredRecentChats.length > 0 && (
                                <div className="p-2 border-t border-border">
                                    <div className="text-xs text-text-tertiary px-2 py-1 font-medium">Recent Chats</div>
                                    {filteredRecentChats.map((chat, idx) => (
                                        <button
                                            key={chat.id}
                                            onClick={() => chat.action()}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${selectedIndex === filteredCommands.length + idx
                                                    ? "bg-accent-primary/10 text-accent-primary"
                                                    : "hover:bg-bg-tertiary text-text-primary"
                                                }`}
                                        >
                                            <span className="text-text-tertiary">{chat.icon}</span>
                                            <div className="flex-1">
                                                <div className="text-sm font-medium truncate">{chat.label}</div>
                                                {chat.description && (
                                                    <div className="text-xs text-text-tertiary">{chat.description}</div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        /* Search Results */
                        <div className="p-2">
                            {searchResults.value.length === 0 ? (
                                <div className="text-center py-8 text-text-tertiary text-sm">
                                    {commandPaletteQuery.value ? "No messages found" : "Type to search messages..."}
                                </div>
                            ) : (
                                <>
                                    <div className="text-xs text-text-tertiary px-2 py-1 font-medium">
                                        {searchResults.value.length} result{searchResults.value.length !== 1 ? "s" : ""}
                                    </div>
                                    {searchResults.value.map((result, idx) => (
                                        <button
                                            key={`${result.sessionId}-${result.messageId}`}
                                            onClick={() => {
                                                const session = chatHistory.value.find(s => s.id === result.sessionId);
                                                if (session) {
                                                    currentMessages.value = session.messages;
                                                    activeSessionId.value = session.id;
                                                    isCommandPaletteOpen.value = false;
                                                }
                                            }}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${selectedIndex === idx
                                                    ? "bg-accent-primary/10"
                                                    : "hover:bg-bg-tertiary"
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${result.role === "user"
                                                        ? "bg-accent-primary/20 text-accent-primary"
                                                        : "bg-bg-tertiary text-text-secondary"
                                                    }`}>
                                                    {result.role}
                                                </span>
                                                <span className="text-xs text-text-tertiary truncate">{result.sessionTitle}</span>
                                            </div>
                                            <div className="text-sm text-text-primary line-clamp-2">
                                                {highlightMatch(result.content, commandPaletteQuery.value)}
                                            </div>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-bg-secondary text-xs text-text-tertiary">
                    <div className="flex items-center gap-4">
                        <span><kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded">↑↓</kbd> Navigate</span>
                        <span><kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded">Enter</kbd> Select</span>
                        <span><kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded">Esc</kbd> Close</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function highlightMatch(text: string, query: string): preact.JSX.Element {
    if (!query) return <>{text}</>;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerQuery);

    if (matchIndex === -1) return <>{text}</>;

    // Show context around the match
    const contextStart = Math.max(0, matchIndex - 30);
    const contextEnd = Math.min(text.length, matchIndex + query.length + 50);

    const before = text.slice(contextStart, matchIndex);
    const match = text.slice(matchIndex, matchIndex + query.length);
    const after = text.slice(matchIndex + query.length, contextEnd);

    return (
        <>
            {contextStart > 0 && "..."}
            {before}
            <mark className="bg-accent-primary/30 text-text-primary px-0.5 rounded">{match}</mark>
            {after}
            {contextEnd < text.length && "..."}
        </>
    );
}
