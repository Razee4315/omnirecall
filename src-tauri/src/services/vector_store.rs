use std::collections::HashMap;
use std::path::{Path, PathBuf};

use directories::ProjectDirs;
use rusqlite::{params, params_from_iter, Connection};

use crate::error::{AppError, Result};

/// A document chunk with embedding for semantic search
#[derive(Debug, Clone)]
pub struct DocumentChunk {
    pub id: String,
    pub document_name: String,
    pub content: String,
    pub embedding: Vec<f32>,
    pub chunk_index: i32,
    pub token_count: i32,
}

/// Search result with relevance score
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub document_name: String,
    pub content: String,
    pub chunk_index: i32,
    pub score: f32,
}

/// Local vector store using SQLite with cosine similarity
pub struct VectorStore {
    conn: Connection,
}

fn db_err(context: &str) -> impl Fn(rusqlite::Error) -> AppError + '_ {
    move |err| AppError::Database(format!("{context}: {err}"))
}

impl VectorStore {
    /// Create or open the vector store database
    pub fn new() -> Result<Self> {
        let db_path = Self::db_path()?;
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        Self::open(&db_path)
    }

    pub fn db_path() -> Result<PathBuf> {
        let proj_dirs = ProjectDirs::from("com", "omnirecall", "OmniRecall")
            .ok_or_else(|| AppError::Config("Could not determine config directory".to_string()))?;
        Ok(proj_dirs.data_dir().join("vectors.db"))
    }

    fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path).map_err(db_err("Failed to open database"))?;
        // WAL allows concurrent readers while a writer is active and survives
        // the fresh-connection-per-command pattern; busy_timeout avoids
        // "database is locked" errors when indexing and searching overlap.
        let _ = conn.pragma_update(None, "journal_mode", "WAL");
        let _ = conn.pragma_update(None, "busy_timeout", 5000);
        Self::init(conn)
    }

    #[cfg(test)]
    fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory().map_err(db_err("Failed to open database"))?;
        Self::init(conn)
    }

    fn init(conn: Connection) -> Result<Self> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                document_name TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB NOT NULL,
                chunk_index INTEGER NOT NULL,
                token_count INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);",
        )
        .map_err(db_err("Failed to create schema"))?;

        // Additive migration: record which embedding model produced each
        // vector so vectors from different models are never compared. Rows
        // written before this column existed came from text-embedding-004.
        let has_model_column = conn.prepare("SELECT model FROM chunks LIMIT 1").is_ok();
        if !has_model_column {
            conn.execute(
                "ALTER TABLE chunks ADD COLUMN model TEXT NOT NULL DEFAULT 'text-embedding-004'",
                [],
            )
            .map_err(db_err("Failed to migrate schema"))?;
        }

        Ok(Self { conn })
    }

    /// Replace every chunk of a document in one transaction.
    pub fn replace_document(
        &mut self,
        document_id: &str,
        model: &str,
        chunks: &[DocumentChunk],
    ) -> Result<()> {
        let tx = self.conn.transaction().map_err(db_err("Failed to start transaction"))?;
        tx.execute("DELETE FROM chunks WHERE document_id = ?1", params![document_id])
            .map_err(db_err("Failed to remove document"))?;
        for chunk in chunks {
            tx.execute(
                "INSERT INTO chunks (id, document_id, document_name, content, embedding, chunk_index, token_count, model)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    chunk.id,
                    document_id,
                    chunk.document_name,
                    chunk.content,
                    embedding_to_bytes(&chunk.embedding),
                    chunk.chunk_index,
                    chunk.token_count,
                    model,
                ],
            )
            .map_err(db_err("Failed to store chunk"))?;
        }
        tx.commit().map_err(db_err("Failed to commit chunks"))
    }

    /// Remove all chunks for a document
    pub fn remove_document(&self, document_id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM chunks WHERE document_id = ?1", params![document_id])
            .map_err(db_err("Failed to remove document"))?;
        Ok(())
    }

    /// Find the chunks most similar to `query_embedding` among the given
    /// documents. Only vectors produced by `model` are considered.
    ///
    /// Scoring reads just ids and embeddings; chunk bodies are loaded for the
    /// winners only.
    pub fn search(
        &self,
        query_embedding: &[f32],
        top_k: usize,
        model: &str,
        document_ids: &[String],
    ) -> Result<Vec<SearchResult>> {
        if document_ids.is_empty() || top_k == 0 {
            return Ok(Vec::new());
        }

        let placeholders = vec!["?"; document_ids.len()].join(",");
        let sql = format!(
            "SELECT id, embedding FROM chunks WHERE model = ? AND document_id IN ({placeholders})"
        );
        let mut stmt = self.conn.prepare(&sql).map_err(db_err("Failed to prepare query"))?;
        let bind = std::iter::once(model.to_string()).chain(document_ids.iter().cloned());
        let rows = stmt
            .query_map(params_from_iter(bind), |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, Vec<u8>>(1)?))
            })
            .map_err(db_err("Failed to query chunks"))?;

        let mut scored: Vec<(String, f32)> = rows
            .filter_map(|row| row.ok())
            .map(|(id, bytes)| {
                let score = cosine_similarity(query_embedding, &bytes_to_embedding(&bytes));
                (id, score)
            })
            .collect();
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(top_k);

        let mut results = Vec::with_capacity(scored.len());
        for (id, score) in scored {
            let result = self
                .conn
                .query_row(
                    "SELECT document_name, content, chunk_index FROM chunks WHERE id = ?1",
                    params![id],
                    |row| {
                        Ok(SearchResult {
                            document_name: row.get(0)?,
                            content: row.get(1)?,
                            chunk_index: row.get(2)?,
                            score,
                        })
                    },
                )
                .map_err(db_err("Failed to load chunk"))?;
            results.push(result);
        }
        Ok(results)
    }

    /// Number of chunks per document id produced by `model`.
    pub fn chunk_counts(&self, model: &str) -> Result<HashMap<String, i64>> {
        let mut stmt = self
            .conn
            .prepare("SELECT document_id, COUNT(*) FROM chunks WHERE model = ?1 GROUP BY document_id")
            .map_err(db_err("Failed to prepare query"))?;
        let rows = stmt
            .query_map(params![model], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
            .map_err(db_err("Failed to count chunks"))?;
        Ok(rows.filter_map(|row| row.ok()).collect())
    }

    /// Get chunk count for stats
    pub fn get_chunk_count(&self) -> Result<i64> {
        self.conn
            .query_row("SELECT COUNT(*) FROM chunks", [], |row| row.get(0))
            .map_err(db_err("Failed to count chunks"))
    }
}

