import { lazy, Suspense } from "preact/compat";
import { useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { toast } from "./stores/toastStore";
import { confirmRequest } from "./stores/confirmStore";
import {
  viewMode,
  theme,
  isSettingsOpen,
  settingsTab,
  isCommandPaletteOpen,
  isCompareMode,
  exportDialog,
  currentMessages,
  stopGeneration,
  isGenerating,
  isFullscreen,
  isShortcutsHelpOpen,
  isOnboardingActive,
  isOnline,
  isDragOver,
  hotkeyError,
  applyThemeClasses,
  flushPendingSaves,
  startNewChat,
  loadSessionByIndex,
  loadAdjacentSession,
} from "./stores/appStore";
import { chatError } from "./stores/chatActions";
import { addDocumentsWithFeedback } from "./lib/documents";
import { Spotlight } from "./components/spotlight/Spotlight";
import { Dashboard } from "./components/dashboard/Dashboard";
import { CommandPalette } from "./components/common/CommandPalette";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { ToastContainer } from "./components/common/Toast";
import { quoteClipboard, requestComposerFocus } from "./components/chat/ChatComposer";

// Overlays are loaded the first time they are opened, keeping them out of
// the code needed to show the chat window.
const Settings = lazy(() => import("./components/settings/Settings").then(m => ({ default: m.Settings })));
const ModelCompare = lazy(() => import("./components/common/ModelCompare").then(m => ({ default: m.ModelCompare })));
const ExportImport = lazy(() => import("./components/common/ExportImport").then(m => ({ default: m.ExportImport })));
const KeyboardShortcuts = lazy(() => import("./components/common/KeyboardShortcuts").then(m => ({ default: m.KeyboardShortcuts })));
const Onboarding = lazy(() => import("./components/common/Onboarding").then(m => ({ default: m.Onboarding })));

/// A blocking overlay is open; chat shortcuts shouldn't act behind it.
function modalIsOpen(): boolean {
  return (
    isSettingsOpen.value ||
    isCompareMode.value ||
    exportDialog.value !== null ||
    isOnboardingActive.value ||
    confirmRequest.value !== null
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

async function copyLastResponse() {
  const lastAssistant = [...currentMessages.value].reverse().find(m => m.role === "assistant" && m.content);
  if (!lastAssistant) {
    toast.info("No response to copy yet");
    return;
  }
  try {
    await navigator.clipboard.writeText(lastAssistant.content);
    toast.success("Copied last response");
  } catch {
    toast.error("Couldn't copy to the clipboard");
  }
}

export function App() {
  useEffect(() => {
    // Suppress the webview context menu on chrome, but keep it where users
    // expect copy/paste: inputs and selectable text (messages, errors).
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=\"true\"], .selectable, .markdown-content")) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);

    // Flush pending debounced saves before the window unloads. Without this
    // a user closing the app within ~1.5s of a change can lose it because
    // the debounced writer hasn't fired yet.
    const handleUnload = () => {
      void flushPendingSaves();
    };
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    // Track connectivity so the UI can show an Offline pill and block cloud sends.
    const handleOnline = () => { isOnline.value = true; };
    const handleOffline = () => { isOnline.value = false; };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // OS-level file drag-and-drop → add as documents. Shows a drop overlay
    // while hovering.
    let unlistenDrop: (() => void) | undefined;
    let disposed = false;
    try {
      getCurrentWebview()
        .onDragDropEvent((event) => {
          const payload = event.payload;
          if (payload.type === "enter" || payload.type === "over") {
            isDragOver.value = true;
          } else if (payload.type === "leave") {
            isDragOver.value = false;
          } else if (payload.type === "drop") {
            isDragOver.value = false;
            void addDocumentsWithFeedback(payload.paths);
          }
        })
        .then((fn) => {
          if (disposed) fn();
          else unlistenDrop = fn;
        })
        .catch(() => {});
    } catch (e) {
      console.error("File drop is unavailable:", e);
    }

    // The global shortcut is the main way in; if it couldn't be registered
    // (another app owns it) say so instead of failing silently.
    if (hotkeyError.value) {
      toast.action(
        hotkeyError.value,
        {
          label: "Fix",
          onClick: () => {
            settingsTab.value = "shortcuts";
            isSettingsOpen.value = true;
          },
        },
        "warning",
        15_000,
      );
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Escape closes the topmost overlay. Overlays with their own focus
      // trap (compare, export, onboarding, confirm) and inline editors stop
      // the event themselves, so reaching here means none of those took it.
      if (e.key === "Escape") {
        if (isShortcutsHelpOpen.value) {
          isShortcutsHelpOpen.value = false;
        } else if (isCommandPaletteOpen.value) {
          isCommandPaletteOpen.value = false;
        } else if (isSettingsOpen.value) {
          isSettingsOpen.value = false;
        } else if (viewMode.value === "spotlight" && !modalIsOpen()) {
          void invoke("hide_window");
        }
        // In the Dashboard, Escape with nothing open does nothing: it must
        // never throw away the window the user is working in.
        return;
      }

      if (mod && key === "k") {
        e.preventDefault();
        if (!modalIsOpen()) isCommandPaletteOpen.value = !isCommandPaletteOpen.value;
        return;
      }

      if (mod && e.key === ",") {
        e.preventDefault();
        isSettingsOpen.value = !isSettingsOpen.value;
        return;
      }

      if ((mod && e.key === "/") || (e.key === "?" && !mod && !isTypingTarget(e.target))) {
        e.preventDefault();
        isShortcutsHelpOpen.value = !isShortcutsHelpOpen.value;
        return;
      }

      if (mod && e.key === ".") {
        e.preventDefault();
        if (isGenerating.value) stopGeneration();
        return;
      }

      if (e.key === "F11") {
        e.preventDefault();
        if (viewMode.value === "dashboard") {
          void invoke<boolean>("toggle_fullscreen").then((state) => {
            isFullscreen.value = state;
          });
        }
        return;
      }

      // Everything below acts on the chat and stays inert behind a modal.
      if (!mod || modalIsOpen()) return;

      if (e.shiftKey && key === "c") {
        e.preventDefault();
        void copyLastResponse();
      } else if (e.shiftKey && key === "v") {
        e.preventDefault();
        void quoteClipboard();
      } else if (e.shiftKey && key === "m") {
        e.preventDefault();
        isCompareMode.value = true;
      } else if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        startNewChat();
        chatError.value = null;
        requestComposerFocus();
      } else if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        loadSessionByIndex(parseInt(e.key) - 1);
      } else if (e.key === "[") {
        e.preventDefault();
        loadAdjacentSession(-1);
      } else if (e.key === "]") {
        e.preventDefault();
        loadAdjacentSession(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      disposed = true;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unlistenDrop?.();
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  // Watch theme changes
  useEffect(() => {
    applyThemeClasses(theme.value);
  }, [theme.value]);

  return (
    <div className={`h-full w-full ${viewMode.value === "spotlight" || theme.value === "transparent" ? "bg-transparent" : "bg-bg-primary"}`}>
      {viewMode.value === "spotlight" ? <Spotlight /> : <Dashboard />}
      <CommandPalette />
      <Suspense fallback={null}>
        {isSettingsOpen.value && <Settings />}
        {isCompareMode.value && <ModelCompare onClose={() => (isCompareMode.value = false)} />}
        {exportDialog.value !== null && <ExportImport />}
        {isShortcutsHelpOpen.value && <KeyboardShortcuts />}
        {isOnboardingActive.value && <Onboarding />}
      </Suspense>
      <ConfirmDialog />
      <ToastContainer />
      {isDragOver.value && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-accent-primary/10 backdrop-blur-sm border-4 border-dashed border-accent-primary pointer-events-none">
          <div className="text-center px-6 py-4 rounded-xl bg-bg-primary/90 border border-border shadow-2xl">
            <p className="text-lg font-semibold text-text-primary">Drop files to add as documents</p>
            <p className="text-sm text-text-secondary mt-1">PDF, text, markdown, code, and more</p>
          </div>
        </div>
      )}
    </div>
  );
}
