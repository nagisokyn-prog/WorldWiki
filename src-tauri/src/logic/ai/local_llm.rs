//! High-level wrapper over llama-sys FFI for local LLM inference.
//! Provides safe Rust API for model loading, streaming generation,
//! embeddings extraction, TriAttention KV-cache eviction, and session checkpointing.

use std::ffi::CString;
use std::os::raw::c_char;
use std::ptr;
use std::sync::mpsc;
use std::sync::{Mutex, OnceLock};

#[cfg(feature = "ai-local")]
use llama_sys::*;

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
            n_gpu_layers: -1, // all layers on GPU
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

#[derive(Debug, Clone)]
pub struct TokenEvent {
    pub token: String,
    pub is_done: bool,
}

#[cfg(feature = "ai-local")]
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

#[cfg(feature = "ai-local")]
unsafe impl Send for LocalLlm {}
#[cfg(feature = "ai-local")]
unsafe impl Sync for LocalLlm {}

pub fn resolve_model_path(path_str: &str) -> std::path::PathBuf {
    let p = std::path::Path::new(path_str);
    if p.exists() {
        return p.to_path_buf();
    }
    
    // Check %APPDATA%/com.worldwiki.app/models/<filename>
    if let Some(app_data) = std::env::var_os("APPDATA") {
        let candidate = std::path::PathBuf::from(app_data).join("com.worldwiki.app").join("models").join(path_str);
        if candidate.exists() {
            return candidate;
        }
    }

    if let Some(user_prof) = std::env::var_os("USERPROFILE") {
        let candidate = std::path::PathBuf::from(user_prof).join("AppData").join("Roaming").join("com.worldwiki.app").join("models").join(path_str);
        if candidate.exists() {
            return candidate;
        }
    }
    
    // Check local models directory ./models/<filename>
    let local_candidate = std::path::PathBuf::from("models").join(path_str);
    if local_candidate.exists() {
        return local_candidate;
    }

    p.to_path_buf()
}

