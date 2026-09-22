//! Safe tokenization and detokenization routines over llama vocabulary.

use std::ffi::CString;
use std::os::raw::c_char;

use super::error::LlmError;

#[cfg(feature = "ai-local")]
use llama_sys::*;

#[cfg(feature = "ai-local")]
pub struct LlmTokenizer;

#[cfg(feature = "ai-local")]
impl LlmTokenizer {
    /// Tokenizes input string into vector of token IDs.
    // SAFETY:
    // 1. Caller guarantees `vocab` is a valid, immutable non-null pointer to model vocabulary.
    // 2. String slices and pointers passed to llama_tokenize are valid and bounded.
    pub(crate) unsafe fn tokenize(
        vocab: *const llama_vocab,
        text: &str,
        add_bos: bool,
        parse_special: bool,
    ) -> Result<Vec<llama_token>, LlmError> {
        let c_text = CString::new(text)?;
        let mut tokens = vec![0 as llama_token; text.len() + 16];

        let n_tokens = llama_tokenize(
            vocab,
            c_text.as_ptr(),
            text.len() as i32,
            tokens.as_mut_ptr(),
            tokens.len() as i32,
            add_bos,
            parse_special,
        );

        if n_tokens < 0 {
            // Negative value indicates required buffer size.
            let required_size = (-n_tokens) as usize;
            tokens.resize(required_size, 0);

            let n2 = llama_tokenize(
                vocab,
                c_text.as_ptr(),
                text.len() as i32,
                tokens.as_mut_ptr(),
                tokens.len() as i32,
                add_bos,
                parse_special,
            );
            if n2 < 0 {
                return Err(LlmError::TokenizationFailed("Second pass tokenization failed".into()));
            }
            tokens.truncate(n2 as usize);
        } else {
            tokens.truncate(n_tokens as usize);
        }

        Ok(tokens)
    }

    /// Converts a single token into UTF-8 text piece.
    // SAFETY:
    // 1. Caller guarantees `vocab` is a valid, non-null pointer to model vocabulary.
    // 2. Caller guarantees `buf` is a valid, writable byte slice.
    pub(crate) unsafe fn token_to_piece(vocab: *const llama_vocab, token: llama_token, buf: &mut [u8]) -> i32 {
        llama_token_to_piece(
            vocab,
            token,
            buf.as_mut_ptr() as *mut c_char,
            buf.len() as i32,
            0,
            false,
        )
    }

    /// Checks if a token represents an End-Of-Generation (EOG) token in the vocabulary.
    // SAFETY: Caller guarantees `vocab` is a valid, non-null pointer to model vocabulary.
    pub(crate) unsafe fn is_eog(vocab: *const llama_vocab, token: llama_token) -> bool {
        llama_vocab_is_eog(vocab, token)
    }

    /// Detects stop sequences for ChatML, Llama-3, and DeepSeek templates.
    pub fn is_stop_sequence(piece: &str, accumulated: &str) -> bool {
        piece.contains("<|im_end|>")
            || piece.contains("<|im_start|>")
            || piece.contains("<|endoftext|>")
            || piece.contains("<|eot_id|>")
            || piece.contains("</s>")
            || accumulated.ends_with("<|im_end|>")
            || accumulated.ends_with("<|im_start|>")
    }
}
