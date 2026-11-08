import { useEffect, useRef } from "preact/hooks";
import { signal } from "@preact/signals";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { currentQuery, isGenerating, isOnline, stopGeneration } from "../../stores/appStore";
import { MAX_MESSAGE_CHARS, submitMessage } from "../../stores/chatActions";
import { toast } from "../../stores/toastStore";
import { pickAndAddDocuments } from "../../lib/documents";
import { useAutoResize } from "../../hooks/useAutoResize";
import { ClipboardIcon, PaperclipIcon, SendIcon, StopIcon } from "../icons";
import { DocsToggle } from "./DocsToggle";

/// Bumped to ask the mounted composer to take focus (after "New chat",
/// "Edit & resend", picking a suggestion, ...).
const focusRequest = signal(0);

export function requestComposerFocus() {
  focusRequest.value += 1;
}

/// Turn clipboard text into a Markdown quote followed by room to type.
export function quoteForComposer(clipboard: string, existing: string): string {
  const quoted = clipboard
    .trim()
    .split(/\r?\n/)
    .map(line => `> ${line}`)
    .join("\n");
  const prefix = existing.trim() ? `${existing.trimEnd()}\n\n` : "";
  return `${prefix}${quoted}\n\n`;
}

/// Insert the clipboard's text into the composer as a quote, so "what does
/// this mean?" about something just copied is one action.
export async function quoteClipboard(): Promise<void> {
  try {
    const text = await readText();
    if (!text || !text.trim()) {
      toast.info("The clipboard has no text");
      return;
    }
    currentQuery.value = quoteForComposer(text, currentQuery.value).slice(0, MAX_MESSAGE_CHARS);
    requestComposerFocus();
  } catch {
    toast.error("Couldn't read the clipboard");
  }
}

function overlayIsOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

interface ChatComposerProps {
  compact: boolean;
  placeholder: string;
}

/// The message input shared by Spotlight and the Dashboard. The textarea is
/// never disabled — while an answer streams you can keep typing the next
/// message, and focus stays where it is — only sending waits.
export function ChatComposer({ compact, placeholder }: ChatComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { resize } = useAutoResize(compact ? 132 : 240);
  const query = currentQuery.value;
  const generating = isGenerating.value;
  const canSend = query.trim().length > 0 && !generating;

  // Keep the textarea height right for typed and programmatic changes.
  useEffect(() => {
    resize(inputRef.current);
  }, [query, resize]);

  const focusInput = () => {
    const input = inputRef.current;
    if (!input || overlayIsOpen()) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  // Focus on mount and whenever something asks for it.
  useEffect(focusInput, [focusRequest.value]);

  // The window is summoned by hotkey to type straight away, so take focus
  // back whenever it is shown again.
  useEffect(() => {
    window.addEventListener("focus", focusInput);
    return () => window.removeEventListener("focus", focusInput);
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    // Enter confirms an IME composition (CJK input); it must not send.
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitMessage();
    }
  };

  const nearLimit = query.length > MAX_MESSAGE_CHARS / 2;

  return (
    <div className={compact ? "px-2.5 pb-2.5 pt-1" : "px-5 pb-4 pt-1"}>
      <div className={compact ? "" : "max-w-3xl mx-auto"}>
        <div
          className="group/composer relative rounded-2xl border border-line bg-surface shadow-soft transition-[border-color,box-shadow] duration-200 focus-within:border-accent/45"
          style={{ boxShadow: "var(--shadow-soft)" }}
          onClick={(e) => {
            // Clicking the padding around the textarea focuses it.
            if (e.target === e.currentTarget) inputRef.current?.focus();
          }}
        >
          <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-200 group-focus-within/composer:opacity-100" style={{ boxShadow: "0 0 0 3px var(--glow)" }} />
          <textarea
            ref={inputRef}
            value={query}
            onInput={(e) => {
              currentQuery.value = (e.target as HTMLTextAreaElement).value;
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            maxLength={MAX_MESSAGE_CHARS}
            aria-label="Message"
            className={`relative block w-full resize-none bg-transparent outline-none text-fg placeholder:text-fg-subtle leading-relaxed ${
              compact ? "px-3.5 pt-3 pb-1 text-[13.5px] min-h-[44px]" : "px-4 pt-3.5 pb-1.5 text-[14.5px] min-h-[52px]"
            }`}
          />

          <div className={`relative flex items-center gap-1 ${compact ? "px-2 pb-2" : "px-2.5 pb-2.5"}`}>
            <button
              onClick={() => void pickAndAddDocuments()}
              className="icon-btn"
              title="Attach documents"
              aria-label="Attach documents"
            >
              <PaperclipIcon size={16} />
            </button>
            <button
              onClick={() => void quoteClipboard()}
              className="icon-btn"
              title="Quote clipboard (Ctrl+Shift+V)"
              aria-label="Quote clipboard text"
            >
              <ClipboardIcon size={16} />
            </button>
            <DocsToggle compact={compact} />
            {!isOnline.value && (
              <span className="chip border-warning/30 bg-warning/10 text-warning" title="No internet connection — only local Ollama models will work">
                Offline
              </span>
            )}

            <div className="flex-1" />

            {nearLimit && (
              <span className={`text-2xs tabular-nums mr-1 ${query.length > MAX_MESSAGE_CHARS * 0.9 ? "text-warning" : "text-fg-subtle"}`}>
                {query.length.toLocaleString()} / {MAX_MESSAGE_CHARS.toLocaleString()}
              </span>
            )}

            {generating ? (
              <button
                onClick={stopGeneration}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-fg text-canvas transition-transform hover:scale-105 active:scale-95"
                title="Stop generating (Ctrl+.)"
                aria-label="Stop generating"
              >
                <StopIcon size={16} />
              </button>
            ) : (
              <button
                onClick={() => void submitMessage()}
                disabled={!canSend}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150 ${
                  canSend
                    ? "bg-accent text-accent-fg hover:brightness-110 active:scale-95 shadow-[0_2px_10px_-2px_var(--glow)]"
                    : "bg-surface-3 text-fg-subtle"
                }`}
                title={canSend ? "Send (Enter)" : "Type a message to send"}
                aria-label={canSend ? "Send message" : "Send disabled — type a message first"}
              >
                <SendIcon size={16} />
              </button>
            )}
          </div>
        </div>

        {!compact && (
          <p className="mt-2 text-center text-2xs text-fg-subtle">
            <span className="kbd">Enter</span> to send · <span className="kbd">Shift</span> <span className="kbd">Enter</span> for a new line ·{" "}
            <span className="kbd">/</span> commands like <span className="font-mono">/system</span>
          </p>
        )}
      </div>
    </div>
  );
}
