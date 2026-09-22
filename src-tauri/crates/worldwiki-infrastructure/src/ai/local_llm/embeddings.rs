//! Dense embeddings extraction and L2 normalization from GGUF embedding models.

use std::ptr;

use super::error::LlmError;

#[cfg(feature = "ai-local")]
use llama_sys::*;

#[cfg(feature = "ai-local")]
pub struct LlmEmbeddings;

#[cfg(feature = "ai-local")]
impl LlmEmbeddings {
    /// Extracts vector embeddings for tokens and returns an L2-normalized float vector.
    // SAFETY: Caller guarantees `model` and `ctx` are valid, initialized non-null pointers.
    pub(crate) unsafe fn extract(
        model: *mut llama_model,
        ctx: *mut llama_context,
        tokens: &[llama_token],
    ) -> Result<Vec<f32>, LlmError> {
        if tokens.is_empty() {
            return Ok(Vec::new());
        }

        // SAFETY: Allocates a batch with size equal to token count.
        let mut batch = unsafe { llama_batch_init(tokens.len() as i32, 0, 1) };
        batch.n_tokens = tokens.len() as i32;

        for (i, &tok) in tokens.iter().enumerate() {
            // SAFETY: `i < tokens.len()`, within initialized batch capacity.
            unsafe {
                *batch.token.add(i) = tok;
                *batch.pos.add(i) = i as i32;
                *(*batch.seq_id.add(i)).add(0) = 0;
                *batch.n_seq_id.add(i) = 1;
                *batch.logits.add(i) = if i == tokens.len() - 1 { 1 } else { 0 };
            }
        }

        // SAFETY: Evaluates embedding model forward pass on valid context.
        let ret = unsafe { llama_decode(ctx, batch) };
        // SAFETY: Cleanly free allocated batch struct.
        unsafe { llama_batch_free(batch) };

        if ret != 0 {
            return Err(LlmError::EmbeddingsDecodeFailed(ret));
        }

        // SAFETY: Retrieve sequence embedding pointer from context.
        let embd_ptr = unsafe { llama_get_embeddings_seq(ctx, 0) };
        let embd_ptr = if embd_ptr.is_null() {
            // SAFETY: Fallback to ith embedding pointer.
            unsafe { llama_get_embeddings_ith(ctx, -1) }
        } else {
            embd_ptr
        };

        if embd_ptr.is_null() {
            return Err(LlmError::EmbeddingsExtractionFailed);
        }

        // SAFETY: `model` is a valid model pointer; retrieves hidden embedding dimension.
        let n_embd = unsafe { llama_model_n_embd(model) };
        let mut result = vec![0.0f32; n_embd as usize];

        // SAFETY: `embd_ptr` is non-null, destination slice is sized to `n_embd`, memory does not overlap.
        unsafe {
            ptr::copy_nonoverlapping(embd_ptr, result.as_mut_ptr(), n_embd as usize);
        }

        // L2 Normalization of embedding vector for cosine similarity
        let norm: f32 = result.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for val in result.iter_mut() {
                *val /= norm;
            }
        }

        Ok(result)
    }
}
