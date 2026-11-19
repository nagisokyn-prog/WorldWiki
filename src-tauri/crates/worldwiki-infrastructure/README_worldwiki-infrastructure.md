# 🧱 worldwiki-infrastructure — Адаптеры Инфраструктуры (Driven Adapters)

> **Слой Cerberus**: `infrastructure` (`allowed_dependencies = ["domain", "ports", "application", "core"]`).  
> **Назначение**: Конкретные реализации портов из `worldwiki-ports` для embedded SurrealDB (`SurrealKv`), генерации документов (DOCX/EPUB/FB2), локальных и облачных бэкапов (ZIP / Яндекс.Диск), веб-скрапинга и обнаружения облачных моделей (`ARCH-004`).

---

## 📦 Зависимости (`Cargo.toml`)

- [`worldwiki-domain`](../worldwiki-domain/README_worldwiki-domain.md), [`worldwiki-ports`](../worldwiki-ports/README_worldwiki-ports.md).
- `surrealdb` (`kv-surrealkv`, `kv-mem`), `tokio`, `reqwest` (`rustls`), `zip` (`deflate`), `dashmap`, `chrono`, `uuid`, `tracing`.
- Фичи: `default = []`, `ver_1.1.0` (включает модуль `documents`), `razrab = []`.

---

## 🏛️ Структура модулей (`src/`)

| Модуль | Назначение и реализации |
|---|---|
| [`lib.rs`](./src/lib.rs) | Корень крейта, экспорт модулей и `InfrastructureError`. |
| [`errors.rs`](./src/errors.rs) & [`macros.rs`](./src/macros.rs) | Типизированные ошибки инфраструктуры и вспомогательные макросы. |
| [`paths.rs`](./src/paths.rs) | Разрешение системных путей данных (`get_surreal_db_path`, `get_backup_path`). |
| [`events/`](./src/events/mod.rs) | `InMemoryEventPublisher` — реализация `EventPublisherPort` для тестов и автономного режима. |
| [`mock_ai.rs`](./src/mock_ai.rs) | Заглушка AI-адаптеров при сборке без фичи `ai`. |
| [`surrealdb/`](./src/surrealdb/mod.rs) | Реализации репозиториев SurrealDB: [`repos/`](./src/surrealdb/repos/mod.rs) (`SurrealChapterRepository`, `SurrealEntityRepository`, `SurrealRelationRepository`, `SurrealPlotPromiseRepository`, `SurrealTodoRepository`, `SurrealStoryArcRepository`, `SurrealAnalyticsRepository`, `SurrealRAGAdapter`, `connections_repo`, `project_ops_repo`, `timeline_repo`, `volume_repo`, `fuzzy`, `helpers`, `rag_repo/`, `analytics_repo/`, `volume_ops_repo/`), [`chat_repo.rs`](./src/surrealdb/chat_repo.rs) (`SurrealChatRepository`, `chat_branching`, `chat_mapping`), [`profile_repo.rs`](./src/surrealdb/profile_repo.rs), [`skill_repo.rs`](./src/surrealdb/skill_repo.rs), [`memory_repos/`](./src/surrealdb/memory_repos/mod.rs) (in-memory репозитории для тестов), [`stemmer/`](./src/surrealdb/stemmer/mod.rs) (русский/английский стеммер). |
| [`documents/`](./src/documents/mod.rs) | *(Фича `ver_1.1.0`)* Компиляторы документов: [`docx/`](./src/documents/docx/mod.rs) (OpenXML ГОСТ), [`epub.rs`](./src/documents/epub.rs), [`fb2.rs`](./src/documents/fb2.rs), [`utils.rs`](./src/documents/utils.rs). |
| [`storage/`](./src/storage/mod.rs) | Резервное копирование [`backup/`](./src/storage/backup/mod.rs) (архивы `.wwiki`, валидация и санитайзинг бандлов) и интеграция с Яндекс.Диском [`yandex/`](./src/storage/yandex/mod.rs) (`auth`, `client`, `http`, `media`). |
| [`model_discovery/`](./src/model_discovery/mod.rs) | Опрос доступных моделей у внешних провайдеров (`anthropic`, `gemini`, `openai`, `openrouter`, `ollama`). |
| [`web/`](./src/web/mod.rs) | Веб-скрапер [`scraper/`](./src/web/scraper/mod.rs) (`duckduckgo`, `html_parser`, `hashing`, `url_utils`). |

---

## 🧪 Тестирование

```bash
cargo test -p worldwiki-infrastructure
```
