use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Settings the backend needs before the webview has loaded. Everything else
/// lives in the frontend's store.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub hotkey: String,
}

pub fn get_data_dir() -> PathBuf {
    ProjectDirs::from("com", "omnirecall", "OmniRecall")
        .map(|dirs| dirs.data_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn get_config_path() -> PathBuf {
    get_data_dir().join("config.json")
}
