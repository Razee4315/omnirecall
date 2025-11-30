use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::error::{AppError, Result};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: u64,
    pub page_count: Option<u32>,
    pub token_count: u32,
    pub status: String,
    pub progress: Option<u32>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct AddDocumentsRequest {
    pub space_id: String,
    pub file_paths: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct AddDocumentsResponse {
    pub documents: Vec<Document>,
    pub errors: Vec<String>,
}

#[tauri::command]
pub async fn add_documents(request: AddDocumentsRequest) -> Result<AddDocumentsResponse> {
    let mut documents = Vec::new();
    let mut errors = Vec::new();

    for path_str in request.file_paths {
        let path = PathBuf::from(&path_str);
        
        if !path.exists() {
            errors.push(format!("File not found: {}", path_str));
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let supported = ["pdf", "txt", "md", "docx", "doc", "html", "py", "js", "rs", "java", "cpp", "c"];
        if !supported.contains(&extension.as_str()) {
            errors.push(format!("Unsupported file type: {}", extension));
            continue;
        }

        let metadata = std::fs::metadata(&path)
            .map_err(|e| AppError::File(e.to_string()))?;

        let doc = Document {
            id: Uuid::new_v4().to_string(),
            name: file_name,
            file_path: path_str,
            file_type: extension,
            file_size: metadata.len(),
            page_count: None,
            token_count: 0,
            status: "processing".to_string(),
            progress: Some(0),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        documents.push(doc);
    }

    // In a real implementation, we would:
    // 1. Copy files to app data directory
    // 2. Extract text from documents
    // 3. Chunk text
    // 4. Generate embeddings
    // 5. Store in vector database
    // 6. Update document status

    Ok(AddDocumentsResponse { documents, errors })
}

#[tauri::command]
pub async fn remove_document(document_id: String) -> Result<()> {
    tracing::info!("Removing document: {}", document_id);
    // In a real implementation, we would:
    // 1. Remove from vector database
    // 2. Delete stored file
    // 3. Update space document count
    Ok(())
}

#[tauri::command]
pub async fn list_documents(space_id: String) -> Result<Vec<Document>> {
    // Return mock data for now
    Ok(vec![
        Document {
            id: "doc1".to_string(),
            name: "Q3_Report.pdf".to_string(),
            file_path: "/documents/Q3_Report.pdf".to_string(),
            file_type: "pdf".to_string(),
            file_size: 1024000,
            page_count: Some(24),
            token_count: 15234,
            status: "indexed".to_string(),
            progress: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        },
        Document {
            id: "doc2".to_string(),
            name: "Q2_Report.pdf".to_string(),
            file_path: "/documents/Q2_Report.pdf".to_string(),
            file_type: "pdf".to_string(),
            file_size: 980000,
            page_count: Some(22),
            token_count: 14102,
            status: "indexed".to_string(),
            progress: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        },
    ])
}
