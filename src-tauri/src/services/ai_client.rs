use futures::Stream;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use crate::error::{AppError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

pub enum StreamEvent {
    Token(String),
    Done(Vec<Source>),
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub document_id: String,
    pub page: u32,
    pub text: String,
}

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

    async fn test_gemini(&self) -> Result<Vec<String>> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={}",
            self.api_key
        );

        let response = self.client.get(&url).send().await?;

        if response.status().is_success() {
            Ok(vec![
                "gemini-2.0-flash-exp".to_string(),
                "gemini-1.5-flash".to_string(),
                "gemini-1.5-pro".to_string(),
            ])
        } else if response.status() == 401 {
            Err(AppError::InvalidApiKey)
        } else {
            Err(AppError::Api(format!(
                "API error: {}",
                response.status()
            )))
        }
    }

    async fn test_openai(&self) -> Result<Vec<String>> {
        let url = "https://api.openai.com/v1/models";

        let response = self
            .client
            .get(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await?;

        if response.status().is_success() {
            Ok(vec![
                "gpt-4o".to_string(),
                "gpt-4o-mini".to_string(),
                "gpt-4-turbo".to_string(),
            ])
        } else if response.status() == 401 {
            Err(AppError::InvalidApiKey)
        } else {
            Err(AppError::Api(format!(
                "API error: {}",
                response.status()
            )))
        }
    }

    async fn test_anthropic(&self) -> Result<Vec<String>> {
        // Anthropic doesn't have a list models endpoint, so we make a minimal request
        let url = "https://api.anthropic.com/v1/messages";

        let response = self
            .client
            .post(url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .body(r#"{"model":"claude-3-5-sonnet-20241022","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}"#)
            .send()
            .await?;

        if response.status().is_success() || response.status() == 400 {
            // 400 might just mean bad request format, key is valid
            Ok(vec![
                "claude-3-5-sonnet-20241022".to_string(),
                "claude-3-5-haiku-20241022".to_string(),
            ])
        } else if response.status() == 401 {
            Err(AppError::InvalidApiKey)
        } else {
            Err(AppError::Api(format!(
                "API error: {}",
                response.status()
            )))
        }
    }

    async fn test_ollama(&self) -> Result<Vec<String>> {
        let base_url = self
            .base_url
            .as_deref()
            .unwrap_or("http://localhost:11434");
        let url = format!("{}/api/tags", base_url);

        let response = self.client.get(&url).send().await;

        match response {
            Ok(resp) if resp.status().is_success() => {
                #[derive(Deserialize)]
                struct OllamaModels {
                    models: Vec<OllamaModel>,
                }
                #[derive(Deserialize)]
                struct OllamaModel {
                    name: String,
                }

                let models: OllamaModels = resp.json().await?;
                Ok(models.models.into_iter().map(|m| m.name).collect())
            }
            Ok(resp) => Err(AppError::Api(format!("Ollama error: {}", resp.status()))),
            Err(_) => Err(AppError::Network(
                "Cannot connect to Ollama. Make sure it's running.".to_string(),
            )),
        }
    }

    pub async fn chat_stream(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        context: Option<String>,
    ) -> Result<Pin<Box<dyn Stream<Item = StreamEvent> + Send>>> {
        match self.provider.as_str() {
            "gemini" => self.chat_gemini_stream(model, messages, context).await,
            "openai" => self.chat_openai_stream(model, messages, context).await,
            "anthropic" => self.chat_anthropic_stream(model, messages, context).await,
            "ollama" => self.chat_ollama_stream(model, messages, context).await,
            _ => Err(AppError::Config("Unknown provider".to_string())),
        }
    }

    async fn chat_gemini_stream(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        context: Option<String>,
    ) -> Result<Pin<Box<dyn Stream<Item = StreamEvent> + Send>>> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
            model, self.api_key
        );

        let mut contents = Vec::new();
        
        // Add context as system instruction if available
        if let Some(ctx) = context {
            contents.push(serde_json::json!({
                "role": "user",
                "parts": [{"text": format!("Context from documents:\n{}\n\nPlease use this context to answer my questions.", ctx)}]
            }));
            contents.push(serde_json::json!({
                "role": "model",
                "parts": [{"text": "I'll use the provided document context to answer your questions accurately."}]
            }));
        }

        for msg in messages {
            let role = if msg.role == "assistant" { "model" } else { "user" };
            contents.push(serde_json::json!({
                "role": role,
                "parts": [{"text": msg.content}]
            }));
        }

        let body = serde_json::json!({
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 8192,
            }
        });

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Api(format!(
                "Gemini API error: {}",
                response.status()
            )));
        }

        let stream = async_stream::stream! {
            use futures::StreamExt;
            
            let mut stream = response.bytes_stream();
            let mut buffer = String::new();

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(bytes) => {
                        buffer.push_str(&String::from_utf8_lossy(&bytes));
                        
                        // Parse SSE events
                        for line in buffer.lines() {
                            if line.starts_with("data: ") {
                                let data = &line[6..];
                                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                    if let Some(text) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                                        yield StreamEvent::Token(text.to_string());
                                    }
                                }
                            }
                        }
                        buffer.clear();
                    }
                    Err(e) => {
                        yield StreamEvent::Error(e.to_string());
                        break;
                    }
                }
            }
            
            yield StreamEvent::Done(vec![]);
        };

        Ok(Box::pin(stream))
    }

    async fn chat_openai_stream(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        context: Option<String>,
    ) -> Result<Pin<Box<dyn Stream<Item = StreamEvent> + Send>>> {
        let url = "https://api.openai.com/v1/chat/completions";

        let mut api_messages = Vec::new();
        
        // System message with context
        let system_msg = if let Some(ctx) = context {
            format!("You are a helpful assistant. Use the following document context to answer questions:\n\n{}", ctx)
        } else {
            "You are a helpful assistant.".to_string()
        };
        
        api_messages.push(serde_json::json!({
            "role": "system",
            "content": system_msg
        }));

        for msg in messages {
            api_messages.push(serde_json::json!({
                "role": msg.role,
                "content": msg.content
            }));
        }

        let body = serde_json::json!({
            "model": model,
            "messages": api_messages,
            "stream": true,
            "temperature": 0.7,
        });

        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Api(format!(
                "OpenAI API error: {}",
                response.status()
            )));
        }

        let stream = async_stream::stream! {
            use futures::StreamExt;
            
            let mut stream = response.bytes_stream();

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(bytes) => {
                        let text = String::from_utf8_lossy(&bytes);
                        for line in text.lines() {
                            if line.starts_with("data: ") && line != "data: [DONE]" {
                                let data = &line[6..];
                                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                    if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                                        yield StreamEvent::Token(content.to_string());
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        yield StreamEvent::Error(e.to_string());
                        break;
                    }
                }
            }
            
            yield StreamEvent::Done(vec![]);
        };

        Ok(Box::pin(stream))
    }

    async fn chat_anthropic_stream(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        context: Option<String>,
    ) -> Result<Pin<Box<dyn Stream<Item = StreamEvent> + Send>>> {
        let url = "https://api.anthropic.com/v1/messages";

        let system = if let Some(ctx) = context {
            format!("Use the following document context to answer questions:\n\n{}", ctx)
        } else {
            String::new()
        };

        let api_messages: Vec<_> = messages
            .into_iter()
            .map(|m| {
                serde_json::json!({
                    "role": m.role,
                    "content": m.content
                })
            })
            .collect();

        let body = serde_json::json!({
            "model": model,
            "max_tokens": 4096,
            "system": system,
            "messages": api_messages,
            "stream": true,
        });

        let response = self
            .client
            .post(url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Api(format!(
                "Anthropic API error: {}",
                response.status()
            )));
        }

        let stream = async_stream::stream! {
            use futures::StreamExt;
            
            let mut stream = response.bytes_stream();

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(bytes) => {
                        let text = String::from_utf8_lossy(&bytes);
                        for line in text.lines() {
                            if line.starts_with("data: ") {
                                let data = &line[6..];
                                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                    if json["type"] == "content_block_delta" {
                                        if let Some(text) = json["delta"]["text"].as_str() {
                                            yield StreamEvent::Token(text.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        yield StreamEvent::Error(e.to_string());
                        break;
                    }
                }
            }
            
            yield StreamEvent::Done(vec![]);
        };

        Ok(Box::pin(stream))
    }

    async fn chat_ollama_stream(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        context: Option<String>,
    ) -> Result<Pin<Box<dyn Stream<Item = StreamEvent> + Send>>> {
        let base_url = self
            .base_url
            .as_deref()
            .unwrap_or("http://localhost:11434");
        let url = format!("{}/api/chat", base_url);

        let mut api_messages = Vec::new();
        
        if let Some(ctx) = &context {
            api_messages.push(serde_json::json!({
                "role": "system",
                "content": format!("Use the following document context to answer questions:\n\n{}", ctx)
            }));
        }

        for msg in messages {
            api_messages.push(serde_json::json!({
                "role": msg.role,
                "content": msg.content
            }));
        }

        let body = serde_json::json!({
            "model": model,
            "messages": api_messages,
            "stream": true,
        });

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Api(format!(
                "Ollama API error: {}",
                response.status()
            )));
        }

        let stream = async_stream::stream! {
            use futures::StreamExt;
            
            let mut stream = response.bytes_stream();

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(bytes) => {
                        let text = String::from_utf8_lossy(&bytes);
                        for line in text.lines() {
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                                if let Some(content) = json["message"]["content"].as_str() {
                                    yield StreamEvent::Token(content.to_string());
                                }
                            }
                        }
                    }
                    Err(e) => {
                        yield StreamEvent::Error(e.to_string());
                        break;
                    }
                }
            }
            
            yield StreamEvent::Done(vec![]);
        };

        Ok(Box::pin(stream))
    }
}
