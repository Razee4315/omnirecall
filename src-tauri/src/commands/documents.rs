use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::SystemTime;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};
use crate::services::document_pipeline::DocumentPipeline;
use crate::services::embedding::{EmbeddingService, EMBEDDING_MODEL};
use crate::services::vector_store::{DocumentChunk, VectorStore};

/// Maximum file size we'll attempt to read (50 MB). Beyond this we refuse
/// rather than risk OOM or extreme parse latency for poorly-formed input.
const MAX_DOCUMENT_BYTES: u64 = 50 * 1024 * 1024;
/// The single source of truth for which file types can be added as
/// documents. The frontend asks for this list (file picker filter, drag-drop
/// filter) instead of keeping its own copy.
const ALLOWED_EXTENSIONS: &[&str] = &[
    "pdf", "txt", "md", "rst", "html", "htm",
    "py", "js", "ts", "tsx", "jsx", "rs", "java", "cpp", "c", "h", "hpp",
    "go", "rb", "php", "swift", "kt", "cs", "json", "yaml", "yml", "toml",
    "xml", "csv", "sh", "ps1", "sql", "log", "conf", "ini", "env",
];

/// Up to this many characters of document text are sent verbatim.
const FULL_CONTEXT_CHARS: usize = 12_000;
/// Larger corpora use semantic retrieval with this token budget.
const SEMANTIC_CONTEXT_TOKENS: usize = 4_000;
/// When retrieval isn't available (nothing indexed, no embedding key) the
/// documents are truncated to this many characters in total instead of
/// sending everything on every message.
const FALLBACK_CONTEXT_CHARS: usize = 48_000;

