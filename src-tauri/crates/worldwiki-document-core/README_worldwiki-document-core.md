# 📄 worldwiki-document-core — Чистое Ядро AST Myers Diff и Patching

> **Слой Cerberus**: `core` (`allowed_dependencies = []`, `#![no_std]` + `alloc`).  
> **Назначение**: Высокопроизводительный детерминированный движок вычисления структурного и посимвольного diff, а также применения патчей для `SemanticDocument`.

---

## 📦 Зависимости (`Cargo.toml`)

- Нулевые внешние runtime-зависимости по умолчанию (`#![no_std]`, `extern crate alloc`).
- Опциональная фича `serde` (`dep:serde` с `alloc`, `derive`) для сериализации AST и результатов diff.
- Фича `kani` — включает модуль формальной верификации [`src/verify/`](./src/verify/mod.rs).

---

## 🏛️ Структура модулей (`src/`)

| Модуль | Назначение |
|---|---|
| [`lib.rs`](./src/lib.rs) | Публичный API: `diff_documents`, `apply_patch`, `compute_inline_diff`, `apply_inline_changes`, `myers_diff`, типы `SemanticDocument`, `SemanticBlock`, `DocumentDiffResult`, `DiffOperation`, `InlineChange`, `EditOp`, `PatchError`, `InlineApplyError`. |
| [`model.rs`](./src/model.rs) | Модели семантических блоков документа, операций diff и ошибок патчинга. |
| [`myers/`](./src/myers/mod.rs) | Реализация алгоритма Майерса (Myers diff): [`trace.rs`](./src/myers/trace.rs), [`backtrack.rs`](./src/myers/backtrack.rs), [`ops.rs`](./src/myers/ops.rs). |
| [`diff.rs`](./src/diff.rs) | Высокоуровневое структурное сравнение блоков `SemanticDocument`. |
| [`inline_diff.rs`](./src/inline_diff.rs) | Посимвольный/строковый inline-diff (`compute_inline_diff`, `apply_inline_changes`). |
| [`patch.rs`](./src/patch.rs) | Применение `DocumentDiffResult` к `SemanticDocument` (`apply_patch`). |
| [`verify/`](./src/verify/mod.rs) | Kani-доказательства: [`verify_myers.rs`](./src/verify/verify_myers.rs), [`verify_inline.rs`](./src/verify/verify_inline.rs), [`verify_patch.rs`](./src/verify/verify_patch.rs). |

---

## 🧪 Тестирование (`tests/`)

Покрыт интеграционными, негативными, стресс- и property-тестами (`positive_tests.rs`, `negative_tests.rs`, `exhaustive_model_tests.rs`, `stress_tests.rs`, `use_case_tests.rs`, `coverage_boost_tests.rs`):

```bash
cargo test -p worldwiki-document-core
```
