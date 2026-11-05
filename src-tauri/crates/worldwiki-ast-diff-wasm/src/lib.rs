use wasm_bindgen::prelude::*;
use worldwiki_document_core::{
    apply_patch as core_apply_patch, compute_inline_diff as core_compute_inline_diff,
    diff_documents, DocumentDiffResult, SemanticDocument,
};

#[wasm_bindgen]
pub struct WasmAstDiffEngine;

#[wasm_bindgen]
impl WasmAstDiffEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self
    }

    /// Computes structural and inline diff between two versions of SemanticDocument
    pub fn compute_diff(
        &self,
        old_doc_json: JsValue,
        new_doc_json: JsValue,
    ) -> Result<JsValue, JsValue> {
        let old_doc: SemanticDocument = serde_wasm_bindgen::from_value(old_doc_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let new_doc: SemanticDocument = serde_wasm_bindgen::from_value(new_doc_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let diff = diff_documents(&old_doc, &new_doc);
        serde_wasm_bindgen::to_value(&diff).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Applies a DocumentDiffResult patch to a SemanticDocument
    pub fn apply_patch(
        &self,
        old_doc_json: JsValue,
        patch_json: JsValue,
    ) -> Result<JsValue, JsValue> {
        let old_doc: SemanticDocument = serde_wasm_bindgen::from_value(old_doc_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let patch: DocumentDiffResult = serde_wasm_bindgen::from_value(patch_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let result = core_apply_patch(&old_doc, &patch)
            .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

        serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Computes character-level inline diff between two text strings
    pub fn compute_inline_diff(
        &self,
        old_text: &str,
        new_text: &str,
    ) -> Result<JsValue, JsValue> {
        let changes = core_compute_inline_diff(old_text, new_text);
        serde_wasm_bindgen::to_value(&changes).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

impl Default for WasmAstDiffEngine {
    fn default() -> Self {
        Self::new()
    }
}