/// A document as the frontend knows it.
#[derive(Debug, Clone, Deserialize)]
pub struct DocumentRef {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ContextMode {
    /// No usable document text.
    None,
    /// Every document is sent in full.
    Full,
    /// The most relevant indexed excerpts are sent.
    Semantic,
    /// Documents are too large and not indexed; a truncated prefix is sent.
    Truncated,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentStatus {
    pub id: String,
    /// Extracted characters; 0 when the document could not be read.
    pub chars: usize,
    pub error: Option<String>,
    pub indexed_chunks: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentsStatus {
    pub documents: Vec<DocumentStatus>,
    pub context_mode: ContextMode,
    /// Estimated tokens the documents add to each message.
    pub context_tokens: usize,
}

/// Document context prepared for one chat message.
pub struct ContextBundle {
    pub text: Option<String>,
    /// Names of the documents the context was drawn from.
    pub sources: Vec<String>,
    pub mode: ContextMode,
}

fn is_allowed_extension(ext: &str) -> bool {
    ALLOWED_EXTENSIONS.iter().any(|allowed| allowed.eq_ignore_ascii_case(ext))
}

#[tauri::command]
pub fn get_supported_extensions() -> Vec<&'static str> {
    ALLOWED_EXTENSIONS.to_vec()
}

type CachedText = (SystemTime, u64, Arc<String>);

/// Extracted text keyed by path, invalidated when the file's size or
/// modification time changes. Avoids re-parsing PDFs on every message while
/// still picking up edits made on disk.
fn text_cache() -> &'static Mutex<HashMap<String, CachedText>> {
    static CACHE: OnceLock<Mutex<HashMap<String, CachedText>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn clear_text_cache() {
    if let Ok(mut cache) = text_cache().lock() {
        cache.clear();
    }
}

/// Read and extract a document's full text. The blocking fs read + PDF parse
/// run off the async runtime via spawn_blocking so they don't stall other
/// commands.
pub async fn load_document_text(file_path: &str) -> Result<Arc<String>> {
    let file_path = file_path.to_string();
    tauri::async_runtime::spawn_blocking(move || read_document_blocking(&file_path))
        .await
        .map_err(|e| AppError::File(format!("Document read task failed: {}", e)))?
}

fn read_document_blocking(file_path: &str) -> Result<Arc<String>> {
    // Reject obvious traversal patterns. We cannot meaningfully sandbox the
    // filesystem here (the user's own dialog picks arbitrary absolute paths)
    // but we can still refuse paths whose components include `..`.
    if file_path.split(['/', '\\']).any(|s| s == "..") {
        return Err(AppError::File("Path traversal patterns are not allowed".to_string()));
    }

    let path = Path::new(file_path);
    if !path.exists() {
        return Err(AppError::File("File not found (moved or deleted?)".to_string()));
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

    let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
    if let Ok(cache) = text_cache().lock() {
        if let Some((cached_modified, cached_len, text)) = cache.get(file_path) {
            if *cached_modified == modified && *cached_len == metadata.len() {
                return Ok(Arc::clone(text));
            }
        }
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !is_allowed_extension(&extension) {
        return Err(AppError::File(format!("Unsupported file type: .{}", extension)));
    }

    let text = match extension.as_str() {
        "pdf" => {
            let text = extract_pdf_text(path)?;
            if text.trim().is_empty() {
                return Err(AppError::File(
                    "No extractable text (scanned or image-only PDF?)".to_string(),
                ));
            }
            text
        }
        "html" | "htm" => {
            let html = fs::read_to_string(path).map_err(|e| AppError::File(e.to_string()))?;
            strip_html_tags(&html)
        }
        _ => {
            // Text-based formats. Use lossy UTF-8 for files with mixed
            // encodings (e.g. log files) so we still surface readable text.
            let bytes = fs::read(path).map_err(|e| AppError::File(e.to_string()))?;
            match String::from_utf8(bytes) {
                Ok(text) => text,
                Err(err) => String::from_utf8_lossy(err.as_bytes()).into_owned(),
            }
        }
    };

    let text = Arc::new(text);
    if let Ok(mut cache) = text_cache().lock() {
        cache.insert(file_path.to_string(), (modified, metadata.len(), Arc::clone(&text)));
    }
    Ok(text)
}

fn extract_pdf_text(path: &Path) -> Result<String> {
    pdf_extract::extract_text(path)
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
            let remaining: String =
                chars_lower.get(i..).unwrap_or_default().iter().take(8).collect();
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

fn truncate_chars(text: &str, max_chars: usize) -> &str {
    match text.char_indices().nth(max_chars) {
        Some((byte_idx, _)) => &text[..byte_idx],
        None => text,
    }
}

fn estimate_tokens(chars: usize) -> usize {
    chars.div_ceil(4)
}

/// Decide how a set of documents will be presented to the model.
fn choose_mode(total_chars: usize, any_indexed: bool, has_embedding_key: bool) -> ContextMode {
    if total_chars == 0 {
        ContextMode::None
    } else if total_chars <= FULL_CONTEXT_CHARS {
        ContextMode::Full
    } else if any_indexed && has_embedding_key {
        ContextMode::Semantic
    } else {
        ContextMode::Truncated
    }
}

fn estimate_context_tokens(mode: ContextMode, total_chars: usize) -> usize {
    match mode {
        ContextMode::None => 0,
        ContextMode::Full => estimate_tokens(total_chars),
        ContextMode::Semantic => SEMANTIC_CONTEXT_TOKENS,
        ContextMode::Truncated => estimate_tokens(total_chars.min(FALLBACK_CONTEXT_CHARS)),
    }
}

fn format_full_context(docs: &[(String, Arc<String>)], budget_chars: Option<usize>) -> String {
    // With a budget, every document gets an equal share so one large file
    // can't crowd out the rest.
    let per_doc = budget_chars.map(|budget| budget / docs.len().max(1));
    let mut context = String::new();
    for (name, text) in docs {
        context.push_str(&format!("--- Document: {} ---\n", name));
        match per_doc {
            Some(limit) if text.chars().count() > limit => {
                context.push_str(truncate_chars(text, limit));
                context.push_str("\n[Document truncated]\n\n");
            }
            _ => {
                context.push_str(text);
                context.push_str("\n\n");
            }
        }
    }
    context
}

fn indexed_counts() -> HashMap<String, i64> {
    VectorStore::new()
        .and_then(|store| store.chunk_counts(EMBEDDING_MODEL))
        .unwrap_or_default()
}

async fn load_all(documents: &[DocumentRef]) -> Vec<(DocumentRef, Result<Arc<String>>)> {
    let mut loaded = Vec::with_capacity(documents.len());
    for doc in documents {
        let text = load_document_text(&doc.path).await;
        loaded.push((doc.clone(), text));
    }
    loaded
}

/// Per-document load/index state plus how the set will be sent to the model.
#[tauri::command]
pub async fn get_documents_status(
    documents: Vec<DocumentRef>,
    has_embedding_key: bool,
) -> Result<DocumentsStatus> {
    let counts = indexed_counts();
    let mut statuses = Vec::with_capacity(documents.len());
    let mut total_chars = 0;
    let mut any_indexed = false;

    for (doc, text) in load_all(&documents).await {
        let indexed_chunks = counts.get(&doc.id).copied().unwrap_or(0);
        let (chars, error) = match text {
            Ok(text) => (text.chars().count(), None),
            Err(err) => (0, Some(err.to_string())),
        };
        if chars > 0 && indexed_chunks > 0 {
            any_indexed = true;
        }
        total_chars += chars;
        statuses.push(DocumentStatus { id: doc.id, chars, error, indexed_chunks });
    }

    let context_mode = choose_mode(total_chars, any_indexed, has_embedding_key);
    Ok(DocumentsStatus {
        documents: statuses,
        context_mode,
        context_tokens: estimate_context_tokens(context_mode, total_chars),
    })
}

/// Build the document context for one chat message. Small corpora are sent in
/// full; large ones use the most relevant indexed excerpts, restricted to the
/// documents currently attached; anything else is truncated to a fixed budget.
pub async fn build_context(
    documents: &[DocumentRef],
    query: &str,
    embedding_key: Option<&str>,
) -> ContextBundle {
    let readable: Vec<(DocumentRef, Arc<String>)> = load_all(documents)
        .await
        .into_iter()
        .filter_map(|(doc, text)| text.ok().map(|text| (doc, text)))
        .filter(|(_, text)| !text.is_empty())
        .collect();

    let total_chars: usize = readable.iter().map(|(_, text)| text.chars().count()).sum();
    let embedding_key = embedding_key.map(str::trim).filter(|key| !key.is_empty());
    let counts = if total_chars > FULL_CONTEXT_CHARS { indexed_counts() } else { HashMap::new() };
    let any_indexed = readable.iter().any(|(doc, _)| counts.get(&doc.id).copied().unwrap_or(0) > 0);
    let mode = choose_mode(total_chars, any_indexed, embedding_key.is_some());

    let named: Vec<(String, Arc<String>)> =
        readable.iter().map(|(doc, text)| (doc.name.clone(), Arc::clone(text))).collect();
    let all_sources: Vec<String> = named.iter().map(|(name, _)| name.clone()).collect();

    match mode {
        ContextMode::None => ContextBundle { text: None, sources: Vec::new(), mode },
        ContextMode::Full => ContextBundle {
            text: Some(format_full_context(&named, None)),
            sources: all_sources,
            mode,
        },
        ContextMode::Semantic => {
            let ids: Vec<String> = readable.iter().map(|(doc, _)| doc.id.clone()).collect();
            let key = embedding_key.unwrap_or_default();
            match relevant_excerpts(query, key, &ids).await {
                Ok((text, sources)) if !sources.is_empty() => {
                    ContextBundle { text: Some(text), sources, mode }
                }
                // Retrieval failed or found nothing: fall back to a bounded
                // prefix rather than silently answering without documents.
                _ => ContextBundle {
                    text: Some(format_full_context(&named, Some(FALLBACK_CONTEXT_CHARS))),
                    sources: all_sources,
                    mode: ContextMode::Truncated,
                },
            }
        }
        ContextMode::Truncated => ContextBundle {
            text: Some(format_full_context(&named, Some(FALLBACK_CONTEXT_CHARS))),
            sources: all_sources,
            mode,
        },
    }
}

async fn relevant_excerpts(
    query: &str,
    api_key: &str,
    document_ids: &[String],
) -> Result<(String, Vec<String>)> {
    let query_embedding = EmbeddingService::new(api_key).embed(query).await?;
    let results = VectorStore::new()?.search(&query_embedding, 10, EMBEDDING_MODEL, document_ids)?;

    let mut context = String::new();
    let mut sources = BTreeSet::new();
    let mut total_tokens = 0;

    for (i, result) in results.iter().enumerate() {
        // After the top three, stop at the first weak match.
        if i > 2 && result.score < 0.5 {
            break;
        }
        let chunk_tokens = estimate_tokens(result.content.chars().count());
        if total_tokens + chunk_tokens > SEMANTIC_CONTEXT_TOKENS {
            break;
        }
        context.push_str(&format!("--- Excerpt from: {} ---\n", result.document_name));
        context.push_str(&result.content);
        context.push_str("\n\n");
        total_tokens += chunk_tokens;
        sources.insert(result.document_name.clone());
    }

    Ok((context, sources.into_iter().collect()))
}

// ============= RAG Commands =============

#[derive(Debug, Serialize)]
pub struct SemanticSearchResult {
    pub document_name: String,
    pub content: String,
    pub score: f32,
    pub chunk_index: i32,
}

/// Index a document for semantic search. Returns the number of chunks stored.
#[tauri::command]
pub async fn index_document(
    document_id: String,
    document_name: String,
    file_path: String,
    api_key: String,
) -> Result<usize> {
    let content = load_document_text(&file_path).await?;

    // Chunk the document (512 tokens per chunk, 50 token overlap)
    let text_chunks = DocumentPipeline::new().chunk_text(&content, 512, 50);
    if text_chunks.is_empty() {
        return Err(AppError::File("Document has no text to index".to_string()));
    }

    let texts: Vec<String> = text_chunks.iter().map(|chunk| chunk.text.clone()).collect();
    let embeddings = EmbeddingService::new(&api_key).embed_batch(&texts).await?;

    let chunks: Vec<DocumentChunk> = text_chunks
        .into_iter()
        .zip(embeddings)
        .enumerate()
        .map(|(index, (chunk, embedding))| DocumentChunk {
            id: chunk.id,
            document_name: document_name.clone(),
            content: chunk.text,
            embedding,
            chunk_index: index as i32,
            token_count: chunk.token_count as i32,
        })
        .collect();

    VectorStore::new()?.replace_document(&document_id, EMBEDDING_MODEL, &chunks)?;
    Ok(chunks.len())
}

/// Remove a document's chunks from the index (called when the document is
/// removed from the app so it can no longer be retrieved).
#[tauri::command]
pub async fn remove_document_index(document_id: String) -> Result<()> {
    VectorStore::new()?.remove_document(&document_id)
}

/// Search the given indexed documents for relevant chunks.
#[tauri::command]
pub async fn semantic_search(
    query: String,
    api_key: String,
    document_ids: Vec<String>,
    top_k: Option<usize>,
) -> Result<Vec<SemanticSearchResult>> {
    let query_embedding = EmbeddingService::new(&api_key).embed(&query).await?;
    let results = VectorStore::new()?.search(
        &query_embedding,
        top_k.unwrap_or(5),
        EMBEDDING_MODEL,
        &document_ids,
    )?;

    Ok(results
        .into_iter()
        .map(|r| SemanticSearchResult {
            document_name: r.document_name,
            content: r.content,
            score: r.score,
            chunk_index: r.chunk_index,
        })
        .collect())
}

/// Delete the vector database, including SQLite's WAL side files.
pub fn delete_index_files() -> Result<()> {
    let db_path = VectorStore::db_path()?;
    for suffix in ["", "-wal", "-shm"] {
        let mut file = db_path.clone().into_os_string();
        file.push(suffix);
        let file = Path::new(&file);
        if file.exists() {
            fs::remove_file(file)?;
        }
    }
    Ok(())
}

/// Clear all indexed documents
#[tauri::command]
pub async fn clear_index() -> Result<()> {
    delete_index_files()
}

/// Get index statistics
#[tauri::command]
pub async fn get_index_stats() -> Result<serde_json::Value> {
    let chunk_count = VectorStore::new()
        .and_then(|store| store.get_chunk_count())
        .unwrap_or(0);
    Ok(serde_json::json!({
        "chunk_count": chunk_count,
        "indexed": chunk_count > 0,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mode_selection() {
        assert_eq!(choose_mode(0, false, true), ContextMode::None);
        assert_eq!(choose_mode(FULL_CONTEXT_CHARS, false, false), ContextMode::Full);
        assert_eq!(choose_mode(FULL_CONTEXT_CHARS + 1, true, true), ContextMode::Semantic);
        // Indexed but no key to embed the query, or key but nothing indexed.
        assert_eq!(choose_mode(FULL_CONTEXT_CHARS + 1, true, false), ContextMode::Truncated);
        assert_eq!(choose_mode(FULL_CONTEXT_CHARS + 1, false, true), ContextMode::Truncated);
    }

    #[test]
    fn context_token_estimates_are_bounded() {
        assert_eq!(estimate_context_tokens(ContextMode::Full, 400), 100);
        assert_eq!(estimate_context_tokens(ContextMode::Semantic, 9_000_000), SEMANTIC_CONTEXT_TOKENS);
        assert_eq!(
            estimate_context_tokens(ContextMode::Truncated, 9_000_000),
            FALLBACK_CONTEXT_CHARS / 4
        );
    }

    #[test]
    fn truncated_context_splits_the_budget() {
        let docs = vec![
            ("a.txt".to_string(), Arc::new("x".repeat(100))),
            ("b.txt".to_string(), Arc::new("short".to_string())),
        ];
        let context = format_full_context(&docs, Some(40));
        assert!(context.contains(&"x".repeat(20)));
        assert!(!context.contains(&"x".repeat(21)));
        assert!(context.contains("[Document truncated]"));
        assert!(context.contains("short"));
    }

    #[test]
    fn truncate_respects_char_boundaries() {
        assert_eq!(truncate_chars("日本語", 2), "日本");
        assert_eq!(truncate_chars("abc", 10), "abc");
    }

    #[test]
    fn extension_allow_list() {
        assert!(is_allowed_extension("PDF"));
        assert!(!is_allowed_extension("docx"));
        assert!(!is_allowed_extension("exe"));
    }

    #[test]
    fn html_is_reduced_to_text() {
        let html = "<html><style>p{}</style><body><p>Hello</p><script>x()</script></body></html>";
        assert_eq!(strip_html_tags(html), "Hello");
    }
}
