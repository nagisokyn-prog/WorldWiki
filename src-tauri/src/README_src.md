# src-tauri — Документация Архитектуры Бэкенда (Hexagonal Modular Monolith)

> **Назначение**: Промышленное модульное ядро WorldWiki на базе **Гексагональной Архитектуры (Ports & Adapters / Modular Monolith)** с предметными контекстами (Bounded Contexts) и изоляцией фреймворка Tauri.

---

## 🏛️ Архитектурная Топология (5 Крейтов Workspace)

Бэкенд физически разделен на 5 изолированных Cargo-крейтов в `src-tauri/crates/` и центральную точку сборки `src/`:

```
src-tauri/
├── Cargo.toml                     # Workspace Root
├── crates/
│   ├── 🧠 worldwiki-domain/       # [Чистый Домен]: Сущности, Value Objects, DomainError (0 внешних SDK)
│   │   ├── manuscript/            # Главы, сцены, тома, арки
│   │   ├── knowledge/             # Сущности лора, схемы, связи
│   │   ├── calendar/              # Абсолютная минута M_abs, астрономия, эпохи
│   │   ├── plot/                  # Сюжетные обещания (Чеховские ружья), планы
│   │   └── document/              # ГОСТ-модели документов
│   │
│   ├── 🔌 worldwiki-ports/        # [Интерфейсы и Контракты]: Secondary Ports
│   │   ├── repositories.rs        # ChapterRepository, EntityRepository, RelationRepository, PlotPromiseRepository, PlanRepository, RAGPort
│   │   ├── ai.rs                  # LlmInferencePort, EmbeddingPort
│   │   ├── storage.rs             # FileSystemPort, BackupStoragePort
│   │   ├── events.rs              # EventPublisherPort + типизированные ApplicationEvent
│   │   └── unit_of_work.rs        # UnitOfWork для атомарных транзакций
│   │
│   ├── ⚙️ worldwiki-application/  # [Сценарии Использования & AI-Фасады]: CQRS + Workflows
│   │   ├── manuscript/            # Commands/Queries: GetChapter, SaveChapter, ReorderNode, AutoExtend
│   │   ├── knowledge/             # Commands/Queries: GetEntityCard, ManageEntity, RelateEntities
│   │   ├── calendar/              # Commands/Queries: CalculateDate, ConvertEras, GenerateSummary
│   │   ├── plot/                  # Commands/Queries: PlantPromise, CompletePlan, AuditVolumeConsistency
│   │   ├── document/              # Commands/Queries: ExportDocx, ExportEpub, ExportFb2
│   │   └── ai/                    # 8 AI-Фасадов + Workflows + SubagentOrchestrator
│   │       ├── tools/             # 8 Consolidated AI Facades (query_world, inspect_entity, edit_manuscript, ...)
│   │       ├── workflows/         # EditManuscriptAtomicWorkflow, HybridSemanticSearchWorkflow
│   │       └── orchestration/     # JobManager (CancellationToken)
│   │
│   ├── 🧱 worldwiki-infrastructure/ # [Адаптеры Портов]: Driven Adapters
│   │   ├── surrealdb/             # SurrealDB реализации репозиториев (SurrealChapterRepository, GraphRAG, ...)
│   │   ├── ai/                    # llama.cpp FFI + HTTP провайдеры (OpenAI, Anthropic, Ollama)
│   │   ├── documents/             # Компиляторы DOCX (OpenXML), EPUB 3.3, FB2 2.0
│   │   └── filesystem/            # Работа с локальным диском, архивы .wwiki
│   │
│   └── 🚪 worldwiki-tauri/        # [Driving Adapter]: Единственный слой с доступом к Tauri
│       ├── bridge_macro.rs        # bridge_command! — декларативный макрос-мост
│       ├── state.rs               # AppState (обертка над AppServices)
│       ├── error.rs               # IpcError (типизированный маппинг ApplicationError -> JSON)
│       ├── events.rs              # TauriEventPublisher (реализация EventPublisherPort)
│       └── commands/              # Модульные IPC-команды (карточки, ружья, планы, 8 AI-фасадов)
│
└── src/                           # 🚀 [Composition Root & Bootstrap]
    ├── main.rs                    # Минимальная точка входа
    ├── lib.rs                     # Запуск рантайма, entity_commands!, on_window_event
    ├── bootstrap/
    │   └── services.rs            # build_surreal_app_services — сборка графа зависимостей
    └── tests/                     # 350+ модульных и интеграционных тестов
```

---

## 🚫 Железные Архитектурные Инварианты (`ARCH-001` .. `ARCH-012`)

| Код Инварианта | Правило |
|---|---|
| **ARCH-001** | `worldwiki-domain` **НЕ ДОЛЖЕН** импортировать `tauri`, `surrealdb`, `reqwest`, `tokio` или другие внешние SDK. |
| **ARCH-002** | `worldwiki-application` **НЕ ДОЛЖЕН** импортировать `tauri`. Зависит только от `domain` и `ports`. |
| **ARCH-003** | `worldwiki-ports` **НЕ ДОЛЖЕН** зависеть от конкретных реализаций инфраструктуры (только чистые трейты). |
| **ARCH-004** | `worldwiki-infrastructure` **ОБЯЗАН** реализовывать трейты из `ports`, а не диктовать доменные правила. |
| **ARCH-005** | `worldwiki-tauri` — **ЕДИНСТВЕННЫЙ** слой/крейт, которому разрешено импортировать `tauri::*`. |
| **ARCH-006** | `worldwiki-application` **НЕ ДОЛЖЕН** напрямую диспатчить события во фронтенд (только через `EventPublisherPort`). |
| **ARCH-007** | Никакие типы `tauri::*` (`State`, `AppHandle`, `Window`) не могут проникать в сигнатуры `application` или `domain`. |
| **ARCH-008** | Никакие конкретные типы `infrastructure` (например, `Surreal<Db>`) не могут появляться в публичных сигнатурах Use Cases. |
| **ARCH-009** | Границы модулей Bounded Contexts изолированы: межмодульное общение только через публичные DTO. |
| **ARCH-010** | Все тяжелые асинхронные задачи (AI, Export, Embeddings) обязаны принимать `CancellationToken`. |
| **ARCH-011** | Мутирующие Use Cases обязаны быть идемпотентными по `operation_id`. |
| **ARCH-012** | AI-инструменты имеют доступ к системе **СТРОГО** через Application Use Cases (не напрямую в БД). |

---

## 🤖 Спецификация 8 Консолидированных AI-Фасадов (Two-Tier Model)

