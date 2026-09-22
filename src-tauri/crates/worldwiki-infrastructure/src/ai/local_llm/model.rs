//! Model file resolution, loading, and low-level FFI initialization.

use std::ffi::CString;
use std::path::{Path, PathBuf};
use std::ptr;

use super::error::LlmError;

#[cfg(feature = "ai-local")]
use llama_sys::*;

/// Configuration parameters for GGUF model loading and runtime execution.
#[derive(Debug, Clone)]
pub struct ModelParams {
    pub n_ctx: u32,
    pub n_batch: u32,
    pub n_gpu_layers: i32,
    pub use_mmap: bool,
    pub use_mlock: bool,
    pub rope_freq_base: f32,
    pub rope_freq_scale: f32,
    pub enable_tcq: bool,
    pub enable_swa: bool,
    pub swa_window: u32,
}

impl Default for ModelParams {
    fn default() -> Self {
        Self {
            n_ctx: 16384,
            n_batch: 512,
            n_gpu_layers: -1, // all layers on GPU by default
            use_mmap: true,
            use_mlock: false,
            rope_freq_base: 10000.0,
            rope_freq_scale: 1.0,
            enable_tcq: true,
            enable_swa: true,
            swa_window: 4096,
        }
    }
}

/// Token streaming event emitted during generation.
#[derive(Debug, Clone)]
pub struct TokenEvent {
    pub token: String,
    pub is_done: bool,
}

/// Resolves a relative or base model filename against system and application directories.
pub fn resolve_model_path(path_str: &str) -> PathBuf {
    let p = Path::new(path_str);
    if p.exists() {
        return p.to_path_buf();
    }

    // Check %APPDATA%/com.worldwiki.app/models/<filename>
    if let Some(app_data) = std::env::var_os("APPDATA") {
        let candidate = PathBuf::from(app_data)
            .join("com.worldwiki.app")
            .join("models")
            .join(path_str);
        if candidate.exists() {
            return candidate;
        }
    }

    // Check %USERPROFILE%/AppData/Roaming/com.worldwiki.app/models/<filename>
    if let Some(user_prof) = std::env::var_os("USERPROFILE") {
        let candidate = PathBuf::from(user_prof)
            .join("AppData")
            .join("Roaming")
            .join("com.worldwiki.app")
            .join("models")
            .join(path_str);
        if candidate.exists() {
            return candidate;
        }
    }

    // Check local models directory ./models/<filename>
    let local_candidate = PathBuf::from("models").join(path_str);
    if local_candidate.exists() {
        return local_candidate;
    }

    p.to_path_buf()
}

#[cfg(feature = "ai-local")]
pub struct LoadedModelHandles {
    pub model: *mut llama_model,
    pub ctx: *mut llama_context,
    pub sampler: *mut llama_sampler,
    pub vocab: *const llama_vocab,
    pub n_vocab: i32,
}

