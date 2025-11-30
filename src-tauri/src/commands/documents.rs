use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;
use crate::error::{AppError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: u64,
    pub status: String,
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

#[derive(Debug, Serialize)]
pub struct DocumentContent {
    pub id: String,
    pub name: String,
    pub content: String,
}

#[tauri::command]
pub async fn add_documents(request: AddDocumentsRequest) -> Result<AddDocumentsResponse> {
    let mut documents = Vec::new();
    let mut errors = Vec::new();

    for path_str in request.file_paths {
        let path = std::path::PathBuf::from(&path_str);
        
        if !path.exists() {
            errors.push(format!("File not found: {}", path_str));
            continue;
        }

        let file_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let extension = path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let metadata = fs::metadata(&path).map_err(|e| AppError::File(e.to_string()))?;

        let doc = Document {
            id: uuid::Uuid::new_v4().to_string(),
            name: file_name,
            file_path: path_str,
            file_type: extension,
            file_size: metadata.len(),
            status: "ready".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        documents.push(doc);
    }

    Ok(AddDocumentsResponse { documents, errors })
}

#[tauri::command]
pub async fn remove_document(_document_id: String) -> Result<()> {
    Ok(())
}

#[tauri::command]
pub async fn list_documents(_space_id: String) -> Result<Vec<Document>> {
    Ok(vec![])
}

#[tauri::command]
pub async fn read_document_content(file_path: String) -> Result<String> {
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err(AppError::File(format!("File not found: {}", file_path)));
    }

    let extension = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let content = match extension.as_str() {
        "pdf" => extract_pdf_text(path)?,
        "txt" | "md" | "py" | "js" | "ts" | "rs" | "java" | "cpp" | "c" | "h" | "json" | "yaml" | "yml" | "toml" => {
            fs::read_to_string(path).map_err(|e| AppError::File(e.to_string()))?
        }
        "html" | "htm" => {
            let html = fs::read_to_string(path).map_err(|e| AppError::File(e.to_string()))?;
            strip_html_tags(&html)
        }
        _ => {
            // Try to read as text
            fs::read_to_string(path).unwrap_or_else(|_| String::from("Unable to read file content"))
        }
    };

    // Truncate if too long (to avoid token limits)
    let max_chars = 100_000;
    if content.len() > max_chars {
        Ok(format!("{}...\n\n[Content truncated - showing first {} characters]", &content[..max_chars], max_chars))
    } else {
        Ok(content)
    }
}

fn extract_pdf_text(path: &Path) -> Result<String> {
    use pdf_extract::extract_text;
    
    extract_text(path)
        .map_err(|e| AppError::File(format!("Failed to extract PDF text: {}", e)))
}

fn strip_html_tags(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    let mut in_script = false;
    let mut in_style = false;
    
    let html_lower = html.to_lowercase();
    let chars: Vec<char> = html.chars().collect();
    let chars_lower: Vec<char> = html_lower.chars().collect();
    
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '<' {
            in_tag = true;
            // Check for script/style tags
            let remaining: String = chars_lower[i..].iter().collect();
            if remaining.starts_with("<script") {
                in_script = true;
            } else if remaining.starts_with("</script") {
                in_script = false;
            } else if remaining.starts_with("<style") {
                in_style = true;
            } else if remaining.starts_with("</style") {
                in_style = false;
            }
        } else if chars[i] == '>' {
            in_tag = false;
        } else if !in_tag && !in_script && !in_style {
            result.push(chars[i]);
        }
        i += 1;
    }
    
    // Clean up whitespace
    let lines: Vec<&str> = result.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();
    
    lines.join("\n")
}
