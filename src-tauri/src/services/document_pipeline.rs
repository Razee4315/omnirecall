use std::path::Path;
use crate::error::{AppError, Result};

pub struct DocumentPipeline;

#[derive(Debug, Clone)]
pub struct TextChunk {
    pub id: String,
    pub text: String,
    pub token_count: usize,
    pub page_number: Option<u32>,
    pub section_header: Option<String>,
}

impl DocumentPipeline {
    pub fn new() -> Self {
        Self
    }

    pub fn extract_text(&self, file_path: &Path) -> Result<String> {
        let extension = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "pdf" => self.extract_pdf(file_path),
            "txt" | "md" | "rst" => self.extract_text_file(file_path),
            "py" | "js" | "ts" | "rs" | "java" | "cpp" | "c" | "go" | "rb" => {
                self.extract_code_file(file_path)
            }
            "html" | "htm" => self.extract_html(file_path),
            _ => Err(AppError::File(format!(
                "Unsupported file type: {}",
                extension
            ))),
        }
    }

    fn extract_pdf(&self, file_path: &Path) -> Result<String> {
        let bytes = std::fs::read(file_path)?;
        pdf_extract::extract_text_from_mem(&bytes)
            .map_err(|e| AppError::File(format!("PDF extraction error: {}", e)))
    }

    fn extract_text_file(&self, file_path: &Path) -> Result<String> {
        std::fs::read_to_string(file_path).map_err(|e| AppError::File(e.to_string()))
    }

    fn extract_code_file(&self, file_path: &Path) -> Result<String> {
        let content = std::fs::read_to_string(file_path)?;
        let extension = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        
        // Add file metadata as header
        Ok(format!(
            "File: {}\nLanguage: {}\n\n{}",
            file_path.file_name().unwrap_or_default().to_string_lossy(),
            extension,
            content
        ))
    }

    fn extract_html(&self, file_path: &Path) -> Result<String> {
        let content = std::fs::read_to_string(file_path)?;
        // Simple HTML tag stripping (in production, use a proper HTML parser)
        let text = content
            .replace("<br>", "\n")
            .replace("<br/>", "\n")
            .replace("<p>", "\n")
            .replace("</p>", "\n");
        
        // Remove HTML tags
        let re = regex::Regex::new(r"<[^>]+>").unwrap_or_else(|_| regex::Regex::new("").unwrap());
        Ok(re.replace_all(&text, "").to_string())
    }

    pub fn chunk_text(&self, text: &str, chunk_size: usize, overlap: usize) -> Vec<TextChunk> {
        let mut chunks = Vec::new();
        let sentences = self.split_sentences(text);
        
        let mut current_chunk = String::new();
        let mut current_tokens = 0;
        
        for (i, sentence) in sentences.iter().enumerate() {
            let sentence_tokens = self.estimate_tokens(sentence);
            
            if current_tokens + sentence_tokens > chunk_size && !current_chunk.is_empty() {
                // Save current chunk
                chunks.push(TextChunk {
                    id: uuid::Uuid::new_v4().to_string(),
                    text: current_chunk.trim().to_string(),
                    token_count: current_tokens,
                    page_number: None,
                    section_header: None,
                });
                
                // Start new chunk with overlap
                current_chunk = String::new();
                current_tokens = 0;
                
                // Add overlap from previous sentences
                let overlap_start = if i >= overlap / 50 { i - overlap / 50 } else { 0 };
                for j in overlap_start..i {
                    current_chunk.push_str(&sentences[j]);
                    current_chunk.push(' ');
                    current_tokens += self.estimate_tokens(&sentences[j]);
                }
            }
            
            current_chunk.push_str(sentence);
            current_chunk.push(' ');
            current_tokens += sentence_tokens;
        }
        
        // Don't forget the last chunk
        if !current_chunk.trim().is_empty() {
            chunks.push(TextChunk {
                id: uuid::Uuid::new_v4().to_string(),
                text: current_chunk.trim().to_string(),
                token_count: current_tokens,
                page_number: None,
                section_header: None,
            });
        }
        
        chunks
    }

    fn split_sentences(&self, text: &str) -> Vec<String> {
        // Simple sentence splitting
        let mut sentences = Vec::new();
        let mut current = String::new();
        
        for c in text.chars() {
            current.push(c);
            if c == '.' || c == '!' || c == '?' || c == '\n' {
                if !current.trim().is_empty() {
                    sentences.push(current.trim().to_string());
                }
                current = String::new();
            }
        }
        
        if !current.trim().is_empty() {
            sentences.push(current.trim().to_string());
        }
        
        sentences
    }

    fn estimate_tokens(&self, text: &str) -> usize {
        // Rough estimate: ~4 characters per token for English
        (text.len() + 3) / 4
    }

    pub fn get_page_count(&self, file_path: &Path) -> Result<Option<u32>> {
        let extension = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if extension == "pdf" {
            // In production, use a proper PDF library to get page count
            Ok(Some(1))
        } else {
            Ok(None)
        }
    }
}

impl Default for DocumentPipeline {
    fn default() -> Self {
        Self::new()
    }
}
