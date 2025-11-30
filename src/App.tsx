import { useEffect } from "preact/hooks";
import { viewMode, theme, isSettingsOpen } from "./stores/appStore";
import { Spotlight } from "./components/spotlight/Spotlight";
import { Dashboard } from "./components/dashboard/Dashboard";
import { Settings } from "./components/settings/Settings";

export function App() {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme.value === "dark");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isSettingsOpen.value) {
          isSettingsOpen.value = false;
        } else if (viewMode.value === "spotlight") {
          // In real app, this would minimize to tray
        }
      }
      if (e.key === "," && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        isSettingsOpen.value = true;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-full w-full bg-bg-primary">
      {viewMode.value === "spotlight" ? <Spotlight /> : <Dashboard />}
      {isSettingsOpen.value && <Settings />}
    </div>
  );
}
