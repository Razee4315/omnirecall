import { isGenerating, isSettingsOpen, settingsTab } from "../../stores/appStore";
import { canRetry, chatError, retryLast } from "../../stores/chatActions";
import { AlertIcon, CloseIcon, KeyIcon, RegenerateIcon } from "../icons";

/// The error card above the composer, with the action that fixes it: open
/// Settings for key problems, otherwise retry the failed send.
export function ChatErrorBanner({ compact }: { compact: boolean }) {
  const error = chatError.value;
  if (!error) return null;

  const needsSettings = /Settings|API key/i.test(error);

  return (
    <div className={compact ? "px-2.5 pt-1" : "px-5 pt-1"}>
      <div
        className={`flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/8 animate-pop-in ${compact ? "p-2.5" : "p-3 max-w-3xl mx-auto"}`}
        role="alert"
      >
        <AlertIcon size={15} className="text-danger flex-shrink-0 mt-px" />
        <p className={`selectable flex-1 min-w-0 text-fg leading-snug ${compact ? "text-xs" : "text-[13px]"}`}>{error}</p>
        <div className="flex items-center gap-1 flex-shrink-0 -my-0.5">
          {needsSettings ? (
            <button
              onClick={() => {
                settingsTab.value = "providers";
                isSettingsOpen.value = true;
              }}
              className="btn btn-sm btn-secondary"
            >
              <KeyIcon size={12} />
              Open Settings
            </button>
          ) : (
            canRetry() && (
              <button onClick={() => void retryLast()} disabled={isGenerating.value} className="btn btn-sm btn-secondary">
                <RegenerateIcon size={12} />
                Try again
              </button>
            )
          )}
          <button onClick={() => (chatError.value = null)} className="icon-btn icon-btn-sm" aria-label="Dismiss error">
            <CloseIcon size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
