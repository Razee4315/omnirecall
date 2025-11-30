import { useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { viewMode, theme, isSettingsOpen } from "./stores/appStore";
import { Spotlight } from "./components/spotlight/Spotlight";
import { Dashboard } from "./components/dashboard/Dashboard";
import { Settings } from "./components/settings/Settings";

export function App() {
  useEffect(() => {
    // Apply theme
    const applyTheme = () => {
      document.documentElement.classList.toggle("dark", theme.value === "dark");
    };
    applyTheme();

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
    document.documentElement.classList.toggle("dark", theme.value === "dark");
  }, [theme.value]);

  return (
    <div className={`h-full w-full ${viewMode.value === "spotlight" ? "bg-transparent" : "bg-bg-primary"}`}>
      {viewMode.value === "spotlight" ? <Spotlight /> : <Dashboard />}
      {isSettingsOpen.value && <Settings />}
    </div>
  );
}
