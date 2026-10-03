use std::sync::OnceLock;
use std::time::Duration;

use futures::StreamExt;
use reqwest::{Client, RequestBuilder};
use serde_json::{json, Value};
use tokio_util::sync::CancellationToken;

use crate::commands::chat::ChatMessage;
use crate::error::{AppError, Result};
use crate::services::sse::{self, LineBuffer, LineParser, Parsed};

/// Connect timeout for all HTTP requests. Long-running streams have no
/// overall request timeout (streams can legitimately run for minutes), but
/// connection establishment must not hang.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
/// Whole-request timeout for non-streaming calls (model listing, embeddings).
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434";
const DEFAULT_SYSTEM_PROMPT: &str = "You are a helpful assistant.";

type ModelListParser = fn(&Value) -> Vec<String>;

fn build_http_client(streaming: bool) -> Client {
    let mut builder = Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        // Limit redirect chains to prevent open-redirect / SSRF amplification.
        .redirect(reqwest::redirect::Policy::limited(3));
    if !streaming {
        builder = builder.timeout(REQUEST_TIMEOUT);
    }
    builder.build().unwrap_or_else(|_| Client::new())
}

/// Shared client for request/response calls. Reusing one client keeps the
/// connection pool (and TLS sessions) warm between messages.
pub fn http_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| build_http_client(false))
}

fn streaming_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| build_http_client(true))
}

/// One chat turn to send to a provider.
pub struct ChatRequest<'a> {
    pub model: &'a str,
    pub message: &'a str,
    pub history: &'a [ChatMessage],
    /// System instructions (user persona plus any document context).
    pub system: Option<&'a str>,
}

#[derive(Debug, Default)]
pub struct StreamOutcome {
    /// Number of characters delivered to the UI.
    pub emitted_chars: usize,
    /// True when the user cancelled the stream.
    pub stopped: bool,
    /// Provider-supplied reason for an empty or truncated answer.
    pub note: Option<String>,
}

pub struct AiClient {
    provider: String,
    api_key: String,
    base_url: Option<String>,
}

impl AiClient {
    pub fn new(provider: &str, api_key: &str, base_url: Option<&str>) -> Self {
        Self {
            provider: provider.to_string(),
            api_key: api_key.to_string(),
            base_url: base_url
                .map(|url| url.trim().trim_end_matches('/').to_string())
                .filter(|url| !url.is_empty()),
        }
    }

    fn ollama_url(&self) -> &str {
        self.base_url.as_deref().unwrap_or(DEFAULT_OLLAMA_URL)
    }

    /// Redact the API key from any string before it's surfaced to the user
    /// or logged. Several providers put the key in the URL (Gemini) or the
    /// Authorization header may be echoed in error envelopes.
    fn redact(&self, msg: String) -> String {
        if self.api_key.len() < 6 {
            return msg;
        }
        msg.replace(&self.api_key, "[REDACTED]")
    }

    fn network_error(&self, err: reqwest::Error) -> AppError {
        match AppError::from(err) {
            AppError::Network(msg) => AppError::Network(self.redact(msg)),
            other => other,
        }
    }