1. **`ai_query_world`**: Единая точка семантического поиска (Graph + BM25 + Vector HNSW).
2. **`ai_inspect_entity`**: Полная карточка сущности с матрицей связей и схемами за 1 вызов.
3. **`ai_manage_entity`**: Создание, обновление, связывание и удаление сущностей в лоре.
4. **`ai_read_manuscript`**: Чтение текста глав, оглавления и аутлайна томов/арок.
5. **`ai_edit_manuscript`**: Атомарная транзакция (`EditManuscriptAtomicWorkflow`): текст главы + Чеховские ружья + закрытие планов.
6. **`ai_timeline_manager`**: Фасад континуума времени $M_{\text{abs}}$ и синхронизации событий.
7. **`ai_audit_consistency`**: Валидация противоречий лора и аудит незакрытых ружей тома.
8. **`ai_delegate_task`**: Оркестрация специализированных саб-агентов (`SubagentOrchestrator`).

---

## 📄 Описание каждого файла

### `main.rs`
**Назначение**: Точка входа приложения. Инициализирует SurrealDB, применяет DDL схему, регистрирует все Tauri-команды через `entity_commands!` макрос, управляет состоянием приложения (`AppState`).

**Ключевые функции**:
- `init_database()` — создаёт/подключается к SurrealDB, применяет `surreal_schema.surql`
- `AppState` — хранит `Surreal<Db>`, реализует `surreal_domain::SurrealDb`
- `main()` — регистрирует 100+ команд через `entity_commands!`, настраивает плагины Tauri

**Зависимости**: Все модули `logic::*`, `tauri_shell::logic::system`, `surreal_domain`

---

### `lib.rs`
**Назначение**: Минимальный boilerplate для Tauri. Экспортирует функцию `run()` для тестов.

**Ключевые функции**:
- `greet()` — пример команды
- `run()` — запуск Tauri приложения

---

### `logic/mod.rs`
**Назначение**: Реэкспорт всех подмодулей `logic` (включая ИИ-подсистему `ai`) для удобства импорта.

```rust
pub mod ai;
pub mod batch;
pub mod calendar_math;
pub mod chapters;
pub mod connections;
pub mod entities;
pub mod export;
pub mod models;
pub mod projects;
pub mod schema;
pub mod volumes;
```

---

### `logic/models.rs` — **Ключевой файл**
**Назначение**: Централизованное определение **всех сущностей** приложения через `surreal_entity!` и `surreal_relation!` макросы. Генерирует:
- Rust структуры с `serde`/`ts_rs` деривами
- Реализацию `SurrealRepository` трейта (CRUD)
- Tauri-команды (при `#[tauri_commands]`)
- TypeScript типы в `apps/spa/src/ts/types/generated/`

**Секции**:
1. **AI-инфраструктура** (системные таблицы): `AutoApprovalSettings`, `AiProfile`, `Artifact`, `AiSkill`, `Chat`, `ChatMessage`, `DictionaryWord`, `WebCache`, `AgentMemory`, `TextBlock`
2. **Системные сущности** (фиксированная схема): `Calendar`, `Volume`, `Arc`, `Chapter`, `Tag`, `Plan`
3. **Пользовательские сущности** (универсальная таблица `entities`): `Entity`, `EntitySchema`, `FieldDef`, `EntityRel`, `RelationSchema`
4. **Граф связей** (system edges): `Cites`, `VolumeContainsArc`, `ArcContainsChapter`, `ProjectContainsVolume`
5. **Схема генерации** (`surreal_schema!`) — список для кодогенерации

**Зависимости**: `surreal_domain`, `serde`, `ts_rs`, `chrono`

---

### `logic/projects.rs`
**Назначение**: CRUD операции для проектов (таблица `projects`).

**Команды**:
| Команда | Описание |
|---------|----------|
| `get_projects` | Список всех проектов |
| `create_project` | Создание проекта (upsert по имени) |
| `get_project_config` | Конфигурация проекта |
| `save_project_config` | Сохранение конфига (merge) |
| `delete_project` | Удаление проекта |

**Особенности**: Работает с записями `projects:<name>`, использует `type::record` для прямого доступа.

---

### `logic/entities.rs`
**Назначение**: CRUD для пользовательских сущностей (универсальная таблица `entities`), схем сущностей (`entity_schemas`), связей (`entity_rel`), схем связей (`relation_schemas`), истории ревизий.

**Команды — Сущности**:
- `get_entities` — список с фильтром по типу/проекту
- `get_entity` — по ID
- `save_entity` — create/upsert с нормализацией RecordId
- `delete_entity` — транзакционное удаление + связи + ревизии
- `search_entities` — полнотекстовый поиск по name/description
- `get_entities_batch` — батч загрузка по типам

**Команды — Схемы сущностей**:
- `get_entity_schemas` / `save_entity_schema` / `delete_entity_schema`
- `get_schema_history` / `toggle_schema_history_pin` — версионирование схем

**Команды — Связи**:
- `get_entity_relations` / `create_entity_relation` / `delete_entity_relation`
- `get_relation_schemas` / `save_relation_schema` / `delete_relation_schema`

**Команды — Ревизии**:
- `get_entity_revisions` / `toggle_entity_history_pin`

**Хелперы**: `safe_pid`, `safe_id`, `flatten_thing`, `deserialize_list` — нормализация RecordId и десериализация.

---

### `logic/chapters.rs`
**Назначение**: Работа с главами, текстовыми блоками, ревизиями глав.

**Команды**:
| Команда | Описание |
|---------|----------|
| `get_global_timeline` | Все главы проекта (через `Chapter::find_all`) |
| `save_text_blocks` | Парсинг HTML → структурированные блоки (`text_blocks`), ACID транзакция |
| `get_chapter_revisions` | История ревизий главы |
| `toggle_chapter_history_pin` | Закрепление ревизии |

**Особенности**: Использует `scraper` для парсинга HTML, специальный формат ID `chapters:⟨id⟩`.

---

### `logic/volumes.rs`
**Назначение**: Иерархия проект → тома → арки → главы. Управление порядком через ребро `contains` с полем `sort_order`.

**Команды**:
| Команда | Описание |
|---------|----------|
| `get_chapter_hierarchy` | Полная иерархия (volumes, arcs, chapters) с sort_order |
| `create_volume` | Создание тома + связь `contains` от проекта |
| `update_volume` | Обновление названия тома |
| `create_arc` | Создание арки внутри тома/проекта |
| `update_arc` | Обновление названия арки |
| `assign_chapter` | Перемещение главы в арку/том/проект (удаляет старые `contains`) |
| `reorder_node` | Изменение `sort_order` на входящем ребре `contains` |

**Особенности**: Работает через графовые запросы SurrealDB (`<-contains`), `RecordId::new` для типобезопасных ссылок.

---

### `logic/connections.rs`
**Назначение**: Управление пользовательскими связями между сущностями (таблица `entity_rel`).

**Команды**:
| Команда | Описание |
|---------|----------|
| `get_connections` | Все связи проекта (опционально по главе), нормализация source/target в `{entityType, entityId}` |
| `remove_connections_by_source` | Удаление исходящих связей сущности |
| `save_connections` | Полная перезапись связей сущности (устаревшие удаляются в т.ч. обратные) |

