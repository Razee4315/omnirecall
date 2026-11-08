import { useRef } from "preact/hooks";
import { formatHotkey, globalHotkey, isShortcutsHelpOpen, viewMode } from "../../stores/appStore";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { SHORTCUT_GROUPS, ShortcutGroup } from "../../lib/shortcuts";
import { CloseIcon, KeyboardIcon } from "../icons";

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
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center ${compact ? "p-3" : "p-6"}`} onClick={close}>
      <div className="scrim absolute inset-0" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="dialog relative w-full max-w-[640px] max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between h-14 px-5 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/12 text-accent">
              <KeyboardIcon size={15} />
            </span>
            <h2 className="text-[15px] font-semibold">Keyboard shortcuts</h2>
          </div>
          <button onClick={close} className="icon-btn" aria-label="Close shortcuts">
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className={`grid ${compact ? "grid-cols-1 gap-5" : "grid-cols-2 gap-x-8 gap-y-6"}`}>
            {groups.map((group) => (
              <section key={group.title}>
                <h3 className="section-label mb-2">{group.title}</h3>
                <dl className="space-y-0.5">
                  {group.shortcuts.map((shortcut) => (
                    <div key={shortcut.description} className="flex items-center justify-between gap-3 h-8">
                      <dt className="text-[13px] text-fg-muted">{shortcut.description}</dt>
                      <dd className="flex items-center gap-1 flex-shrink-0">
                        {shortcut.keys.map((key, index) => (
                          <span key={index} className="kbd h-[22px] min-w-[22px] px-1.5 text-[11px]">{key}</span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 h-10 border-t border-line text-2xs text-fg-subtle flex-shrink-0">
          <span className="kbd">Ctrl</span>
          <span className="kbd">/</span>
          <span>opens this list ·</span>
          <span className="kbd">Esc</span>
          <span>closes it</span>
        </div>
      </div>
    </div>
  );
}
