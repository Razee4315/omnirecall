use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;

use crate::commands::documents::{build_context, ContextMode, DocumentRef};
use crate::error::{AppError, Result};
use crate::services::ai_client::{AiClient, ChatRequest};

#[derive(Debug, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamResult {
    /// True when the user stopped the stream.
    pub stopped: bool,
    /// Names of the documents whose text was sent as context.
    pub sources: Vec<String>,
    pub context_mode: ContextMode,
}

/// Cancellation tokens for in-flight streams, keyed by the id the frontend
/// generated for the request. Each stream has its own token, so stopping one
/// request (or starting another) can never affect a different stream.
fn streams() -> &'static Mutex<HashMap<String, CancellationToken>> {
    static STREAMS: OnceLock<Mutex<HashMap<String, CancellationToken>>> = OnceLock::new();
    STREAMS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Registers a stream for its lifetime and removes it when dropped, including
/// on early returns.
struct StreamRegistration {
    id: String,
    token: CancellationToken,
}

impl StreamRegistration {
    fn new(id: &str) -> Self {
        let token = CancellationToken::new();
        if let Ok(mut map) = streams().lock() {
            map.insert(id.to_string(), token.clone());
        }
        Self { id: id.to_string(), token }
    }
}

impl Drop for StreamRegistration {
    fn drop(&mut self) {
        if let Ok(mut map) = streams().lock() {
            map.remove(&self.id);
        }
    }
}

/// Combine the user's system prompt with document context into the system
/// instructions for the provider. The persona comes first so it sets the tone
/// before the documents are introduced.
fn compose_system(system_prompt: Option<&str>, doc_context: Option<&str>) -> Option<String> {
    let prompt = system_prompt.map(str::trim).filter(|s| !s.is_empty());
    let documents = doc_context.map(|context| {
        format!(
            "Use the following document context to answer the user's questions accurately. \
             If the answer is not in the context, say so.\n\n{context}"
        )
    });
    match (prompt, documents) {
        (None, None) => None,
        (Some(prompt), None) => Some(prompt.to_string()),
        (None, Some(documents)) => Some(documents),
        (Some(prompt), Some(documents)) => Some(format!("{prompt}\n\n{documents}")),
    }
}

fn cancel_streams(stream_id: Option<&str>) {
    if let Ok(map) = streams().lock() {
        match stream_id {
            Some(id) => {
                if let Some(token) = map.get(id) {
                    token.cancel();
                }
            }
            None => map.values().for_each(CancellationToken::cancel),
        }
    }
}

/// Stream a chat completion. Text arrives as `chat-stream` events tagged with
/// `stream_id`; the command resolves when the stream ends.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn send_message_stream(
    app: AppHandle,
    stream_id: String,
    message: String,
    history: Vec<ChatMessage>,
    documents: Vec<DocumentRef>,
    provider: String,
    model: String,
    api_key: String,
    base_url: Option<String>,
    system_prompt: Option<String>,
    embedding_key: Option<String>,
) -> Result<StreamResult> {
    let registration = StreamRegistration::new(&stream_id);

    let context = build_context(&documents, &message, embedding_key.as_deref()).await;
    let system = compose_system(system_prompt.as_deref(), context.text.as_deref());

    let client = AiClient::new(&provider, &api_key, base_url.as_deref());
    let request = ChatRequest {
        model: &model,
        message: &message,
        history: &history,
        system: system.as_deref(),
    };
    let emit = |chunk: &str| {
        let _ = app.emit(
            "chat-stream",
            serde_json::json!({ "streamId": &stream_id, "chunk": chunk }),
        );
    };

    let outcome = client.chat_stream(&request, &registration.token, &emit).await?;

    if outcome.emitted_chars == 0 && !outcome.stopped {
        let reason = outcome.note.map(|note| format!(": {note}")).unwrap_or_default();
        return Err(AppError::EmptyResponse(reason));
    }

    Ok(StreamResult {
        stopped: outcome.stopped,
        sources: context.sources,
        context_mode: context.mode,
    })
}

/// Abort one in-flight stream, or every stream when no id is given.
#[tauri::command]
pub async fn stop_generation(stream_id: Option<String>) -> Result<()> {
    cancel_streams(stream_id.as_deref());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn system_prompt_precedes_documents() {
        assert_eq!(compose_system(None, None), None);
        assert_eq!(compose_system(Some("  "), None), None);
        assert_eq!(compose_system(Some(" be brief "), None).as_deref(), Some("be brief"));
        let both = compose_system(Some("be brief"), Some("DOC")).unwrap();
        assert!(both.starts_with("be brief\n\nUse the following document context"));
        assert!(both.ends_with("DOC"));
    }

    #[test]
    fn stop_targets_only_the_named_stream() {
        let first = StreamRegistration::new("test-stream-a");
        let second = StreamRegistration::new("test-stream-b");
        cancel_streams(Some("test-stream-a"));
        assert!(first.token.is_cancelled());
        assert!(!second.token.is_cancelled());
    }

    #[test]
    fn registration_is_removed_on_drop() {
        {
            let _registration = StreamRegistration::new("test-stream-c");
            assert!(streams().lock().unwrap().contains_key("test-stream-c"));
        }
        assert!(!streams().lock().unwrap().contains_key("test-stream-c"));
    }
}
