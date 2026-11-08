//! Model slot structure for loaded generation and embedding models.

use super::LocalLlm;

pub struct LoadedModelSlot {
    pub model_path: String,
    pub llm: LocalLlm,
}
