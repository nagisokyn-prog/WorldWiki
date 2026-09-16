use arch_guard_ports::VectorEmbedderPort;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub struct SemanticEmbedderAdapter {
    dimension: usize,
}

impl SemanticEmbedderAdapter {
    pub fn new(dimension: usize) -> Self {
        Self { dimension }
    }

    fn l2_normalize(vec: &mut [f32]) {
        let norm: f32 = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for val in vec.iter_mut() {
                *val /= norm;
            }
        }
    }

    fn hash_token(token: &str) -> u64 {
        let mut hasher = DefaultHasher::new();
        token.hash(&mut hasher);
        hasher.finish()
    }
}

impl Default for SemanticEmbedderAdapter {
    fn default() -> Self {
        Self::new(128)
    }
}

impl VectorEmbedderPort for SemanticEmbedderAdapter {
    fn dimension(&self) -> usize {
        self.dimension
    }

    fn embed_texts(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        let mut result = Vec::with_capacity(texts.len());

        for text in texts {
            let mut vector = vec![0.0f32; self.dimension];

            // Extract semantic tokens and subwords
            for word in text.split(|c: char| !c.is_alphanumeric() && c != '_' && c != '-') {
                let clean = word.trim().to_lowercase();
                if clean.is_empty() || clean.len() < 2 {
                    continue;
                }

                let hash = Self::hash_token(&clean);
                let idx = (hash as usize) % self.dimension;
                let sign = if (hash >> 32) % 2 == 0 { 1.0f32 } else { -1.0f32 };
                vector[idx] += sign;

                // N-gram features for code snippets (length 3..5)
                if clean.len() >= 3 {
                    for i in 0..=(clean.len() - 3) {
                        let ngram = &clean[i..i + 3];
                        let ngram_hash = Self::hash_token(ngram);
                        let ngram_idx = (ngram_hash as usize) % self.dimension;
                        vector[ngram_idx] += 0.5;
                    }
                }
            }

            // L2-normalization for Cosine distance compatibility
            Self::l2_normalize(&mut vector);
            result.push(vector);
        }

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_semantic_embedder_dimension_and_normalization() {
        let embedder = SemanticEmbedderAdapter::new(64);
        assert_eq!(embedder.dimension(), 64);

        let texts = vec![
            "Rule: ARCH-001 (v1.0)\nuse tauri::command;".to_string(),
            "Rule: CSS-004 (v1.0)\ncolor: #ff0000;".to_string(),
        ];

        let vectors = embedder.embed_texts(&texts).unwrap();
        assert_eq!(vectors.len(), 2);
        assert_eq!(vectors[0].len(), 64);

        // Check L2 normalization: norm should be ~ 1.0
        let norm0: f32 = vectors[0].iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm0 - 1.0).abs() < 1e-5);
    }

    #[test]
    fn test_semantic_embedder_default_and_zero_norm() {
        let embedder = SemanticEmbedderAdapter::default();
        assert_eq!(embedder.dimension(), 128);

        // Text with no valid tokens (only spaces or single punctuation)
        let texts = vec!["   ... ???   ".to_string()];
        let vectors = embedder.embed_texts(&texts).unwrap();
        assert_eq!(vectors.len(), 1);
        assert_eq!(vectors[0].len(), 128);
        assert_eq!(vectors[0][0], 0.0);
    }
}