fn embedding_to_bytes(embedding: &[f32]) -> Vec<u8> {
    embedding.iter().flat_map(|f| f.to_le_bytes()).collect()
}

fn bytes_to_embedding(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot_product / (norm_a * norm_b)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn chunk(id: &str, name: &str, embedding: Vec<f32>) -> DocumentChunk {
        DocumentChunk {
            id: id.to_string(),
            document_name: name.to_string(),
            content: format!("content of {id}"),
            embedding,
            chunk_index: 0,
            token_count: 3,
        }
    }

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 0.001);

        let c = vec![0.0, 1.0, 0.0];
        assert!((cosine_similarity(&a, &c) - 0.0).abs() < 0.001);
    }

    #[test]
    fn embedding_round_trip() {
        let embedding = vec![0.25, -1.5, 3.0];
        assert_eq!(bytes_to_embedding(&embedding_to_bytes(&embedding)), embedding);
    }

    #[test]
    fn search_is_scoped_to_listed_documents_and_model() {
        let mut store = VectorStore::in_memory().unwrap();
        store.replace_document("a", "m1", &[chunk("a1", "a.txt", vec![1.0, 0.0])]).unwrap();
        store.replace_document("b", "m1", &[chunk("b1", "b.txt", vec![1.0, 0.0])]).unwrap();
        store.replace_document("c", "old", &[chunk("c1", "c.txt", vec![1.0, 0.0])]).unwrap();

        let ids = vec!["a".to_string(), "c".to_string()];
        let results = store.search(&[1.0, 0.0], 10, "m1", &ids).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].document_name, "a.txt");
        assert!(store.search(&[1.0, 0.0], 10, "m1", &[]).unwrap().is_empty());
    }

    #[test]
    fn removing_a_document_removes_its_chunks() {
        let mut store = VectorStore::in_memory().unwrap();
        store.replace_document("a", "m1", &[chunk("a1", "a.txt", vec![1.0])]).unwrap();
        assert_eq!(store.chunk_counts("m1").unwrap().get("a"), Some(&1));
        store.remove_document("a").unwrap();
        assert_eq!(store.get_chunk_count().unwrap(), 0);
    }

    #[test]
    fn replace_document_overwrites_previous_chunks() {
        let mut store = VectorStore::in_memory().unwrap();
        store.replace_document("a", "m1", &[chunk("a1", "a.txt", vec![1.0])]).unwrap();
        store
            .replace_document("a", "m1", &[chunk("a2", "a.txt", vec![1.0]), chunk("a3", "a.txt", vec![1.0])])
            .unwrap();
        assert_eq!(store.chunk_counts("m1").unwrap().get("a"), Some(&2));
    }
}