#[cfg(feature = "ai-local")]
impl LocalLlm {
    /// Load model from a GGUF file
    pub fn load_model(model_path: &str, params: ModelParams) -> Result<Self, String> {
        let mut model_params = unsafe { llama_model_default_params() };
        model_params.n_gpu_layers = params.n_gpu_layers;
        model_params.use_mmap = params.use_mmap;
        model_params.use_mlock = params.use_mlock;

        let resolved = resolve_model_path(model_path);
        let c_path = CString::new(resolved.to_string_lossy().as_bytes()).map_err(|e| e.to_string())?;
        let model = unsafe { llama_model_load_from_file(c_path.as_ptr(), model_params) };
        if model.is_null() {
            return Err(format!("Failed to load model from {model_path} (resolved: {})", resolved.display()));
        }

        let vocab = unsafe { llama_model_get_vocab(model) };
        if vocab.is_null() {
            unsafe { llama_model_free(model) };
            return Err("Failed to get vocab from model".to_string());
        }
        let n_vocab = unsafe { llama_vocab_n_tokens(vocab) };

        let mut ctx_params = unsafe { llama_context_default_params() };
        ctx_params.n_ctx = params.n_ctx;
        ctx_params.n_batch = params.n_batch;
        ctx_params.n_ubatch = params.n_batch;
        ctx_params.rope_freq_base = params.rope_freq_base;
        ctx_params.rope_freq_scale = params.rope_freq_scale;

        let ctx = unsafe { llama_init_from_model(model, ctx_params) };
        if ctx.is_null() {
            unsafe { llama_model_free(model) };
            return Err("Failed to create context".to_string());
        }

        let sparams = unsafe { llama_sampler_chain_default_params() };
        let sampler = unsafe { llama_sampler_chain_init(sparams) };
        if sampler.is_null() {
            unsafe {
                llama_free(ctx);
                llama_model_free(model);
            }
            return Err("Failed to create sampler chain".to_string());
        }

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
            n_ctx: params.n_ctx,
            n_vocab,
            params,
            n_past: 0,
            tokens: Vec::new(),
        })
    }

    /// Load model dedicated for generating embeddings (RAG)
    pub fn load_embedding_model(model_path: &str, params: ModelParams) -> Result<Self, String> {
        let mut model_params = unsafe { llama_model_default_params() };
        model_params.n_gpu_layers = params.n_gpu_layers;
        model_params.use_mmap = params.use_mmap;

        let resolved = resolve_model_path(model_path);
        let c_path = CString::new(resolved.to_string_lossy().as_bytes()).map_err(|e| e.to_string())?;
        let model = unsafe { llama_model_load_from_file(c_path.as_ptr(), model_params) };
        if model.is_null() {
            return Err(format!("Failed to load embedding model from {model_path} (resolved: {})", resolved.display()));
        }

        let vocab = unsafe { llama_model_get_vocab(model) };
        let n_vocab = unsafe { llama_vocab_n_tokens(vocab) };

        let train_ctx = unsafe { llama_model_n_ctx_train(model) };
        let actual_ctx = if train_ctx > 0 { train_ctx as u32 } else { params.n_ctx };

        let mut ctx_params = unsafe { llama_context_default_params() };
        ctx_params.n_ctx = actual_ctx;
        ctx_params.n_batch = actual_ctx;
        ctx_params.n_ubatch = actual_ctx;
        ctx_params.embeddings = true;

        let ctx = unsafe { llama_init_from_model(model, ctx_params) };
        if ctx.is_null() {
            unsafe { llama_model_free(model) };
            return Err("Failed to create embedding context".to_string());
        }

        Ok(Self {
            model,
            ctx,
            sampler: ptr::null_mut(),
            vocab,
            n_ctx: actual_ctx,
            n_vocab,
            params,
            n_past: 0,
            tokens: Vec::new(),
        })
    }

    /// Enable TriAttention KV eviction using calibration file
    pub fn enable_triattention(&mut self, stats_path: &str, budget: i32) -> Result<(), String> {
        let c_path = CString::new(stats_path).map_err(|e| e.to_string())?;
        let ok = unsafe {
            llama_triattention_init(
                self.ctx,
                c_path.as_ptr(),
                budget,
                128,
                65536,
                0,
                0,
                0,
                0,
                false,
                true,
                false,
                false,
                false,
            )
        };
        if ok == 0 {
            return Err("TriAttention init failed: invalid calibration file or model mismatch".to_string());
        }
        Ok(())
    }

    /// Save context checkpoint (session + KV cache)
    pub fn save_checkpoint(&self, base_path: &str) -> Result<(), String> {
        let session_path = format!("{base_path}.session");
        let c_session = CString::new(session_path).map_err(|e| e.to_string())?;
        let ok = unsafe {
            llama_state_save_file(
                self.ctx,
                c_session.as_ptr(),
                self.tokens.as_ptr(),
                self.tokens.len(),
            )
        };
        if !ok {
            return Err("Failed to save session state".to_string());
        }
        Ok(())
    }

    /// Load context checkpoint (session + KV cache)
    pub fn load_checkpoint(&mut self, base_path: &str) -> Result<(), String> {
        let session_path = format!("{base_path}.session");
        let c_session = CString::new(session_path).map_err(|e| e.to_string())?;
        let mut tokens_out = vec![0 as llama_token; self.n_ctx as usize];
        let mut n_token_count = 0usize;

        let ok = unsafe {
            llama_state_load_file(
                self.ctx,
                c_session.as_ptr(),
                tokens_out.as_mut_ptr(),
                tokens_out.len(),
                &mut n_token_count,
            )
        };
        if !ok {
            return Err("Failed to load session state".to_string());
        }
        self.tokens = tokens_out[..n_token_count].to_vec();
        self.n_past = n_token_count as i32;
        Ok(())
    }

    /// Tokenize input text
    pub fn tokenize(&self, text: &str, add_bos: bool, parse_special: bool) -> Result<Vec<llama_token>, String> {
        let c_text = CString::new(text).map_err(|e| e.to_string())?;
        let mut tokens = vec![0 as llama_token; text.len() + 16];
        let n_tokens = unsafe {
            llama_tokenize(
                self.vocab,
                c_text.as_ptr(),
                text.len() as i32,
                tokens.as_mut_ptr(),
                tokens.len() as i32,
                add_bos,
                parse_special,
            )
        };
        if n_tokens < 0 {
            let required_size = (-n_tokens) as usize;
            tokens.resize(required_size, 0);
            let n2 = unsafe {
                llama_tokenize(
                    self.vocab,
                    c_text.as_ptr(),
                    text.len() as i32,
                    tokens.as_mut_ptr(),
                    tokens.len() as i32,
                    add_bos,
                    parse_special,
                )
            };
            if n2 < 0 {
                return Err("Tokenization failed".to_string());
            }
            tokens.truncate(n2 as usize);
        } else {
            tokens.truncate(n_tokens as usize);
        }
        Ok(tokens)
    }

    /// Stream generation of response tokens
    pub fn generate_stream(
        &mut self,
        prompt: &str,
        tx: mpsc::Sender<TokenEvent>,
    ) -> Result<(), String> {
        let tokens = self.tokenize(prompt, false, true)?;
        if tokens.is_empty() {
            let _ = tx.send(TokenEvent {
                token: String::new(),
                is_done: true,
            });
            return Ok(());
        }

        // Prefill prompt in chunks of n_batch
        let n_batch = (self.params.n_batch as usize).max(1);
        let mut batch = unsafe { llama_batch_init(n_batch as i32, 0, 1) };

        for (chunk_idx, chunk) in tokens.chunks(n_batch).enumerate() {
            batch.n_tokens = chunk.len() as i32;
            let offset = chunk_idx * n_batch;

            for (i, &tok) in chunk.iter().enumerate() {
                let global_idx = offset + i;
                unsafe {
                    *batch.token.add(i) = tok;
                    *batch.pos.add(i) = self.n_past + global_idx as i32;
                    *(*batch.seq_id.add(i)).add(0) = 0;
                    *batch.n_seq_id.add(i) = 1;
                    *batch.logits.add(i) = if global_idx == tokens.len() - 1 { 1 } else { 0 };
                }
            }

            let decode_res = unsafe { llama_decode(self.ctx, batch) };
            if decode_res != 0 {
                unsafe { llama_batch_free(batch) };
                return Err(format!("Prefill decode failed with code: {decode_res}"));
            }
        }
        unsafe { llama_batch_free(batch) };

        self.n_past += tokens.len() as i32;
        self.tokens.extend_from_slice(&tokens);

        let mut n_decode = 0;
        let max_tokens = (self.n_ctx as i32 - self.n_past - 1).max(0);
        let mut generated_buffer = String::new();

        while n_decode < max_tokens {
            let token = unsafe { llama_sampler_sample(self.sampler, self.ctx, -1) };
            unsafe { llama_sampler_accept(self.sampler, token) };

            if unsafe { llama_vocab_is_eog(self.vocab, token) } {
                let _ = tx.send(TokenEvent {
                    token: String::new(),
                    is_done: true,
                });
                break;
            }

            let mut buf = [0u8; 256];
            let n = unsafe {
                llama_token_to_piece(
                    self.vocab,
                    token,
                    buf.as_mut_ptr() as *mut c_char,
                    buf.len() as i32,
                    0,
                    false,
                )
            };
            if n > 0 {
                let piece = std::str::from_utf8(&buf[..n as usize]).unwrap_or("");
                generated_buffer.push_str(piece);

                // Stop conditions for ChatML and other instruct formats
                let is_stop = piece.contains("<|im_end|>")
                    || piece.contains("<|im_start|>")
                    || piece.contains("<|endoftext|>")
                    || piece.contains("<|eot_id|>")
                    || piece.contains("</s>")
                    || generated_buffer.ends_with("<|im_end|>")
                    || generated_buffer.ends_with("<|im_start|>");

                if is_stop {
                    let _ = tx.send(TokenEvent {
                        token: String::new(),
                        is_done: true,
                    });
                    break;
                }

                if !piece.is_empty()
                    && tx
                        .send(TokenEvent {
                            token: piece.to_string(),
                            is_done: false,
                        })
                        .is_err()
                {
                    break;
                }
            }

            // Feed generated token back
            let mut next_batch = unsafe { llama_batch_init(1, 0, 1) };
            next_batch.n_tokens = 1;
            unsafe {
                *next_batch.token.add(0) = token;
                *next_batch.pos.add(0) = self.n_past;
                *(*next_batch.seq_id.add(0)).add(0) = 0;
                *next_batch.n_seq_id.add(0) = 1;
                *next_batch.logits.add(0) = 1;
            }

            let ret = unsafe { llama_decode(self.ctx, next_batch) };
            unsafe { llama_batch_free(next_batch) };
            if ret != 0 {
                return Err(format!("Decode failed at step {n_decode}: {ret}"));
            }

            self.n_past += 1;
            self.tokens.push(token);
            n_decode += 1;
        }

        let _ = tx.send(TokenEvent {
            token: String::new(),
            is_done: true,
        });
        Ok(())
    }

    /// Extract vector embeddings for given text
    pub fn get_embeddings(&mut self, text: &str) -> Result<Vec<f32>, String> {
        let mut tokens = self.tokenize(text, true, false)?;
        if tokens.is_empty() {
            return Ok(Vec::new());
        }
        if tokens.len() > self.n_ctx as usize {
            tokens.truncate(self.n_ctx as usize);
        }

        let mut batch = unsafe { llama_batch_init(tokens.len() as i32, 0, 1) };
        batch.n_tokens = tokens.len() as i32;
        for (i, &tok) in tokens.iter().enumerate() {
            unsafe {
                *batch.token.add(i) = tok;
                *batch.pos.add(i) = i as i32;
                *(*batch.seq_id.add(i)).add(0) = 0;
                *batch.n_seq_id.add(i) = 1;
                *batch.logits.add(i) = if i == tokens.len() - 1 { 1 } else { 0 };
            }
        }

        let ret = unsafe { llama_decode(self.ctx, batch) };
        unsafe { llama_batch_free(batch) };
        if ret != 0 {
            return Err(format!("Embeddings decode failed: {ret}"));
        }

        let embd_ptr = unsafe { llama_get_embeddings_seq(self.ctx, 0) };
        let embd_ptr = if embd_ptr.is_null() {
            unsafe { llama_get_embeddings_ith(self.ctx, -1) }
        } else {
            embd_ptr
        };

        if embd_ptr.is_null() {
            return Err("Failed to retrieve embeddings from context".to_string());
        }

        let n_embd = unsafe { llama_model_n_embd(self.model) };
        let mut result = vec![0.0f32; n_embd as usize];
        unsafe {
            ptr::copy_nonoverlapping(embd_ptr, result.as_mut_ptr(), n_embd as usize);
        }

        // L2 Normalize embedding vector
        let norm: f32 = result.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for val in result.iter_mut() {
                *val /= norm;
            }
        }

        Ok(result)
    }

    /// Re-initialize working context and sampler while keeping model weights in GPU memory
    pub fn reset_context(&mut self) -> Result<(), String> {
        unsafe {
            if !self.sampler.is_null() {
                llama_sampler_free(self.sampler);
                self.sampler = ptr::null_mut();
            }
            if !self.ctx.is_null() {
                llama_free(self.ctx);
                self.ctx = ptr::null_mut();
            }

            let mut ctx_params = llama_context_default_params();
            ctx_params.n_ctx = self.n_ctx;
            ctx_params.n_batch = self.params.n_batch;
            ctx_params.n_ubatch = self.params.n_batch;
            ctx_params.rope_freq_base = self.params.rope_freq_base;
            ctx_params.rope_freq_scale = self.params.rope_freq_scale;

            let ctx = llama_init_from_model(self.model, ctx_params);
            if ctx.is_null() {
                return Err("Failed to reset llama context".to_string());
            }

            let sparams = llama_sampler_chain_default_params();
            let sampler = llama_sampler_chain_init(sparams);
            llama_sampler_chain_add(sampler, llama_sampler_init_penalties(64, 1.15, 0.0, 0.0));
            llama_sampler_chain_add(sampler, llama_sampler_init_top_k(40));
            llama_sampler_chain_add(sampler, llama_sampler_init_top_p(0.95, 1));
            llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.7));
            llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

            self.ctx = ctx;
            self.sampler = sampler;
            self.n_past = 0;
            self.tokens.clear();
        }
        Ok(())
    }
}

