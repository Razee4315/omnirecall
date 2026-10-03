import { useEffect, useRef } from "preact/hooks";
import { signal } from "@preact/signals";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { currentQuery, isGenerating, stopGeneration } from "../../stores/appStore";
import { MAX_MESSAGE_CHARS, submitMessage } from "../../stores/chatActions";
import { toast } from "../../stores/toastStore";
import { useAutoResize } from "../../hooks/useAutoResize";
import { ClipboardIcon, SendIcon, StopIcon } from "../icons";

/// Bumped to ask the mounted composer to take focus (after "New chat",
/// "Edit & resend", picking a quick prompt, ...).
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
  const { resize } = useAutoResize(compact ? 60 : 200);
  const query = currentQuery.value;
  const generating = isGenerating.value;
  const canSend = query.trim().length > 0 && !generating;

  // Keep the textarea height correct for typed and programmatic changes.
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

  const iconSize = compact ? 14 : 18;
  const textarea = (
    <textarea
      ref={inputRef}
      value={query}
      onInput={(e) => {
        currentQuery.value = (e.target as HTMLTextAreaElement).value;
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={
        compact
          ? "flex-1 bg-bg-tertiary rounded-lg px-3 py-2 text-text-primary placeholder:text-text-tertiary resize-none outline-none text-xs leading-relaxed min-h-[32px] max-h-[60px]"
          : "flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary resize-none outline-none text-sm leading-6 min-h-[24px] max-h-[200px] py-0"
      }
      rows={1}
      maxLength={MAX_MESSAGE_CHARS}
      aria-label="Chat message input"
    />
  );

  const buttons = (
    <>
      <button
        onClick={() => void quoteClipboard()}
        className={`rounded-lg transition-colors flex-shrink-0 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary p-2`}
        title="Quote clipboard text"
        aria-label="Quote clipboard text"
      >
        <ClipboardIcon size={iconSize} />
      </button>
      {generating ? (
        <button
          onClick={stopGeneration}
          className="p-2 rounded-lg bg-error text-white hover:bg-error/90 transition-colors flex-shrink-0"
          title="Stop generating (Ctrl+.)"
          aria-label="Stop generating"
        >
          <StopIcon size={iconSize} />
        </button>
      ) : (
        <button
          onClick={() => void submitMessage()}
          disabled={!canSend}
          className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
            canSend
              ? "bg-accent-primary text-on-accent hover:bg-accent-primary/90"
              : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
          }`}
          title={canSend ? "Send (Enter)" : "Type a message to send"}
          aria-label={canSend ? "Send message" : "Send disabled — type a message first"}
        >
          <SendIcon size={iconSize} />
        </button>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="p-2 border-t border-border">
        <div className="flex items-end gap-1.5">
          {textarea}
          {buttons}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-bg-secondary p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 bg-bg-primary rounded-xl border border-border px-4 py-3 focus-within:border-accent-primary transition-colors">
          {textarea}
          {buttons}
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-text-tertiary">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded">Enter</kbd> send</span>
            <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded">Shift</kbd>+<kbd className="px-1 py-0.5 bg-bg-tertiary rounded">Enter</kbd> newline</span>
            <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded">/help</kbd> commands</span>
          </div>
          {query.length > MAX_MESSAGE_CHARS / 2 && (
            <span className={query.length > MAX_MESSAGE_CHARS * 0.9 ? "text-warning" : ""}>
              {query.length.toLocaleString()} / {MAX_MESSAGE_CHARS.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