**Особенности**: Маппинг frontend `role` → БД `rel_type`, поддержка периодов (`start_chapter`, `end_chapter`).

---

### `logic/export.rs`
**Назначение**: Экспорт контента, бэкапы, облачное хранение (Yandex Disk), восстановление.

**Команды**:
| Команда | Описание |
|---------|----------|
| `export_chapters` | Экспорт глав в текстовый файл (Downloads) |
| `create_cloud_backup` | Полный бэкап (DB dump + images + settings) → ZIP `.wwiki` |
| `exchange_yandex_token` | OAuth код → access token |
| `upload_to_yandex_disk` | Загрузка бэкапа на Яндекс.Диск |
| `list_yandex_disk_backups` | Список бэкапов в облаке |
| `download_and_restore_yandex` | Скачивание + восстановление из облака |
| `restore_from_backup` | Восстановление из локального `.wwiki` (распаковка, импорт DB, файлы) |
| `get_launch_args` | Аргументы запуска (файл `.wwiki` для ассоциации) |

**Зависимости**: `reqwest`, `zip`, `chrono`, Tauri `AppHandle` для путей.

---

### `logic/documents/`
**Назначение**: Семантический текстовый процессор и мультиформатный экспорт академических документов (курсовых, дипломных работ, отчетов НИР) и художественных книг напрямую в системную папку пользователя `Downloads`.

**Команды**:
| Команда | Описание |
|---------|----------|
| `export_document_docx` | Экспорт в Microsoft Word (.docx OpenXML) со строгим соблюдением ГОСТ 7.32 (TNR 14pt, полуторный интервал, абзацный отступ 1.25 см, поля 30/10/20/20 мм, таблицы, рисунки, сноски) |
| `export_document_epub` | Экспорт в электронную книгу EPUB 3.3 по спецификации IDPF (STORED mimetype, OEBPS-манифест, навигация toc.xhtml, сноски epub:type="footnote") |
| `export_document_fb2` | Экспорт в FictionBook 2.0 (.fb2 XML) с валидной схемой, метаданными title-info, секциями и телом примечаний `<body name="notes">` |
| `export_document_pdf_save` | Хук сохранения векторного PDF с подтверждением пути в Downloads |

**Особенности**:
- Автономная генерация без внешних сторонних утилит (pandoc, libreoffice).
- Сборка валидных ZIP-пакетов через `zip::ZipWriter` со сжатием `CompressionMethod::Deflated` и сохранением первого файла `mimetype` в режиме `CompressionMethod::Stored`.
- Санитизация опасных символов ОС (`/ \ : * ? " < > |`) и защита от Path Traversal.
- Интеграционные тесты вынесены в `tests/document_export_integration.rs`.

---

### `logic/batch.rs`
**Назначение**: Пакетные операции в одной транзакции для производительности.

**Команды**:
| Команда | Описание |
|---------|----------|
| `get_entities_batch` | Одним запросом загружает сущности нескольких типов, группирует по типам |
| `upsert_connections_batch` | Транзакционное удаление старых + создание новых связей батчем |
| `save_entity_with_relations` | Сохранение основной сущности + связанных (foreign_updates) в одной транзакции |

**Особенности**: Динамическое построение SurrealQL в транзакции (`BEGIN`/`COMMIT`), `RETURN $saved` для получения результата.

---

### `logic/schema.rs`
**Назначение**: Заглушка для обратной совместимости. В SurrealDB схема задаётся через `.surql` при старте.

---

### `logic/calendar_math.rs`
**Назначение**: Конвертация абсолютного времени в локальное (календарь проекта).

**Команда**: `convert_absolute_to_local` (регистрируется в `main.rs`)

---

### `logic/ai/` — ИИ-подсистема (агент, чат, провайдеры, инструменты)

**Назначение**: Полный ИИ-стек WorldWiki: агент-соавтор с циклом tool-вызовов, древовидный чат с ветвлением, RAG-поиск по базе проекта и подключение к внешним LLM через `claw_api`. Все команды регистрируются в `main.rs`/`lib.rs` через `use logic::ai::*`.

Подмодули: `chat` (дерево и операции), `agent` (промпты и цикл исполнения), `providers` (каталоги моделей), `tools` (инструменты агента).

---

#### `logic/ai/mod.rs`
**Назначение**: Re-exports публичных функций подсистемы для `logic::*`-импорта.

**Re-exports**:
- `chat::tree` → `get_chat_tree`, `get_chat_messages`, `get_message_branch`
- `chat::operations` → `fork_chat`, `update_chat_parent`, `send_chat_message`, `cancel_generation`, `delete_chat_message`, `edit_chat_message`, `regenerate_chat_message`, `switch_message_variant`, `delete_ai_chat`
- `agent::runner` → `get_ai_completion`, `generate_chat_title`
- `providers::fetch` → `fetch_ai_models`
- `hardware` → `get_hardware_info`, `calculate_quantization_estimates`, `get_recommended_local_models`
- `manager` → `list_installed_models`, `load_local_model`, `unload_local_model`, `unload_all_local_models`, `delete_local_model`
- `model_hub` → `fetch_hf_models`, `download_hf_model`
- `retrieval` → `reindex_project_lore`, `reindex_project_lore_inner`
- `permissions` → `get_tool_permissions_catalog`

**Зависимости**: `chat::*`, `agent::*`, `providers::*`, `tools::*`, `local_llm::*`, `retrieval::*`, `hardware::*`, `manager::*`

---

#### `logic/ai/local_llm.rs` — **Ключевой файл (Local LLM & CUDA C++ Engine)**
**Назначение**: Прямая FFI-обвязка над библиотекой `llama.cpp` (через `llama-sys`):
- `LocalLlm::load_model(path, params)` — загрузка генеративной модели в память GPU с настраиваемыми слоями `n_gpu_layers = -1`, контекстом 16K, аппаратными сэмплерами (Repetition Penalties 1.15, Top-K 40, Top-P 0.95, Temperature 0.7) и ChatML-токенизатором.
- `LocalLlm::load_embedding_model(path, params)` — инициализация эмбеддеров (Nemotron, Nomic, BGE) с безопасным контекстом и батчем до 4096 токенов для исключения VRAM OOM.
- `generate_stream(...)` — потоковая генерация токенов с немедленной остановкой по атомарному флагу `CANCEL_LOCAL_GEN`.
- `get_embeddings(text)` — прямое вычисление плотных векторов (Dense Embeddings) float32.
- `enable_triattention(stats_path, budget)` — интеграция сжатия и TriAttention KV-cache эвикшена.

---

#### `logic/ai/agent_runtime.rs` — **Ключевой файл (Local Agent Execution)**
**Назначение**: Полный цикл автономного локального соавтора:
1. Вызов детерминированного `QueryAnalyzer` для классификации интента.
2. Селективное извлечение цельных глав (Exact Document Fetch) или векторных чанков.
3. Бюджетирование контекста (до 12 000 символов) и инъекция в пользовательский ход диалога (`rfind("<|im_end|>")`).
4. Запуск инференса в отдельном рабочем потоке `spawn_blocking` со стримингом токенов во фронтенд через `chat_stream_chunk`.

