use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;
use crate::error::Result;
use crate::services::ai_client::AiClient;

/// Global cancellation flag for in-flight streaming requests.
/// Streaming chat is sequential (compare mode runs models one-by-one), so a
/// single flag is sufficient. Set to true by the `stop_generation` command and
/// reset to false at the start of each new stream.
pub(crate) static STREAM_CANCELLED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct DocumentContext {
    pub name: String,
    pub content: String,
}

fn build_doc_context(documents: &[DocumentContext]) -> Option<String> {
    if documents.is_empty() {
        return None;
    }
    let mut context = String::from("Use the following document context to answer the question:\n\n");
    for doc in documents {
        context.push_str(&format!("--- Document: {} ---\n{}\n\n", doc.name, doc.content));
    }
    Some(context)
}

/// Combine an optional user-set system prompt with the (also optional)
/// document context into a single string. Both are presented to the model
/// as additional context; the system prompt is intentionally placed FIRST
/// so it sets the persona/tone before the documents are introduced.
fn build_combined_context(
    system_prompt: Option<&str>,
    doc_context: Option<&str>,
) -> Option<String> {
    let prompt = system_prompt.map(str::trim).filter(|s| !s.is_empty());
    match (prompt, doc_context) {
        (None, None) => None,
        (Some(p), None) => Some(format!("System instructions:\n{}\n", p)),
        (None, Some(d)) => Some(d.to_string()),
        (Some(p), Some(d)) => Some(format!(
            "System instructions:\n{}\n\n{}",
            p, d,
        )),
    }
}

#[tauri::command]
pub async fn send_message(
    message: String,
    history: Vec<ChatMessage>,
    documents: Vec<DocumentContext>,
    provider: String,
    model: String,
    api_key: String,
    system_prompt: Option<String>,
) -> Result<String> {
    let client = AiClient::new(&provider, &api_key, None);
    let doc_context = build_doc_context(&documents);
    let combined = build_combined_context(system_prompt.as_deref(), doc_context.as_deref());
    let response = client
        .chat_with_history(&model, &message, &history, combined.as_deref())
        .await?;
    Ok(response)
}

/// Streaming version - emits chunks via Tauri events
#[tauri::command]
pub async fn send_message_stream(
    app: AppHandle,
    message: String,
    history: Vec<ChatMessage>,
    documents: Vec<DocumentContext>,
    provider: String,
    model: String,
    api_key: String,
    system_prompt: Option<String>,
) -> Result<()> {
    // Reset cancellation flag for this new stream
    STREAM_CANCELLED.store(false, Ordering::SeqCst);

    let client = AiClient::new(&provider, &api_key, None);
    let doc_context = build_doc_context(&documents);
    let combined = build_combined_context(system_prompt.as_deref(), doc_context.as_deref());

    client.chat_stream_with_emitter(
        &app,
        &model,
        &message,
        &history,
        combined.as_deref(),
    ).await?;

    Ok(())
}

/// Signal in-flight streaming requests to abort.
#[tauri::command]
pub async fn stop_generation() -> Result<()> {
    STREAM_CANCELLED.store(true, Ordering::SeqCst);
    Ok(())
}
