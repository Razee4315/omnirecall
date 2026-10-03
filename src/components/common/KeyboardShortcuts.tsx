import { useRef } from "preact/hooks";
import { formatHotkey, globalHotkey, isShortcutsHelpOpen, viewMode } from "../../stores/appStore";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { SHORTCUT_GROUPS, ShortcutGroup } from "../../lib/shortcuts";
import { CloseIcon, CommandIcon } from "../icons";

/// Overlay listing every shortcut and slash command. Both views show the
/// same list; Spotlight just lays it out in one column.
export function KeyboardShortcuts() {
    const panelRef = useRef<HTMLDivElement>(null);
    const open = isShortcutsHelpOpen.value;
    useFocusTrap(panelRef, open);

    if (!open) return null;

    const compact = viewMode.value === "spotlight";
    const close = () => {
        isShortcutsHelpOpen.value = false;
    };
    const groups: ShortcutGroup[] = [
        {
            title: "Anywhere",
            shortcuts: [{ keys: formatHotkey(globalHotkey.value).split(" + "), description: "Show / hide OmniRecall" }],
        },
        ...SHORTCUT_GROUPS,
    ];

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 ${compact ? "p-2" : "p-4"}`}
            onClick={close}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Keyboard shortcuts"
                className="w-full max-w-xl max-h-full flex flex-col bg-bg-primary border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`flex items-center justify-between border-b border-border bg-bg-secondary flex-shrink-0 ${compact ? "px-3 py-2" : "px-5 py-3"}`}>
                    <div className="flex items-center gap-2">
                        <CommandIcon size={compact ? 14 : 18} className="text-accent-primary" />
                        <h2 className={`font-semibold text-text-primary ${compact ? "text-xs" : "text-base"}`}>Keyboard Shortcuts</h2>
                    </div>
                    <button
                        onClick={close}
                        className="p-1.5 hover:bg-bg-tertiary rounded-lg transition-colors text-text-tertiary hover:text-text-primary"
                        aria-label="Close shortcuts"
                    >
                        <CloseIcon size={compact ? 12 : 16} />
                    </button>
                </div>

                <div className={`overflow-y-auto ${compact ? "p-3" : "p-5"}`}>
                    <div className={`grid ${compact ? "grid-cols-1 gap-3" : "grid-cols-2 gap-x-6 gap-y-5"}`}>
                        {groups.map((group) => (
                            <section key={group.title}>
                                <h3 className={`font-semibold text-text-primary mb-1.5 ${compact ? "text-xs" : "text-sm"}`}>{group.title}</h3>
                                <dl className="space-y-1">
                                    {group.shortcuts.map((shortcut) => (
                                        <div key={shortcut.description} className="flex items-center justify-between gap-3 py-1">
                                            <dt className={`text-text-secondary ${compact ? "text-xs" : "text-sm"}`}>{shortcut.description}</dt>
                                            <dd className="flex items-center gap-1 flex-shrink-0">
                                                {shortcut.keys.map((key, index) => (
                                                    <span key={index} className="flex items-center gap-1">
                                                        {index > 0 && <span className="text-text-tertiary text-[10px]">+</span>}
                                                        <kbd className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 bg-bg-tertiary border border-border rounded text-[11px] font-mono text-text-primary">
                                                            {key}
                                                        </kbd>
                                                    </span>
                                                ))}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>
                        ))}
                    </div>
                </div>

                <div className={`border-t border-border bg-bg-secondary text-center flex-shrink-0 ${compact ? "px-2 py-1.5" : "px-5 py-2.5"}`}>
                    <p className="text-[11px] text-text-tertiary">
                        Press <kbd className="px-1 py-0.5 bg-bg-tertiary border border-border rounded font-mono">Ctrl</kbd> +{" "}
                        <kbd className="px-1 py-0.5 bg-bg-tertiary border border-border rounded font-mono">/</kbd> to open this list, Esc to close
                    </p>
                </div>
            </div>
        </div>
    );
}
