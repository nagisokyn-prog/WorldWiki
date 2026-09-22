//! Streaming token generation and cancellation management.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;

use super::error::LlmError;
use super::model::TokenEvent;
use super::sampler::LlmSampler;
use super::tokenizer::LlmTokenizer;

#[cfg(feature = "ai-local")]
use llama_sys::*;

pub static CANCEL_LOCAL_GEN: AtomicBool = AtomicBool::new(false);

/// Triggers cancellation of active inference loops.
pub fn trigger_cancel_local_gen() {
    CANCEL_LOCAL_GEN.store(true, Ordering::SeqCst);
}

#[cfg(feature = "ai-local")]
pub struct LlmGenerator;

#[cfg(feature = "ai-local")]
impl LlmGenerator {
    /// Prefills tokens in batches of `n_batch` size.
    // SAFETY: Caller guarantees `ctx` is a valid, initialized non-null `llama_context` pointer.
    pub(crate) unsafe fn prefill(
        ctx: *mut llama_context,
        tokens: &[llama_token],
        n_past: i32,
        n_batch: usize,
    ) -> Result<(), LlmError> {
        let n_batch = n_batch.max(1);

        // SAFETY: Allocates a new batch structure with capacity `n_batch`.
        let mut batch = unsafe { llama_batch_init(n_batch as i32, 0, 1) };

        for (chunk_idx, chunk) in tokens.chunks(n_batch).enumerate() {
            if CANCEL_LOCAL_GEN.load(Ordering::SeqCst) {
                // SAFETY: Cleanly free allocated batch on cancellation.
                unsafe { llama_batch_free(batch) };
                return Err(LlmError::Cancelled);
            }

            batch.n_tokens = chunk.len() as i32;
            let offset = chunk_idx * n_batch;

            for (i, &tok) in chunk.iter().enumerate() {
                let global_idx = offset + i;
                // SAFETY:
                // 1. `batch.token`, `batch.pos`, `batch.seq_id`, `batch.n_seq_id`, `batch.logits` have size >= n_batch.
                // 2. `i < chunk.len() <= n_batch`.
                unsafe {
                    *batch.token.add(i) = tok;
                    *batch.pos.add(i) = n_past + global_idx as i32;
                    *(*batch.seq_id.add(i)).add(0) = 0;
                    *batch.n_seq_id.add(i) = 1;
                    *batch.logits.add(i) = if global_idx == tokens.len() - 1 { 1 } else { 0 };
                }
            }

            // SAFETY: `ctx` is valid and `batch` contains properly formatted tokens.
            let decode_res = unsafe { llama_decode(ctx, batch) };
            if decode_res != 0 {
                // SAFETY: Cleanly free allocated batch on decode failure.
                unsafe { llama_batch_free(batch) };
                return Err(LlmError::PrefillFailed { code: decode_res });
            }
        }

        // SAFETY: Free batch structure after prefill completion.
        unsafe { llama_batch_free(batch) };
        Ok(())
    }

    /// Feeds a single generated token back into the model context for autoregressive decoding.
    // SAFETY: Caller guarantees `ctx` is a valid, initialized non-null `llama_context` pointer.
    pub(crate) unsafe fn decode_single(
        ctx: *mut llama_context,
        token: llama_token,
        pos: i32,
    ) -> Result<(), LlmError> {
        // SAFETY: Allocates a batch with capacity for 1 token.
        let mut next_batch = unsafe { llama_batch_init(1, 0, 1) };
        next_batch.n_tokens = 1;

        // SAFETY: Valid 1-element pointers initialized above.
        unsafe {
            *next_batch.token.add(0) = token;
            *next_batch.pos.add(0) = pos;
            *(*next_batch.seq_id.add(0)).add(0) = 0;
            *next_batch.n_seq_id.add(0) = 1;
            *next_batch.logits.add(0) = 1;
        }

        // SAFETY: Decodes 1 token in valid context.
        let ret = unsafe { llama_decode(ctx, next_batch) };
        // SAFETY: Free single-token batch structure.
        unsafe { llama_batch_free(next_batch) };

        if ret != 0 {
            return Err(LlmError::DecodeFailed {
                step: pos as usize,
                code: ret,
            });
        }

        Ok(())
    }

    /// Executes the full autoregressive streaming loop.
    // SAFETY: Caller guarantees `ctx`, `sampler`, and `vocab` are valid, initialized non-null pointers.
    pub(crate) unsafe fn stream_loop(
        ctx: *mut llama_context,
        sampler: *mut llama_sampler,
        vocab: *const llama_vocab,
        n_ctx: u32,
        n_past: &mut i32,
        tokens_history: &mut Vec<llama_token>,
        tx: mpsc::Sender<TokenEvent>,
    ) -> Result<(), LlmError> {
        let mut n_decode = 0;
        let max_tokens = (n_ctx as i32 - *n_past - 1).max(0);
        let mut generated_buffer = String::new();

        while n_decode < max_tokens {
            if CANCEL_LOCAL_GEN.load(Ordering::SeqCst) {
                let _ = tx.send(TokenEvent {
                    token: String::new(),
                    is_done: true,
                });
                break;
            }

            // SAFETY: `sampler` and `ctx` are valid pointers.
            let token = unsafe { LlmSampler::sample_token(sampler, ctx) };

            // SAFETY: `vocab` is a valid pointer.
            if unsafe { LlmTokenizer::is_eog(vocab, token) } {
                let _ = tx.send(TokenEvent {
                    token: String::new(),
                    is_done: true,
                });
                break;
            }

            let mut buf = [0u8; 256];
            // SAFETY: `vocab` is valid and `buf` is a mutable slice.
            let n = unsafe { LlmTokenizer::token_to_piece(vocab, token, &mut buf) };
            if n > 0 {
                let piece = std::str::from_utf8(&buf[..n as usize]).unwrap_or("");
                generated_buffer.push_str(piece);

                if LlmTokenizer::is_stop_sequence(piece, &generated_buffer) {
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

            // SAFETY: `ctx` is valid.
            unsafe { Self::decode_single(ctx, token, *n_past)? };

            *n_past += 1;
            tokens_history.push(token);
            n_decode += 1;
        }

        let _ = tx.send(TokenEvent {
            token: String::new(),
            is_done: true,
        });
        Ok(())
    }
}
