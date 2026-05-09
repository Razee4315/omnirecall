use crate::error::Result;
use crate::services::ai_client::AiClient;

#[tauri::command]
pub async fn test_api_key(
    provider: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<()> {
    if api_key.trim().is_empty() && provider != "ollama" {
        return Err(crate::error::AppError::Config("API key is empty".to_string()));
    }
    let client = AiClient::new(&provider, &api_key, base_url.as_deref());
    client.test_connection().await?;
    Ok(())
}

