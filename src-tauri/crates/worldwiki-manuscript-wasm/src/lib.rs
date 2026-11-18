use hashbrown::HashMap;
use wasm_bindgen::prelude::*;

pub(crate) fn js_err<E: std::fmt::Display>(err: E) -> JsValue {
    JsValue::from_str(&err.to_string())
}
use worldwiki_manuscript_core::{
    extract_entity_mentions as core_extract_entity_mentions,
    resolve_cross_references as core_resolve_cross_references, CrossReference, TargetMetadata,
};

#[wasm_bindgen]
pub struct WasmManuscriptEngine;

#[wasm_bindgen]
impl WasmManuscriptEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self
    }

    /// High-speed FSM extraction of all `((Entity))` mentions from manuscript text
    pub fn extract_entities(&self, text: &str) -> Result<JsValue, JsValue> {
        let mentions = core_extract_entity_mentions(text);
        serde_wasm_bindgen::to_value(&mentions).map_err(crate::js_err)
    }

    /// Resolves a collection of cross references against an ID lookup index
    pub fn resolve_cross_references(
        &self,
        references_json: JsValue,
        index_json: JsValue,
    ) -> Result<JsValue, JsValue> {
        let references: Vec<CrossReference> = serde_wasm_bindgen::from_value(references_json)
            .map_err(crate::js_err)?;
        let index: HashMap<String, TargetMetadata> = serde_wasm_bindgen::from_value(index_json)
            .map_err(crate::js_err)?;

        let resolved = core_resolve_cross_references(&references, &index);
        serde_wasm_bindgen::to_value(&resolved).map_err(crate::js_err)
    }
}

impl Default for WasmManuscriptEngine {
    fn default() -> Self {
        Self::new()
    }
}