    /// Validate the credentials and return the chat models the account can
    /// use, straight from the provider.
    pub async fn list_models(&self) -> Result<Vec<String>> {
        let client = http_client();
        let (request, label, parse): (RequestBuilder, &str, ModelListParser) =
            match self.provider.as_str() {
                "gemini" => (
                    client.get(format!(
                        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key={}",
                        self.api_key
                    )),
                    "Gemini",
                    parse_gemini_models as ModelListParser,
                ),
                "openai" => (
                    client
                        .get("https://api.openai.com/v1/models")
                        .header("Authorization", format!("Bearer {}", self.api_key)),
                    "OpenAI",
                    parse_openai_models as ModelListParser,
                ),
                "anthropic" => (
                    client
                        .get("https://api.anthropic.com/v1/models?limit=100")
                        .header("x-api-key", &self.api_key)
                        .header("anthropic-version", "2023-06-01"),
                    "Anthropic",
                    parse_id_list as ModelListParser,
                ),
                "glm" => (
                    client
                        .get("https://api.z.ai/api/paas/v4/models")
                        .header("Authorization", format!("Bearer {}", self.api_key)),
                    "GLM",
                    parse_id_list as ModelListParser,
                ),
                "ollama" => (
                    client.get(format!("{}/api/tags", self.ollama_url())),
                    "Ollama",
                    parse_ollama_models as ModelListParser,
                ),
                _ => return Err(AppError::Config("Unknown provider".to_string())),
            };

        let response = request.send().await.map_err(|err| {
            if self.provider == "ollama" {
                AppError::Network("Cannot connect to Ollama".to_string())
            } else {
                self.network_error(err)
            }
        })?;

        let status = response.status();
        if !status.is_success() {
            // Gemini reports a bad key as 400 rather than 401.
            if status.as_u16() == 400 && self.provider == "gemini" {
                return Err(AppError::InvalidApiKey);
            }
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::for_status(status.as_u16(), label, &self.redact(body)));
        }

        let json: Value = response.json().await.map_err(|err| self.network_error(err))?;
        Ok(parse(&json))
    }

    /// Stream a chat completion, calling `emit` for every piece of text.
    /// Returns once the provider finishes or `cancel` fires.
    pub async fn chat_stream(
        &self,
        request: &ChatRequest<'_>,
        cancel: &CancellationToken,
        emit: &(dyn Fn(&str) + Send + Sync),
    ) -> Result<StreamOutcome> {
        let (builder, label, parser) = self.build_stream_request(request)?;
        let mut outcome = StreamOutcome::default();

        let response = tokio::select! {
            _ = cancel.cancelled() => {
                outcome.stopped = true;
                return Ok(outcome);
            }
            sent = builder.send() => sent.map_err(|err| self.network_error(err))?,
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::for_status(status.as_u16(), label, &self.redact(body)));
        }

        let mut stream = response.bytes_stream();
        let mut lines = LineBuffer::default();

        loop {
            let next = tokio::select! {
                _ = cancel.cancelled() => {
                    outcome.stopped = true;
                    break;
                }
                next = stream.next() => next,
            };
            let Some(chunk) = next else { break };
            let chunk = chunk.map_err(|err| self.network_error(err))?;
            for line in lines.push(&chunk) {
                apply_line(parser(&line), label, &mut outcome, emit)?;
            }
        }

        if !outcome.stopped {
            if let Some(line) = lines.finish() {
                apply_line(parser(&line), label, &mut outcome, emit)?;
            }
        }

        Ok(outcome)
    }

    fn build_stream_request(
        &self,
        request: &ChatRequest<'_>,
    ) -> Result<(RequestBuilder, &'static str, LineParser)> {
        let client = streaming_client();
        match self.provider.as_str() {
            "gemini" => {
                let url = format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
                    request.model, self.api_key
                );
                Ok((client.post(url).json(&gemini_body(request)), "Gemini", sse::parse_gemini as LineParser))
            }
            "openai" => Ok((
                client
                    .post("https://api.openai.com/v1/chat/completions")
                    .header("Authorization", format!("Bearer {}", self.api_key))
                    .json(&openai_body(request)),
                "OpenAI",
                sse::parse_openai as LineParser,
            )),
            "glm" => Ok((
                client
                    .post("https://api.z.ai/api/paas/v4/chat/completions")
                    .header("Authorization", format!("Bearer {}", self.api_key))
                    .json(&openai_body(request)),
                "GLM",
                sse::parse_openai as LineParser,
            )),
            "anthropic" => Ok((
                client
                    .post("https://api.anthropic.com/v1/messages")
                    .header("x-api-key", &self.api_key)
                    .header("anthropic-version", "2023-06-01")
                    .json(&anthropic_body(request)),
                "Anthropic",
                sse::parse_anthropic as LineParser,
            )),
            "ollama" => Ok((
                client
                    .post(format!("{}/api/chat", self.ollama_url()))
                    .json(&ollama_body(request)),
                "Ollama",
                sse::parse_ollama as LineParser,
            )),
            _ => Err(AppError::Config("Unknown provider".to_string())),
        }
    }
}

