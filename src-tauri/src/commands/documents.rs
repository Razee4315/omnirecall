use serde::Serialize;
use std::path::Path;
use std::fs;
use crate::error::{AppError, Result};

/// Maximum file size we'll attempt to read (50 MB). Beyond this we refuse
/// rather than risk OOM or extreme parse latency for poorly-formed input.
const MAX_DOCUMENT_BYTES: u64 = 50 * 1024 * 1024;
/// Allow-list of extensions whose content we'll read. Prevents accidental
/// reads of unexpected binary types (e.g. exe, dll) and makes the surface
/// callable from the frontend explicit.
const ALLOWED_EXTENSIONS: &[&str] = &[
    "pdf", "txt", "md", "rst", "html", "htm",
    "py", "js", "ts", "tsx", "jsx", "rs", "java", "cpp", "c", "h", "hpp",
    "go", "rb", "php", "swift", "kt", "cs", "json", "yaml", "yml", "toml",
    "xml", "csv", "sh", "ps1", "sql", "log", "conf", "ini", "env",
];

fn is_allowed_extension(ext: &str) -> bool {
    ALLOWED_EXTENSIONS.iter().any(|allowed| allowed.eq_ignore_ascii_case(ext))
}

#[tauri::command]
pub async fn read_document_content(file_path: String) -> Result<String> {
    // Reject obvious traversal patterns. We cannot meaningfully sandbox the
    // filesystem here (the user's own dialog picks arbitrary absolute paths)
    // but we can still refuse paths whose components include `..`, which are
    // never produced by the dialog and only show up if a caller is trying to
    // confuse path resolution downstream.
    if file_path.split(['/', '\\']).any(|s| s == "..") {
        return Err(AppError::File("Path traversal patterns are not allowed".to_string()));
    }

    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(AppError::File(format!("File not found: {}", file_path)));
    }

    let metadata = fs::metadata(path).map_err(|e| AppError::File(e.to_string()))?;
    if !metadata.is_file() {
        return Err(AppError::File("Path is not a regular file".to_string()));
    }
    if metadata.len() > MAX_DOCUMENT_BYTES {
        return Err(AppError::File(format!(
            "File too large ({} MB). Maximum supported size is {} MB.",
            metadata.len() / 1_048_576,
            MAX_DOCUMENT_BYTES / 1_048_576,
        )));
    }

    let extension = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !is_allowed_extension(&extension) {
        return Err(AppError::File(format!("Unsupported file type: .{}", extension)));
    }

    let content = match extension.as_str() {
        "pdf" => extract_pdf_text(path)?,
        "html" | "htm" => {
            let html = fs::read_to_string(path).map_err(|e| AppError::File(e.to_string()))?;
            strip_html_tags(&html)
        }
        _ => {
            // Text-based formats. Use lossy UTF-8 for files that contain mixed
            // encodings (e.g. log files) so we still surface readable content.
            let bytes = fs::read(path).map_err(|e| AppError::File(e.to_string()))?;
            String::from_utf8(bytes.clone()).unwrap_or_else(|_| String::from_utf8_lossy(&bytes).into_owned())
        }
    };

    // Truncate if too long (to avoid token limits)
    let max_chars = 100_000;
    if content.len() > max_chars {
        // Find a valid UTF-8 boundary at or before max_chars
        let truncated = match content.char_indices().nth(max_chars) {
            Some((byte_idx, _)) => &content[..byte_idx],
            None => &content, // fewer than max_chars characters
        };
        Ok(format!("{}...\n\n[Content truncated - showing first {} characters]", truncated, max_chars))
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

// ============= RAG Commands =============

#[derive(Debug, Serialize)]
pub struct IndexResult {
    pub document_id: String,
    pub chunks_created: usize,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SemanticSearchResult {
    pub document_name: String,
    pub content: String,
    pub score: f32,
    pub chunk_index: i32,
}

/// Index a document for semantic search
#[tauri::command]
pub async fn index_document(
    document_id: String,
    document_name: String,
    file_path: String,
    provider: String,
    api_key: String,
) -> Result<IndexResult> {
    use crate::services::document_pipeline::DocumentPipeline;
    use crate::services::embedding::EmbeddingService;
    use crate::services::vector_store::{VectorStore, DocumentChunk};
    
    // Read document content
    let content = match read_document_content(file_path.clone()).await {
        Ok(c) => c,
        Err(e) => return Ok(IndexResult {
            document_id,
            chunks_created: 0,
            success: false,
            error: Some(e.to_string()),
        }),
    };
    
    // Initialize services
    let pipeline = DocumentPipeline::new();
    let embedding_service = EmbeddingService::new(&provider, &api_key, None);
    let vector_store = match VectorStore::new() {
        Ok(vs) => vs,
        Err(e) => return Ok(IndexResult {
            document_id,
            chunks_created: 0,
            success: false,
            error: Some(format!("Failed to open vector store: {}", e)),
        }),
    };
    
    // Remove existing chunks for this document
    let _ = vector_store.remove_document(&document_id);
    
    // Chunk the document (512 tokens per chunk, 50 token overlap)
    let text_chunks = pipeline.chunk_text(&content, 512, 50);
    
    let mut chunks_created = 0;
    
    for (index, text_chunk) in text_chunks.iter().enumerate() {
        // Generate embedding
        let embedding = match embedding_service.embed(&text_chunk.text).await {
            Ok(e) => e,
            Err(_) => continue, // Skip failed embeddings
        };
        
        let chunk = DocumentChunk {
            id: text_chunk.id.clone(),
            document_id: document_id.clone(),
            document_name: document_name.clone(),
            content: text_chunk.text.clone(),
            embedding,
            chunk_index: index as i32,
            token_count: text_chunk.token_count as i32,
        };
        
        if vector_store.store_chunk(&chunk).is_ok() {
            chunks_created += 1;
        }
    }
    
    Ok(IndexResult {
        document_id,
        chunks_created,
        success: chunks_created > 0,
        error: None,
    })
}

/// Search indexed documents for relevant context
#[tauri::command]
pub async fn semantic_search(
    query: String,
    provider: String,
    api_key: String,
    top_k: Option<usize>,
) -> Result<Vec<SemanticSearchResult>> {
    use crate::services::embedding::EmbeddingService;
    use crate::services::vector_store::VectorStore;
    
    let k = top_k.unwrap_or(5);
    
    // Initialize services
    let embedding_service = EmbeddingService::new(&provider, &api_key, None);
    let vector_store = VectorStore::new()?;
    
    // Embed the query
    let query_embedding = embedding_service.embed(&query).await?;
    
    // Search for similar chunks
    let results = vector_store.search(&query_embedding, k)?;
    
    Ok(results.into_iter().map(|r| SemanticSearchResult {
        document_name: r.chunk.document_name,
        content: r.chunk.content,
        score: r.score,
        chunk_index: r.chunk.chunk_index,
    }).collect())
}

/// Get relevant context for a chat query using semantic search
#[tauri::command]
pub async fn get_relevant_context(
    query: String,
    provider: String,
    api_key: String,
    max_tokens: Option<usize>,
) -> Result<String> {
    let max = max_tokens.unwrap_or(4000);
    
    // Get top relevant chunks
    let results = semantic_search(query, provider, api_key, Some(10)).await?;
    
    if results.is_empty() {
        return Ok(String::new());
    }
    
    // Build context from top results, respecting token limit
    let mut context = String::from("Relevant document context:\n\n");
    let mut total_tokens = 0;
    
    for (i, result) in results.iter().enumerate() {
        let chunk_header = format!("--- {} (relevance: {:.2}) ---\n", result.document_name, result.score);
        let chunk_tokens = result.content.len() / 4; // rough estimate
        
        if total_tokens + chunk_tokens > max {
            break;
        }
        
        context.push_str(&chunk_header);
        context.push_str(&result.content);
        context.push_str("\n\n");
        total_tokens += chunk_tokens;
        
        // Only include high-relevance results (score > 0.5)
        if result.score < 0.5 && i > 2 {
            break;
        }
    }
    
    Ok(context)
}

/// Clear all indexed documents
#[tauri::command]
pub async fn clear_index() -> Result<()> {
    use directories::ProjectDirs;

    if let Some(proj_dirs) = ProjectDirs::from("com", "omnirecall", "OmniRecall") {
        let db_path = proj_dirs.data_dir().join("vectors.db");
        if db_path.exists() {
            std::fs::remove_file(db_path)?;
        }
    }

    Ok(())
}

/// Get index statistics
#[tauri::command]
pub async fn get_index_stats() -> Result<serde_json::Value> {
    use crate::services::vector_store::VectorStore;
    
    match VectorStore::new() {
        Ok(vs) => {
            let chunk_count = vs.get_chunk_count().unwrap_or(0);
            Ok(serde_json::json!({
                "chunk_count": chunk_count,
                "indexed": chunk_count > 0,
            }))
        }
        Err(_) => Ok(serde_json::json!({
            "chunk_count": 0,
            "indexed": false,
        }))
    }
}
