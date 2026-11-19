# 🚪 worldwiki-tauri — Driving Adapter для Tauri v2 IPC и AppState

> **Слой Cerberus**: `tauri` (`allowed_dependencies = ["domain", "ports", "application", "infrastructure", "core"]`).  
> **Назначение**: Единственный крейт среди слоёв гексагонального ядра, которому разрешено импортировать `tauri::*` (`ARCH-005`). Предоставляет IPC-команды, `AppState`/`AppServices`, трансляцию ошибок в `IpcError` и публикацию событий во фронтенд.

---

## 📦 Зависимости (`Cargo.toml`)

- [`worldwiki-domain`](../worldwiki-domain/README_worldwiki-domain.md), [`worldwiki-ports`](../worldwiki-ports/README_worldwiki-ports.md), [`worldwiki-application`](../worldwiki-application/README_worldwiki-application.md), [`worldwiki-infrastructure`](../worldwiki-infrastructure/README_worldwiki-infrastructure.md).
- Опциональная зависимость: [`worldwiki-ai`](../worldwiki-ai/README_worldwiki-ai.md) (под фичей `ai`).
- `tauri` (`protocol-asset`), `surrealdb`, `tokio`, `reqwest`, `serde`, `serde_json`, `thiserror`, `async-trait`.
- Фичи: `default = []`, `ai = ["dep:worldwiki-ai"]`, `ver_1.1.0`, `razrab`.

---

## 🏛️ Структура модулей (`src/`)

| Модуль | Назначение |
|---|---|
| [`lib.rs`](./src/lib.rs) | Экспорт `IpcError`, `AppState`, `AppServices`, `TauriEventPublisher` и модулей `commands`, `bridge_macro`. |
| [`state.rs`](./src/state.rs) | Контейнер зависимостей `AppServices` (все сервисы `application`, `JobManager`, `db`) и обёртка `AppState`. |
| [`error.rs`](./src/error.rs) | `IpcError { code, message, details }` — маппинг `ApplicationError` и `DomainError` в типизированный JSON-ответ фронтенду (`ERR-007`). |
| [`events.rs`](./src/events.rs) | `TauriEventPublisher` — реализация `EventPublisherPort` через `tauri::AppHandle`. |
| [`bridge_macro.rs`](./src/bridge_macro.rs) | Макрос `bridge_command!` для декларативного связывания `#[tauri::command]` с методами `AppServices` (синхронными и асинхронными). |
| [`commands/`](./src/commands/mod.rs) | Модульные Tauri IPC-команды: [`ai.rs`](./src/commands/ai.rs), [`analytics.rs`](./src/commands/analytics.rs), [`backup.rs`](./src/commands/backup.rs), [`calendar.rs`](./src/commands/calendar.rs), [`chat/`](./src/commands/chat/mod.rs) (`messages`, `profiles`, `sessions`, `tools`), [`connections.rs`](./src/commands/connections.rs), [`documents.rs`](./src/commands/documents.rs) *(фича `ver_1.1.0`)*, [`knowledge.rs`](./src/commands/knowledge.rs), [`local_ai.rs`](./src/commands/local_ai.rs), [`manuscript.rs`](./src/commands/manuscript.rs), [`plot.rs`](./src/commands/plot.rs), [`projects.rs`](./src/commands/projects.rs), [`story_arcs.rs`](./src/commands/story_arcs.rs), [`volumes.rs`](./src/commands/volumes.rs). |

---

## 🧪 Тестирование

```bash
cargo test -p worldwiki-tauri
```