#[cfg(feature = "ai-local")]
impl LoadedModelHandles {
    /// Loads a generation model and initial context/sampler from GGUF.
    pub fn load_generation(model_path: &str, params: &ModelParams) -> Result<Self, LlmError> {
        let resolved = resolve_model_path(model_path);
        let c_path = CString::new(resolved.to_string_lossy().as_bytes())?;

        // SAFETY:
        // 1. `llama_model_default_params` returns a valid POD struct with default parameters.
        // 2. We only modify value fields (`n_gpu_layers`, `use_mmap`, `use_mlock`) before passing to FFI.
        let mut model_params = unsafe { llama_model_default_params() };
        model_params.n_gpu_layers = params.n_gpu_layers;
        model_params.use_mmap = params.use_mmap;
        model_params.use_mlock = params.use_mlock;

        // SAFETY:
        // 1. `c_path.as_ptr()` points to a valid null-terminated C-string backed by `c_path` which outlives the call.
        // 2. `llama_model_load_from_file` handles invalid files gracefully by returning a null pointer.
        let model = unsafe { llama_model_load_from_file(c_path.as_ptr(), model_params) };
        if model.is_null() {
            return Err(LlmError::ModelLoadFailed {
                path: model_path.to_string(),
                reason: format!("resolved: {}", resolved.display()),
            });
        }

        // SAFETY:
        // 1. `model` is non-null (verified above) and properly initialized by `llama_model_load_from_file`.
        // 2. `llama_model_get_vocab` returns a borrow of the model's vocabulary pointer without transferring ownership.
        let vocab = unsafe { llama_model_get_vocab(model) };
        if vocab.is_null() {
            // SAFETY: `model` is non-null and must be freed to prevent memory leak on early exit.
            unsafe { llama_model_free(model) };
            return Err(LlmError::VocabExtractionFailed("Returned null vocab pointer".into()));
        }

        // SAFETY: `vocab` is non-null and valid.
        let n_vocab = unsafe { llama_vocab_n_tokens(vocab) };

        // SAFETY: `llama_context_default_params` returns a valid POD struct.
        let mut ctx_params = unsafe { llama_context_default_params() };
        ctx_params.n_ctx = params.n_ctx;
        ctx_params.n_batch = params.n_batch;
        ctx_params.n_ubatch = params.n_batch;
        ctx_params.rope_freq_base = params.rope_freq_base;
        ctx_params.rope_freq_scale = params.rope_freq_scale;

        // SAFETY:
        // 1. `model` is a valid initialized model pointer.
        // 2. `ctx_params` values are validated within bounds by llama.cpp.
        let ctx = unsafe { llama_init_from_model(model, ctx_params) };
        if ctx.is_null() {
            // SAFETY: `model` is valid and must be freed on failure.
            unsafe { llama_model_free(model) };
            return Err(LlmError::ContextCreationFailed("llama_init_from_model returned null".into()));
        }

        // SAFETY: `llama_sampler_chain_default_params` returns default POD parameters for sampler chain.
        let sparams = unsafe { llama_sampler_chain_default_params() };
        // SAFETY: `llama_sampler_chain_init` creates a new heap-allocated sampler chain.
        let sampler = unsafe { llama_sampler_chain_init(sparams) };
        if sampler.is_null() {
            // SAFETY: Free both context and model to prevent memory leaks on initialization failure.
            unsafe {
                llama_free(ctx);
                llama_model_free(model);
            }
            return Err(LlmError::SamplerCreationFailed("llama_sampler_chain_init returned null".into()));
        }

        // SAFETY:
        // 1. `sampler` is a valid, non-null sampler chain initialized above.
        // 2. Each `llama_sampler_init_*` function returns a pointer transfer of ownership into the chain.
        unsafe {
            llama_sampler_chain_add(sampler, llama_sampler_init_penalties(64, 1.15, 0.0, 0.0));
            llama_sampler_chain_add(sampler, llama_sampler_init_top_k(40));
            llama_sampler_chain_add(sampler, llama_sampler_init_top_p(0.95, 1));
            llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.7));
            llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
        }

        Ok(Self {
            model,
            ctx,
            sampler,
            vocab,
            n_vocab,
        })
    }

    /// Loads a model dedicated for embedding vector extraction (RAG).
    pub fn load_embedding(model_path: &str, params: &ModelParams) -> Result<(Self, u32), LlmError> {
        let resolved = resolve_model_path(model_path);
        let c_path = CString::new(resolved.to_string_lossy().as_bytes())?;

        // SAFETY: Default model params POD struct initialization.
        let mut model_params = unsafe { llama_model_default_params() };
        model_params.n_gpu_layers = params.n_gpu_layers;
        model_params.use_mmap = params.use_mmap;

        // SAFETY: Null-terminated C-string pointer and safe return check.
        let model = unsafe { llama_model_load_from_file(c_path.as_ptr(), model_params) };
        if model.is_null() {
            return Err(LlmError::ModelLoadFailed {
                path: model_path.to_string(),
                reason: format!("resolved: {}", resolved.display()),
            });
        }

        // SAFETY: `model` is non-null and valid.
        let vocab = unsafe { llama_model_get_vocab(model) };
        if vocab.is_null() {
            // SAFETY: Free model on vocab failure.
            unsafe { llama_model_free(model) };
            return Err(LlmError::VocabExtractionFailed("Returned null vocab pointer".into()));
        }

        // SAFETY: `vocab` is non-null and valid.
        let n_vocab = unsafe { llama_vocab_n_tokens(vocab) };
        // SAFETY: `model` is non-null and valid.
        let train_ctx = unsafe { llama_model_n_ctx_train(model) };

        let actual_ctx = if params.n_ctx > 0 {
            params.n_ctx.min(4096)
        } else if train_ctx > 0 {
            (train_ctx as u32).min(4096)
        } else {
            2048
        };
        let actual_batch = actual_ctx;

        // SAFETY: Context params POD struct initialization.
        let mut ctx_params = unsafe { llama_context_default_params() };
        ctx_params.n_ctx = actual_ctx;
        ctx_params.n_batch = actual_batch;
        ctx_params.n_ubatch = actual_batch;
        ctx_params.embeddings = true;

        // SAFETY: Initializing embedding context from valid model.
        let ctx = unsafe { llama_init_from_model(model, ctx_params) };
        if ctx.is_null() {
            // SAFETY: Free model on context failure.
            unsafe { llama_model_free(model) };
            return Err(LlmError::EmbeddingContextFailed("llama_init_from_model returned null".into()));
        }

        Ok((
            Self {
                model,
                ctx,
                sampler: ptr::null_mut(),
                vocab,
                n_vocab,
            },
            actual_ctx,
        ))
    }
}
