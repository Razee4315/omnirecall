use crate::error::Result;
use crate::services::ai_client::AiClient;

#[tauri::command]
pub async fn test_api_key(
    provider: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<()> {
    let client = AiClient::new(&provider, &api_key, base_url.as_deref());
    client.test_connection().await?;
    Ok(())
}

#[tauri::command]
pub async fn get_providers() -> Result<Vec<serde_json::Value>> {
    Ok(vec![
        serde_json::json!({
            "id": "gemini",
            "name": "Google Gemini",
            "models": [
                "gemini-3-flash-preview",
                "gemini-3-pro-preview",
                "gemini-2.5-flash",
                "gemini-2.5-pro",
                "gemini-2.5-flash-lite"
            ],
        }),
        serde_json::json!({
            "id": "openai",
            "name": "OpenAI",
            "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
        }),
        serde_json::json!({
            "id": "anthropic",
            "name": "Anthropic Claude",
            "models": ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
        }),
        serde_json::json!({
            "id": "ollama",
            "name": "Ollama (Local)",
            "models": ["llama3.2", "mistral", "codellama"],
        }),
    ])
}

#[tauri::command]
pub async fn save_api_key(_provider: String, _api_key: String) -> Result<()> {
    // For now, we store in frontend state
    // In production, use keyring crate for secure storage
    Ok(())
}