fn apply_line(
    parsed: Parsed,
    label: &str,
    outcome: &mut StreamOutcome,
    emit: &(dyn Fn(&str) + Send + Sync),
) -> Result<()> {
    match parsed {
        Parsed::Text(text) => {
            outcome.emitted_chars += text.chars().count();
            emit(&text);
        }
        Parsed::Note(note) => outcome.note = Some(note),
        Parsed::Error(message) => {
            return Err(AppError::Api(format!("{label} error: {message}")));
        }
        Parsed::Skip => {}
    }
    Ok(())
}

fn role_messages(request: &ChatRequest<'_>, system: Option<&str>) -> Vec<Value> {
    let mut messages = Vec::with_capacity(request.history.len() + 2);
    if let Some(system) = system {
        messages.push(json!({ "role": "system", "content": system }));
    }
    for msg in request.history {
        messages.push(json!({ "role": &msg.role, "content": &msg.content }));
    }
    messages.push(json!({ "role": "user", "content": request.message }));
    messages
}

fn gemini_body(request: &ChatRequest<'_>) -> Value {
    let mut contents = Vec::with_capacity(request.history.len() + 1);
    for msg in request.history {
        let role = if msg.role == "assistant" { "model" } else { "user" };
        contents.push(json!({ "role": role, "parts": [{ "text": &msg.content }] }));
    }
    contents.push(json!({ "role": "user", "parts": [{ "text": request.message }] }));

    let mut body = json!({
        "contents": contents,
        "generationConfig": { "temperature": 0.7, "maxOutputTokens": 8192 },
    });
    if let Some(system) = request.system {
        body["systemInstruction"] = json!({ "parts": [{ "text": system }] });
    }
    body
}

fn openai_body(request: &ChatRequest<'_>) -> Value {
    let system = request.system.unwrap_or(DEFAULT_SYSTEM_PROMPT);
    json!({
        "model": request.model,
        "messages": role_messages(request, Some(system)),
        "temperature": 0.7,
        "stream": true,
    })
}

fn anthropic_body(request: &ChatRequest<'_>) -> Value {
    let mut body = json!({
        "model": request.model,
        "max_tokens": 4096,
        "messages": role_messages(request, None),
        "stream": true,
    });
    if let Some(system) = request.system {
        body["system"] = json!(system);
    }
    body
}

fn ollama_body(request: &ChatRequest<'_>) -> Value {
    json!({
        "model": request.model,
        "messages": role_messages(request, request.system),
        "stream": true,
    })
}

fn sorted_unique(mut models: Vec<String>) -> Vec<String> {
    models.sort();
    models.dedup();
    models
}

/// Gemini lists every model family; keep the ones that can chat.
fn parse_gemini_models(json: &Value) -> Vec<String> {
    let models = json["models"].as_array().cloned().unwrap_or_default();
    sorted_unique(
        models
            .iter()
            .filter(|model| {
                model["supportedGenerationMethods"]
                    .as_array()
                    .is_some_and(|methods| methods.iter().any(|m| m == "generateContent"))
            })
            .filter_map(|model| model["name"].as_str())
            .map(|name| name.trim_start_matches("models/").to_string())
            .filter(|name| name.starts_with("gemini"))
            .collect(),
    )
}

fn is_openai_chat_model(id: &str) -> bool {
    const PREFIXES: [&str; 5] = ["gpt-", "chatgpt-", "o1", "o3", "o4"];
    const EXCLUDED: [&str; 9] = [
        "embedding", "audio", "realtime", "tts", "transcribe", "image", "instruct", "search",
        "moderation",
    ];
    PREFIXES.iter().any(|prefix| id.starts_with(prefix))
        && !EXCLUDED.iter().any(|word| id.contains(word))
}

