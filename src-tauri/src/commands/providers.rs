use serde::{Deserialize, Serialize};
use crate::error::{AppError, Result};
use crate::services::ai_client::AiClient;

#[derive(Debug, Serialize)]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub models: Vec<String>,
    pub is_connected: bool,
}

#[derive(Debug, Deserialize)]
pub struct TestApiKeyRequest {
    pub provider: String,
    pub api_key: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TestApiKeyResponse {
    pub valid: bool,
    pub error: Option<String>,
    pub models: Option<Vec<String>>,
}

#[tauri::command]
pub async fn test_api_key(request: TestApiKeyRequest) -> Result<TestApiKeyResponse> {
    let client = AiClient::new(&request.provider, &request.api_key, request.base_url.as_deref());
    
    match client.test_connection().await {
        Ok(models) => Ok(TestApiKeyResponse {
            valid: true,
            error: None,
            models: Some(models),
        }),
        Err(e) => Ok(TestApiKeyResponse {
            valid: false,
            error: Some(e.to_string()),
            models: None,
        }),
    }
}

#[tauri::command]
pub async fn get_providers() -> Result<Vec<Provider>> {
    Ok(vec![
        Provider {
            id: "gemini".to_string(),
            name: "Google Gemini".to_string(),
            models: vec![
                "gemini-2.0-flash-exp".to_string(),
                "gemini-1.5-flash".to_string(),
                "gemini-1.5-flash-8b".to_string(),
                "gemini-1.5-pro".to_string(),
            ],
            is_connected: false,
        },
        Provider {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            models: vec![
                "gpt-4o".to_string(),
                "gpt-4o-mini".to_string(),
                "gpt-4-turbo".to_string(),
                "gpt-3.5-turbo".to_string(),
            ],
            is_connected: false,
        },
        Provider {
            id: "anthropic".to_string(),
            name: "Anthropic Claude".to_string(),
            models: vec![
                "claude-3-5-sonnet-20241022".to_string(),
                "claude-3-5-haiku-20241022".to_string(),
                "claude-3-opus-20240229".to_string(),
            ],
            is_connected: false,
        },
        Provider {
            id: "ollama".to_string(),
            name: "Ollama (Local)".to_string(),
            models: vec![
                "llama3.2".to_string(),
                "llama3.1".to_string(),
                "mistral".to_string(),
                "codellama".to_string(),
                "phi3".to_string(),
            ],
            is_connected: false,
        },
    ])
}

#[derive(Debug, Deserialize)]
pub struct SaveApiKeyRequest {
    pub provider: String,
    pub api_key: String,
}

#[tauri::command]
pub async fn save_api_key(request: SaveApiKeyRequest) -> Result<()> {
    // Use keyring to securely store API key
    let entry = keyring::Entry::new("omnirecall", &format!("{}_api_key", request.provider))
        .map_err(|e| AppError::Config(e.to_string()))?;
    
    entry
        .set_password(&request.api_key)
        .map_err(|e| AppError::Config(e.to_string()))?;
    
    Ok(())
}
