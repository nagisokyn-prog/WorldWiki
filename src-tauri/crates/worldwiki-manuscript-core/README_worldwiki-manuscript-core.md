# ✍️ worldwiki-manuscript-core — FSM-лексер сущностей и движок перекрёстных ссылок

> **Слой Cerberus**: `core` (`allowed_dependencies = []`, `#![no_std]` + `alloc`).  
> **Назначение**: Быстрый конечный автомат (FSM) для извлечения упоминаний сущностей формата `((Сущность))` из текста рукописи и разрешения перекрёстных ссылок по индексу.

---

## 📦 Зависимости (`Cargo.toml`)

- `hashbrown` (`alloc`, `default-hasher`) — `no_std`-совместимая хэш-таблица для индексации целей.
- Опциональная фича `serde` (`dep:serde`).
- Фича `kani` — формальная верификация в [`src/verify/`](./src/verify/mod.rs).

---

## 🏛️ Структура модулей (`src/`)

| Модуль | Назначение |
|---|---|
| [`lib.rs`](./src/lib.rs) | Реэкспорт `extract_entity_mentions`, `resolve_cross_references`, `CrossReference`, `ExtractedEntityMention`, `ResolvedCrossReference`, `TargetMetadata`. |
| [`fsm_lexer.rs`](./src/fsm_lexer.rs) | Детерминированный FSM-сканер `extract_entity_mentions` для поиска триггеров `((...))` за один проход. |
| [`crossref.rs`](./src/crossref.rs) | Функция `resolve_cross_references` — сопоставление ссылок с `HashMap<String, TargetMetadata>`. |
| [`types.rs`](./src/types.rs) | Структуры упоминаний, перекрёстных ссылок и метаданных целей. |
| [`verify/`](./src/verify/mod.rs) | Формальные доказательства Kani: [`verify_fsm_lexer.rs`](./src/verify/verify_fsm_lexer.rs), [`verify_crossref.rs`](./src/verify/verify_crossref.rs). |

---

## 🧪 Тестирование (`tests/`)

Набор тестов включает `positive_tests.rs`, `negative_tests.rs`, `exhaustive_model_tests.rs`, `stress_tests.rs`, `use_case_tests.rs`, `coverage_boost_tests.rs`:

```bash
cargo test -p worldwiki-manuscript-core
```
