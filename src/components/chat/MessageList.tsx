import { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import {
  activeSessionId,
  chatHistory,
  currentMessages,
  isGenerating,
  pendingScrollMessageId,
  threadEpoch,
  visibleThreadCount,
} from "../../stores/appStore";
import { BranchSelector } from "../common/BranchSelector";
import { ChevronDownIcon, TypingIndicator } from "../icons";
import { MessageBubble } from "./MessageBubble";

/// Distance from the bottom (px) within which new content keeps the view
/// pinned to the latest message.
const STICK_THRESHOLD = 100;

interface MessageListProps {
  compact: boolean;
  /// Shown instead of the conversation when there are no messages yet.
  emptyState: ComponentChildren;
}

/// The scrolling conversation. Follows new content only while the user is at
/// the bottom, so streaming never yanks someone reading earlier messages.
export function MessageList({ compact, emptyState }: MessageListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const messages = currentMessages.value;
  const generating = isGenerating.value;
  const epoch = threadEpoch.value;
  const session = chatHistory.value.find(s => s.id === activeSessionId.value);
  // Regenerated versions are stepped through with the arrows on the answer;
  // the selector appears once the user has created a branch of their own.
  const showBranches = !!session && visibleThreadCount(session) > 1;

  // Messages already on screen when a thread opens don't animate; only ones
  // added afterwards do (and they keep the class, so a re-render mid-way
  // doesn't cut the animation short).
  const initialRef = useRef<{ epoch: number; ids: Set<string> }>({ epoch: -1, ids: new Set() });
  if (initialRef.current.epoch !== epoch) {
    initialRef.current = { epoch, ids: new Set(messages.map(m => m.id)) };
  }
  const seen = initialRef.current.ids;

  const scrollToBottom = () => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Opening a different thread always starts at the bottom.
  useLayoutEffect(() => {
    atBottomRef.current = true;
    setShowJump(false);
    scrollToBottom();
  }, [epoch]);

  useLayoutEffect(() => {
    if (atBottomRef.current) scrollToBottom();
  }, [messages]);

  // Scroll a search hit into view and flash it.
  const pendingId = pendingScrollMessageId.value;
  useEffect(() => {
    if (!pendingId) return;
    const target = scrollerRef.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(pendingId)}"]`);
    pendingScrollMessageId.value = null;
    if (!target) return;
    atBottomRef.current = false;
    target.scrollIntoView({ block: "center" });
    setHighlightedId(pendingId);
    const timer = setTimeout(() => setHighlightedId(null), 2000);
    return () => clearTimeout(timer);
  }, [pendingId, epoch]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
    atBottomRef.current = atBottom;
    setShowJump(!atBottom);
  };

  const last = messages[messages.length - 1];
  const waitingForFirstChunk = generating && last?.role === "assistant" && !last.content;

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className={`h-full overflow-y-auto ${compact ? "" : "p-4"}`}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        aria-busy={generating}
        aria-label="Conversation"
      >
        {messages.length === 0 ? (
          emptyState
        ) : (
          <div className={compact ? "p-3 pb-6 space-y-3" : "max-w-3xl mx-auto pb-4 space-y-4"}>
            {showBranches && (
              <div className="flex justify-center">
                <BranchSelector />
              </div>
            )}

            {messages.map((message, index) => {
              // The empty assistant placeholder is represented by the typing
              // indicator until the first chunk arrives.
              if (message.role === "assistant" && !message.content) return null;
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  index={index}
                  isLast={index === messages.length - 1}
                  compact={compact}
                  animate={!seen.has(message.id)}
                  highlighted={highlightedId === message.id}
                />
              );
            })}

            {waitingForFirstChunk && (
              <div className="flex justify-start" role="status" aria-label="Waiting for the response">
                <div
                  className={
                    compact
                      ? "bg-bg-tertiary rounded-lg px-3 py-2.5"
                      : "bg-bg-secondary border border-border rounded-xl px-4 py-3"
                  }
                >
                  <TypingIndicator className="text-accent-primary" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Outside the scroller so it stays put while the conversation scrolls. */}
      {showJump && messages.length > 0 && (
        <button
          onClick={() => {
            atBottomRef.current = true;
            setShowJump(false);
            scrollToBottom();
          }}
          className={`absolute z-10 rounded-full bg-bg-secondary border border-border shadow-lg hover:bg-bg-tertiary transition-colors animate-fade-in ${
            compact ? "bottom-2 right-3 p-1.5" : "bottom-4 right-6 p-2"
          }`}
          aria-label="Scroll to latest message"
          title="Scroll to latest message"
        >
          <ChevronDownIcon size={compact ? 14 : 16} className="text-text-secondary" />
        </button>
      )}
    </div>
  );
}
