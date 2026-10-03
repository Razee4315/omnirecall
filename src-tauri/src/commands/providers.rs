use crate::error::{AppError, Result};
use crate::services::ai_client::AiClient;

/// Validate a provider's credentials. On success returns the chat models the
/// account can use, which the UI offers in the model picker.
#[tauri::command]
pub async fn test_api_key(
    provider: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<Vec<String>> {
    if api_key.trim().is_empty() && provider != "ollama" {
        return Err(AppError::Config("API key is empty".to_string()));
    }
    AiClient::new(&provider, api_key.trim(), base_url.as_deref())
        .list_models()
        .await
}
