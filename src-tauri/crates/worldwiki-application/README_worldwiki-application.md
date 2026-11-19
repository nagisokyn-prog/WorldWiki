# ⚙️ worldwiki-application — Сценарии Использования, Аналитика и AI-Фасады

> **Слой Cerberus**: `application` (`allowed_dependencies = ["domain", "ports", "core"]`).  
> **Назначение**: Use Cases, CQRS-сервисы, атомарные воркфлоу и 8 консолидированных AI-фасадов. Полностью изолирован от `tauri` и конкретных адаптеров `infrastructure` (`ARCH-002`, `ARCH-006`, `ARCH-007`, `ARCH-008`, `ARCH-012`).

---

## 📦 Зависимости (`Cargo.toml`)

- [`worldwiki-domain`](../worldwiki-domain/README_worldwiki-domain.md) — модели предметной области и `DomainError`.
- [`worldwiki-ports`](../worldwiki-ports/README_worldwiki-ports.md) — интерфейсы репозиториев, AI и шины событий.
- `async-trait`, `serde`, `serde_json`, `thiserror`, `tokio`, `chrono`, `uuid`.

---

## 🏛️ Структура модулей (`src/`)

| Модуль | Назначение и ключевые компоненты |
|---|---|
| [`lib.rs`](./src/lib.rs) | Корень крейта, экспорт модулей и `ApplicationError`. |
| [`errors.rs`](./src/errors.rs) | `ApplicationError` (`NotFound`, `Conflict`, `Validation`, `Domain`, `Cancelled`, `ExecutionFailed`, `PermissionDenied`). |
| [`manuscript/`](./src/manuscript/mod.rs) | `ManuscriptServices`, `SaveChapterWithMentionsWorkflow`, [`mentions.rs`](./src/manuscript/mentions.rs) (извлечение и синхронизация упоминаний `((Сущность))`). |
| [`knowledge/`](./src/knowledge/mod.rs) | `KnowledgeServices` — получение полных карточек сущностей, управление сущностями и связями. |
| [`calendar/`](./src/calendar/mod.rs) | `CalendarServices` ([`usecases.rs`](./src/calendar/usecases.rs), [`dtos.rs`](./src/calendar/dtos.rs)) — конвертация абсолютного времени и календарных дат. |
| [`plot/`](./src/plot/mod.rs) | `PlotServices`, `StoryArcServices`, [`arc_services.rs`](./src/plot/arc_services.rs), [`audit_services.rs`](./src/plot/audit_services.rs), [`todo_services.rs`](./src/plot/todo_services.rs). |
| [`analytics/`](./src/analytics/mod.rs) | Сервисы литературного анализа: `CharacterJourneyService`, `CrossReferenceMatrixService`, `ItemTrackerService`, `ManuscriptAnalyticsService`, `TimelineInspectorService`. |
| [`workflows/`](./src/workflows/mod.rs) | Атомарные составные сценарии: `EditManuscriptAtomicWorkflow` ([`edit_manuscript_workflow.rs`](./src/workflows/edit_manuscript_workflow.rs)) и `HybridSemanticSearchWorkflow` ([`hybrid_search_workflow.rs`](./src/workflows/hybrid_search_workflow.rs)). |
| [`common/`](./src/common/mod.rs) | [`job_manager.rs`](./src/common/job_manager.rs) — `JobManager` с отменой длительных операций через `CancellationToken` (`ARCH-010`). |
| [`ai/`](./src/ai/mod.rs) | Оркестрация ИИ: [`tools/`](./src/ai/tools/mod.rs) (`AiToolFacades` — 8 AI-фасадов, `manuscript_tools`, `entity_tools`, `system_tools`), [`chat_services/`](./src/ai/chat_services/mod.rs) (`ChatServices`, `agent_loop`, `tool_dispatcher`, `approval`, `rag_context`, `session_service`), [`local_services.rs`](./src/ai/local_services.rs) (`LocalAiServices`), [`prompt/`](./src/ai/prompt/mod.rs), [`research/`](./src/ai/research/mod.rs), [`schema_adapter/`](./src/ai/schema_adapter/mod.rs), [`assembler.rs`](./src/ai/assembler.rs), [`budget.rs`](./src/ai/budget.rs), [`lineage.rs`](./src/ai/lineage.rs). |

---

## 🧪 Тестирование (`tests/`)

Юнит- и интеграционные тесты Use Cases на In-Memory моках (`analytics_services.rs`, `integration_workflows.rs`, `manuscript_mentions.rs`, `plot_services.rs`):

```bash
cargo test -p worldwiki-application
```
