# 🤖 worldwiki-ai — Среда Исполнения ИИ-Агента, Локальный LLM и RAG

> **Слой Cerberus**: `infrastructure` (опциональный крейт, подключаемый фичей `ai`, версия `0.60.0`).  
> **Назначение**: Локальный инференс GGUF-моделей через [`llama-sys`](../../llama-sys/README_llama-sys.md), интеграция с рантаймом `claw-code`, детекция железа (WinAPI/DXGI), загрузка моделей с Hugging Face Hub и гибридный RAG-пайплайн.

---

## 📦 Зависимости (`Cargo.toml`)

- [`worldwiki-domain`](../worldwiki-domain/README_worldwiki-domain.md), [`worldwiki-ports`](../worldwiki-ports/README_worldwiki-ports.md), [`worldwiki-application`](../worldwiki-application/README_worldwiki-application.md).
- [`llama-sys`](../../llama-sys/README_llama-sys.md) — нативный C FFI к `llama-turboquant-cpp` (CUDA).
- `claw_runtime`, `claw_api` (из `vendor/claw-code/rust/crates/`).
- `surrealdb`, `reqwest` (`rustls`), `tokio`, `serde`, `serde_json`, `tracing`, `uuid`, `chrono`.

---

## 🏛️ Структура модулей (`src/`)

| Модуль | Назначение и ключевые типы |
|---|---|
| [`lib.rs`](./src/lib.rs) | Реэкспорт адаптеров: `MockAiAdapter`, `WinApiHardwareDetector`, `StaticPermissionsCatalog`, `FsLocalModelManager`, `ClawStreamAdapter` и модулей `hub`, `chunker`, `retrieval`, `client`, `local_llm`. |
| [`hardware.rs`](./src/hardware.rs) | `WinApiHardwareDetector` — определение RAM и VRAM GPU через WinAPI/DXGI. |
| [`local_manager.rs`](./src/local_manager.rs) & [`model_scanner.rs`](./src/model_scanner.rs) | `FsLocalModelManager` — управление локальными GGUF-моделями на диске и сканирование каталога. |
| [`hub.rs`](./src/hub.rs) | Взаимодействие с Hugging Face Model Hub и стриминг загрузки моделей. |
| [`permissions.rs`](./src/permissions.rs) | `StaticPermissionsCatalog` — каталог политик автоодобрения и уровней доступа инструментов. |
| [`local_llm/`](./src/local_llm/mod.rs) | Движок локального инференса на `llama-sys`: `model.rs`, `slot.rs`, `generator.rs`, `sampler.rs`, `tokenizer.rs`, `embeddings.rs`, `checkpoint.rs`, `error.rs`. |
| [`claw_adapter/`](./src/claw_adapter/mod.rs) | `ClawStreamAdapter` — мост к `claw_runtime` / `claw_api` (`payload_builder.rs`, `stream_consumer.rs`, `types.rs`). |
| [`client.rs`](./src/client.rs) & [`model_discovery/`](./src/model_discovery/mod.rs) | HTTP-клиенты и обнаружение моделей провайдеров (`anthropic`, `gemini`, `openai`, `openrouter`, `ollama`). |
| [`chunker.rs`](./src/chunker.rs) & [`retrieval/`](./src/retrieval/mod.rs) | Семантическая нарезка текста, эмбеддер (`embedder.rs`), фоновый индексатор (`indexer.rs`), анализ запросов (`query_analyzer/`) и маршрутизация поиска (`router/`: `exact_search`, `hybrid_search`, `greetings`). |
| [`mock_ai.rs`](./src/mock_ai.rs) | `MockAiAdapter` для детерминированного тестирования. |

---

## 🧪 Тестирование

```bash
cargo test -p worldwiki-ai
```
