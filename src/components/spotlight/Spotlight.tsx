import { invoke } from "@tauri-apps/api/core";
import {
  currentMessages,
  isSettingsOpen,
  isWindowPinned,
  readableDocumentCount,
  setDashboardMode,
  setWindowPinned,
  startNewChat,
} from "../../stores/appStore";
import { chatError } from "../../stores/chatActions";
import { handleTitleBarMouseDown } from "../../lib/window";
import { CloseIcon, ExpandIcon, NewChatIcon, PinIcon, SettingsIcon } from "../icons";
import { ModelSelector } from "../common/ModelSelector";
import { TokenCounter } from "../common/TokenCounter";
import { ChatComposer, requestComposerFocus } from "../chat/ChatComposer";
import { ChatErrorBanner } from "../chat/ChatErrorBanner";
import { EmptyState } from "../chat/EmptyState";
import { MessageList } from "../chat/MessageList";

/// The compact window summoned at the cursor. Drag the title bar to move it,
/// drag any edge to resize it, double-click the title bar to expand to the
/// Dashboard.
export function Spotlight() {
  const docCount = readableDocumentCount.value;
  const hasMessages = currentMessages.value.length > 0;
  const pinned = isWindowPinned.value;

  const handleNewChat = () => {
    startNewChat();
    chatError.value = null;
    requestComposerFocus();
  };

  return (
    // The transparent margin gives the panel room for its shadow and leaves a
    // grab area for resizing at the window edge.
    <div className="h-full w-full p-2">
      <div className="glass-panel grain relative h-full flex flex-col overflow-hidden rounded-[18px] border border-line-strong shadow-panel animate-window-in">
        <header
          className="relative z-20 flex items-center gap-1 h-12 pl-2 pr-1.5 flex-shrink-0 select-none"
          onMouseDown={(e) => handleTitleBarMouseDown(e, () => void setDashboardMode(true))}
          title="Drag to move · double-click to expand"
        >
          <ModelSelector compact />
          <div className="flex-1 min-w-2 self-stretch" />
          {hasMessages && <TokenCounter />}
          {hasMessages && (
            <button onClick={handleNewChat} className="icon-btn" title="New chat (Ctrl+N)" aria-label="New chat">
              <NewChatIcon size={15} />
            </button>
          )}
          <button
            onClick={() => setWindowPinned(!pinned)}
            className="icon-btn"
            aria-pressed={pinned}
            title={pinned ? "Pinned — stays open when you click elsewhere" : "Pin: keep open when you click elsewhere"}
            aria-label="Keep window open"
          >
            <PinIcon size={15} className={`transition-transform ${pinned ? "-rotate-45" : ""}`} />
          </button>
          <button onClick={() => (isSettingsOpen.value = true)} className="icon-btn" title="Settings (Ctrl+,)" aria-label="Settings">
            <SettingsIcon size={15} />
          </button>
          <button onClick={() => void setDashboardMode(true)} className="icon-btn" title="Expand to Dashboard" aria-label="Expand to Dashboard">
            <ExpandIcon size={15} />
          </button>
          <button
            onClick={() => invoke("hide_window")}
            className="icon-btn hover:!bg-danger/15 hover:!text-danger"
            title="Hide (Esc)"
            aria-label="Hide window"
          >
            <CloseIcon size={16} />
          </button>
        </header>

        <MessageList compact emptyState={<EmptyState compact />} />
        <ChatErrorBanner compact />
        <ChatComposer compact placeholder={docCount > 0 ? "Ask about your documents…" : "Ask anything…"} />
      </div>
    </div>
  );
}
