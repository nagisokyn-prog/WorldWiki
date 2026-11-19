# 🌐 worldwiki-manuscript-wasm — WebAssembly-обёртка для FSM-лексера рукописи

> **Слой Cerberus**: `core` (`crate-type = ["cdylib", "rlib"]`).  
> **Назначение**: Экспорт движка [`worldwiki-manuscript-core`](../worldwiki-manuscript-core/README_worldwiki-manuscript-core.md) в браузер/фронтенд через `wasm-bindgen`.

---

## 📦 Зависимости (`Cargo.toml`)

- [`worldwiki-manuscript-core`](../worldwiki-manuscript-core/README_worldwiki-manuscript-core.md) (с фичей `serde`).
- `wasm-bindgen`, `serde`, `serde-wasm-bindgen`, `hashbrown` (`serde`).

---

## 🔌 Публичный WASM API ([`src/lib.rs`](./src/lib.rs))

Экспортируемая структура `WasmManuscriptEngine`:
- `new()` — конструктор экземпляра движка.
- `extract_entities(text: &str) -> Result<JsValue, JsValue>` — высокоскоростное FSM-извлечение всех упоминаний `((Сущность))` из текста рукописи.
- `resolve_cross_references(references_json: JsValue, index_json: JsValue) -> Result<JsValue, JsValue>` — разрешение коллекции перекрёстных ссылок по JSON-индексу `HashMap<String, TargetMetadata>`.

---

## 🧪 Тестирование

```bash
cargo test -p worldwiki-manuscript-wasm
```
