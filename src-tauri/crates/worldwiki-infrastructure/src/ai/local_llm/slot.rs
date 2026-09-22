//! Global slots for loaded generation and embedding models.

use std::sync::{Mutex, OnceLock};

use super::LocalLlm;

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
