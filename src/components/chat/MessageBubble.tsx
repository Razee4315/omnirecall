import { memo } from "preact/compat";
import { useState } from "preact/hooks";
import {
  activeSessionId,
  branchFromMessage,
  ChatMessage,
  editMessage,
  getMessageVersions,
  isGenerating,
  switchToBranch,
} from "../../stores/appStore";
import { chatError, regenerateMessage } from "../../stores/chatActions";
import { requestComposerFocus } from "./ChatComposer";
import { toast } from "../../stores/toastStore";
import { modelLabel } from "../../lib/models";
import {
  AlertIcon,
  BranchIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DocumentIcon,
  EditIcon,
  LogoMark,
  RegenerateIcon,
} from "../icons";
import { Markdown } from "../common/Markdown";

interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
  isLast: boolean;
  /// Spotlight's denser layout.
  compact: boolean;
  /// Play the entrance animation (new messages only).
  animate: boolean;
  highlighted: boolean;
  /// This answer is still being written.
  streaming?: boolean;
}

function ActionButton({ onClick, label, children, disabled }: { onClick: () => void; label: string; children: preact.ComponentChildren; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="icon-btn icon-btn-sm" title={label} aria-label={label}>
      {children}
    </button>
  );
}

/// One chat message. User turns are bubbles on the right; answers are full
/// width prose, like a document, with their actions underneath. Memoized:
/// while an answer streams only the message being written re-renders.
export const MessageBubble = memo(function MessageBubble({
  message,
  index,
  isLast,
  compact,
  animate,
  highlighted,
  streaming = false,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const busy = isGenerating.value;
  const sessionId = activeSessionId.value;
  const versions = !isUser && sessionId ? getMessageVersions(index) : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };

  const handleEdit = () => {
    if (editMessage(message.id)) {
      chatError.value = null;
      requestComposerFocus();
    }
  };

  const stepVersion = (delta: number) => {
    if (!versions || !sessionId) return;
    const next = versions.ids[versions.current + delta];
    if (next !== undefined) switchToBranch(sessionId, next);
  };

  const copyButton = (
    <ActionButton onClick={() => void handleCopy()} label={copied ? "Copied" : "Copy"}>
      {copied ? <CheckIcon size={13} className="text-success" /> : <CopyIcon size={13} />}
    </ActionButton>
  );

  if (isUser) {
    return (
      <div
        data-message-id={message.id}
        className={`group flex flex-col items-end ${animate ? "animate-message-reveal" : ""}`}
      >
        <div
          className={`selectable relative whitespace-pre-wrap break-words leading-relaxed text-fg bg-surface-2 border border-line ${
            compact ? "max-w-[88%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px]" : "max-w-[78%] rounded-[20px] rounded-br-md px-4 py-2.5 text-[14.5px]"
          } ${highlighted ? "ring-2 ring-accent" : ""}`}
        >
          {message.content}
        </div>
        <div className="flex items-center gap-0.5 mt-1 h-6 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {copyButton}
          {!busy && (
            <ActionButton onClick={handleEdit} label="Edit and resend">
              <EditIcon size={13} />
            </ActionButton>
          )}
        </div>
      </div>
    );
  }

  // The last answer keeps its actions visible; earlier ones show on hover.
  const actionsAlwaysVisible = (isLast && !streaming) || copied || !!versions;

  return (
    <div
      data-message-id={message.id}
      className={`group flex gap-3 ${animate ? "animate-message-reveal" : ""} ${highlighted ? "rounded-xl ring-2 ring-accent ring-offset-4 ring-offset-canvas" : ""}`}
    >
      {!compact && (
        <div className="flex-shrink-0 pt-0.5">
          <LogoMark size={24} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <Markdown
          content={message.content}
          className={`text-fg ${compact ? "text-[13.5px]" : "text-[14.5px]"} ${streaming ? "stream-caret" : ""}`}
        />

        {message.interrupted && (
          <div className="inline-flex items-center gap-1.5 mt-2 px-2 h-6 rounded-md bg-warning/10 text-2xs text-warning">
            <AlertIcon size={12} />
            <span>Response was interrupted</span>
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3" aria-label="Sources used for this answer">
            {message.sources.map(source => (
              <span key={source} className="chip max-w-[220px]" title={source}>
                <DocumentIcon size={11} className="flex-shrink-0 text-accent" />
                <span className="truncate">{source}</span>
              </span>
            ))}
          </div>
        )}

        {!streaming && (
          <div
            className={`flex items-center gap-0.5 mt-1.5 -ml-1 h-7 transition-opacity ${
              actionsAlwaysVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            }`}
          >
            {copyButton}

            {isLast && !busy && sessionId && (
              <ActionButton onClick={() => regenerateMessage(message.id)} label="Regenerate">
                <RegenerateIcon size={13} />
              </ActionButton>
            )}

            {!isLast && !busy && sessionId && (
              <ActionButton onClick={() => branchFromMessage(sessionId, message.id)} label="Branch from here">
                <BranchIcon size={13} />
              </ActionButton>
            )}

            {versions && (
              <div className="flex items-center text-fg-subtle" role="group" aria-label="Answer versions">
                <ActionButton onClick={() => stepVersion(-1)} disabled={busy || versions.current === 0} label="Previous version">
                  <ChevronLeftIcon size={13} />
                </ActionButton>
                <span className="text-2xs tabular-nums px-0.5" aria-live="polite">
                  {versions.current + 1} / {versions.ids.length}
                </span>
                <ActionButton
                  onClick={() => stepVersion(1)}
                  disabled={busy || versions.current === versions.ids.length - 1}
                  label="Next version"
                >
                  <ChevronRightIcon size={13} />
                </ActionButton>
              </div>
            )}

            {message.model && (
              <span className="ml-1.5 text-2xs text-fg-subtle truncate max-w-[200px]" title={`Answered by ${message.model}`}>
                {modelLabel(message.model)}
              </span>
            )}
            {!compact && message.tokenCount !== undefined && message.tokenCount > 10 && (
              <span className="text-2xs text-fg-subtle whitespace-nowrap before:content-['·'] before:mx-1.5">
                ~{message.tokenCount.toLocaleString()} tokens
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
