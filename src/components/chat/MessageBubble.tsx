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
import {
  AlertIcon,
  BranchIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DocumentIcon,
  EditIcon,
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
}

/// One chat message with its hover actions. Memoized: while an answer streams
/// only the message being written re-renders.
export const MessageBubble = memo(function MessageBubble({
  message,
  index,
  isLast,
  compact,
  animate,
  highlighted,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const busy = isGenerating.value;
  const sessionId = activeSessionId.value;
  const versions = !isUser && sessionId ? getMessageVersions(index) : null;
  const iconSize = 12;

  const actionClass = `rounded flex items-center justify-center transition-colors text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary ${
    compact ? "p-1 min-w-[24px] min-h-[24px]" : "p-1.5 min-w-[28px] min-h-[28px]"
  }`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  return (
    <div
      data-message-id={message.id}
      className={`group flex ${isUser ? "justify-end" : "justify-start"} ${animate ? "animate-message-reveal" : ""}`}
    >
      <div
        className={`relative ${compact ? "max-w-[90%] rounded-lg px-3 py-2 text-xs" : "max-w-[80%] rounded-xl px-4 py-3 text-sm"} ${
          isUser
            ? "bg-accent-primary text-on-accent"
            : compact
            ? "bg-bg-tertiary text-text-primary"
            : "bg-bg-secondary text-text-primary border border-border"
        } ${highlighted ? "ring-2 ring-accent-primary" : ""}`}
      >
        {isUser ? (
          <div className="selectable whitespace-pre-wrap leading-relaxed">{message.content}</div>
        ) : (
          <Markdown content={message.content} className="leading-relaxed" />
        )}

        {message.interrupted && (
          <div className="flex items-center gap-1 mt-2 text-[11px] text-warning">
            <AlertIcon size={12} />
            <span>Response was interrupted</span>
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2" aria-label="Sources used for this answer">
            <span className="text-[10px] text-text-tertiary">Sources:</span>
            {message.sources.map(source => (
              <span
                key={source}
                className="inline-flex items-center gap-1 max-w-[180px] px-1.5 py-0.5 rounded bg-accent-primary/10 text-[10px] text-accent-primary"
                title={source}
              >
                <DocumentIcon size={10} className="flex-shrink-0" />
                <span className="truncate">{source}</span>
              </span>
            ))}
          </div>
        )}

        {/* A toolbar floating on the bubble's bottom edge, so it takes no
            space in the message. Hidden until the message is hovered or
            focused, except while showing the "copied" confirmation or the
            version arrows. */}
        <div
          className={`absolute z-10 -bottom-4 ${isUser ? "right-2" : "left-2"} flex items-center gap-0.5 px-0.5 rounded-lg border border-border bg-bg-primary shadow-md transition-opacity ${
            copied || versions
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          }`}
        >
          <button
            onClick={handleCopy}
            className={actionClass}
            title={copied ? "Copied!" : "Copy message"}
            aria-label="Copy message"
          >
            {copied ? <CheckIcon size={iconSize} /> : <CopyIcon size={iconSize} />}
          </button>

          {isUser && !busy && (
            <button onClick={handleEdit} className={actionClass} title="Edit & resend" aria-label="Edit and resend message">
              <EditIcon size={iconSize} />
            </button>
          )}

          {!isUser && isLast && !busy && sessionId && (
            <button
              onClick={() => regenerateMessage(message.id)}
              className={actionClass}
              title="Regenerate response"
              aria-label="Regenerate response"
            >
              <RegenerateIcon size={iconSize} />
            </button>
          )}

          {!isUser && !isLast && !busy && sessionId && (
            <button
              onClick={() => branchFromMessage(sessionId, message.id)}
              className={actionClass}
              title="Branch conversation from here"
              aria-label="Branch from this message"
            >
              <BranchIcon size={iconSize} />
            </button>
          )}

          {versions && (
            <div className="flex items-center text-text-tertiary" role="group" aria-label="Answer versions">
              <button
                onClick={() => stepVersion(-1)}
                disabled={busy || versions.current === 0}
                className={`${actionClass} disabled:opacity-30`}
                aria-label="Previous version"
                title="Previous version"
              >
                <ChevronLeftIcon size={iconSize} />
              </button>
              <span className="text-[11px] tabular-nums px-0.5" aria-live="polite">
                {versions.current + 1}/{versions.ids.length}
              </span>
              <button
                onClick={() => stepVersion(1)}
                disabled={busy || versions.current === versions.ids.length - 1}
                className={`${actionClass} disabled:opacity-30`}
                aria-label="Next version"
                title="Next version"
              >
                <ChevronRightIcon size={iconSize} />
              </button>
            </div>
          )}

          {!isUser && message.model && (
            <span className="text-[10px] text-text-tertiary px-1 truncate max-w-[160px] whitespace-nowrap" title={`Answered by ${message.model}`}>
              {message.model}
            </span>
          )}
          {!compact && message.tokenCount !== undefined && message.tokenCount > 10 && (
            <span className="text-[10px] px-1 text-text-tertiary whitespace-nowrap">~{message.tokenCount} tokens</span>
          )}
        </div>
      </div>
    </div>
  );
});
