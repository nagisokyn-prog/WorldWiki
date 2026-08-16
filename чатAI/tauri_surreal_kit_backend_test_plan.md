# План тестирования: `tauri-surreal-kit/backend`

> **Цель**: Покрыть 100% критической функциональности переиспользуемого фреймворка `tauri-surreal-kit/backend` (`surreal_domain_core`, `surreal_domain_macros`, `surreal_domain_facade`, `tauri_shell`) надежными Unit-, Integration-, Stress- и Negative-тестами по стандарту enterprise-уровня.

---

## 1. Архитектурная карта компонентов и их покрытие тестами

```
tauri-surreal-kit/backend
├── surreal_domain/
│   ├── surreal_domain_core/         ◄── [T1: Trait CRUD, DTOs, RecordId normalizer]
│   ├── surreal_domain_macros/       ◄── [T2: AST Parsing, Macro Expansions, Command Gen]
│   └── surreal_domain_facade/       ◄── [T3: Re-export Facade & Full Stack Integration]
└── tauri_shell/
    ├── logic/system.rs              ◄── [T4: FS, User Images, Themes, Settings]
    ├── logic/performance.rs         ◄── [T5: CPU/Mem Benchmarks, Adaptive CSS]
    └── main.rs / lib.rs             ◄── [T6: AppState, Bootstrap, entity_commands! Handler]
```

---

## 2. Структура тестовых модулей

