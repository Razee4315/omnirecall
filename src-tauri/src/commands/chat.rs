use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use crate::error::Result;
use crate::services::ai_client::AiClient;

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

#[derive(Clone, Serialize)]
pub struct StreamChunk {
    pub chunk: String,
    pub done: bool,
}

#[tauri::command]
pub async fn send_message(
    message: String,
    history: Vec<ChatMessage>,
    documents: Vec<DocumentContext>,
    provider: String,
    model: String,
    api_key: String,
) -> Result<String> {
    let client = AiClient::new(&provider, &api_key, None);
    
    // Build context from documents
    let doc_context = if !documents.is_empty() {
        let mut context = String::from("Use the following document context to answer the question:\n\n");
        for doc in &documents {
            context.push_str(&format!("--- Document: {} ---\n{}\n\n", doc.name, doc.content));
        }
        Some(context)
    } else {
        None
    };
    
    // Send with history and context
    let response = client.chat_with_history(&model, &message, &history, doc_context.as_deref()).await?;
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
) -> Result<()> {
    let client = AiClient::new(&provider, &api_key, None);
    
    // Build context from documents
    let doc_context = if !documents.is_empty() {
        let mut context = String::from("Use the following document context to answer the question:\n\n");
        for doc in &documents {
            context.push_str(&format!("--- Document: {} ---\n{}\n\n", doc.name, doc.content));
        }
        Some(context)
    } else {
        None
    };
    
    // Stream response - pass app handle for event emission
    client.chat_stream_with_emitter(
        &app,
        &model,
        &message,
        &history,
        doc_context.as_deref(),
    ).await?;
    
    Ok(())
}

#[tauri::command]
pub async fn stop_generation(_stream_id: String) -> Result<()> {
    Ok(())
}
