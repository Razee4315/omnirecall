import { useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { toast } from "./stores/toastStore";
import {
  viewMode,
  theme,
  isSettingsOpen,
  isCommandPaletteOpen,
  isCompareMode,
  currentMessages,
  stopGeneration,
  isGenerating,
  isFullscreen,
  isShortcutsHelpOpen,
  isOnline,
  isDragOver,
  addDroppedFiles,
  loadPersistedData,
  applyThemeClasses,
  flushPendingSaves,
  startNewChat,
  loadSessionByIndex,
  loadAdjacentSession,
} from "./stores/appStore";
import { Spotlight } from "./components/spotlight/Spotlight";
import { Dashboard } from "./components/dashboard/Dashboard";
import { Settings } from "./components/settings/Settings";
import { CommandPalette } from "./components/common/CommandPalette";
import { ModelCompare } from "./components/common/ModelCompare";
import { ToastContainer } from "./components/common/Toast";
import { KeyboardShortcuts } from "./components/common/KeyboardShortcuts";
import { Onboarding, checkOnboardingStatus } from "./components/common/Onboarding";

export function App() {
  useEffect(() => {
    // Load persisted data once at app level
    loadPersistedData();

    // Apply theme on mount
    applyThemeClasses(theme.value);

    // Check onboarding status
    checkOnboardingStatus();

    // Suppress the webview context menu on chrome, but keep it where users
    // expect copy/paste: inputs and selectable text (messages, errors).
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=\"true\"], .selectable, .markdown-content")) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);

    // Flush pending debounced saves before the window unloads. Without this
    // a user closing the app within ~1.5s of typing can lose their last
    // chat history / folder updates because the debounced writer hasn't
    // fired yet.
    const handleUnload = () => {
      flushPendingSaves();
    };
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    // Track connectivity so the UI can show an Offline pill and block cloud sends.
    const handleOnline = () => { isOnline.value = true; };
    const handleOffline = () => { isOnline.value = false; };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // OS-level file drag-and-drop → add as documents (the feature the
    // onboarding tour advertises). Shows a drop overlay while hovering.
    let unlistenDrop: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const p = event.payload as { type: string; paths?: string[] };
        if (p.type === "enter" || p.type === "over") {
          isDragOver.value = true;
        } else if (p.type === "leave") {
          isDragOver.value = false;
        } else if (p.type === "drop") {
          isDragOver.value = false;
          const n = addDroppedFiles(p.paths ?? []);
          if (n > 0) toast.success(`Added ${n} document${n > 1 ? "s" : ""}`);
          else toast.warning("No supported files in that drop");
        }
      })
      .then((fn) => { unlistenDrop = fn; })
      .catch(() => {});

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Command Palette (Ctrl+K)
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        isCommandPaletteOpen.value = !isCommandPaletteOpen.value;
        return;
      }

      // New Chat (Ctrl+N)
      if (e.key === "n" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        startNewChat();
        return;
      }

      // Copy Last Response (Ctrl+Shift+C)
      if (e.key === "C" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        const lastAssistant = [...currentMessages.value].reverse().find(m => m.role === "assistant");
        if (lastAssistant) {
          await navigator.clipboard.writeText(lastAssistant.content);
        }
        return;
      }

      // Stop Generation (Ctrl+.)
      if (e.key === "." && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (isGenerating.value) {
          stopGeneration();
        }
        return;
      }

      // Toggle Compare Mode (Ctrl+Shift+M)
      if (e.key === "M" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        isCompareMode.value = !isCompareMode.value;
        return;
      }

      // Fullscreen toggle (F11)
      if (e.key === "F11") {
        e.preventDefault();
        const newState = await invoke<boolean>("toggle_fullscreen");
        isFullscreen.value = newState;
        return;
      }

      // Quick Chat Navigation (Ctrl+1-9)
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        loadSessionByIndex(parseInt(e.key) - 1);
        return;
      }

      // Previous Chat (Ctrl+[)
      if (e.key === "[" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        loadAdjacentSession(-1);
        return;
      }

      // Next Chat (Ctrl+])
      if (e.key === "]" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        loadAdjacentSession(1);
        return;
      }

      // Settings shortcut
      if (e.key === "," && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        isSettingsOpen.value = !isSettingsOpen.value;
        return;
      }

      // Close settings or hide window on Escape
      if (e.key === "Escape") {
        if (isShortcutsHelpOpen.value) {
          isShortcutsHelpOpen.value = false;
          return;
        }
        if (isCommandPaletteOpen.value) {
          isCommandPaletteOpen.value = false;
          return;
        }
        if (isCompareMode.value) {
          isCompareMode.value = false;
          return;
        }
        if (isSettingsOpen.value) {
          isSettingsOpen.value = false;
        } else if (viewMode.value === "spotlight") {
          await invoke("hide_window");
        } else {
          // Switch back to spotlight from dashboard
          viewMode.value = "spotlight";
          await invoke("toggle_dashboard", { isDashboard: false });
        }
        return;
      }

      // Keyboard shortcuts help (?)
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        // Only trigger if not typing in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          isShortcutsHelpOpen.value = !isShortcutsHelpOpen.value;
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
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
      {isSettingsOpen.value && <Settings />}
      <CommandPalette />
      {isCompareMode.value && <ModelCompare onClose={() => (isCompareMode.value = false)} />}
      <ToastContainer />
      <KeyboardShortcuts />
      <Onboarding />
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
