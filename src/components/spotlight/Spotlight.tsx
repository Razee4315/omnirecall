import { invoke } from "@tauri-apps/api/core";
import {
  currentMessages,
  currentQuery,
  isOnline,
  isSettingsOpen,
  isWindowPinned,
  readableDocumentCount,
  setDashboardMode,
  setWindowPinned,
  startNewChat,
} from "../../stores/appStore";
import { chatError } from "../../stores/chatActions";
import { pickAndAddDocuments } from "../../lib/documents";
import {
  CloseIcon,
  ExpandIcon,
  FolderIcon,
  LogoIcon,
  PinIcon,
  PlusIcon,
  SettingsIcon,
} from "../icons";
import { ModelSelector } from "../common/ModelSelector";
import { TokenCounter } from "../common/TokenCounter";
import { ChatComposer, requestComposerFocus } from "../chat/ChatComposer";
import { ChatErrorBanner } from "../chat/ChatErrorBanner";
import { DocsToggle } from "../chat/DocsToggle";
import { MessageList } from "../chat/MessageList";

const QUICK_PROMPTS = ["Explain simply", "Brainstorm ideas", "Draft a reply"];

const headerButton =
  "p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary";

export function Spotlight() {
  const docCount = readableDocumentCount.value;
  const hasMessages = currentMessages.value.length > 0;

  const handleNewChat = () => {
    startNewChat();
    chatError.value = null;
    requestComposerFocus();
  };

  const emptyState = (
    <div className="h-full flex items-center justify-center p-4">
      <div className="text-center max-w-xs">
        <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-accent-primary/10 flex items-center justify-center">
          <LogoIcon size={22} className="text-accent-primary" />
        </div>
        <p className="text-xs text-text-secondary mb-1 font-medium">
          {docCount > 0 ? `${docCount} document${docCount > 1 ? "s" : ""} ready` : "Ask anything"}
        </p>
        <p className="text-[11px] text-text-tertiary mb-3">
          {docCount > 0 ? "Ask questions about your documents" : "Chat, or add documents to ask about them"}
        </p>
        {docCount === 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  currentQuery.value = `${prompt}: `;
                  requestComposerFocus();
                }}
                className="px-2 py-1 rounded-md border border-border text-[11px] text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-text-tertiary">
          <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border">Enter</kbd> send</span>
          <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border">Ctrl+K</kbd> commands</span>
          <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border">Esc</kbd> hide</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col">
      <div className="glass rounded-xl border border-border shadow-2xl overflow-hidden animate-fade-in m-2 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border drag-region">
          <div className="flex items-center gap-2 no-drag min-w-0 flex-1">
            <LogoIcon size={18} className="text-accent-primary flex-shrink-0" />
            <ModelSelector compact />
            {hasMessages && <TokenCounter />}
            <DocsToggle compact />
            {!isOnline.value && (
              <span
                className="px-1.5 py-0.5 rounded bg-warning/15 text-warning text-[10px] font-medium"
                title="No internet connection — only local Ollama models will work"
              >
                Offline
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 no-drag flex-shrink-0">
            {hasMessages && (
              <button
                onClick={handleNewChat}
                className={headerButton}
                title="New chat (Ctrl+N)"
                aria-label="New chat"
              >
                <PlusIcon size={14} />
              </button>
            )}
            <button
              onClick={() => void pickAndAddDocuments()}
              className={headerButton}
              title="Add documents"
              aria-label="Add documents"
            >
              <FolderIcon size={14} />
            </button>
            <button
              onClick={() => setWindowPinned(!isWindowPinned.value)}
              className={`p-1.5 rounded-md transition-colors ${
                isWindowPinned.value
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
              title={isWindowPinned.value ? "Unpin: hide when you click elsewhere" : "Keep open when you click elsewhere"}
              aria-label="Keep window open"
              aria-pressed={isWindowPinned.value}
            >
              <PinIcon size={14} />
            </button>
            <button
              onClick={() => (isSettingsOpen.value = true)}
              className={headerButton}
              title="Settings (Ctrl+,)"
              aria-label="Settings"
            >
              <SettingsIcon size={14} />
            </button>
            <button
              onClick={() => void setDashboardMode(true)}
              className={headerButton}
              title="Expand to Dashboard"
              aria-label="Expand to Dashboard"
            >
              <ExpandIcon size={14} />
            </button>
            <button
              onClick={() => invoke("hide_window")}
              className={headerButton}
              title="Hide (Esc)"
              aria-label="Hide window"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>

        <MessageList compact emptyState={emptyState} />
        <ChatErrorBanner compact />
        <ChatComposer compact placeholder={docCount > 0 ? "Ask about your docs..." : "Ask anything..."} />
      </div>
    </div>
  );
}
