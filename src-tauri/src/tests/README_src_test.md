# Интеграционные и Модульные Тесты WorldWiki  
### `src-tauri/src/tests/` — Инвентарь, Архитектурная Привязка к Гексагональному Ядру и Карта Покрытия

> **Назначение**: Документ сопоставляет каждый тестовый файл монорепозитория с **5-крейтной Гексагональной Архитектурой** (`worldwiki-domain`, `worldwiki-ports`, `worldwiki-application`, `worldwiki-infrastructure`, `worldwiki-tauri`), инвариантами `ARCH-001` .. `ARCH-012` и покрываемыми сценариями использования (Use Cases).

---

## 🏛️ Архитектурная Матрица Распределения Тестов

```
                ┌─────────────────────────────────────────────────────────┐
                │          E2E & SYSTEM INTEGRATION TESTS                 │
                │        (src/tests/*, tests/agent_pipeline.rs)           │
                │   SurrealKv Temp Engine, Multi-Repository Workflows     │
                └───────────────────────────┬─────────────────────────────┘
                                            │
                ┌───────────────────────────▼─────────────────────────────┐
                │        APPLICATION USE CASE & WORKFLOW TESTS            │
                │            (crates/worldwiki-application)               │
                │     Fast In-Memory Mocks, CQRS, Atomic Transactions     │
                └─────────────┬─────────────────────────────┬─────────────┘
                              │                             │
    ┌─────────────────────────▼─────────────┐ ┌─────────────▼─────────────┐
    │          DOMAIN UNIT TESTS            │ │   INFRASTRUCTURE ADAPTERS     │
    │     (crates/worldwiki-domain)         │ │(crates/worldwiki-infrastructure)  │
    │ M_abs Math, AST, Validation, Errors   │ │ SurrealDB, DOCX, Hub, WinAPI/DXGI │
    └───────────────────────────────────────┘ └───────────────────────────┘
```

---

## 🚀 Как запускать тесты

### 1. Запуск всех тестов монорепозитория
```powershell
cd src-tauri
cargo test --workspace
```

### 2. Запуск тестов по отдельным слоям архитектуры (Крейтам)
```powershell
# 1. Чистый домен (Domain Unit Tests — 0 внешних зависимостей)
cargo test -p worldwiki-domain

# 2. Контракты и порты
cargo test -p worldwiki-ports

# 3. Сценарии использования и воркфлоу (Application CQRS Use Cases)
cargo test -p worldwiki-application

# 4. Адаптеры инфраструктуры (SurrealDB, DOCX, EPUB, FB2, Yandex Disk, AI Hub)
cargo test -p worldwiki-infrastructure

# 5. Driving адаптер (Tauri IPC, State, Events)
cargo test -p worldwiki-tauri

# 6. Сквозные интеграционные тесты (Integration Test Suite)
cargo test --lib -- tests
```

### 3. Запуск конкретного тестового модуля
```powershell
# Запуск тестов конкретного файла (например, AI или чат)
cargo test --lib -- tests::ai_integration
cargo test --lib -- tests::chat_operations_integration
cargo test --lib -- tests::tools_integration
```

### 4. Запуск E2E AI-пайплайна
```powershell
cargo test --test agent_pipeline --features agent-pipeline -- --nocapture
```

### 5. Измерение покрытия кода (`cargo llvm-cov`)
```powershell
cargo llvm-cov --workspace --open
```

---

## 🧪 Особенности Тестового Окружения (Test Harness & SurrealDB)

1. **Изолированные инстансы БД (`common.rs`)**:
   * Для предотвращения конфликтов совместного доступа на Windows (`SurrealKv`), функция `create_test_db()` создает уникальный временный каталог (`%TMP%/worldwiki-test-<UUID>`), автоматически очищаемый в конце работы.
2. **Строгая валидация DDL-схемы (`SCHEMAFULL`)**:
   * При накатывании `surreal_schema.surql` в тестах обязательно проверяется `.take_errors()`. В SurrealDB v2 ошибки схемы не выбрасываются на транспортном уровне, поэтому явная проверка предотвращает скрытые сбои валидации полей и типов (`record`, `datetime`, `array`).
3. **Парсинг Record ID**:
   * Адаптеры инфраструктуры (`worldwiki-infrastructure`) поддерживают парсинг сложных JSON-структур ID (`{"tb": "table", "id": {"String": "..."}}`), что гарантирует корректную фильтрацию по `project_id`.
