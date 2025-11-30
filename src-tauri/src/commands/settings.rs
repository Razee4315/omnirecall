use serde::{Deserialize, Serialize};
use std::fs;
use crate::config::{AppConfig, get_config_path};
use crate::error::{AppError, Result};

#[tauri::command]
pub async fn get_settings() -> Result<AppConfig> {
    let config_path = get_config_path();
    
    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| AppError::Config(e.to_string()))?;
        let config: AppConfig = serde_json::from_str(&content)?;
        Ok(config)
    } else {
        Ok(AppConfig::default())
    }
}

#[tauri::command]
pub async fn save_settings(settings: AppConfig) -> Result<()> {
    let config_path = get_config_path();
    
    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Config(e.to_string()))?;
    }
    
    let content = serde_json::to_string_pretty(&settings)?;
    fs::write(&config_path, content)
        .map_err(|e| AppError::Config(e.to_string()))?;
    
    Ok(())
}
