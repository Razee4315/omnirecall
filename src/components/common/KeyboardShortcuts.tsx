import { isShortcutsHelpOpen, viewMode } from "../../stores/appStore";
import { CloseIcon, CommandIcon } from "../icons";

interface ShortcutGroup {
    title: string;
    shortcuts: { keys: string[]; description: string }[];
}

// Compact shortcuts for spotlight
const spotlightShortcuts: ShortcutGroup[] = [
    {
        title: "Essential",
        shortcuts: [
            { keys: ["Ctrl", "K"], description: "Command palette" },
            { keys: ["Ctrl", ","], description: "Settings" },
            { keys: ["Ctrl", "N"], description: "New chat" },
            { keys: ["Enter"], description: "Send message" },
            { keys: ["Esc"], description: "Close / Hide" },
        ],
    },
];

const fullShortcutGroups: ShortcutGroup[] = [
    {
        title: "General",
        shortcuts: [
            { keys: ["Ctrl", "K"], description: "Open command palette" },
            { keys: ["Ctrl", ","], description: "Open settings" },
            { keys: ["Esc"], description: "Close overlay / Hide window" },
            { keys: ["F11"], description: "Toggle fullscreen" },
            { keys: ["?"], description: "Show keyboard shortcuts" },
        ],
    },
    {
        title: "Chat",
        shortcuts: [
            { keys: ["Enter"], description: "Send message" },
            { keys: ["Shift", "Enter"], description: "New line" },
            { keys: ["Ctrl", "N"], description: "New chat" },
            { keys: ["Ctrl", "."], description: "Stop generation" },
            { keys: ["Ctrl", "Shift", "C"], description: "Copy last response" },
        ],
    },
    {
        title: "Navigation",
        shortcuts: [
            { keys: ["Ctrl", "["], description: "Previous chat" },
            { keys: ["Ctrl", "]"], description: "Next chat" },
            { keys: ["Ctrl", "1-9"], description: "Quick jump to chat" },
        ],
    },
    {
        title: "Comparison",
        shortcuts: [
            { keys: ["Ctrl", "Shift", "M"], description: "Toggle model compare" },
        ],
    },
];

export function KeyboardShortcuts() {
    if (!isShortcutsHelpOpen.value) return null;

    const isSpotlight = viewMode.value === "spotlight";

    // Minimal inline tooltip for Spotlight
    if (isSpotlight) {
        return (
            <div
                className="fixed top-0 left-0 right-0 bottom-0 z-[9999] flex flex-col"
                style={{ background: 'rgba(0,0,0,0.7)' }}
                onClick={() => (isShortcutsHelpOpen.value = false)}
            >
                <div
                    className="m-2 bg-bg-primary border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col"
                    style={{ maxHeight: 'calc(100% - 16px)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Compact Header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary border-b border-border flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <CommandIcon size={14} className="text-accent-primary" />
                            <span className="text-xs font-semibold text-text-primary">Shortcuts</span>
                        </div>
                        <button
                            onClick={() => (isShortcutsHelpOpen.value = false)}
                            className="p-1 hover:bg-bg-tertiary rounded text-text-tertiary hover:text-text-primary"
                        >
                            <CloseIcon size={12} />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {spotlightShortcuts.map((group) => (
                            <div key={group.title}>
                                {group.shortcuts.map((shortcut, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-bg-secondary text-xs"
                                    >
                                        <span className="text-text-secondary">{shortcut.description}</span>
                                        <div className="flex items-center gap-0.5">
                                            {shortcut.keys.map((key, kidx) => (
                                                <span key={kidx} className="flex items-center">
                                                    <kbd className="px-1 py-0.5 bg-bg-tertiary border border-border rounded text-[10px] font-mono text-text-primary min-w-[18px] text-center">
                                                        {key}
                                                    </kbd>
                                                    {kidx < shortcut.keys.length - 1 && (
                                                        <span className="text-text-tertiary text-[9px] mx-0.5">+</span>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="px-2 py-1.5 bg-bg-secondary border-t border-border text-center flex-shrink-0">
                        <span className="text-[10px] text-text-tertiary">Press ? or Esc to close</span>
                    </div>
                </div>
            </div>
        );
    }

    // Full version for Dashboard
    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => (isShortcutsHelpOpen.value = false)}
        >
            <div
                className="w-full max-w-xl bg-bg-primary border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg-secondary">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent-primary/10 rounded-lg">
                            <CommandIcon size={20} className="text-accent-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-text-primary">Keyboard Shortcuts</h2>
                            <p className="text-xs text-text-tertiary">Master your workflow with hotkeys</p>
                        </div>
                    </div>
                    <button
                        onClick={() => (isShortcutsHelpOpen.value = false)}
                        className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-text-tertiary hover:text-text-primary"
                    >
                        <CloseIcon size={18} />
                    </button>
                </div>

                {/* Shortcuts Grid */}
                <div className="p-5 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-6">
                        {fullShortcutGroups.map((group) => (
                            <div key={group.title}>
                                <h3 className="text-sm font-semibold text-text-primary mb-3">{group.title}</h3>
                                <div className="space-y-2">
                                    {group.shortcuts.map((shortcut, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-bg-secondary transition-colors"
                                        >
                                            <span className="text-sm text-text-secondary">{shortcut.description}</span>
                                            <div className="flex items-center gap-1">
                                                {shortcut.keys.map((key, kidx) => (
                                                    <span key={kidx} className="flex items-center gap-1">
                                                        <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-bg-tertiary border border-border rounded text-xs font-mono text-text-primary shadow-sm">
                                                            {key}
                                                        </kbd>
                                                        {kidx < shortcut.keys.length - 1 && (
                                                            <span className="text-text-tertiary text-xs">+</span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-border bg-bg-secondary text-center">
                    <p className="text-xs text-text-tertiary">
                        Press <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border rounded text-xs font-mono">?</kbd> anytime to toggle this overlay
                    </p>
                </div>
            </div>
        </div>
    );
}
