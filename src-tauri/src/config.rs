use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Size of a window in logical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct WindowSize {
    pub width: f64,
    pub height: f64,
}

/// Where the Dashboard was last shown. The position is in physical pixels
/// (it is only restored if it still lands on a connected monitor).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct DashboardBounds {
    pub x: i32,
    pub y: i32,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub maximized: bool,
}

/// Settings the backend needs before the webview has loaded. Everything else
/// lives in the frontend's store.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub hotkey: String,
    /// The size the user last gave the Spotlight window.
    #[serde(default)]
    pub spotlight_size: Option<WindowSize>,
    /// The Dashboard's last size, position and maximized state.
    #[serde(default)]
    pub dashboard_bounds: Option<DashboardBounds>,
}

pub fn get_data_dir() -> PathBuf {
    ProjectDirs::from("com", "omnirecall", "OmniRecall")
        .map(|dirs| dirs.data_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn get_config_path() -> PathBuf {
    get_data_dir().join("config.json")
}

/// Read the config file, falling back to defaults when it is missing or
/// unreadable.
pub fn load_config() -> AppConfig {
    fs::read_to_string(get_config_path())
        .ok()
        .and_then(|content| serde_json::from_str::<AppConfig>(&content).ok())
        .unwrap_or_default()
}

/// Read-modify-write the config file, so one setting never clobbers another.
pub fn update_config(update: impl FnOnce(&mut AppConfig)) -> Result<(), String> {
    let mut config = load_config();
    update(&mut config);
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to save config: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn old_config_files_still_load() {
        let config: AppConfig = serde_json::from_str(r#"{ "hotkey": "Alt+Space" }"#).unwrap();
        assert_eq!(config.hotkey, "Alt+Space");
        assert!(config.spotlight_size.is_none());
        assert!(config.dashboard_bounds.is_none());
    }

    #[test]
    fn window_prefs_round_trip() {
        let config = AppConfig {
            hotkey: "Ctrl+Space".into(),
            spotlight_size: Some(WindowSize { width: 520.0, height: 640.0 }),
            dashboard_bounds: Some(DashboardBounds { x: 10, y: 20, width: 1200.0, height: 800.0, maximized: true }),
        };
        let json = serde_json::to_string(&config).unwrap();
        let back: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back.spotlight_size, config.spotlight_size);
        assert_eq!(back.dashboard_bounds, config.dashboard_bounds);
    }
}
