use reqwest::Client;
use serde::Deserialize;
use crate::error::{AppError, Result};
use crate::commands::chat::ChatMessage;

pub struct AiClient {
    provider: String,
    api_key: String,
    base_url: Option<String>,
    client: Client,
}

impl AiClient {
    pub fn new(provider: &str, api_key: &str, base_url: Option<&str>) -> Self {
        Self {
            provider: provider.to_string(),
            api_key: api_key.to_string(),
            base_url: base_url.map(String::from),
            client: Client::new(),
        }
    }

    pub async fn test_connection(&self) -> Result<Vec<String>> {
        match self.provider.as_str() {
            "gemini" => self.test_gemini().await,
            "openai" => self.test_openai().await,
            "anthropic" => self.test_anthropic().await,
            "ollama" => self.test_ollama().await,
            _ => Err(AppError::Config("Unknown provider".to_string())),
        }
    }

    pub async fn chat(&self, model: &str, message: &str) -> Result<String> {
        self.chat_with_history(model, message, &[], None).await
    }

    pub async fn chat_with_history(
        &self,
        model: &str,
        message: &str,
        history: &[ChatMessage],
        context: Option<&str>,
    ) -> Result<String> {
        match self.provider.as_str() {
            "gemini" => self.chat_gemini_with_history(model, message, history, context).await,
            "openai" => self.chat_openai_with_history(model, message, history, context).await,
            "anthropic" => self.chat_anthropic_with_history(model, message, history, context).await,
            "ollama" => self.chat_ollama_with_history(model, message, history, context).await,
            _ => Err(AppError::Config("Unknown provider".to_string())),
        }
    }

