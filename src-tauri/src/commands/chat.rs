use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use crate::error::{AppError, Result};
use crate::services::ai_client::{AiClient, ChatMessage, StreamEvent};

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub provider: String,
    pub model: String,
    pub api_key: String,
    pub messages: Vec<ChatMessage>,
    pub context: Option<String>,
    pub stream_id: String,
}

#[derive(Debug, Serialize)]
pub struct SendMessageResponse {
    pub stream_id: String,
}

#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    request: SendMessageRequest,
) -> Result<SendMessageResponse> {
    let stream_id = request.stream_id.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        let client = AiClient::new(
            &request.provider,
            &request.api_key,
            None,
        );

        match client.chat_stream(&request.model, request.messages, request.context).await {
            Ok(mut stream) => {
                use futures::StreamExt;
                
                while let Some(event) = stream.next().await {
                    match event {
                        StreamEvent::Token(token) => {
                            let _ = app_clone.emit("chat:token", serde_json::json!({
                                "streamId": request.stream_id,
                                "token": token,
                            }));
                        }
                        StreamEvent::Done(sources) => {
                            let _ = app_clone.emit("chat:complete", serde_json::json!({
                                "streamId": request.stream_id,
                                "sources": sources,
                            }));
                        }
                        StreamEvent::Error(err) => {
                            let _ = app_clone.emit("chat:error", serde_json::json!({
                                "streamId": request.stream_id,
                                "error": err,
                            }));
                        }
                    }
                }
            }
            Err(e) => {
                let _ = app_clone.emit("chat:error", serde_json::json!({
                    "streamId": request.stream_id,
                    "error": e.to_string(),
                }));
            }
        }
    });

    Ok(SendMessageResponse { stream_id })
}

#[tauri::command]
pub async fn stop_generation(stream_id: String) -> Result<()> {
    // In a real implementation, we would cancel the ongoing stream
    tracing::info!("Stopping generation for stream: {}", stream_id);
    Ok(())
}
