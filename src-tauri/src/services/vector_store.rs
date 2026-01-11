use rusqlite::{Connection, params};
use crate::error::{AppError, Result};
use std::path::PathBuf;
use directories::ProjectDirs;

/// A document chunk with embedding for semantic search
#[derive(Debug, Clone)]
pub struct DocumentChunk {
    pub id: String,
    pub document_id: String,
    pub document_name: String,
    pub content: String,
    pub embedding: Vec<f32>,
    pub chunk_index: i32,
    pub token_count: i32,
}

/// Search result with relevance score
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub chunk: DocumentChunk,
    pub score: f32,
}

/// Local vector store using SQLite with cosine similarity
pub struct VectorStore {
    conn: Connection,
}

impl VectorStore {
    /// Create or open the vector store database
    pub fn new() -> Result<Self> {
        let db_path = Self::get_db_path()?;
        
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        let conn = Connection::open(&db_path)
            .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
        
        // Initialize schema
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
            
            CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
            CREATE INDEX IF NOT EXISTS idx_chunks_document_name ON chunks(document_name);"
        ).map_err(|e| AppError::Database(format!("Failed to create schema: {}", e)))?;
        
        Ok(Self { conn })
    }
    
    fn get_db_path() -> Result<PathBuf> {
        let proj_dirs = ProjectDirs::from("com", "omnirecall", "OmniRecall")
            .ok_or_else(|| AppError::Config("Could not determine config directory".to_string()))?;
        
        Ok(proj_dirs.data_dir().join("vectors.db"))
    }
    
    /// Store a document chunk with its embedding
    pub fn store_chunk(&self, chunk: &DocumentChunk) -> Result<()> {
        let embedding_bytes = Self::embedding_to_bytes(&chunk.embedding);
        
        self.conn.execute(
            "INSERT OR REPLACE INTO chunks (id, document_id, document_name, content, embedding, chunk_index, token_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                chunk.id,
                chunk.document_id,
                chunk.document_name,
                chunk.content,
                embedding_bytes,
                chunk.chunk_index,
                chunk.token_count,
            ],
        ).map_err(|e| AppError::Database(format!("Failed to store chunk: {}", e)))?;
        
        Ok(())
    }
    
    /// Remove all chunks for a document
    pub fn remove_document(&self, document_id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM chunks WHERE document_id = ?1",
            params![document_id],
        ).map_err(|e| AppError::Database(format!("Failed to remove document: {}", e)))?;
        
        Ok(())
    }
    
    /// Search for similar chunks using cosine similarity
    pub fn search(&self, query_embedding: &[f32], top_k: usize) -> Result<Vec<SearchResult>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, document_id, document_name, content, embedding, chunk_index, token_count FROM chunks"
        ).map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
        
        let chunks = stmt.query_map([], |row| {
            let embedding_bytes: Vec<u8> = row.get(4)?;
            let embedding = Self::bytes_to_embedding(&embedding_bytes);
            
            Ok(DocumentChunk {
                id: row.get(0)?,
                document_id: row.get(1)?,
                document_name: row.get(2)?,
                content: row.get(3)?,
                embedding,
                chunk_index: row.get(5)?,
                token_count: row.get(6)?,
            })
        }).map_err(|e| AppError::Database(format!("Failed to query chunks: {}", e)))?;
        
        // Calculate cosine similarity for each chunk
        let mut results: Vec<SearchResult> = chunks
            .filter_map(|c| c.ok())
            .map(|chunk| {
                let score = Self::cosine_similarity(query_embedding, &chunk.embedding);
                SearchResult { chunk, score }
            })
            .collect();
        
        // Sort by score descending and take top_k
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(top_k);
        
        Ok(results)
    }
    
    /// Get all chunks for a document
    pub fn get_document_chunks(&self, document_id: &str) -> Result<Vec<DocumentChunk>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, document_id, document_name, content, embedding, chunk_index, token_count 
             FROM chunks WHERE document_id = ?1 ORDER BY chunk_index"
        ).map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
        
        let chunks = stmt.query_map(params![document_id], |row| {
            let embedding_bytes: Vec<u8> = row.get(4)?;
            let embedding = Self::bytes_to_embedding(&embedding_bytes);
            
            Ok(DocumentChunk {
                id: row.get(0)?,
                document_id: row.get(1)?,
                document_name: row.get(2)?,
                content: row.get(3)?,
                embedding,
                chunk_index: row.get(5)?,
                token_count: row.get(6)?,
            })
        }).map_err(|e| AppError::Database(format!("Failed to query chunks: {}", e)))?;
        
        Ok(chunks.filter_map(|c| c.ok()).collect())
    }
    
    /// Check if a document is already indexed
    pub fn document_exists(&self, document_id: &str) -> Result<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM chunks WHERE document_id = ?1",
            params![document_id],
            |row| row.get(0),
        ).map_err(|e| AppError::Database(format!("Failed to check document: {}", e)))?;
        
        Ok(count > 0)
    }
    
    /// Get chunk count for stats
    pub fn get_chunk_count(&self) -> Result<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM chunks",
            [],
            |row| row.get(0),
        ).map_err(|e| AppError::Database(format!("Failed to count chunks: {}", e)))?;
        
        Ok(count)
    }
    
    // Utility: Convert embedding to bytes for storage
    fn embedding_to_bytes(embedding: &[f32]) -> Vec<u8> {
        embedding.iter()
            .flat_map(|f| f.to_le_bytes())
            .collect()
    }
    
    // Utility: Convert bytes back to embedding
    fn bytes_to_embedding(bytes: &[u8]) -> Vec<f32> {
        bytes.chunks(4)
            .map(|chunk| {
                let arr: [u8; 4] = chunk.try_into().unwrap_or([0, 0, 0, 0]);
                f32::from_le_bytes(arr)
            })
            .collect()
    }
    
    // Cosine similarity between two vectors
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
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        assert!((VectorStore::cosine_similarity(&a, &b) - 1.0).abs() < 0.001);
        
        let c = vec![0.0, 1.0, 0.0];
        assert!((VectorStore::cosine_similarity(&a, &c) - 0.0).abs() < 0.001);
    }
}
