import { isGenerating, isSettingsOpen, settingsTab } from "../../stores/appStore";
import { canRetry, chatError, retryLast } from "../../stores/chatActions";
import { CloseIcon } from "../icons";

/// The error strip above the composer, with the action that fixes it: open
/// Settings for key problems, otherwise retry the failed send.
export function ChatErrorBanner({ compact }: { compact: boolean }) {
  const error = chatError.value;
  if (!error) return null;

  const needsSettings = /Settings|API key/i.test(error);
  const buttonClass = `rounded bg-error/20 text-error hover:bg-error/30 transition-colors disabled:opacity-50 ${
    compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
  }`;

  return (
    <div
      className={`bg-error/10 border-t border-error/20 flex items-center justify-between ${
        compact ? "px-3 py-2 gap-2" : "px-4 py-2 gap-3"
      }`}
      role="alert"
    >
      <p className={`selectable text-error flex-1 ${compact ? "text-xs" : "text-sm"}`}>{error}</p>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {needsSettings ? (
          <button
            onClick={() => {
              settingsTab.value = "providers";
              isSettingsOpen.value = true;
            }}
            className={buttonClass}
          >
            Open Settings
          </button>
        ) : (
          canRetry() && (
            <button onClick={() => void retryLast()} disabled={isGenerating.value} className={buttonClass}>
              Try again
            </button>
          )
        )}
        <button
          onClick={() => (chatError.value = null)}
          className="p-1 rounded text-error/70 hover:text-error hover:bg-error/10 transition-colors"
          aria-label="Dismiss error"
        >
          <CloseIcon size={compact ? 10 : 12} />
        </button>
      </div>
    </div>
  );
}