---

#### `logic/ai/hardware.rs`
**Назначение**: Прямой опрос аппаратных ресурсов рабочей станции:
- `get_hardware_info()` — WinAPI `GlobalMemoryStatusEx` для RAM и DirectX DXGI `CreateDXGIFactory` для точного объема видеопамяти VRAM на GPU NVIDIA/AMD.
- `calculate_quantization_estimates(model_size_b)` — расчет расхода VRAM/RAM для Q4_K_M, Q8_0, BF16.
- `get_recommended_local_models()` — список карточек рекомендуемых моделей (Nemotron, Qwen 2.5 7B/14B/3B, Saiga).

---

#### `logic/ai/manager.rs`
**Назначение**: Управление файлами и жизненным циклом локальных моделей в памяти:
- `list_installed_models()` — сканирование директории моделей с неблокирующим `try_lock()`.
- `load_local_model(filename)` / `unload_local_model(filename)` — загрузка и выгрузка слотов моделей (`LOADED_MODEL` / `LOADED_EMBED`).
- `unload_all_local_models()` — экстренный сброс видеопамяти и обнуление глобальных указателей llama.
- `delete_local_model(filename)` — удаление `.gguf` с диска.

---

#### `logic/ai/model_hub.rs`
**Назначение**: Каталог HuggingFace Model Hub и фоновое скачивание квантованных GGUF:
- `fetch_hf_models(query)` — поиск по репозиториям HuggingFace API.
- `download_hf_model(repo_id, filename, token)` — потоковая загрузка с отправкой прогресса во фронтенд через событие `hf_download_progress`.

---

#### `logic/ai/permissions.rs`
**Назначение**: Каталог уровней разрешений и автоодобрения (Auto-Approval System):
- Категории: `read`, `edit_entities`, `edit_content`, `edit_relations`, `edit_calendar`, `analyze`.
- Пресеты: Безопасный (Safe), Сбалансированный (Balanced), Экспертный (Expert).
- Allowlist / Denylist по типам сущностей, связей и путям проекта.

---

#### `logic/ai/retrieval/` — **Продвинутая подсистема RAG**
**Назначение**: Модульная архитектура информационного поиска и индексации лора:
- `query_analyzer.rs` — морфологический анализ русских числительных (от «первая» до «сотая», римские `I..L`, арабские `1..100`), детекция приветствий/смолл-тока.
- `router.rs` — **Query Planner**: маршрутизация запросов между Exact Document Retrieval (глава/том целиком) и Hybrid Semantic Vector Search (BM25 + Cosine Similarity).
- `embedder.rs` — HTTP-клиент к сервисам эмбеддингов с форматированием префиксов (`query:` / `passage:`).
- `indexer.rs` — фоновый индексатор проекта: нарезка глав и сущностей на чанки, параллельная генерация векторов на GPU и сохранение в SurrealDB.

---

#### `logic/ai/agent/mod.rs`
**Назначение**: Подмодуль агента. Объявляет:
- `pub mod prompt;` — построение системного промпта и истории сообщений
- `pub mod runner;` — цикл агента (`run_agent_loop`), стриминг

---

#### `logic/ai/agent/prompt.rs`
**Назначение**: Построение системного промпта и подготовка истории чата для LLM.

**Константы**:
- `MAX_AGENT_ITERATIONS = 8` — максимум итераций «вызов инструмента → ответ LLM» в одном ходе
- `DEFAULT_MAX_TOKENS = 4096` — лимит `max_tokens` по умолчанию
- `HISTORY_CHAR_BUDGET = 120_000` — бюджет истории в символах (Context Windowing)

**Функции**:
- `build_system_prompt(role_definition, custom_instructions, project_id)` — собирает полный системный промпт: Golden Rules (соавтор, не «ИИ»), безопасность (LORE LOCK, запрет выдумывать факты), правила общения, литературная теория, регламент работы с инструментами (RAG-first)
- `history_to_input_messages(history, assistant_msg_id)` — из дерева истории (по `parent_id`) строит линейную цепочку в `Vec<InputMessage>`, отбрасывает `is_active=false`, обрезает до бюджета

---

#### `logic/ai/agent/runner.rs` — **Ключевой файл**
**Назначение**: Главный цикл агента и потоковая передача ответа. Содержит логику вызова LLM, обработки tool-calls, сохранение ответа в `chat_messages`.

**Структуры**:
- `StreamChunk` — потоковый чанк для фронта `{chat_id, message_id, text, is_done, chunk_type}`
- `AgentToolEvent` — событие вызова инструмента `{chat_id, message_id, tool_name, tool_args}`
- `ToolAssembler` — буфер сборки JSON-аргументов tool_use из стрим-дельт

**Функции**:
- `get_ai_completion(...)` — Tauri-команда; спавнит агента в `tokio::spawn` (регистрируется в `AgentTasks` для отмены)
- `run_agent_loop(app, project_id, chat_id, assistant_msg_id, user_text, mode_slug)` — читает активный `AiProfile`, строит промпт, историю и отправляет запрос со стримингом; до `MAX_AGENT_ITERATIONS` обрабатывает tool-calls через `WorldWikiTools::run`
- `build_provider_client(provider, api_key, base_url)` — создаёт `ProviderClient`: `anthropic` | `openai` | `openrouter` | `gemini` | `local`/`ollama` | `deepseek`
- `generate_chat_title(...)` — генерирует заголовок чата (2–5 слов), обновляет `chats.title`

**События (emit)**:
- `chat_stream_chunk` (payload `StreamChunk`) — текст ответа/дум-процесс/usage для UI
- `agent_tool` (payload `AgentToolEvent`) — вызов инструмента

**Зависимости**: `claw_api`, `reqwest`, `tokio`, `surrealdb`, `surreal_domain::SurrealDb`

#### `logic/ai/chat/mod.rs`
**Назначение**: Общий контекст чат-подсистемы + хелперы работы с RecordId.

**Хелперы**:
- `parse_record_id(id, default_table)` — парсит `table:id`, `⟨id⟩`, `` `id` `` → `RecordId` с подстановкой таблицы по умолчанию
- `clean_surreal_id(val)` — нормализует RecordId в строку `table:id` (или `None`)

---

#### `logic/ai/chat/tree.rs`
**Назначение**: Получение дерева чатов и сообщений для UI.

**Команды**:
- `get_chat_tree(project_id, state)` — чаты проекта + `parent_chat_id`/`sort_order` на основе рёбер `contains`
- `get_chat_messages(chat_id, state)` — все сообщения чата (санитизированные ID)
- `get_message_branch(chat_id, state)` — активная ветка (фильтрует `is_active`); используется агентом и regenerate