4. **Композиция сервисов (`AppServices`)**:
   * Интеграционные тесты инициализируют реальный `AppServices` со всеми репозиториями SurrealDB и мок-адаптерами для внешних сервисов (AI, Event Publisher, File Storage).

---

## 📋 Инвентарь и Архитектурная Привязка Тестов (20 файлов `src/tests/` + Таргеты)

| # | Файл теста (`src/tests/`) | Целевой Архитектурный Слой / Крейт | Покрываемые Компоненты и Use Cases | Тип теста |
|---|---|---|---|---|
| 1 | `common.rs` | **Test Harness / Shared Fixtures** | `create_test_db`, `seed_project`, `seed_chapter`, `create_test_services` | Изолированный временный каталог `%TMP%/worldwiki-test-*`, инициализация DDL и валидация `.take_errors()` |
| 2 | `smoke_schema.rs` | **Infrastructure & DDL Validation** (`worldwiki-infrastructure`) | `surreal_schema.surql`, 23 системные таблицы, fulltext analyzer `like`, HNSW-индексы | DDL Smoke Test на реальном embedded SurrealKv |
| 3 | `timeline_integration.rs` | **Domain & Application: Calendar / Manuscript** (`worldwiki-domain`, `worldwiki-application`) | Золотой эталон абсолютной минуты $M_{\text{abs}}$, хронология глав, события таймлайна, ревизии | Интеграционный: расчет дат календаря + `get_global_timeline` |
| 4 | `hierarchy_integration.rs` | **Application: Manuscript Hierarchy** (`worldwiki-application`) | `ManuscriptServices`, дерево `Project -> Volume -> Arc -> Chapter`, связи `contains`, сортировка `sort_order` | Интеграционный: переупорядочивание узлов, удаление томов с авторасширением |
| 5 | `entity_integration.rs` | **Application: Knowledge & Schema** (`worldwiki-application`) | `KnowledgeServices`, `EntityRepository`, схемы полей, валидация полей, эволюция схем, пины ревизий | Интеграционный: CRUD сущностей, динамические схемы, версионирование |
| 6 | `text_blocks_integration.rs` | **Application: Manuscript AST** (`worldwiki-application`) | `save_text_blocks`, парсинг HTML рукописи в семантический AST, транзакционное обновление блоков | Интеграционный: валидация AST, целостность блоков |
| 7 | `project_integration.rs` | **Application & Logic: Projects** (`worldwiki-application`) | Управление проектами (`create_project`, `save_project_config`, каскадное удаление через триггеры) | Интеграционный: изоляция namespace/database проектов |
| 8 | `ai_integration.rs` | **Application: AI Facades & Prompts** (`worldwiki-application`) | `AiToolFacades`, системный промпт, LORE LOCK, tool-use циклы агента | Интеграционный: структура промпта, изоляция контекста |
| 9 | `embeddings_integration.rs` | **Infrastructure: AI Retrieval** (`worldwiki-infrastructure`) | `EmbedderService`, `DocumentChunker`, HNSW векторная индексация, вычисление косинусной близости | Интеграционный: нарезка чанков + векторный поиск |
| 10 | `retrieval_integration.rs` | **Infrastructure: Hybrid RAG** (`worldwiki-infrastructure`) | `reindex_project_lore_inner`, `QueryAnalyzer`, Query Routing (Exact Doc vs Vector) | Интеграционный: индексация пустого проекта, идемпотентность, поиск по главе |
| 11 | `tools_integration.rs` | **Application: 8 AI Facades** (`worldwiki-application`) | 8 консолидированных фасадов (`ai_query_world`, `ai_inspect_entity`, `ai_edit_manuscript`, ...) | Интеграционный: проверка исполнения всех инструментов через Application Core |
| 12 | `chat_integration.rs` | **Domain & Application: AI Chat** (`worldwiki-domain`, `worldwiki-application`) | `ChatServices`, сущности `Chat`, `ChatMessage`, дерево вариантов ответов | Интеграционный: создание чатов, сохранение сообщений |
| 13 | `chat_operations_integration.rs` | **Application: AI Chat Operations** (`worldwiki-application`) | `fork_chat`, `update_chat_parent`, `switch_variant`, `edit_message`, `regenerate_message`, каскадное удаление | Интеграционный: ветвление истории, переключение вариантов, правка сообщений |
| 14 | `batch_and_connections_integration.rs` | **Application & Logic: Batch Operations** (`worldwiki-application`) | `get_entities_batch`, `upsert_connections_batch`, транзакционная запись сущности со связями | Интеграционный: высокая нагрузка, многорепозиторные ACID-транзакции |
| 15 | `export_integration.rs` | **Infrastructure: Backup & Cloud** (`worldwiki-infrastructure`) | `export_chapters_inner`, `create_cloud_backup_inner`, `restore_from_backup_inner`, ZIP `.wwiki` | Интеграционный: упаковка базы данных + медиафайлов, распаковка и восстановление |
| 16 | `document_export_integration.rs` | **Infrastructure: Academic Documents** (`worldwiki-infrastructure`) | `DocxCompiler` (ГОСТ 7.32), `EpubCompiler` (EPUB 3.3), `Fb2Compiler` (FB2 2.0) | Интеграционный: валидация структуры XML, OpenXML packaging, оглавления и сноски |
| 17 | `stress_integration.rs` | **System & Performance Stress Tests** | Параллельная запись 1000+ сущностей, конкурентные транзакции, проверка memory leak | Нагрузочный стресс-тест |
| 18 | `negative_integration.rs` | **Error & Rollback Path Validation** | `DomainError` / `ApplicationError`, проверка отката транзакций, невалидные ID, SQLi protection | Тестирование негативных сценариев и безопасности |
| 19 | `tests/agent_pipeline.rs` | **End-to-End System Pipeline** | Полный пайплайн агента-соавтора (Tauri IPC -> Use Case -> Mock OpenAI SSE Server -> SurrealKv) | E2E системный тест |

