/// Recursive text chunker for RAG pipeline.
/// Splits large text into semantically cohesive chunks respecting natural boundaries.
pub struct DocumentChunker {
    pub chunk_size: usize,
    pub chunk_overlap: usize,
}

impl Default for DocumentChunker {
    fn default() -> Self {
        Self {
            chunk_size: 900, // ~250-320 tokens (fits well within 512-token context windows)
            chunk_overlap: 120, // ~30-45 tokens
        }
    }
}

impl DocumentChunker {
    pub fn new(chunk_size: usize, chunk_overlap: usize) -> Self {
        Self {
            chunk_size,
            chunk_overlap,
        }
    }

    /// Splits text recursively using natural delimiters
    pub fn split_text(&self, text: &str) -> Vec<String> {
        let text = text.trim();
        if text.is_empty() {
            return Vec::new();
        }

        if text.chars().count() <= self.chunk_size {
            return vec![text.to_string()];
        }

        let separators = ["\n\n", "\r\n\r\n", "\n", "\r\n", ". ", "! ", "? ", "; ", " "];
        self.split_recursive(text, &separators)
    }

    fn split_recursive(&self, text: &str, separators: &[&str]) -> Vec<String> {
        let (sep, remaining_seps) = match separators.split_first() {
            Some((first, rest)) => (*first, rest),
            None => return self.split_by_chars(text),
        };

        let parts: Vec<&str> = text.split(sep).collect();
        let mut chunks: Vec<String> = Vec::new();
        let mut current_chunk = String::new();

        for part in parts {
            let part = part.trim();
            if part.is_empty() {
                continue;
            }

            let separator_to_add = if current_chunk.is_empty() { "" } else { sep };
            let candidate_len = current_chunk.chars().count() + separator_to_add.chars().count() + part.chars().count();

            if candidate_len <= self.chunk_size {
                current_chunk.push_str(separator_to_add);
                current_chunk.push_str(part);
            } else {
                if !current_chunk.is_empty() {
                    chunks.push(current_chunk.clone());
                    let overlap_text = self.get_overlap_tail(&current_chunk);
                    current_chunk = overlap_text;
                }

                if part.chars().count() > self.chunk_size {
                    let sub_chunks = self.split_recursive(part, remaining_seps);
                    for sub in sub_chunks {
                        if !sub.trim().is_empty() {
                            chunks.push(sub);
                        }
                    }
                } else {
                    let sep_to_use = if current_chunk.is_empty() { "" } else { sep };
                    current_chunk.push_str(sep_to_use);
                    current_chunk.push_str(part);
                }
            }
        }

        if !current_chunk.trim().is_empty() {
            chunks.push(current_chunk);
        }

        chunks
    }

    fn get_overlap_tail(&self, text: &str) -> String {
        let char_count = text.chars().count();
        if char_count <= self.chunk_overlap {
            return text.to_string();
        }

        let tail_chars: String = text.chars().skip(char_count - self.chunk_overlap).collect();
        if let Some((_, rest)) = tail_chars.split_once(' ') {
            rest.to_string()
        } else {
            tail_chars
        }
    }

    fn split_by_chars(&self, text: &str) -> Vec<String> {
        let mut chunks = Vec::new();
        let chars: Vec<char> = text.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            let end = (i + self.chunk_size).min(chars.len());
            if let Some(slice) = chars.get(i..end) {
                let chunk: String = slice.iter().collect();
                chunks.push(chunk);
            }

            if end == chars.len() {
                break;
            }
            i += self.chunk_size.saturating_sub(self.chunk_overlap).max(1);
        }

        chunks
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_and_small() {
        let chunker = DocumentChunker::new(100, 20);
        assert!(chunker.split_text("").is_empty());
        assert!(chunker.split_text("   ").is_empty());
        assert_eq!(chunker.split_text("Short text").len(), 1);
    }

    #[test]
    fn test_recursive_split() {
        let chunker = DocumentChunker::new(50, 10);
        let text = "Paragraph one with some text.\n\nParagraph two with some more text that exceeds limit.\n\nParagraph three.";
        let chunks = chunker.split_text(text);
        assert!(chunks.len() >= 3);
        for chunk in &chunks {
            assert!(chunk.chars().count() <= 60);
        }
    }

    #[test]
    fn test_overlap() {
        let chunker = DocumentChunker::new(40, 15);
        let text = "First sentence here. Second sentence goes here. Third sentence is very long.";
        let chunks = chunker.split_text(text);
        assert!(chunks.len() >= 2);
    }
}