**Внутренние**:
- `get_chat_messages_impl(db, chat_id)` — возврат только активных сообщений (для агента и ветвления)
- `sanitize_message_ids(...)` — очистка SurrealDB-объектов RecordId в выдаче

---

#### `logic/ai/chat/operations.rs`
**Назначение**: Операции CRUD + ветвление + генерация ответов.

**Команды**:
- `send_chat_message(project_id, chat_id, text, ...)` — создаёт (при необходимости) чат, сообщение пользователя и placeholder-сообщение ассистента, затем асинхронно запускает агента через `AgentTasks`
- `cancel_generation(chat_id)` — отменяет активную генерацию (abort зарегистрированной `JoinHandle`)
- `fork_chat(project_id, message_id, new_title, ...)` — ответвление ветки: новый чат + копия истории по `parent_id` (через `id_map`)
- `update_chat_parent(...)` — перенос чата между родителями (`parent_chat_id`)
- `edit_chat_message(...)` / `delete_chat_message(...)` — редактирование/удаление сообщения (с ветвлением)
- `regenerate_chat_message(...)` — перегенерирует ответ, создавая новый вариант сообщения
- `switch_message_variant(msg_id)` — смена варианта ответа (активирует нужный `is_active`)
- `delete_ai_chat(id, ...)` — каскадное удаление чата: `chat_messages` → рёбра `contains` → `chats`

**Потоки**: `tokio::spawn` + `AgentTasks` (Arc<Mutex<HashMap<String, JoinHandle>>>).

**Зависимости**: `serde_json`, `surrealdb`, `tauri::Manager`, `surreal_domain::SurrealDb`

---

#### `logic/ai/providers/mod.rs`
**Назначение**: Подмодуль провайдеров (`pub mod fetch;`).

---

#### `logic/ai/providers/fetch.rs`
**Назначение**: Получение списков моделей от провайдеров для настроек UI.

**Команда**: `fetch_ai_models(provider, api_key)` — запрашивает каталоги моделей (OpenRouter, OpenAI, Gemini, Anthropic, local) и возвращает `Vec<AiModelInfo>` (сортировка по label).

**Структуры**: `AiModelInfo { value, label, description, context_length?, max_completion_tokens? }` — генерирует TypeScript-тип через `ts-rs`.

---

#### `logic/ai/tools/mod.rs` — **Ключевой файл**
**Назначение**: Встроенный набор инструментов агента `WorldWikiTools` — RAG-поиск и операции с БД, которые LLM вызывает через tool-use.

**Структуры и функции**:
- `WorldWikiTools { db: Surreal<Db>, project_id: String }` — состояние инструментов
- `tool_definitions()` → `Vec<ToolDefinition>` — JSON-schemа всех инструментов для `claw_api`
- `WorldWikiTools::run(name, args)` — диспетчер: вызов функции по имени, работа через `self.db`
- `param(description)` / `arg(args, key)` — хелперы схем и извлечения аргументов

**Инструменты (19)**:
- `rag_search(query, top_k)` — RAG по структурным таблицам
- `search_entities(query, type_key)` — поиск сущностей по имени/описанию
- `get_entity(id)`, `get_relations(entity_id)`
- `get_chapter(id)`, `get_chapters_list()`, `get_timeline(...)`, `get_calendar(...)`
- `get_entity_schema(...)`, `get_entity_evolution(...)`, `get_relation_history(...)`
- `update_entity(...)`, `create_entity(...)`, `create_relation(...)`, `update_chapter(...)`, `add_timeline_event(...)`
- `validate_world_consistency(statement)` — проверка согласованности мира
- `search_chat_history(query)` — поиск по истории чатов
- `spawn_subagent(task, subagent_type)` — вызов субагента (mock)

**Зависимости**: `claw_api` (ToolDefinition), `surrealdb`, `serde_json`

---

## 🔗 Mermaid: Module Dependency Graph

```mermaid
flowchart TD
    main[main.rs] --> lib[lib.rs]
    main --> logic_mod[logic/mod.rs]
    main --> tauri_shell[tauri_shell::logic::system]
    main --> surreal_domain[surreal_domain]
    
    logic_mod --> projects[projects.rs]
    logic_mod --> entities[entities.rs]
    logic_mod --> chapters[chapters.rs]
    logic_mod --> volumes[volumes.rs]
    logic_mod --> connections[connections.rs]
    logic_mod --> export[export.rs]
    logic_mod --> documents[documents/mod.rs]
    logic_mod --> batch[batch.rs]
    logic_mod --> models[models.rs]
    logic_mod --> schema[schema.rs]
    logic_mod --> calendar[calendar_math.rs]
    logic_mod --> ai[ai/mod.rs]
    
    ai --> ai_agent[agent/runner.rs]
    ai --> ai_chat[chat/operations.rs]
    ai --> ai_tools[tools/mod.rs]
    ai_agent --> ai_tools
    ai_agent --> models
    ai_chat --> models
    ai_tools --> models
    
    projects --> models
    entities --> models
    chapters --> models
    volumes --> models
    connections --> models
    export --> models
    documents --> models
    batch --> models
    calendar --> models
    
    models --> surreal_domain
    entities --> surreal_domain
    batch --> surreal_domain
    
    tauri_shell --> surreal_domain
    
    style main fill:#f0f0f0,stroke:#333,stroke-width:2px
    style models fill:#e0e0e0,stroke:#333,stroke-width:2px
    style surreal_domain fill:#d0d0d0,stroke:#333,stroke-width:2px
```

---

## 🔄 Mermaid: DFD (Data Flow Diagram)

```mermaid
flowchart TD
    subgraph Frontend["Frontend (Vue/TypeScript)"]
        UI[UI Components]
        Stores[Pinia Stores]
        API[API Services]
    end
    
    subgraph Tauri[Tauri Layer]
        Invoke[tauri::invoke]
        Commands[Tauri Commands]
    end
    
    subgraph Logic[Logic Modules]
        Projects[projects.rs]
        Entities[entities.rs]
        Chapters[chapters.rs]
        Volumes[volumes.rs]
        Connections[connections.rs]
        Export[export.rs]
        Batch[batch.rs]
        AI[ai/: chat, agent, providers, tools]
    end
    
            subgraph Models[Models & Macros]
        model_core[models.rs]
        Macros[surreal_domain macros]
    end
    
    subgraph DB[SurrealDB]
        KV[(SurrealKV Engine)]
        Tables[Tables: projects, entities, chapters, ...]
        Edges[Edges: contains, cites, entity_rel, ...]
    end
    
    UI --> Stores
    Stores --> API
    API --> Invoke
    Invoke --> Commands
    
    Commands --> Projects
    Commands --> Entities
    Commands --> Chapters
    Commands --> Volumes
    Commands --> Connections
    Commands --> Export
    Commands --> Documents
    Commands --> Batch
    Commands --> AI
    
    Projects --> Models
    Entities --> Models
    Chapters --> Models
    Volumes --> Models
    Connections --> Models
    Export --> Models
    Documents --> Models
    Batch --> Models
    AI --> Models
    
    Models --> Macros
    Macros --> KV
    
    Projects --> KV
    Entities --> KV
    Chapters --> KV
    Volumes --> KV
    Connections --> KV
    Export --> KV
    Batch --> KV
    AI --> KV
    
    KV --> Tables
    KV --> Edges
    
    style Frontend fill:#f5f5f5,stroke:#333
    style Tauri fill:#e8e8e8,stroke:#333
    style Logic fill:#dcdcdc,stroke:#333
    style Models fill:#d0d0d0,stroke:#333
    style DB fill:#c4c4c4,stroke:#333
```

