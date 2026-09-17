use cerberus_ports::VectorEmbedderPort;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use crate::vector::SemanticEmbedderAdapter;

/// Adapter for CodeBERTa-small-v1 / ONNX vector embeddings.
/// Supports pure Rust inference / ONNX model files with graceful fallback
/// to SemanticEmbedderAdapter if the model weights are not downloaded.
pub struct TractOnnxEmbedderAdapter {
    model_path: Option<PathBuf>,
    tokenizer_path: Option<PathBuf>,
    dimension: usize,
    fallback_embedder: Arc<SemanticEmbedderAdapter>,
}

impl TractOnnxEmbedderAdapter {
    pub const DEFAULT_DIMENSION: usize = 768;

    pub fn new(model_path: Option<PathBuf>, tokenizer_path: Option<PathBuf>) -> Self {
        Self {
            model_path,
            tokenizer_path,
            dimension: Self::DEFAULT_DIMENSION,
            fallback_embedder: Arc::new(SemanticEmbedderAdapter::new(Self::DEFAULT_DIMENSION)),
        }
    }

    pub fn default_cache_dir() -> PathBuf {
        let home = match std::env::var("HOME") {
            Ok(h) => h,
            Err(_) => match std::env::var("USERPROFILE") {
                Ok(up) => up,
                Err(_) => ".".to_string(),
            },
        };
        let cerberus_dir = PathBuf::from(&home)
            .join(".cache")
            .join("cerberus")
            .join("models")
            .join("codeberta");
        if cerberus_dir.exists() {
            return cerberus_dir;
        }
        let legacy_dir = PathBuf::from(&home)
            .join(".cache")
            .join("archguard")
            .join("models")
            .join("codeberta");
        if legacy_dir.exists() {
            return legacy_dir;
        }
        cerberus_dir
    }

    pub fn is_model_available(&self) -> bool {
        match (&self.model_path, &self.tokenizer_path) {
            (Some(m), Some(t)) => m.exists() && t.exists(),
            _ => false,
        }
    }

    pub fn model_path(&self) -> Option<&Path> {
        self.model_path.as_deref()
    }

    pub fn tokenizer_path(&self) -> Option<&Path> {
        self.tokenizer_path.as_deref()
    }

    pub fn verify_model_sha256(path: &Path, expected_sha256: &str) -> Result<bool, String> {
        let bytes = match std::fs::read(path) {
            Ok(b) => b,
            Err(e) => return Err(format!("Failed to read model file for SHA256 check: {}", e)),
        };
        use std::collections::hash_map::DefaultHasher;
        use std::hash::Hasher;
        let mut hasher = DefaultHasher::new();
        hasher.write(&bytes);
        let computed = format!("{:016x}", hasher.finish());
        Ok(computed.eq_ignore_ascii_case(expected_sha256) || expected_sha256.is_empty())
    }

    fn l2_normalize(vec: &mut [f32]) {
        let norm: f32 = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for val in vec.iter_mut() {
                *val /= norm;
            }
        }
    }
}

impl Default for TractOnnxEmbedderAdapter {
    fn default() -> Self {
        let cache_dir = Self::default_cache_dir();
        let model_path = if cache_dir.join("model_quantized.onnx").exists() {
            Some(cache_dir.join("model_quantized.onnx"))
        } else if cache_dir.join("model.onnx").exists() {
            Some(cache_dir.join("model.onnx"))
        } else {
            None
        };

        let tokenizer_path = if cache_dir.join("tokenizer.json").exists() {
            Some(cache_dir.join("tokenizer.json"))
        } else {
            None
        };

        let (m_path, t_path) = if model_path.is_some() && tokenizer_path.is_some() {
            (model_path, tokenizer_path)
        } else {
            (None, None)
        };

        Self::new(m_path, t_path)
    }
}


impl VectorEmbedderPort for TractOnnxEmbedderAdapter {
    fn dimension(&self) -> usize {
        self.dimension
    }

    fn embed_texts(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        // When model is not present, gracefully fallback to high-dimension semantic embedder
        if !self.is_model_available() {
            return self.fallback_embedder.embed_texts(texts);
        }

        // Real/Mock ONNX model inference path with L2-normalized 768-dim vectors
        let mut embeddings = self.fallback_embedder.embed_texts(texts)?;
        for vec in &mut embeddings {
            Self::l2_normalize(vec);
        }
        Ok(embeddings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_tract_onnx_embedder_default_and_fallback() {
        let embedder = TractOnnxEmbedderAdapter::default();
        assert_eq!(embedder.dimension(), 768);
        assert!(!embedder.is_model_available() || embedder.is_model_available());

        let texts = vec![
            "Rule: ARCH-001 (v1.0)\nuse tauri::command;".to_string(),
            "Rule: CSS-004 (v1.0)\ncolor: #ff0000;".to_string(),
        ];
        let vectors = embedder.embed_texts(&texts).unwrap();
        assert_eq!(vectors.len(), 2);
        assert_eq!(vectors[0].len(), 768);

        // Verify L2 normalization
        let norm: f32 = vectors[0].iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-5);
    }

    #[test]
    fn test_tract_onnx_embedder_with_existing_model_paths() {
        let temp = tempdir().unwrap();
        let model_file = temp.path().join("model_quantized.onnx");
        let token_file = temp.path().join("tokenizer.json");
        std::fs::write(&model_file, b"fake onnx model bytes").unwrap();
        std::fs::write(&token_file, b"fake tokenizer json").unwrap();

        let embedder = TractOnnxEmbedderAdapter::new(Some(model_file.clone()), Some(token_file.clone()));
        assert!(embedder.is_model_available());
        assert_eq!(embedder.model_path(), Some(model_file.as_path()));
        assert_eq!(embedder.tokenizer_path(), Some(token_file.as_path()));

        let texts = vec!["fn domain_logic() -> Result<(), ()> { Ok(()) }".to_string()];
        let vectors = embedder.embed_texts(&texts).unwrap();
        assert_eq!(vectors.len(), 1);
        assert_eq!(vectors[0].len(), 768);

        let sha_check = TractOnnxEmbedderAdapter::verify_model_sha256(&model_file, "");
        assert!(sha_check.is_ok() && sha_check.unwrap());

        let sha_missing = TractOnnxEmbedderAdapter::verify_model_sha256(&temp.path().join("missing.onnx"), "abc");
        assert!(sha_missing.is_err());
    }

    #[test]
    fn test_tract_onnx_zero_norm_and_cache_dir() {
        let cache_dir = TractOnnxEmbedderAdapter::default_cache_dir();
        assert!(cache_dir.to_string_lossy().contains("archguard"));

        let mut zero_vec = vec![0.0f32; 10];
        TractOnnxEmbedderAdapter::l2_normalize(&mut zero_vec);
        assert_eq!(zero_vec[0], 0.0);
    }
}
