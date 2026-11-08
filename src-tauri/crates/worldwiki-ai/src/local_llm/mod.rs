//! High-level wrapper over llama-sys FFI for local LLM inference.
//!
//! Provides safe Rust API for model loading, streaming generation,
//! embeddings extraction, TriAttention KV-cache eviction, and session checkpointing.

pub mod checkpoint;
pub mod embeddings;
pub mod error;
pub mod generator;
pub mod model;
pub mod sampler;
pub mod slot;
pub mod tokenizer;

pub use checkpoint::LlmCheckpoint;
pub use embeddings::LlmEmbeddings;
pub use error::LlmError;
pub use generator::{trigger_cancel_local_gen, CANCEL_LOCAL_GEN, LlmGenerator};
pub use model::{resolve_model_path, ModelParams, TokenEvent};
pub use sampler::LlmSampler;
pub use slot::LoadedModelSlot;
pub use tokenizer::LlmTokenizer;

use std::sync::mpsc;

use llama_sys::*;

pub struct LocalLlm {
    model: *mut llama_model,
    ctx: *mut llama_context,
    sampler: *mut llama_sampler,
    vocab: *const llama_vocab,
    pub n_ctx: u32,
    pub n_vocab: i32,
    pub params: ModelParams,
    pub n_past: i32,
    pub tokens: Vec<llama_token>,
}

// SAFETY: LocalLlm manages exclusive pointer lifetimes and thread confinement; mutation requires &mut self.
unsafe impl Send for LocalLlm {}
// SAFETY: Read-only access through immutable references is safe; thread synchronization is enforced via Mutex/RwLock.
unsafe impl Sync for LocalLlm {}

impl LocalLlm {
    /// Loads a generation model from a GGUF file.
    pub fn load_model(model_path: &str, params: ModelParams) -> Result<Self, LlmError> {
        let handles = model::LoadedModelHandles::load_generation(model_path, &params)?;

        Ok(Self {
            model: handles.model,
            ctx: handles.ctx,
            sampler: handles.sampler,
            vocab: handles.vocab,
            n_ctx: params.n_ctx,
            n_vocab: handles.n_vocab,
            params,
            n_past: 0,
            tokens: Vec::new(),
        })
    }

    /// Loads a model dedicated for generating vector embeddings (RAG).
    pub fn load_embedding_model(model_path: &str, params: ModelParams) -> Result<Self, LlmError> {
        let (handles, actual_ctx) = model::LoadedModelHandles::load_embedding(model_path, &params)?;

        Ok(Self {
            model: handles.model,
            ctx: handles.ctx,
            sampler: handles.sampler,
            vocab: handles.vocab,
            n_ctx: actual_ctx,
            n_vocab: handles.n_vocab,
            params,
            n_past: 0,
            tokens: Vec::new(),
        })
    }

    /// Enables TriAttention KV eviction using a calibration stats file.
    pub fn enable_triattention(&mut self, stats_path: &str, budget: i32) -> Result<(), LlmError> {
        // SAFETY: `self.ctx` is initialized and valid.
        unsafe { LlmCheckpoint::init_triattention(self.ctx, stats_path, budget) }
    }

    /// Saves context checkpoint (session + KV cache) to disk.
    pub fn save_checkpoint(&self, base_path: &str) -> Result<(), LlmError> {
        // SAFETY: `self.ctx` is initialized and valid.
        unsafe { LlmCheckpoint::save(self.ctx, &self.tokens, base_path) }
    }

    /// Loads context checkpoint (session + KV cache) from disk.
    pub fn load_checkpoint(&mut self, base_path: &str) -> Result<(), LlmError> {
        // SAFETY: `self.ctx` is initialized and valid.
        let (tokens, n_past) = unsafe { LlmCheckpoint::load(self.ctx, self.n_ctx, base_path)? };
        self.tokens = tokens;
        self.n_past = n_past;
        Ok(())
    }

    /// Tokenizes input text into token IDs.
    pub fn tokenize(&self, text: &str, add_bos: bool, parse_special: bool) -> Result<Vec<llama_token>, LlmError> {
        // SAFETY: `self.vocab` is valid and outlives `self`.
        unsafe { LlmTokenizer::tokenize(self.vocab, text, add_bos, parse_special) }
    }