---

## 🏗 Mermaid: Class/Function Interaction Diagrams

### main.rs — Взаимодействие компонентов

```mermaid
classDiagram
    class AppState {
        +db: Surreal~Db~
        +surreal_db() &Surreal~Db~
    }
    
    class SurrealDb {
        <<trait>>
        +surreal_db() &Surreal~Db~
    }
    
    class InitDatabase {
        +init_database() Surreal~Db~
    }
    
    class EntityCommands {
        <<macro>>
        +entity_commands![] Handler
    }
    
    class LogicModules {
        +projects::*
        +entities::*
        +chapters::*
        +volumes::*
        +connections::*
        +export::*
        +documents::*
        +batch::*
        +tauri_shell::system::*
    }
    
    AppState ..|> SurrealDb : implements
    InitDatabase --> AppState : creates
    EntityCommands --> LogicModules : registers
    LogicModules --> AppState : uses State~AppState~
    
    note for AppState "Managed by Tauri\nState~AppState~"
    note for EntityCommands "Generates 100+ handlers\nvia proc-macro"
```

---

### models.rs — Сущности и макросы

```mermaid
classDiagram
    class SurrealEntityMacro {
        <<proc-macro>>
        +surreal_entity!() TokenStream
    }
    
    class SurrealRelationMacro {
        <<proc-macro>>
        +surreal_relation!() TokenStream
    }
    
    class SurrealSchemaMacro {
        <<proc-macro>>
        +surreal_schema!() TokenStream
    }
    
    class GeneratedStruct {
        +id: Option~String~
        +project_id: Option~Value~
        +TABLE: &str
        +find_all() Vec~Self~
        +find_by_id() Option~Self~
        +create() Self
        +save() Self
        +delete() ()
    }
    
    class GeneratedCommands {
        +get_*()
        +save_*()
        +delete_*()
        +search_*()
    }
    
    class SurrealRepository {
        <<trait>>
        +TABLE: &str
        +get_id() Option~String~
        +set_id(id: String)
        +find_all()
        +find_by_id()
        +create()
        +save()
        +delete()
    }
    
    class Entity {
        +entity_type: String
        +name: String
        +attributes: Value
        +tags: Vec~String~
    }
    
    class EntitySchema {
        +type_key: String
        +fields_schema: Vec~FieldDef~
    }
    
    class EntityRel {
        +in: Option~String~
        +out: Option~String~
        +rel_type: String
        +strength: Option~i64~
    }
    
    class RelationSchema {
        +rel_key: String
        +from_types: Vec~String~
        +to_types: Vec~String~
        +directed: bool
    }
    
    class Cites {
        +relevance_score: f64
    }
    
    class VolumeContainsArc {
        +sort_order: i64
    }
    
    SurrealEntityMacro --> GeneratedStruct : generates
    SurrealEntityMacro --> GeneratedCommands : generates
    SurrealRelationMacro --> GeneratedStruct : generates
    SurrealRelationMacro --> GeneratedCommands : generates
    SurrealSchemaMacro --> GeneratedStruct : registers
    
    GeneratedStruct ..|> SurrealRepository : implements
    Entity --> GeneratedStruct : manual impl
    EntitySchema --> GeneratedStruct : manual impl
    EntityRel --> GeneratedStruct : manual impl
    RelationSchema --> GeneratedStruct : manual impl
    Cites --> GeneratedStruct : macro-generated
    VolumeContainsArc --> GeneratedStruct : macro-generated
    
    note for SurrealEntityMacro "Attributes:\n#[table], #[project_scoped],\n#[tauri_commands], #[fulltext],\n#[hnsw], #[flexible]"
    note for GeneratedCommands "Only if #[tauri_commands]\npresent on struct"
```

---

### entities.rs — Взаимодействие функций

```mermaid
sequenceDiagram
    participant Frontend
    participant Command as get_entities
    participant Helpers as Helpers
    participant DB as SurrealDB
    
    Frontend->>Command: invoke("get_entities", {project, entity_type?})
    Command->>Helpers: safe_pid(project)
    Helpers-->>Command: pid_val, pid_literal
    Command->>Helpers: safe_id() если нужно
    Command->>DB: SELECT * FROM entities WHERE project_id = ... 
    DB-->>Command: Vec<Value>
    Command->>Helpers: flatten_thing() для каждого
    Command->>Helpers: deserialize_list<Entity>()
    Helpers-->>Command: Vec<Entity>
    Command-->>Frontend: Result<Vec<Entity>, String>
```

```mermaid
sequenceDiagram
            participant Frontend
    participant Command as save_entity
    participant Helpers as Helpers
    participant DB as SurrealDB
    
    Frontend->>Command: invoke("save_entity", {project, entity})
    Command->>Helpers: serde_json::to_value(entity)
    Command->>Helpers: normalize RecordId (flatten_thing)
    alt entity.id exists
        Command->>DB: UPSERT type::record($id) SET ...
    else new entity
        Command->>DB: CREATE entities SET ...
    end
    DB-->>Command: Saved Value
    Command->>Helpers: flatten_thing()
    Command->>Helpers: serde_json::from_value()
    Helpers-->>Command: Entity
    Command-->>Frontend: Result<Entity, String>
```

---

### volumes.rs — Иерархия и графовые запросы

```mermaid
sequenceDiagram
            participant Frontend
    participant Command as get_chapter_hierarchy
    participant DB as SurrealDB
    
    Frontend->>Command: invoke("get_chapter_hierarchy", {project})
    Command->>DB: SELECT id, title, (SELECT sort_order FROM <-contains WHERE in=$proj)[0] FROM volumes
    DB-->>Command: volumes[]
    Command->>DB: SELECT id, title, (SELECT in FROM <-contains WHERE tb(in)='volumes')[0] as volume_id, sort_order FROM arcs
    DB-->>Command: arcs[]
    Command->>DB: SELECT *, (SELECT in FROM <-contains WHERE tb(in)='arcs')[0] as arc_id, (SELECT in FROM <-contains WHERE tb(in)='volumes')[0] as volume_id, sort_order FROM chapters
    DB-->>Command: chapters[]
    Command->>Command: sort volumes/arcs/chapters by sort_order
    Command-->>Frontend: {volumes, arcs, chapters}
```