Тестовый сьют организуется в двух основных точках:
1. **`surreal_domain/tests/`** (или в `surreal_domain_facade/tests/` с доступом ко всем 3 crate'ам) — тестирование макросов, CRUD-трейтов, графов, поиска и кодогенерации команд.
2. **`tauri_shell/tests/`** (или `tauri_shell/src/tests/`) — тестирование системных команд, бенчмарков, тем, настроек и интеграции с Tauri runtime.

```
tauri-surreal-kit/backend/
├── surreal_domain/tests/
│   ├── mod.rs
│   ├── common.rs                               # Тестовая in-memory SurrealDB, AppState mock
│   ├── macro_expansion_unit.rs                 # Unit-тесты синтаксиса и парсинга AST
│   ├── entity_repository_integration.rs        # Тесты SurrealRepository (CRUD, RecordId)
│   ├── relation_integration.rs                 # Тесты surreal_relation! (RELATE, in/out)
│   ├── search_and_vector_integration.rs        # Тесты Fulltext & HNSW Vector сходства
│   ├── entity_commands_integration.rs          # Тесты entity_commands! и вызовов команд
│   ├── stress_integration.rs                   # Load/Stress тесты CRUD и связей
│   └── negative_integration.rs                 # Ошибки типов, невалидные ID, битые JSON
│
└── tauri_shell/tests/
    ├── mod.rs
    ├── common.rs                               # Временные каталоги data/
    ├── system_integration.rs                   # upload_photo, copy_background, themes, settings
    ├── performance_integration.rs              # benchmark score, tier classification, CSS
    └── negative_system_integration.rs          # Битые файлы, несуществующие пути, оверфлоу
```

---

## 3. Детальный реестр тестов по категориям

### Категория 1: Базовый тестовый стенд (`common.rs`)
**Целевые файлы:** `surreal_domain_core/src/lib.rs`, `tauri_shell/src/main.rs`

| Название теста | Назначение и проверки | Целевой исходник |
|---|---|---|
| `test_harness_creates_isolated_in_memory_db` | Проверяет, что каждый вызов стенда инициализирует изолированный экземпляр SurrealKV с уникальным UUID-каталогом. | `common.rs` |
| `test_mock_app_state_implements_surreal_db_trait` | Проверяет корректность реализации `SurrealDb` трейта для структуры состояния приложения (`AppState::surreal_db()`). | `surreal_domain_core/src/lib.rs` |

---

### Категория 2: AST & Macro Expansion Unit Tests (`macro_expansion_unit.rs`)
**Целевые файлы:** `surreal_domain_macros/src/entity.rs`, `relation.rs`, `schema.rs`, `entity_commands.rs`

| Название теста | Назначение и проверки | Целевой исходник |
|---|---|---|
| `unit_parse_entity_attributes_custom_table` | Проверяет, что атрибут `#[table = "custom_entities"]` корректно переопределяет константу `TABLE`. | `entity.rs` |
| `unit_parse_entity_field_attributes_flags` | Проверяет корректное распознавание флагов `#[fulltext]`, `#[hnsw]`, `#[flexible]` на полях структуры. | `entity.rs` |
| `unit_parse_relation_from_to_attributes` | Проверяет извлечение атрибутов `#[from = SourceType]` и `#[to = TargetType]` для ребра графа. | `relation.rs` |
| `unit_parse_entity_commands_syntax_dsl` | Проверяет парсинг синтаксического сахара макроса `entity_commands![cmd1, @entities:[A], @searchable:[B], @relations:[R]]`. | `entity_commands.rs` |
| `unit_schema_macro_compiles_cleanly` | Проверяет валидацию списков сущностей макросом `surreal_schema!`. | `schema.rs` |

---

### Категория 3: SurrealRepository & Entity CRUD (`entity_repository_integration.rs`)
**Целевые файлы:** `surreal_domain_core/src/lib.rs`, `surreal_domain_macros/src/entity.rs`

| Название теста | Назначение и проверки | Целевой исходник |
|---|---|---|
| `test_repository_create_generates_id_and_binds_fields` | Создает сущность через `Entity::create()`, проверяет генерацию ID, биндинг скалярных полей и удаление null-значений. | `core/src/lib.rs:77` |
| `test_repository_find_by_id_with_and_without_prefix` | Выбирает запись по `"table:key"` и по чистому `"key"`, проверяя корректное отсечение префикса таблицы. | `core/src/lib.rs:129` |
| `test_repository_find_all_matches_all_project_id_formats` | Проверяет фильтрацию `WHERE project_id = ...` для 3 форматов: `"p1"`, `"projects:p1"`, `type::record('projects', 'p1')`. | `core/src/lib.rs:137` |
| `test_repository_find_all_deserializes_surreal_thing_objects` | Проверяет нормализацию внутренних полей `{ "tb": "table", "id": "key" }` в строковый вид `"table:key"`. | `core/src/lib.rs:150` |
| `test_repository_save_upsert_existing_and_new_records` | Вызывает `Entity::save()` для новой записи (делегирование в `create`) и для существующей (вызов `UPSERT $__record_id`). | `core/src/lib.rs:188` |
| `test_repository_save_preserves_record_id_bindings` | Проверяет, что поля вида `"table:key"` биндятся как строгие `RecordId`, исключая строковые конфликты схемы. | `core/src/lib.rs:214` |
| `test_repository_delete_removes_record_cleanly` | Удаляет запись через `Entity::delete()` и проверяет `find_by_id(...) == None`. | `core/src/lib.rs:242` |

---

### Категория 4: Graph Relations & Traversal (`relation_integration.rs`)
**Целевые файлы:** `surreal_domain_macros/src/relation.rs`, `surreal_domain_core/src/lib.rs`

| Название теста | Назначение и проверки | Целевой исходник |
|---|---|---|
| `test_relation_relate_creates_edge_with_content` | Выполняет `Relation::relate(&db, from, to, data)`, проверяя создание записи в таблице ребер с полями `in` и `out`. | `relation.rs:134` |
| `test_relation_find_between_returns_directed_edges` | Выбирает ребра между конкретной парой узлов `from` и `to` через `find_between()`. | `relation.rs:135` |
| `test_relation_find_all_scoped_to_project` | Проверяет выборку всех ребер проекта через `Relation::find_all(&db, project_id)`. | `relation.rs:136` |
| `test_relation_delete_removes_edge` | Удаляет ребро графа по идентификатору через `Relation::delete(&db, edge_id)`. | `relation.rs:137` |
| `test_graph_neighborhood_structure_serialization` | Проверяет сериализацию и структуру DTO `GraphNeighborhood` (`center_id`, `nodes`, `edges`, `depth`). | `core/src/lib.rs:57` |

---

### Категория 5: Search & Vector Similarity (`search_and_vector_integration.rs`)
**Целевые файлы:** `surreal_domain_macros/src/entity.rs`, `surreal_domain_core/src/lib.rs`

| Название теста | Назначение и проверки | Целевой исходник |
|---|---|---|
| `test_search_fulltext_matches_annotated_fields` | Создает сущность с `#[fulltext]` на полях `title` и `content` и проверяет `search_fulltext(&db, project_id, query)`. | `entity.rs` |
| `test_search_similar_cosine_vector_scoring` | Создает сущность с `#[hnsw]` вектором, передает референсный вектор и проверяет сортировку по косинусному расстоянию `SimilarResult`. | `entity.rs`, `core:35` |
| `test_hnsw_embedding_dimension_mismatch_rejected` | Проверяет отказ/валидацию при попытке сохранить вектор некорректной размерности (например, 512 вместо 1536) в HNSW-индексированное поле. | `entity.rs`, `core:35` |
| `test_search_result_dto_structure_and_kind` | Проверяет DTO `SearchResult<T>` со всеми разновидностями `SearchKind::Fulltext`, `Vector`, `Hybrid`. | `core/src/lib.rs:28` |

---

### Категория 6: Tauri Commands Generation (`entity_commands_integration.rs`)
**Целевые файлы:** `surreal_domain_macros/src/entity_commands.rs`, `entity.rs`, `relation.rs`

| Название теста | Назначение и проверки | Целевой исходник |
|---|---|---|
| `test_generated_get_entities_command_execution` | Вызывает сгенерированную функцию `{Name}_commands::get_{name}s(project, state)` через mock State. | `entity.rs:111` |
| `test_generated_save_entity_command_normalizes_json` | Вызывает `{Name}_commands::save_{name}(data, state)`, проверяя входящую нормализацию RecordId из сырого JSON. | `entity.rs:113` |
| `test_generated_delete_entity_command` | Вызывает `{Name}_commands::delete_{name}(id, state)` и проверяет отсутствие записи в БД. | `entity.rs:114` |
| `test_generated_relation_commands_create_and_fetch` | Вызывает `{Rel}_commands::create_{rel}` и `{Rel}_commands::get_{rel}s`. | `relation.rs:138` |
| `test_entity_commands_expands_to_valid_tauri_handler` | Проверяет, что макрос `entity_commands!` успешно генерирует рабочий `tauri::generate_handler!`. | `entity_commands.rs` |

---

### Категория 7: System & Filesystem Commands (`system_integration.rs`)
**Целевые файлы:** `tauri_shell/src/logic/system.rs`

| Название теста | Назначение и проверки | Целевой исходник |
|---|---|---|
| `test_upload_photo_saves_file_with_timestamp_prefix` | Передает массив байт и имя файла в `upload_photo()`, проверяет создание в `data/user_images/` и уникальный timestamp префикс. | `system.rs:27` |
| `test_copy_background_file_copies_to_user_images` | Создает тестовый файл и вызывает `copy_background_file()`, проверяя целостность скопированного файла. | `system.rs:46` |
| `test_get_local_file_reads_exact_binary_contents` | Записывает бинарные данные на диск и считывает их через `get_local_file()`. | `system.rs:68` |
| `test_settings_save_and_load_roundtrip` | Сохраняет произвольный JSON через `save_settings()` и считывает через `load_settings()`. | `system.rs:95` |
| `test_custom_themes_scan_and_load` | Создает `settings-theme-custom.json`, проверяет обнаружение через `get_custom_themes()` и чтение через `load_theme("custom")`. | `system.rs:120` |
| `test_save_custom_theme_creates_formatted_json` | Сохраняет новую тему через `save_custom_theme("neon", ...)` и валидирует файл на диске. | `system.rs:135` |

---

### Категория 8: Performance Benchmark & Adaptive CSS (`performance_integration.rs`)
**Целевые файлы:** `tauri_shell/src/logic/performance.rs`, `system.rs`

| Название теста | Назначение и проверки | Целевой исходник |
|---|---|---|
| `test_run_performance_benchmark_returns_valid_metrics` | Запускает `run_benchmark()`, проверяет, что `cpu_score > 0`, `memory_mb > 0`, `cores >= 1` и `level` входит в `{Low, Medium, High}`. | `performance.rs:40` |
| `test_performance_level_classification_tiers` | Тестирует чистую логику классификации по порогам CPU/Memory/Cores (граничные значения 150ms/300ms/8cores и 400ms/600ms/4cores). | `performance.rs:75` |
| `test_get_performance_css_returns_correct_overrides` | Проверяет, что для `Low` отключаются `backdrop-filter` и `transition`, для `Medium` задается `blur(10px)`, для `High` — пустая строка. | `performance.rs:95` |

---

### Категория 9: Load & Stress Testing (`stress_integration.rs`)
**Целевые файлы:** `surreal_domain_core/src/lib.rs`, `surreal_domain_macros/src/relation.rs`

| Название теста | Назначение и проверки | Целевой исходник |
|---|---|---|
| `stress_repository_bulk_insert_5k_entities` | Массовое сохранение 5,000 сгенерированных сущностей через `Entity::save()`, замер времени и пропускной способности (ops/sec). | `core/src/lib.rs` |
| `stress_graph_high_density_connections` | Создание 1,000 графовых связей между 100 сущностями и выборка через `find_all(project_id)`. | `relation.rs` |
| `stress_concurrent_read_write_state` | 30 параллельных `tokio::spawn` задач, одновременно читающих и сохраняющих сущности через `AppState`. | `core/src/lib.rs` |
| `stress_concurrent_save_race_condition_resilience` | 10 параллельных воркеров одновременно перезаписывают (`save()`) одну и ту же сущность. Проверяет отсутствие паник, целостность и корректность финального состояния в SurrealKV. | `core/src/lib.rs` |

---

### Категория 10: Negative & Error Paths (`negative_integration.rs`, `negative_system_integration.rs`)
**Целевые файлы:** `surreal_domain_core/src/lib.rs`, `tauri_shell/src/logic/system.rs`

| Название теста | Назначение и проверки | Целевой исходник |
|---|---|---|
| `negative_find_by_id_nonexistent_returns_none` | Запрос `find_by_id("nonexistent_id")` возвращает `Ok(None)`, а не ошибку или панику. | `core/src/lib.rs:129` |
| `negative_delete_nonexistent_is_idempotent` | Повторный вызов `delete("ghost_id")` завершается успешно. | `core/src/lib.rs:242` |
| `negative_get_local_file_missing_path_returns_err` | Попытка чтения несуществующего пути в `get_local_file()` возвращает `Err(String)`. | `system.rs:68` |
| `negative_load_theme_invalid_name_returns_null` | Запрос несуществующей темы `load_theme("unknown_theme")` возвращает `Value::Null`. | `system.rs:125` |
| `negative_save_malformed_json_handled_gracefully` | Передача поврежденного payload в команды не приводит к панике процесса. | `entity.rs`, `system.rs` |

---

## 4. План реализации по шагам

```
  Шаг 1: Настройка Cargo.toml (добавление dev-dependencies: tokio, surrealdb)
     │
     ▼
  Шаг 2: Реализация стенда isolation common.rs (in-memory DB + AppState mock)
     │
     ▼
  Шаг 3: Тестирование Core & Macros (Entity CRUD, Relation Graph, Search, Commands)
     │
     ▼
  Шаг 4: Тестирование Tauri Shell (System FS, Themes, Performance, Benchmark)
     │
     ▼
  Шаг 5: Нагрузочные (Stress) и Негативные (Negative) тесты
     │
     ▼
  Шаг 6: Запуск cargo test по всему workspace и фиксация 100% PASS
```

> [!IMPORTANT]
> Все тесты будут изолированы и не оставят мусорных файлов на диске (автоматическая очистка временных `data/` и `temp_dir`).
> **Реализация будет начата только после вашего подтверждения.**
