import { useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import {
  viewMode,
  theme,
  isSettingsOpen,
  isCommandPaletteOpen,
  isCompareMode,
  currentMessages,
  activeSessionId,
  chatHistory,
  stopGeneration,
  isGenerating,
  isFullscreen,
} from "./stores/appStore";
import { Spotlight } from "./components/spotlight/Spotlight";
import { Dashboard } from "./components/dashboard/Dashboard";
import { Settings } from "./components/settings/Settings";
import { CommandPalette } from "./components/common/CommandPalette";
import { ModelCompare } from "./components/common/ModelCompare";

function applyThemeClasses(currentTheme: string) {
  const html = document.documentElement;
  // Remove all theme classes
  html.classList.remove("dark", "transparent", "paper", "rose", "ocean");

  // Apply the appropriate theme class
  switch (currentTheme) {
    case "dark":
      html.classList.add("dark");
      break;
    case "transparent":
      html.classList.add("dark", "transparent");
      break;
    case "paper":
      html.classList.add("paper");
      break;
    case "rose":
      html.classList.add("dark", "rose");
      break;
    case "ocean":
      html.classList.add("dark", "ocean");
      break;
    // light theme is default (no class needed)
  }
}

export function App() {
  useEffect(() => {
    // Apply theme on mount
    applyThemeClasses(theme.value);

    // Disable right-click context menu (hide devtools option)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);

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
        currentMessages.value = [];
        activeSessionId.value = null;
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
        const index = parseInt(e.key) - 1;
        if (chatHistory.value[index]) {
          currentMessages.value = chatHistory.value[index].messages;
          activeSessionId.value = chatHistory.value[index].id;
        }
        return;
      }

      // Previous Chat (Ctrl+[)
      if (e.key === "[" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (activeSessionId.value) {
          const currentIndex = chatHistory.value.findIndex(s => s.id === activeSessionId.value);
          if (currentIndex > 0) {
            const prevSession = chatHistory.value[currentIndex - 1];
            currentMessages.value = prevSession.messages;
            activeSessionId.value = prevSession.id;
          }
        }
        return;
      }

      // Next Chat (Ctrl+])
      if (e.key === "]" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (activeSessionId.value) {
          const currentIndex = chatHistory.value.findIndex(s => s.id === activeSessionId.value);
          if (currentIndex < chatHistory.value.length - 1) {
            const nextSession = chatHistory.value[currentIndex + 1];
            currentMessages.value = nextSession.messages;
            activeSessionId.value = nextSession.id;
          }
        }
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
    </div>
  );
}
