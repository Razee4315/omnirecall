use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: String,
    pub hotkey: String,
    pub default_provider: String,
    pub default_model: String,
    pub max_context_chunks: u32,
    pub show_token_count: bool,
    pub hybrid_search: bool,
    pub similarity_threshold: f32,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            hotkey: "Alt+Space".to_string(),
            default_provider: "gemini".to_string(),
            default_model: "gemini-2.5-flash".to_string(),
            max_context_chunks: 5,
            show_token_count: true,
            hybrid_search: false,
            similarity_threshold: 0.7,
        }
    }
}

pub fn get_data_dir() -> PathBuf {
    ProjectDirs::from("com", "omnirecall", "OmniRecall")
        .map(|dirs| dirs.data_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn get_config_path() -> PathBuf {
    get_data_dir().join("config.json")
}

pub fn get_documents_dir() -> PathBuf {
    get_data_dir().join("documents")
}

pub fn get_database_dir() -> PathBuf {
    get_data_dir().join("db")
}
