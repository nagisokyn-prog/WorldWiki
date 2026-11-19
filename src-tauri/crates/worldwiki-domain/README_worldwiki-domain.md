# 🧠 worldwiki-domain — Чистый Домен и Бизнес-Инварианты

> **Слой Cerberus**: `domain` (`allowed_dependencies = ["core"]`).  
> **Назначение**: Модели предметной области, Value Objects, доменные инварианты и ошибки `DomainError` для WorldWiki. Полностью изолирован от `tauri`, `surrealdb`, `reqwest`, `tokio` и любых внешних SDK (`ARCH-001`).

---

## 📦 Зависимости (`Cargo.toml`)

- [`worldwiki-calendar-core`](../worldwiki-calendar-core/README.md) — математическое ядро календарей и шкалы времени.
- `serde`, `serde_json` — сериализация доменных DTO.
- `chrono` (`clock`, `std`, `serde`) — временные метки метаданных.
- `thiserror` — декларативное определение `DomainError`.
- Фичи: `default = []`, `kani = []` (формальная верификация), `ver_1.1.0 = []`.

---

## 🏛️ Структура модулей (`src/`)

| Модуль | Назначение и ключевые сущности |
|---|---|
| [`lib.rs`](./src/lib.rs) | Корень крейта, реэкспорт `DomainError`, `DomainResultExt`, `OptionStrExt`, модульные юнит-тесты. |
| [`errors.rs`](./src/errors.rs) | Перечисление `DomainError` (`Validation`, `ConstraintViolation`, `InvalidStateTransition`, `InvalidTimelineMinute`, `InvalidAstNode`, `InvalidPlotPromise`, `InvalidEntityRelation`) и расширения контекста ошибок. |
| [`ai/`](./src/ai/mod.rs) | Модели ИИ-подсистемы: `chat.rs` (чаты, сообщения, ветки), `context.rs`, `research.rs`, `types.rs` (оборудование `HardwareInfo`, карточки моделей `HfModelCard`, `InstalledModelInfo`, разрешения `ToolPermissionConfig`). |
| [`analytics/`](./src/analytics/mod.rs) | Доменные модели литературной аналитики: `character_journey.rs`, `chekhov_guns.rs`, `cross_ref.rs`, `graph_slice.rs`, `timeline_inspector.rs`. |
| [`calendar/`](./src/calendar/mod.rs) | Модели времени и хронологии: `math.rs` (золотой эталон абсолютной минуты $M_{\text{abs}}$), `models.rs`, `reveal.rs` (`EventReveal`), `timeline_event.rs` (`TimelineEvent`). |
| [`document/`](./src/document/mod.rs) | Модели экспорта и документов: `ast.rs` (`SemanticDocument`), `export.rs` (`ExportConfig` и форматы экспорта). |
| [`knowledge/`](./src/knowledge/mod.rs) | База знаний (лор): `entity.rs` (`Entity`), `relation.rs` (типизированные связи), `schema.rs` (пользовательские схемы полей). |
| [`manuscript/`](./src/manuscript/mod.rs) | Рукопись: `chapter.rs` (`Chapter`), `volume.rs`, `text_block.rs` (`TextBlock`), `mention_parser.rs` (триггер `((Сущность))`), `ascii_scanner.rs`, `id_extractor.rs`, `appearance.rs` (`EntityAppearance`, `AppearanceSource`), `status.rs`. |
| [`plot/`](./src/plot/mod.rs) | Сюжет и планирование: `promise.rs` (`PlotPromise`, `PromiseKind`, `PromiseStatus`), `plan.rs`, `arc.rs` (`StoryArc`, `ArcStatus`), `todo.rs` (`Todo`). |
| [`storage/`](./src/storage/mod.rs) | Доменные структуры резервного копирования и облачного хранения. |
| [`verify/`](./src/verify/mod.rs) | Харнессы формальной верификации Kani (`#[cfg(any(kani, feature = "kani"))]`, `verify_manuscript.rs`). |

---

## 🧪 Тестирование

```bash
cargo test -p worldwiki-domain
```