    /// Streams token generation into the provided mpsc channel.
    pub fn generate_stream(
        &mut self,
        prompt: &str,
        tx: mpsc::Sender<TokenEvent>,
    ) -> Result<(), LlmError> {
        generator::CANCEL_LOCAL_GEN.store(false, std::sync::atomic::Ordering::SeqCst);
        let tokens = self.tokenize(prompt, false, true)?;
        if tokens.is_empty() {
            if let Err(e) = tx.send(TokenEvent {
                token: String::new(),
                is_done: true,
            }) {
                eprintln!("[LOCAL LLM] Empty prompt send error: {e}");
            }
            return Ok(());
        }

        let n_batch = self.params.n_batch as usize;
        // SAFETY: `self.ctx` is valid.
        if let Err(e) = unsafe { LlmGenerator::prefill(self.ctx, &tokens, self.n_past, n_batch) } {
            if e == LlmError::Cancelled {
                if let Err(send_err) = tx.send(TokenEvent {
                    token: String::new(),
                    is_done: true,
                }) {
                    eprintln!("[LOCAL LLM] Cancel send error: {send_err}");
                }
                return Ok(());
            }
            return Err(e);
        }

        self.n_past += tokens.len() as i32;
        self.tokens.extend_from_slice(&tokens);

        // SAFETY: `self.ctx`, `self.sampler`, and `self.vocab` are valid pointers.
        unsafe {
            LlmGenerator::stream_loop(
                self.ctx,
                self.sampler,
                self.vocab,
                self.n_ctx,
                &mut self.n_past,
                &mut self.tokens,
                tx,
            )
        }
    }

    /// Extracts vector embeddings for the given text.
    pub fn get_embeddings(&mut self, text: &str) -> Result<Vec<f32>, LlmError> {
        let mut tokens = self.tokenize(text, true, false)?;
        if tokens.is_empty() {
            return Ok(Vec::new());
        }
        let max_len = (self.n_ctx as usize).min(self.params.n_batch as usize);
        if tokens.len() > max_len {
            tokens.truncate(max_len);
        }

        // SAFETY: `self.model` and `self.ctx` are valid pointers.
        unsafe { LlmEmbeddings::extract(self.model, self.ctx, &tokens) }
    }

    /// Re-initializes working context and sampler while keeping model weights in memory.
    pub fn reset_context(&mut self) -> Result<(), LlmError> {
        LlmSampler::free(&mut self.sampler);

        if !self.ctx.is_null() {
            // SAFETY: `self.ctx` is non-null and will be replaced with freshly initialized context.
            unsafe {
                llama_free(self.ctx);
            }
            self.ctx = std::ptr::null_mut();
        }

        // SAFETY: Context params POD struct initialization.
        let mut ctx_params = unsafe { llama_context_default_params() };
        ctx_params.n_ctx = self.n_ctx;
        ctx_params.n_batch = self.params.n_batch;
        ctx_params.n_ubatch = self.params.n_batch;
        ctx_params.rope_freq_base = self.params.rope_freq_base;
        ctx_params.rope_freq_scale = self.params.rope_freq_scale;

        // SAFETY: Re-initializing context from valid `self.model`.
        let ctx = unsafe { llama_init_from_model(self.model, ctx_params) };
        if ctx.is_null() {
            return Err(LlmError::ResetContextFailed("llama_init_from_model returned null".into()));
        }

        let sampler = LlmSampler::create_default_chain()?;

        self.ctx = ctx;
        self.sampler = sampler;
        self.n_past = 0;
        self.tokens.clear();
        Ok(())
    }
}

impl Drop for LocalLlm {
    fn drop(&mut self) {
        LlmSampler::free(&mut self.sampler);

        if !self.ctx.is_null() {
            // SAFETY: Context is valid and freed once upon drop.
            unsafe {
                llama_free(self.ctx);
            }
            self.ctx = std::ptr::null_mut();
        }

        if !self.model.is_null() {
            // SAFETY: Model is valid and freed once upon drop.
            unsafe {
                llama_model_free(self.model);
            }
            self.model = std::ptr::null_mut();
        }
    }
}
