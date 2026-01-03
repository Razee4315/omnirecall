import { useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { viewMode, theme, isSettingsOpen } from "./stores/appStore";
import { Spotlight } from "./components/spotlight/Spotlight";
import { Dashboard } from "./components/dashboard/Dashboard";
import { Settings } from "./components/settings/Settings";

function applyThemeClasses(currentTheme: string) {
  const html = document.documentElement;
  html.classList.remove("dark", "transparent");
  if (currentTheme === "dark" || currentTheme === "transparent") {
    html.classList.add("dark");
  }
  if (currentTheme === "transparent") {
    html.classList.add("transparent");
  }
}

export function App() {
  useEffect(() => {
    // Apply theme on mount
    applyThemeClasses(theme.value);

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Settings shortcut
      if (e.key === "," && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        isSettingsOpen.value = !isSettingsOpen.value;
        return;
      }

      // Close settings or hide window on Escape
      if (e.key === "Escape") {
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
    </div>
  );
}