fn parse_openai_models(json: &Value) -> Vec<String> {
    sorted_unique(
        parse_id_list(json)
            .into_iter()
            .filter(|id| is_openai_chat_model(id))
            .collect(),
    )
}

/// `{ "data": [{ "id": "..." }] }` — the shape Anthropic and GLM share.
fn parse_id_list(json: &Value) -> Vec<String> {
    json["data"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item["id"].as_str())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn parse_ollama_models(json: &Value) -> Vec<String> {
    json["models"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item["name"].as_str())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request<'a>(history: &'a [ChatMessage], system: Option<&'a str>) -> ChatRequest<'a> {
        ChatRequest { model: "m", message: "hello", history, system }
    }

    #[test]
    fn gemini_uses_system_instruction() {
        let history = [ChatMessage { role: "assistant".into(), content: "hi".into() }];
        let body = gemini_body(&request(&history, Some("be brief")));
        assert_eq!(body["systemInstruction"]["parts"][0]["text"], "be brief");
        assert_eq!(body["contents"][0]["role"], "model");
        assert_eq!(body["contents"][1]["parts"][0]["text"], "hello");
        assert!(gemini_body(&request(&[], None)).get("systemInstruction").is_none());
    }

    #[test]
    fn openai_always_has_a_system_message() {
        let body = openai_body(&request(&[], None));
        assert_eq!(body["messages"][0]["role"], "system");
        assert_eq!(body["messages"][0]["content"], DEFAULT_SYSTEM_PROMPT);
        let body = openai_body(&request(&[], Some("be brief")));
        assert_eq!(body["messages"][0]["content"], "be brief");
        assert_eq!(body["stream"], true);
    }

    #[test]
    fn anthropic_system_is_top_level_and_optional() {
        let body = anthropic_body(&request(&[], Some("be brief")));
        assert_eq!(body["system"], "be brief");
        assert_eq!(body["messages"][0]["role"], "user");
        assert!(anthropic_body(&request(&[], None)).get("system").is_none());
    }

    #[test]
    fn base_url_is_normalised() {
        let client = AiClient::new("ollama", "", Some(" http://10.0.0.5:11434/ "));
        assert_eq!(client.ollama_url(), "http://10.0.0.5:11434");
        let client = AiClient::new("ollama", "", Some("  "));
        assert_eq!(client.ollama_url(), DEFAULT_OLLAMA_URL);
    }

    #[test]
    fn model_list_parsing() {
        let gemini = json!({ "models": [
            { "name": "models/gemini-2.5-pro", "supportedGenerationMethods": ["generateContent"] },
            { "name": "models/gemini-embedding-001", "supportedGenerationMethods": ["embedContent"] },
        ]});
        assert_eq!(parse_gemini_models(&gemini), vec!["gemini-2.5-pro"]);

        let openai = json!({ "data": [
            { "id": "gpt-4o" }, { "id": "text-embedding-3-small" }, { "id": "gpt-4o-audio-preview" },
        ]});
        assert_eq!(parse_openai_models(&openai), vec!["gpt-4o"]);

        let ollama = json!({ "models": [{ "name": "llama3.2:latest" }] });
        assert_eq!(parse_ollama_models(&ollama), vec!["llama3.2:latest"]);
    }

    #[test]
    fn stream_lines_update_outcome() {
        let emitted = std::sync::Mutex::new(String::new());
        let emit = |text: &str| emitted.lock().unwrap().push_str(text);
        let mut outcome = StreamOutcome::default();
        apply_line(Parsed::Text("héllo".into()), "X", &mut outcome, &emit).unwrap();
        apply_line(Parsed::Note("blocked".into()), "X", &mut outcome, &emit).unwrap();
        assert_eq!(outcome.emitted_chars, 5);
        assert_eq!(outcome.note.as_deref(), Some("blocked"));
        assert_eq!(*emitted.lock().unwrap(), "héllo");
        assert!(apply_line(Parsed::Error("boom".into()), "X", &mut outcome, &emit).is_err());
    }
}
