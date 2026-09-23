//! Sampler chain configuration, destruction, and token sampling operations.

use super::error::LlmError;

#[cfg(feature = "ai-local")]
use llama_sys::*;

#[cfg(feature = "ai-local")]
pub struct LlmSampler;

#[cfg(feature = "ai-local")]
impl LlmSampler {
    /// Creates and configures a default sampling chain (penalties, top_k, top_p, temp, dist).
    pub(crate) fn create_default_chain() -> Result<*mut llama_sampler, LlmError> {
        // SAFETY: `llama_sampler_chain_default_params` returns a valid POD struct.
        let sparams = unsafe { llama_sampler_chain_default_params() };
        // SAFETY: `llama_sampler_chain_init` creates a new heap-allocated sampler chain.
        let sampler = unsafe { llama_sampler_chain_init(sparams) };
        if sampler.is_null() {
            return Err(LlmError::SamplerCreationFailed("llama_sampler_chain_init returned null".into()));
        }

        // SAFETY:
        // 1. `sampler` is verified non-null above.
        // 2. Each `llama_sampler_init_*` returns a pointer whose ownership is transferred to the chain.
        unsafe {
            llama_sampler_chain_add(sampler, llama_sampler_init_penalties(64, 1.15, 0.0, 0.0));
            llama_sampler_chain_add(sampler, llama_sampler_init_top_k(40));
            llama_sampler_chain_add(sampler, llama_sampler_init_top_p(0.95, 1));
            llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.7));
            llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
        }

        Ok(sampler)
    }

    /// Safely samples a single next token from the context logits.
    pub(crate) fn sample_token(sampler: *mut llama_sampler, ctx: *mut llama_context) -> llama_token {
        // SAFETY: Caller guarantees valid non-null pointers `sampler` and `ctx`.
        unsafe {
            let token = llama_sampler_sample(sampler, ctx, -1);
            llama_sampler_accept(sampler, token);
            token
        }
    }

    /// Safely frees a sampler chain pointer if non-null.
    pub(crate) fn free(sampler: &mut *mut llama_sampler) {
        if !sampler.is_null() {
            // SAFETY: `*sampler` is verified non-null and will not be accessed again.
            unsafe {
                llama_sampler_free(*sampler);
            }
            *sampler = std::ptr::null_mut();
        }
    }
}