    async fn test_gemini(&self) -> Result<Vec<String>> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={}",
            self.api_key
        );
        let response = self.client.get(&url).send().await?;
        if response.status().is_success() {
            Ok(vec!["gemini-2.0-flash".to_string(), "gemini-1.5-flash".to_string(), "gemini-1.5-pro".to_string()])
        } else if response.status() == 401 || response.status() == 400 {
            Err(AppError::InvalidApiKey)
        } else {
            Err(AppError::Api(format!("API error: {}", response.status())))
        }
    }

    async fn test_openai(&self) -> Result<Vec<String>> {
        let response = self.client.get("https://api.openai.com/v1/models")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send().await?;
        if response.status().is_success() {
            Ok(vec!["gpt-4o".to_string(), "gpt-4o-mini".to_string()])
        } else if response.status() == 401 {
            Err(AppError::InvalidApiKey)
        } else {
            Err(AppError::Api(format!("API error: {}", response.status())))
        }
    }

    async fn test_anthropic(&self) -> Result<Vec<String>> {
        let response = self.client.post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .body(r#"{"model":"claude-3-5-sonnet-20241022","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}"#)
            .send().await?;
        if response.status().is_success() || response.status() == 400 {
            Ok(vec!["claude-3-5-sonnet-20241022".to_string()])
        } else if response.status() == 401 {
            Err(AppError::InvalidApiKey)
        } else {
            Err(AppError::Api(format!("API error: {}", response.status())))
        }
    }

    async fn test_ollama(&self) -> Result<Vec<String>> {
        let base_url = self.base_url.as_deref().unwrap_or("http://localhost:11434");
        let response = self.client.get(format!("{}/api/tags", base_url)).send().await;
        match response {
            Ok(resp) if resp.status().is_success() => {
                #[derive(Deserialize)]
                struct OllamaModels { models: Vec<OllamaModel> }
                #[derive(Deserialize)]
                struct OllamaModel { name: String }
                let models: OllamaModels = resp.json().await?;
                Ok(models.models.into_iter().map(|m| m.name).collect())
            }
            Ok(resp) => Err(AppError::Api(format!("Ollama error: {}", resp.status()))),
            Err(_) => Err(AppError::Network("Cannot connect to Ollama".to_string())),
        }
    }

    async fn chat_gemini_with_history(
        &self,
        model: &str,
        message: &str,
        history: &[ChatMessage],
        context: Option<&str>,
    ) -> Result<String> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model, self.api_key
        );

        let mut contents = Vec::new();

        // Add document context as first message if provided
        if let Some(ctx) = context {
            contents.push(serde_json::json!({
                "role": "user",
                "parts": [{"text": format!("{}\n\nPlease use this context to answer my questions accurately.", ctx)}]
            }));
            contents.push(serde_json::json!({
                "role": "model",
                "parts": [{"text": "I'll use the provided document context to answer your questions. Please go ahead with your question."}]
            }));
        }

        // Add conversation history
        for msg in history {
            let role = if msg.role == "assistant" { "model" } else { "user" };
            contents.push(serde_json::json!({
                "role": role,
                "parts": [{"text": &msg.content}]
            }));
        }

        // Add current message
        contents.push(serde_json::json!({
            "role": "user",
            "parts": [{"text": message}]
        }));

        let body = serde_json::json!({
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 8192,
            }
        });

        let response = self.client.post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!("Gemini error {}: {}", status, error_text)));
        }

        let json: serde_json::Value = response.json().await?;
        json["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| AppError::Api("No response from Gemini".to_string()))
    }

    async fn chat_openai_with_history(
        &self,
        model: &str,
        message: &str,
        history: &[ChatMessage],
        context: Option<&str>,
    ) -> Result<String> {
        let mut messages = Vec::new();

        // System message with document context
        let system_msg = if let Some(ctx) = context {
            format!("You are a helpful assistant. Use the following document context to answer questions accurately:\n\n{}", ctx)
        } else {
            "You are a helpful assistant.".to_string()
        };
        messages.push(serde_json::json!({"role": "system", "content": system_msg}));

        // Add conversation history
        for msg in history {
            messages.push(serde_json::json!({"role": &msg.role, "content": &msg.content}));
        }

        // Add current message
        messages.push(serde_json::json!({"role": "user", "content": message}));

        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": 0.7,
        });

        let response = self.client.post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!("OpenAI error {}: {}", status, error_text)));
        }

        let json: serde_json::Value = response.json().await?;
        json["choices"][0]["message"]["content"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| AppError::Api("No response from OpenAI".to_string()))
    }

    async fn chat_anthropic_with_history(
        &self,
        model: &str,
        message: &str,
        history: &[ChatMessage],
        context: Option<&str>,
    ) -> Result<String> {
        let system = if let Some(ctx) = context {
            format!("Use the following document context to answer questions accurately:\n\n{}", ctx)
        } else {
            String::new()
        };

        let mut messages = Vec::new();
        for msg in history {
            messages.push(serde_json::json!({"role": &msg.role, "content": &msg.content}));
        }
        messages.push(serde_json::json!({"role": "user", "content": message}));

        let body = serde_json::json!({
            "model": model,
            "max_tokens": 4096,
            "system": system,
            "messages": messages,
        });

        let response = self.client.post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!("Anthropic error {}: {}", status, error_text)));
        }

        let json: serde_json::Value = response.json().await?;
        json["content"][0]["text"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| AppError::Api("No response from Anthropic".to_string()))
    }

    async fn chat_ollama_with_history(
        &self,
        model: &str,
        message: &str,
        history: &[ChatMessage],
        context: Option<&str>,
    ) -> Result<String> {
        let base_url = self.base_url.as_deref().unwrap_or("http://localhost:11434");

        let mut messages = Vec::new();
        
        // Add context as system message
        if let Some(ctx) = context {
            messages.push(serde_json::json!({
                "role": "system",
                "content": format!("Use the following document context to answer questions:\n\n{}", ctx)
            }));
        }

        // Add history
        for msg in history {
            messages.push(serde_json::json!({"role": &msg.role, "content": &msg.content}));
        }

        // Add current message
        messages.push(serde_json::json!({"role": "user", "content": message}));

        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": false,
        });

        let response = self.client.post(format!("{}/api/chat", base_url))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!("Ollama error {}: {}", status, error_text)));
        }

        let json: serde_json::Value = response.json().await?;
        json["message"]["content"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| AppError::Api("No response from Ollama".to_string()))
    }
}