```mermaid
classDiagram
    class VolumeCommands {
        +get_chapter_hierarchy()
        +create_volume()
        +update_volume()
        +create_arc()
        +update_arc()
        +assign_chapter()
        +reorder_node()
    }
    
    class GraphQueries {
        +contains_edge: "in -> contains -> out"
        +sort_order_field
        +subquery_select: (SELECT ... FROM <-contains)[0]
    }
    
    class RecordIdHelper {
        +RecordId::new(table, id)
        +split ':'
    }
    
    VolumeCommands --> GraphQueries : uses
    VolumeCommands --> RecordIdHelper : uses
    GraphQueries --> SurrealDB : executes
```

---

### export.rs — Бэкап и восстановление

```mermaid
sequenceDiagram
            participant Frontend
    participant Command as create_cloud_backup
    participant DB as SurrealDB
    participant FS as FileSystem
    participant Zip as ZipWriter
        participant Yandex as Yandex Disk API
    
    Frontend->>Command: invoke("create_cloud_backup")
    Command->>DB: export(temp.surql)
    DB-->>Command: OK
    Command->>FS: read temp.surql
    Command->>FS: read data/user_images/*
    Command->>FS: read data/*.json
    Command->>Zip: create backup.wwiki
    Zip->>Zip: add database.surql
    Zip->>Zip: add images/
    Zip->>Zip: add settings/
    Zip-->>Command: zip_path
    Command->>FS: delete temp.surql
    Command-->>Frontend: backup_path
    
    Note over Frontend, Yandex: Затем upload_to_yandex_disk(backup_path)
```

```mermaid
sequenceDiagram
        participant Frontend
    participant Command as restore_from_backup
    participant FS as FileSystem
    participant Zip as ZipArchive
    participant DB as SurrealDB
    
    Frontend->>Command: invoke("restore_from_backup", {backup_path})
    Command->>FS: open backup.wwiki
    Command->>Zip: extract database.surql -> temp/
    Command->>Zip: extract images/ -> data/user_images/
    Command->>Zip: extract settings/ -> data/
    Command->>DB: import(temp/database.surql)
    DB-->>Command: OK
    Command->>FS: cleanup temp/
    Command-->>Frontend: OK
```

---

### batch.rs — Транзакционные операции

```mermaid
sequenceDiagram
        participant Frontend
    participant Command as save_entity_with_relations
    participant DB as SurrealDB
    
    Frontend->>Command: invoke("save_entity_with_relations", {project, entity, foreign_updates[]})
    Command->>Command: BEGIN TRANSACTION
    Command->>Command: Build dynamic query:
    Note right of Command: LET $saved = (UPSERT type::record($main_id) SET ...)
    Note right of Command: FOR each foreign: UPSERT type::record($foreign_id) SET ...
    Note right of Command: COMMIT TRANSACTION
    Note right of Command: RETURN $saved
    Command->>DB: Execute full transaction
    DB-->>Command: Result array
    Command->>Command: Take RETURN statement result
    Command->>Command: flatten_thing + deserialize
    Command-->>Frontend: Result<Entity, String>
```

```mermaid
classDiagram
    class BatchCommands {
        +get_entities_batch()
        +upsert_connections_batch()
        +save_entity_with_relations()
    }
    
    class TransactionBuilder {
        +query: String
        +bind_data: Map~String, Value~
        +add_upsert()
        +add_delete()
        +add_relate()
        +build()
    }
    
    class Helpers {
        +safe_pid()
        +safe_id()
        +flatten_thing()
        +deserialize_list()
    }
    
    BatchCommands --> TransactionBuilder : uses
    BatchCommands --> Helpers : uses
    TransactionBuilder --> SurrealDB : executes
```

---

## 🔁 Mermaid: Sequence Diagrams — Ключевые флоу

### Создание проекта

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Tauri as Tauri Invoke
    participant Cmd as create_project
    participant DB as SurrealDB
    
    User->>Frontend: Вводит название проекта
    Frontend->>Tauri: invoke("create_project", {project_data: {name}})
    Tauri->>Cmd: create_project(project_data, state)
    Cmd->>Cmd: Удаляет id, добавляет data:{} если нет
    Cmd->>DB: UPSERT projects:name CONTENT data
    DB-->>Cmd: OK
    Cmd-->>Tauri: Ok(name)
    Tauri-->>Frontend: Project name
    Frontend->>User: Проект создан, открыт
```

---

### Сохранение сущности с отношениями

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Tauri
    participant Cmd as save_entity_with_relations
    participant DB as SurrealDB
    
    User->>Frontend: Редактирует сущность + связи
    Frontend->>Tauri: invoke("save_entity_with_relations", {entity, foreign_updates[]})
    Tauri->>Cmd: save_entity_with_relations(project, entity, foreign_updates, state)
    Cmd->>Cmd: BEGIN TRANSACTION
    Cmd->>DB: UPSERT основная сущность
    loop Для каждой foreign_updates
        Cmd->>DB: UPSERT связанная сущность
    end
    Cmd->>DB: COMMIT TRANSACTION
    Cmd->>DB: RETURN $saved
    DB-->>Cmd: Saved entity
    Cmd-->>Tauri: Result<Entity>
    Tauri-->>Frontend: Saved entity
    Frontend->>User: UI обновлено
```

---

### Экспорт и бэкап в облако

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Tauri
    participant Export as export.rs
    participant DB as SurrealDB
    participant FS as FileSystem
    participant Zip as Zip
    participant Yandex as Yandex Disk
    
    User->>Frontend: Нажимает "Бэкап в облако"
    Frontend->>Tauri: invoke("create_cloud_backup")
    Tauri->>Export: create_cloud_backup(state, app)
    Export->>DB: export(temp.surql)
    Export->>FS: read images, settings
    Export->>Zip: create backup.wwiki
    Export-->>Tauri: local_path
    Tauri-->>Frontend: local_path
    
    Frontend->>Tauri: invoke("exchange_yandex_token", {code})
    Tauri->>Yandex: POST /token
    Yandex-->>Tauri: access_token
    Tauri-->>Frontend: token
    
    Frontend->>Tauri: invoke("upload_to_yandex_disk", {token, file_path})
    Tauri->>Yandex: GET upload URL
    Yandex-->>Tauri: href
    Tauri->>Yandex: PUT file
    Yandex-->>Tauri: 200 OK
    Tauri-->>Frontend: OK
    Frontend->>User: Бэкап загружен
