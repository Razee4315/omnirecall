pub struct DocumentPipeline;

#[derive(Debug, Clone)]
pub struct TextChunk {
    pub id: String,
    pub text: String,
    pub token_count: usize,
}

impl DocumentPipeline {
    pub fn new() -> Self {
        Self
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
                });
                
                // Start new chunk with overlap
                current_chunk = String::new();
                current_tokens = 0;
                
                // Add overlap from previous sentences
                let overlap_start = i.saturating_sub(overlap / 50);
                for sentence_item in sentences.iter().take(i).skip(overlap_start) {
                    current_chunk.push_str(sentence_item);
                    current_chunk.push(' ');
                    current_tokens += self.estimate_tokens(sentence_item);
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
        text.len().div_ceil(4)
    }

}

impl Default for DocumentPipeline {
    fn default() -> Self {
        Self::new()
    }
}
