//! KV-cache session checkpointing and TriAttention calibration operations.

use std::ffi::CString;

use super::error::LlmError;

#[cfg(feature = "ai-local")]
use llama_sys::*;

#[cfg(feature = "ai-local")]
pub struct LlmCheckpoint;

#[cfg(feature = "ai-local")]
impl LlmCheckpoint {
    /// Initializes TriAttention KV eviction using a calibration stats file.
    // SAFETY: Caller guarantees `ctx` is a valid, initialized non-null `llama_context` pointer.
    pub(crate) unsafe fn init_triattention(
        ctx: *mut llama_context,
        stats_path: &str,
        budget: i32,
    ) -> Result<(), LlmError> {
        let c_path = CString::new(stats_path)?;

        // SAFETY: `ctx` is non-null and valid, `c_path` is a null-terminated C string.
        let ok = unsafe {
            llama_triattention_init(
                ctx,
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
            return Err(LlmError::TriAttentionInitFailed(stats_path.to_string()));
        }

        Ok(())
    }

    /// Saves context checkpoint (KV cache state and token stream) to disk.
    // SAFETY: Caller guarantees `ctx` is a valid, initialized non-null `llama_context` pointer.
    pub(crate) unsafe fn save(
        ctx: *mut llama_context,
        tokens: &[llama_token],
        base_path: &str,
    ) -> Result<(), LlmError> {
        let session_path = format!("{base_path}.session");
        let c_session = CString::new(session_path.clone())?;

        // SAFETY: `ctx` is valid, `c_session` is null-terminated, `tokens` is a contiguous slice.
        let ok = unsafe {
            llama_state_save_file(
                ctx,
                c_session.as_ptr(),
                tokens.as_ptr(),
                tokens.len(),
            )
        };

        if !ok {
            return Err(LlmError::SaveStateFailed(session_path));
        }

        Ok(())
    }

    /// Loads context checkpoint (KV cache state and token stream) from disk.
    // SAFETY: Caller guarantees `ctx` is a valid, initialized non-null `llama_context` pointer.
    pub(crate) unsafe fn load(
        ctx: *mut llama_context,
        n_ctx: u32,
        base_path: &str,
    ) -> Result<(Vec<llama_token>, i32), LlmError> {
        let session_path = format!("{base_path}.session");
        let c_session = CString::new(session_path.clone())?;
        let mut tokens_out = vec![0 as llama_token; n_ctx as usize];
        let mut n_token_count = 0usize;

        // SAFETY: `ctx` is valid, `c_session` is null-terminated, `tokens_out` has preallocated capacity.
        let ok = unsafe {
            llama_state_load_file(
                ctx,
                c_session.as_ptr(),
                tokens_out.as_mut_ptr(),
                tokens_out.len(),
                &mut n_token_count,
            )
        };

        if !ok {
            return Err(LlmError::LoadStateFailed(session_path));
        }

        let actual_count = n_token_count.min(tokens_out.len());
        let tokens = tokens_out
            .get(..actual_count)
            .map(|s| s.to_vec())
            .unwrap_or_else(|| tokens_out.clone());
        let n_past = actual_count as i32;

        Ok((tokens, n_past))
    }
}
