# 🔌 worldwiki-ports — Вторичные Порты и Контракты (Secondary Ports)

> **Слой Cerberus**: `ports` (`allowed_dependencies = ["domain", "core"]`).  
> **Назначение**: Чистые асинхронные трейты (интерфейсы) репозиториев, AI-подсистемы, хранилищ и публикации событий. Не содержит конкретных реализаций (`ARCH-003`).

---

## 📦 Зависимости (`Cargo.toml`)

- [`worldwiki-domain`](../worldwiki-domain/README_worldwiki-domain.md) — доменные сущности и `DomainError`.
- `async-trait`, `serde`, `serde_json`, `thiserror`, `tokio` (`sync`).
- Фичи: `default = []`, `ver_1.1.0 = ["worldwiki-domain/ver_1.1.0"]`.

---

## 🏛️ Структура модулей (`src/`)

### 1. [`repositories/`](./src/repositories/mod.rs) — Порты персистентности
- [`manuscript.rs`](./src/repositories/manuscript.rs) — `ChapterRepository` и контракты работы с главами/текстовыми блоками.
- [`knowledge.rs`](./src/repositories/knowledge.rs) — `EntityRepository`, `RelationRepository` для лора и графа связей.
- [`timeline.rs`](./src/repositories/timeline.rs) — контракты хронологии и событий таймлайна.
- [`analytics.rs`](./src/repositories/analytics.rs) — `AnalyticsRepositoryPort` для аналитических выборок.
- [`plot.rs`](./src/repositories/plot.rs) — агрегирует подмодули [`plot/arc.rs`](./src/repositories/plot/arc.rs) (`StoryArcRepository`), [`plot/promise.rs`](./src/repositories/plot/promise.rs) (`PlotPromiseRepository`) и [`plot/todo.rs`](./src/repositories/plot/todo.rs) (`TodoRepository`).

### 2. [`ai/`](./src/ai/mod.rs) — Порты ИИ и локального инференса
- [`chat.rs`](./src/ai/chat.rs) — `ChatRepository`, `AiProfileRepository` для дерева чатов, сообщений и профилей.
- [`inference.rs`](./src/ai/inference.rs) — контракты генерации и инференса.
- [`models.rs`](./src/ai/models.rs) — `HardwareDetectorPort`, `LocalModelManagerPort`, `ModelHubPort`, управление разрешениями.
- [`research.rs`](./src/ai/research.rs) — `RAGContextPort` и контракты исследовательского пайплайна.
- [`skills.rs`](./src/ai/skills.rs) — `SkillRepositoryPort` для навыков агента.
- [`stream.rs`](./src/ai/stream.rs) — `LlmStreamPort` для потоковой генерации ответов.

### 3. [`storage.rs`](./src/storage.rs) — Файловая система и компиляция документов
- `FileSystemPort` (`read_file`, `write_file`, `exists`).
- `DocumentCompilerPort` (под фичей `ver_1.1.0`) — компиляция `SemanticDocument` + `ExportConfig` в бинарный буфер.

### 4. [`events.rs`](./src/events.rs) — Шина доменных событий (`ARCH-006`)
- Трейты `ApplicationEvent`, `EventPublisherPort`, `EventPublisherExt`.
- Типизированные события: `ChapterUpdatedEvent` (`"chapter_updated"`), `EntityChangedEvent` (`"entity_changed"`), `PlotPromiseUpdatedEvent` (`"plot_promise_updated"`).

---

## 🧪 Тестирование

```bash
cargo test -p worldwiki-ports
```
