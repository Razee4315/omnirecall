use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::error::{AppError, Result};

pub struct EmbeddingService {
    provider: String,
    api_key: String,
    model: String,
    client: Client,
}

#[derive(Debug, Serialize)]
struct GeminiEmbedRequest {
    model: String,
    content: GeminiContent,
}

#[derive(Debug, Serialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Debug, Deserialize)]
struct GeminiEmbedResponse {
    embedding: GeminiEmbedding,
}

#[derive(Debug, Deserialize)]
struct GeminiEmbedding {
    values: Vec<f32>,
}

impl EmbeddingService {
    pub fn new(provider: &str, api_key: &str, model: Option<&str>) -> Self {
        let default_model = match provider {
            "gemini" => "text-embedding-004",
            "openai" => "text-embedding-3-small",
            "ollama" => "nomic-embed-text",
            _ => "text-embedding-004",
        };

        Self {
            provider: provider.to_string(),
            api_key: api_key.to_string(),
            model: model.unwrap_or(default_model).to_string(),
            client: Client::new(),
        }
    }

    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        match self.provider.as_str() {
            "gemini" => self.embed_gemini(text).await,
            "openai" => self.embed_openai(text).await,
            "ollama" => self.embed_ollama(text).await,
            _ => Err(AppError::Config("Unknown embedding provider".to_string())),
        }
    }

    pub async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        let mut embeddings = Vec::with_capacity(texts.len());
        
        for text in texts {
            let embedding = self.embed(text).await?;
            embeddings.push(embedding);
        }
        
        Ok(embeddings)
    }

    async fn embed_gemini(&self, text: &str) -> Result<Vec<f32>> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:embedContent?key={}",
            self.model, self.api_key
        );

        let body = serde_json::json!({
            "model": format!("models/{}", self.model),
            "content": {
                "parts": [{"text": text}]
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
                "Gemini embedding error: {}",
                response.status()
            )));
        }

        let result: GeminiEmbedResponse = response.json().await?;
        Ok(result.embedding.values)
    }

    async fn embed_openai(&self, text: &str) -> Result<Vec<f32>> {
        let url = "https://api.openai.com/v1/embeddings";

        let body = serde_json::json!({
            "model": self.model,
            "input": text,
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
                "OpenAI embedding error: {}",
                response.status()
            )));
        }

        #[derive(Deserialize)]
        struct OpenAIResponse {
            data: Vec<OpenAIEmbedding>,
        }
        #[derive(Deserialize)]
        struct OpenAIEmbedding {
            embedding: Vec<f32>,
        }

        let result: OpenAIResponse = response.json().await?;
        Ok(result.data.first().map(|e| e.embedding.clone()).unwrap_or_default())
    }

    async fn embed_ollama(&self, text: &str) -> Result<Vec<f32>> {
        let url = "http://localhost:11434/api/embeddings";

        let body = serde_json::json!({
            "model": self.model,
            "prompt": text,
        });

        let response = self
            .client
            .post(url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Api(format!(
                "Ollama embedding error: {}",
                response.status()
            )));
        }

        #[derive(Deserialize)]
        struct OllamaResponse {
            embedding: Vec<f32>,
        }

        let result: OllamaResponse = response.json().await?;
        Ok(result.embedding)
    }

    pub fn dimension(&self) -> usize {
        match (self.provider.as_str(), self.model.as_str()) {
            ("gemini", "text-embedding-004") => 768,
            ("openai", "text-embedding-3-small") => 1536,
            ("openai", "text-embedding-3-large") => 3072,
            ("ollama", "nomic-embed-text") => 768,
            ("ollama", "mxbai-embed-large") => 1024,
            _ => 768,
        }
    }
}