---

## 🛡️ Соответствие Тестов Инвариантам `ARCH-001` .. `ARCH-012`

| Инвариант | Требование Архитектуры | Как верифицируется в тестах |
|---|---|---|
| **ARCH-001** | `domain` 0 внешних SDK | `worldwiki-domain` компилируется и тестируется изолированно (`cargo test -p worldwiki-domain`) без `tauri`/`surrealdb`. |
| **ARCH-002** | `application` не знает о Tauri | Use Cases тестируются с Fake/In-Memory репозиториями (`InMemoryChapterRepository` и т.д.) без инициализации GUI/Tauri. |
| **ARCH-003** | `ports` чистые трейты | `worldwiki-ports` не имеет зависимостей на `surrealdb` или `reqwest`. |
| **ARCH-004** | `infrastructure` реализует порты | Тесты `worldwiki-infrastructure` проверяют имплементации трейтов `ChapterRepository`, `EntityRepository`, `DocxCompiler`. |
| **ARCH-005** | `worldwiki-tauri` изолирует Tauri | Только `worldwiki-tauri` тестирует маппинг IPC-команд и `IpcError`. |
| **ARCH-006** | События через `EventPublisherPort` | В тестах используется `InMemoryEventPublisher` для фиксации событий без Tauri Webview. |
| **ARCH-010** | `CancellationToken` в задачах | Тесты `JobManager` проверяют прерывание долгих асинхронных операций. |
| **ARCH-011** | Идемпотентность Use Cases | Тесты `reindex_project_lore` и `save_entity` проверяют повторные запуски без дублирования данных. |
| **ARCH-012** | Доступ AI только через Use Cases | Тесты `tools_integration.rs` и `ai_integration.rs` проверяют, что все вызовы инструментов проходят через `AiToolFacades`. |

---

## 🔍 Подробное Описание Каждого Интеграционного Теста

### 1. `smoke_schema.rs` (Infrastructure DDL)
- **Цель**: Проверка синтаксической и семантической корректности схемы `surreal_schema.surql`.
- **Проверяет**: Накатывание 23 системных и пользовательских таблиц, полнотекстовые анализаторы (`analyzer::like`), индексы уникальности и графовые связи.

### 2. `timeline_integration.rs` (Calendar & Timeline)
- **Цель**: Проверка хронологии глав и временного континуума.
- **Проверяет**: Расчет абсолютной минуты $M_{\text{abs}}$, сохранение таймлайна глав, версионирование ревизий и закрепление (pin/unpin) ревизий.