```

---

### Восстановление из бэкапа

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Tauri
    participant Restore as restore_from_backup
    participant FS as FileSystem
    participant Zip as ZipArchive
    participant DB as SurrealDB
    
    User->>Frontend: Выбирает .wwiki файл
    Frontend->>Tauri: invoke("restore_from_backup", {backup_path})
    Tauri->>Restore: restore_from_backup(backup_path, state)
    Restore->>FS: open backup.wwiki
    Restore->>Zip: extract database.surql -> temp/
    Restore->>Zip: extract images/ -> data/user_images/
    Restore->>Zip: extract settings/ -> data/
    Restore->>DB: import(temp/database.surql)
    DB-->>Restore: OK
    Restore->>FS: cleanup temp/
    Restore-->>Tauri: OK
    Tauri-->>Frontend: OK
    Frontend->>User: Приложение перезагружено с данными
```

---

### ИИ-чат: отправка сообщения и агентский цикл

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Frontend (WowilonPanel)
    participant Tauri as Tauri (operations.rs)
    participant Tasks as AgentTasks
    participant Runner as run_agent_loop
    participant QA as QueryAnalyzer / Router
    participant LocalLLM as LocalLlm (CUDA FFI)
    participant CloudLLM as Provider (OpenRouter/API)
    participant Tools as WorldWikiTools
    participant DB as SurrealDB

    User->>Frontend: Вводит запрос / вопрос по главе
    Frontend->>Tauri: invoke("send_chat_message", {chatId, text, project, modeSlug})
    Tauri->>DB: CREATE chat_messages (user_msg + assistant_placeholder)
    Tauri->>Tasks: tokio::spawn(run_agent_loop(keyed by chat_id))
    Tauri-->>Frontend: {chat_id, assistant_msg_id, user_msg_id}
    Note over Runner,DB: Асинхронное исполнение без блокировки UI

    Runner->>DB: SELECT активный AiProfile + история (parent_id)
    Runner->>QA: analyze_user_query(text)
    
    alt Chitchat / Приветствие
        QA-->>Runner: Skip RAG
    else Запрос по главе (Chapter 1)
        QA->>DB: Exact Document Retrieval (упорядоченные чанки главы)
        DB-->>QA: Полный связный текст главы
        QA-->>Runner: retrieved_context (Document-level)
    else Общий вопрос по лору
        QA->>DB: Hybrid Search (BM25 + Dense Vector Cosine Similarity)
        DB-->>QA: Top-K фрагментов сущностей и чанков
        QA-->>Runner: retrieved_context (Semantic chunks)
    end

    alt Локальный инференс (provider == "local")
        Runner->>Runner: Внедрение контекста в реплику (rfind) + бюджетирование 12K
        Runner->>LocalLLM: spawn_blocking(generate_stream)
        loop Генерация токенов на GPU
            LocalLLM->>LocalLLM: Проверка CANCEL_LOCAL_GEN
            LocalLLM->>Frontend: emit("chat_stream_chunk", {text: delta, is_done: false})
        end
    else Облачный провайдер (OpenRouter / Anthropic / OpenAI)
        Runner->>Runner: Сборка системного промпта с <context>
        Runner->>CloudLLM: stream_message(messages + tools, reasoning_effort)
        loop Стриминг событий
            alt Рассуждения (Thinking / CoT)
                CloudLLM-->>Runner: ThinkingDelta / reasoning_content
                Runner->>Frontend: emit("chat_stream_chunk", {chunk_type: "reasoning", text})
            else Текстовый ответ
                CloudLLM-->>Runner: TextDelta
                Runner->>Frontend: emit("chat_stream_chunk", {chunk_type: "text", text: delta})
            else Вызов инструмента (ToolUse)
                CloudLLM-->>Runner: ToolUse (name, args)
                Runner->>Frontend: emit("agent_tool", AgentToolEvent)
                Runner->>Tools: WorldWikiTools::run(name, args)
                Tools->>DB: Чтение / Запись лора
                Tools-->>Runner: Результат исполнения (JSON)
            end
        end
    end

    Runner->>DB: UPDATE chat_messages SET content = answer, reasoning = reasoning
    Runner-->>Frontend: emit("chat_stream_chunk", {text: "", is_done: true})
    Frontend->>User: Ответ отрисован, аккордеон мыслей доступен
```

---

## 📝 Примечания и Архитектурные Решения

1. **Гексагональная Модульность**: Вся кодовая база бэкенда разделена на 5 изолированных крейтов (`worldwiki-domain`, `worldwiki-ports`, `worldwiki-application`, `worldwiki-infrastructure`, `worldwiki-tauri`).
2. **Макросы**:
   - `bridge_command!` (`worldwiki-tauri`) — механический мост, инжектирующий `AppState` и маппящий ошибки в `IpcError`.
   - `entity_commands!` (`surreal_domain_macros`) — сборка команд с поддержкой путей модулей (`syn::Path`) и генерацией CRUD.
3. **SurrealDB & GraphRAG**:
   - Работает в embedded режиме (`SurrealKv`), файлы в `data/surreal_db/`.
   - DDL схема вкомпилирована и применяется при старте из `apps/spa/src/logic/surreal_schema.surql`.
   - Внедрена нативная функция графового обхода окрестности `fn::get_chapter_multi_hop_context`.
   - Таймлайн индексирован по эталону абсолютной минуты $M_{\text{abs}}$ (`idx_event_m_abs`) со связями `participates_in`.
4. **Типизация RecordId**: Формат `table:id`, хелперы `safe_id`/`flatten_thing` нормализуют идентификаторы.
5. **Транзакции**: Критичные операции (удаление, батч, редактирование глав с ружьями и планами) обёрнуты в атомарные транзакции `EditManuscriptAtomicWorkflow`.
6. **Производительность**: `get_entities_batch`, `upsert_connections_batch` минимизируют round-trip'ы.
7. **AI-стек**:
   - Локальный инференс через прямой C++ FFI `llama-sys` / `llama.cpp` на GPU CUDA, сэмплеры со штрафами повторений, KV-кэш 16K, безопасный батчинг эмбеддеров (4096 токенов).
   - Облачный инференс через провайдеров (OpenRouter, Anthropic, OpenAI, DeepSeek, Gemini).
   - Двухуровневая модель ИИ: 8 высокоуровневых фасадов (`ai_query_world`, `ai_inspect_entity`, `ai_edit_manuscript` и т.д.) делегируют в типизированный Application Core.
   - Поддержка потокового **Reasoning / CoT (Thinking)** с отображением рассуждений в аккордеоне UI.
   - История чатов хранится в `chat_messages` в виде направленного дерева с поддержкой форков и веток.
8. **Стриминг ответа**: UI получает дельты через события `chat_stream_chunk` (payload `StreamChunk`) и `agent_tool` (payload `AgentToolEvent`); генерация запускается в `tokio::spawn` и регистрируется в `AgentTasks` для отмены через `cancel_generation` (включая мгновенный сброс GPU через атомик `CANCEL_LOCAL_GEN`).
9. **Лимиты контекста**: `prompt.rs` задаёт `MAX_AGENT_ITERATIONS = 8`, `DEFAULT_MAX_TOKENS = 4096`, `HISTORY_CHAR_BUDGET = 120_000`, локальный бюджет лора `12_000` символов.