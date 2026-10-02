use serde_json::{json, Value};

use crate::error::{AppError, Result};
use crate::services::ai_client::http_client;

/// Embedding model used for document indexing and query embedding. Stored
/// alongside every vector so a model change triggers re-indexing instead of
/// comparing incompatible vectors.
pub const EMBEDDING_MODEL: &str = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS: u32 = 768;
/// Texts per `batchEmbedContents` request.
const BATCH_SIZE: usize = 50;

pub struct EmbeddingService {
    api_key: String,
}

impl EmbeddingService {
    pub fn new(api_key: &str) -> Self {
        Self { api_key: api_key.to_string() }
    }

    fn redact(&self, msg: String) -> String {
        if self.api_key.len() < 6 {
            return msg;
        }
        msg.replace(&self.api_key, "[REDACTED]")
    }

    /// reqwest errors can echo the request URL, which carries the key.
    fn network_error(&self, err: reqwest::Error) -> AppError {
        match AppError::from(err) {
            AppError::Network(msg) => AppError::Network(self.redact(msg)),
            other => other,
        }
    }

    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        self.embed_batch(&[text.to_string()])
            .await?
            .pop()
            .ok_or_else(|| AppError::Api("Gemini returned no embedding".to_string()))
    }

    /// Embed many texts with as few round trips as possible. The result has
    /// one vector per input, in order.
    pub async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:batchEmbedContents?key={}",
            EMBEDDING_MODEL, self.api_key
        );

        let mut embeddings = Vec::with_capacity(texts.len());
        for batch in texts.chunks(BATCH_SIZE) {
            let response = http_client()
                .post(&url)
                .json(&batch_body(batch))
                .send()
                .await
                .map_err(|err| self.network_error(err))?;
            let status = response.status();
            if !status.is_success() {
                let body = response.text().await.unwrap_or_default();
                return Err(AppError::for_status(
                    status.as_u16(),
                    "Gemini embedding",
                    &self.redact(body),
                ));
            }
            let json: Value = response.json().await.map_err(|err| self.network_error(err))?;
            let vectors = parse_batch_response(&json)?;
            if vectors.len() != batch.len() {
                return Err(AppError::Api(format!(
                    "Gemini returned {} embeddings for {} inputs",
                    vectors.len(),
                    batch.len()
                )));
            }
            embeddings.extend(vectors);
        }
        Ok(embeddings)
    }
}

fn batch_body(texts: &[String]) -> Value {
    let requests: Vec<Value> = texts
        .iter()
        .map(|text| {
            json!({
                "model": format!("models/{EMBEDDING_MODEL}"),
                "content": { "parts": [{ "text": text }] },
                "outputDimensionality": EMBEDDING_DIMENSIONS,
            })
        })
        .collect();
    json!({ "requests": requests })
}

fn parse_batch_response(json: &Value) -> Result<Vec<Vec<f32>>> {
    let items = json["embeddings"]
        .as_array()
        .ok_or_else(|| AppError::Api("Unexpected embedding response".to_string()))?;
    items
        .iter()
        .map(|item| {
            item["values"]
                .as_array()
                .map(|values| {
                    values
                        .iter()
                        .filter_map(Value::as_f64)
                        .map(|value| value as f32)
                        .collect::<Vec<f32>>()
                })
                .filter(|values| !values.is_empty())
                .ok_or_else(|| AppError::Api("Unexpected embedding response".to_string()))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batch_body_has_one_request_per_text() {
        let body = batch_body(&["a".to_string(), "b".to_string()]);
        let requests = body["requests"].as_array().unwrap();
        assert_eq!(requests.len(), 2);
        assert_eq!(requests[1]["content"]["parts"][0]["text"], "b");
        assert_eq!(requests[0]["model"], "models/gemini-embedding-001");
    }

    #[test]
    fn parses_batch_response() {
        let json = json!({ "embeddings": [{ "values": [0.5, 1.0] }, { "values": [2.0] }] });
        assert_eq!(parse_batch_response(&json).unwrap(), vec![vec![0.5, 1.0], vec![2.0]]);
        assert!(parse_batch_response(&json!({})).is_err());
        assert!(parse_batch_response(&json!({ "embeddings": [{}] })).is_err());
    }
}
