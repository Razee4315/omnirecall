use serde::{Deserialize, Serialize};
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

#[tauri::command]
pub async fn stop_generation(_stream_id: String) -> Result<()> {
    Ok(())
}
