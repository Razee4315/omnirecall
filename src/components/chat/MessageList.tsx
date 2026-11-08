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
import { ArrowDownIcon, LogoMark, TypingIndicator } from "../icons";
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
  const [scrolled, setScrolled] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const messages = currentMessages.value;
  const generating = isGenerating.value;
  const epoch = threadEpoch.value;
  const session = chatHistory.value.find(s => s.id === activeSessionId.value);
  // Regenerated versions are stepped through with the arrows on the answer;
  // the selector appears once the user has created a branch of their own.
  const showBranches = !!session && visibleThreadCount(session) > 1;

  // Messages already on screen when a thread opens don't animate; only ones
  // added afterwards do.
  const initialRef = useRef<{ epoch: number; ids: Set<string> }>({ epoch: -1, ids: new Set() });
  if (initialRef.current.epoch !== epoch) {
    initialRef.current = { epoch, ids: new Set(messages.map(m => m.id)) };
  }
  const seen = initialRef.current.ids;

  const scrollToBottom = (smooth = false) => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
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
    setScrolled(el.scrollTop > 4);
  };

  const last = messages[messages.length - 1];
  const waitingForFirstChunk = generating && last?.role === "assistant" && !last.content;
  const streamingId = generating && last?.role === "assistant" && last.content ? last.id : null;

  return (
    <div className="relative flex-1 min-h-0">
      {/* Hairline that appears once content scrolls under the header. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-line transition-opacity duration-200 ${scrolled && messages.length > 0 ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overscroll-contain"
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
          <div className={compact ? "px-4 pt-3 pb-4 space-y-5" : "max-w-3xl mx-auto px-6 pt-6 pb-8 space-y-7"}>
            {showBranches && (
              <div className="flex justify-center">
                <BranchSelector />
              </div>
            )}

            {messages.map((message, index) => {
              // The empty assistant placeholder is represented by the
              // thinking row until the first chunk arrives.
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
                  streaming={message.id === streamingId}
                />
              );
            })}

            {waitingForFirstChunk && (
              <div className="flex items-center gap-3 animate-fade-in" role="status" aria-label="Waiting for the response">
                {!compact && <LogoMark size={24} />}
                <div className="flex items-center gap-2 h-6 text-fg-subtle">
                  <TypingIndicator className="text-accent" />
                  <span className="text-xs">Thinking…</span>
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
            scrollToBottom(true);
          }}
          className="absolute z-10 left-1/2 -translate-x-1/2 bottom-3 inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full bg-overlay border border-line shadow-pop text-2xs font-medium text-fg-muted hover:text-fg transition-colors animate-pop-in"
          aria-label="Scroll to latest message"
        >
          <ArrowDownIcon size={13} />
          {generating ? "New response" : "Latest"}
        </button>
      )}
    </div>
  );
}
