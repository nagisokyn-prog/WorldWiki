# 🌐 worldwiki-ast-diff-wasm — WebAssembly-обёртка для AST Myers Diff

> **Слой Cerberus**: `core` (`crate-type = ["cdylib", "rlib"]`).  
> **Назначение**: Экспорт движка [`worldwiki-document-core`](../worldwiki-document-core/README_worldwiki-document-core.md) в JavaScript/TypeScript через `wasm-bindgen` и `serde-wasm-bindgen`.

---

## 📦 Зависимости (`Cargo.toml`)

- [`worldwiki-document-core`](../worldwiki-document-core/README_worldwiki-document-core.md) (с фичей `serde`).
- `wasm-bindgen`, `serde`, `serde-wasm-bindgen`.

---

## 🔌 Публичный WASM API ([`src/lib.rs`](./src/lib.rs))

Экспортируемая структура `WasmAstDiffEngine`:
- `new()` — конструктор экземпляра движка.
- `compute_diff(old_doc_json: JsValue, new_doc_json: JsValue) -> Result<JsValue, JsValue>` — вычисляет структурный и inline-diff между двумя версиями `SemanticDocument`.
- `apply_patch(old_doc_json: JsValue, patch_json: JsValue) -> Result<JsValue, JsValue>` — применяет `DocumentDiffResult` к `SemanticDocument`.
- `compute_inline_diff(old_text: &str, new_text: &str) -> Result<JsValue, JsValue>` — вычисляет символьный inline-diff двух строк.

---

## 🧪 Тестирование

```bash
cargo test -p worldwiki-ast-diff-wasm
```