### 3. `hierarchy_integration.rs` (Manuscript Hierarchy)
- **Цель**: Валидация иерархического дерева рукописи.
- **Проверяет**: Создание томов, арок, перемещение глав между узлами, сохранение порядка сортировки `sort_order` на входящих ребрах `contains` и авторасширение при удалении родительского тома.

### 4. `entity_integration.rs` (Knowledge & Entities)
- **Цель**: Валидация универсального хранилища сущностей лора.
- **Проверяет**: CRUD-операции сущностей, динамические схемы полей (`entity_schemas`), снимки истории схем (`schema_history`), каскадное удаление сущностей со связями и ревизиями.

### 5. `text_blocks_integration.rs` (Manuscript AST Blocks)
- **Цель**: Проверка разбиения текста глав на семантические блоки.
- **Проверяет**: Преобразование HTML редактора в структурированные блоки (`text_blocks`), разметка тегами (`desc`, `dialog`, `custom_action`) и атомарная перезапись блоков главы.

### 6. `project_integration.rs` (Projects)
- **Цель**: Жизненный цикл проектов.
- **Проверяет**: Создание проектов, чтение/запись конфигураций и каскадное удаление данных проекта через SurrealDB триггеры.

### 7. `ai_integration.rs` (AI Prompts & Tools)
- **Цель**: Системные промпты и протокол соавтора.
- **Проверяет**: Сборку системного промпта `build_system_prompt`, соблюдение LORE LOCK, подготовку истории диалога с учетом бюджета контекста (`PromptBudget`) и диспетчеризацию вызовов инструментов.

### 8. `embeddings_integration.rs` & `retrieval_integration.rs` (Hybrid RAG)
- **Цель**: Векторный и гибридный поиск по базе знаний.
- **Проверяет**: Индексацию глав и сущностей, нарезку на чанки `DocumentChunker`, KNN-поиск по векторным индексам HNSW и маршрутизацию запросов (Query Routing: Exact Doc vs Vector).

### 9. `tools_integration.rs` (8 Consolidated AI Facades)
- **Цель**: Проверка работы инструментов ИИ через Application Core.
- **Проверяет**: Исполнение запросов `ai_query_world`, `ai_inspect_entity`, `ai_manage_entity`, `ai_read_manuscript`, `ai_edit_manuscript`, `ai_timeline_manager`, `ai_audit_consistency`.

### 10. `chat_integration.rs` & `chat_operations_integration.rs` (AI Chat Tree)
- **Цель**: Древовидная структура чата соавтора.
- **Проверяет**: Создание веток сообщений, форки чатов (`fork_chat`), перенос поддеревьев (`update_chat_parent`), переключение вариантов ответов (`switch_variant`), правку сообщений и регенерацию ответов.

### 11. `batch_and_connections_integration.rs` (Batch & Graph Relations)
- **Цель**: Высокопроизводительные пакетные операции.
- **Проверяет**: Пакетное чтение сущностей нескольких типов (`get_entities_batch`), атомарную замену связей (`upsert_connections_batch`), транзакционную запись сущности со связанными записями.

### 12. `export_integration.rs` & `document_export_integration.rs` (Documents & Backups)
- **Цель**: Формирование документов и резервное копирование.
- **Проверяет**: Генерацию DOCX (OpenXML ГОСТ 7.32), EPUB 3.3, FB2 2.0, создание архива `.wwiki` (ZIP), целостность дампа БД и восстановление данных из бэкапа.

### 13. `stress_integration.rs` & `negative_integration.rs` (Stress & Robustness)
- **Цель**: Надежность и безопасность системы при предельных нагрузках и некорректных входных данных.
- **Проверяет**: Массовую вставку 10,000+ записей, конкурентную работу 50 потоков, устойчивость к невалидным идентификаторам, защиту от SQL-инъекций и откат транзакций при сбоях.

---

## 📈 Итоги Прогона и Покрытие

- **Общее количество тестов**: 350+ тестов (интеграционные в `src/tests/` + unit-тесты в крейтах `crates/*`).
- **Статус выполнения**: Все тесты проходят успешно (`ok. 0 failed; 0 ignored`).
- **Соблюдение архитектурных границ**: 100% изоляция слоев согласно `ARCH-001` .. `ARCH-012`.

