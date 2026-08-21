/// Recursive text chunker for RAG pipeline.
/// Splits large text into semantically cohesive chunks respecting natural boundaries.

pub struct DocumentChunker {
    pub chunk_size: usize,
    pub chunk_overlap: usize,
}

impl Default for DocumentChunker {
    fn default() -> Self {
        Self {
            chunk_size: 1800, // ~450-550 tokens
            chunk_overlap: 200, // ~50-70 tokens
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
        if separators.is_empty() {
            // Hard fallback: split by characters if no separator can reduce chunk size
            return self.split_by_chars(text);
        }

        let sep = separators[0];
        let remaining_seps = &separators[1..];

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
                    // Keep overlap if possible
                    let overlap_text = self.get_overlap_tail(&current_chunk);
                    current_chunk = overlap_text;
                }

                if part.chars().count() > self.chunk_size {
                    // Part itself is too large, recurse with deeper separators
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
        // Try to break at a word boundary
        if let Some(space_idx) = tail_chars.find(' ') {
            tail_chars[space_idx + 1..].to_string()
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
            let chunk: String = chars[i..end].iter().collect();
            chunks.push(chunk);

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
        assert_eq!(chunker.split_text("Short text").len(), 1);
    }

    #[test]
    fn test_recursive_split() {
        let chunker = DocumentChunker::new(50, 10);
        let text = "Paragraph one with some text.\n\nParagraph two with some more text that exceeds limit.\n\nParagraph three.";
        let chunks = chunker.split_text(text);
        assert!(chunks.len() >= 3);
        for chunk in &chunks {
            assert!(chunk.chars().count() <= 60); // within tolerance
        }
    }
}
