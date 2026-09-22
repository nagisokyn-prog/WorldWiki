//! Strongly-typed error definitions for Local LLM inference operations.

use thiserror::Error;

/// Enumeration of all domain-level and FFI-level errors in Local LLM execution.
#[derive(Debug, Clone, Error, PartialEq, Eq)]
pub enum LlmError {
    #[error("Failed to load model from {path}: {reason}")]
    ModelLoadFailed { path: String, reason: String },

    #[error("Failed to load model from {0}")]
    LegacyModelLoadFailed(String),

    #[error("Failed to get vocab from model: {0}")]
    VocabExtractionFailed(String),

    #[error("Failed to create context: {0}")]
    ContextCreationFailed(String),

    #[error("Failed to create sampler chain: {0}")]
    SamplerCreationFailed(String),

    #[error("Failed to create embedding context: {0}")]
    EmbeddingContextFailed(String),

    #[error("Tokenization failed: {0}")]
    TokenizationFailed(String),

    #[error("Decode failed at step {step}: code {code}")]
    DecodeFailed { step: usize, code: i32 },

    #[error("Prefill decode failed with code: {code}")]
    PrefillFailed { code: i32 },

    #[error("Embeddings decode failed: {0}")]
    EmbeddingsDecodeFailed(i32),

    #[error("Failed to retrieve embeddings from context")]
    EmbeddingsExtractionFailed,

    #[error("TriAttention init failed: invalid calibration file or model mismatch: {0}")]
    TriAttentionInitFailed(String),

    #[error("Failed to save session state to {0}")]
    SaveStateFailed(String),

    #[error("Failed to load session state from {0}")]
    LoadStateFailed(String),

    #[error("Failed to reset llama context: {0}")]
    ResetContextFailed(String),

    #[error("CString conversion failed: {0}")]
    NulError(String),

    #[error("Inference cancelled by caller")]
    Cancelled,
}

impl LlmError {
    /// Convenience helper for string matching in smoke tests and logging
    pub fn contains(&self, pat: &str) -> bool {
        self.to_string().contains(pat)
    }
}

impl From<std::ffi::NulError> for LlmError {
    fn from(err: std::ffi::NulError) -> Self {
        LlmError::NulError(err.to_string())
    }
}