#[cfg(feature = "ai-local")]
pub struct LoadedModelSlot {
    pub model_path: String,
    pub llm: LocalLlm,
}

#[cfg(feature = "ai-local")]
static LOADED_MODEL: OnceLock<Mutex<Option<LoadedModelSlot>>> = OnceLock::new();

#[cfg(feature = "ai-local")]
pub fn get_loaded_model_slot() -> &'static Mutex<Option<LoadedModelSlot>> {
    LOADED_MODEL.get_or_init(|| Mutex::new(None))
}

#[cfg(feature = "ai-local")]
static LOADED_EMBED: OnceLock<Mutex<Option<LoadedModelSlot>>> = OnceLock::new();

#[cfg(feature = "ai-local")]
pub fn get_loaded_embed_slot() -> &'static Mutex<Option<LoadedModelSlot>> {
    LOADED_EMBED.get_or_init(|| Mutex::new(None))
}

#[cfg(feature = "ai-local")]
impl Drop for LocalLlm {
    fn drop(&mut self) {
        unsafe {
            if !self.sampler.is_null() {
                llama_sampler_free(self.sampler);
                self.sampler = ptr::null_mut();
            }
            if !self.ctx.is_null() {
                llama_free(self.ctx);
                self.ctx = ptr::null_mut();
            }
            if !self.model.is_null() {
                llama_model_free(self.model);
                self.model = ptr::null_mut();
            }
        }
    }
}
