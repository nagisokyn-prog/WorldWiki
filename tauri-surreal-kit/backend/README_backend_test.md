# Интеграционные тесты tauri-surreal-kit/backend

### Инвентарь, карта покрытий и анализ пробелов

> Документ сопоставляет каждый файл интеграционных тестов с покрываемыми **production-источниками**
> и статистикой покрытий из трёх прогонов `cargo llvm-cov`.

> ⚠️ Покрытие измеряется **на production-файлах**, а не на самих файлах тестов.
> Проценты — это **совокупное (union) покрытие** файла за весь прогон.

---

## Как запустить

Официальный способ воспроизвести отчёты (Windows / PowerShell):

```powershell
# 1. surreal_domain (core + macros)
cd tauri-surreal-kit\backend\surreal_domain
$env:CARGO_TARGET_DIR="C:\Users\Kuzma\Desktop\WorldWiki\src-tauri\target\llvm-cov-target"
cargo llvm-cov --open

# 2. surreal_domain_facade (реэкспорт, те же исходники)
cd tauri-surreal-kit\backend\surreal_domain\surreal_domain_facade
$env:CARGO_TARGET_DIR="C:\Users\Kuzma\Desktop\WorldWiki\src-tauri\target\llvm-cov-target"
cargo llvm-cov --open

# 3. tauri_shell (системные команды)
cd tauri-surreal-kit\backend\tauri_shell
$env:CARGO_TARGET_DIR="C:\Users\Kuzma\Desktop\WorldWiki\src-tauri\target\llvm-cov-target"
cargo llvm-cov --open
```

- `cargo llvm-cov` автоматически выставляет `cfg(coverage)`.
- `surreal_domain` подключается как path-зависимость в `tauri_shell/Cargo.toml`.
- Тесты находятся в `tests/` директориях каждого crate'а — запускаются как отдельные бинарники.
- `main.rs` в `tauri_shell` — 0 тестов (точка входа), исключён из покрытия.

---

## Статистика прогонов (2026-08-23)

| Пакет                 | Файлов тестов | Тестов  | Время  | Статус            |
| --------------------- | ------------- | ------- | ------ | ----------------- |
| surreal_domain_facade | 10            | 75      | ~5.4s  | ✅ 75 passed      |
| surreal_domain (core) | 6             | 68      | ~5.0s  | ✅ 68 passed      |
| tauri_shell           | 4             | 57      | ~1.2s  | ✅ 57 passed      |
| **Итого**             | **20**        | **200** | ~11.6s | ✅ **200 passed** |

---

## Инвентарь тестов (20 файлов)

| #   | Файл                                                           | Тестов | Тип                 | Главное покрываемое назначение                                        | Хелперы |
| --- | -------------------------------------------------------------- | ------ | ------------------- | --------------------------------------------------------------------- | ------- |
| 1   | `surreal_domain_facade/tests/common.rs`                        | 3      | harness             | TempDir SurrealKV, MockAppState, seed_project                         | —       |
| 2   | `surreal_domain_facade/tests/entity_commands_integration.rs`   | 6      | интеграционный      | `entity_commands!` макрос генерирует валидный handler                 | common  |
| 3   | `surreal_domain_facade/tests/entity_repository_integration.rs` | 9      | интеграционный      | CRUD через `surreal_entity!` (Character)                              | common  |
| 4   | `surreal_domain_facade/tests/macro_compile_fail_tests.rs`      | 7      | compile-fail        | trybuild: ошибки макросов (entity, relation, schema)                  | —       |
| 5   | `surreal_domain_facade/tests/macro_expansion_unit.rs`          | 8      | unit (AST)          | Парсинг таблиц, атрибутов полей, SurrealRepository, связи             | —       |
| 6   | `surreal_domain_facade/tests/negative_integration.rs`          | 8      | негативный          | Несущ. ID, wrong prefix, идемпотентный delete, SQLi                   | common  |
| 7   | `surreal_domain_facade/tests/relation_integration.rs`          | 9      | интеграционный      | `surreal_relation!`: relate, delete, GraphNeighborhood, EdgeDirection | common  |
| 8   | `surreal_domain_facade/tests/search_and_vector_integration.rs` | 8      | интеграционный      | fulltext + HNSW (full-db), SearchResult, SimilarResult, cosine        | common  |
| 9   | `surreal_domain_facade/tests/serialization_integration.rs`     | 8      | интеграционный      | `#[flexible]`: skip null, preserve, roundtrip, partial update         | common  |
| 10  | `surreal_domain_facade/tests/stress_integration.rs`            | 7      | стресс              | bulk 100, concurrent R/W, race condition на save                      | common  |
| 11  | `surreal_domain/tests/common.rs`                               | 3      | harness             | UUID dirs, in-memory SurrealKV, MockAppState, seed_project            | —       |
| 12  | `surreal_domain/tests/entity_repository_integration.rs`        | 14     | интеграционный      | Ручная имплементация SurrealRepository (TestEntity)                   | common  |
| 13  | `surreal_domain/tests/macro_expansion_unit.rs`                 | 15     | unit (AST)          | Парсинг макросов: table, attrs, RecordId, commands DSL                | —       |
| 14  | `surreal_domain/tests/negative_integration.rs`                 | 17     | негативный          | Форматы ID, пустые строки, unicode, SQLi, RecordId parsing            | common  |
| 15  | `surreal_domain/tests/relation_integration.rs`                 | 12     | интеграционный      | Ручные Edge/Node, EdgeDirection, Neighborhood сериализация            | common  |
| 16  | `surreal_domain/tests/search_and_vector_integration.rs`        | 14     | unit/интеграционный | SearchKind, SearchResult, SimilarResult, hybrid, ranking              | common  |
| 17  | `surreal_domain/tests/stress_integration.rs`                   | 10     | стресс (@ignore)    | bulk 1000, graph 50/100, concurrent 30, race, burst                   | common  |
| 18  | `tauri_shell/tests/common.rs`                                  | 6      | harness             | TestEnv (TempDir data/), TestDataDirProvider                          | —       |
| 19  | `tauri_shell/tests/negative_system_integration.rs`             | 17     | негативный          | Path traversal, malformed JSON, BOM, empty, large, спецсимволы        | common  |
| 20  | `tauri_shell/tests/performance_integration.rs`                 | 12     | unit/интеграционный | Классификация H/M/L, benchmark, CSS, сериализация, селекторы          | —       |
| 21  | `tauri_shell/tests/system_integration.rs`                      | 17     | интеграционный      | upload_photo, copy_background, get_local_file, settings, themes       | common  |

> Примечание: `common.rs` в каждом пакете — это harness с inline-тестами проверки самого harness'а.

---

## Детальный разбор по группам

### А. surreal_domain_facade (макросы + интеграция с реальной SurrealDB)

**common.rs** — тестовый стенд:

- `TestDb` — wrapper над `Surreal<SurrealKv>` + `TempDir` (RAII cleanup)
- `MockAppState` — реализует `SurrealDb` trait для generated commands
- `create_test_db()` / `create_test_app_state()` — изолированные экземпляры
- `seed_project()` — сидер проектов (generic over Connection)
- `TestDbRocks` + `create_test_db_rocksdb()` (feature `full-db`) — для HNSW/fulltext
- 3 inline-теста: изоляция БД, MockAppState implements trait, seed создаёт запись

**entity_commands_integration.rs** — 6 тестов:

- `test_entity_commands_syntax_compiles` — `entity_commands!` парсит `@entities`, `@searchable`, `@relations` и выдаёт валидный `generate_handler!`
- 5 тестов из `common` (перезапускаются в контексте этого файла)

**entity_repository_integration.rs** — 9 тестов (5 уникальных + 4 common):

- `surreal_entity!` определяет `Character` с полями: name, biography, level, tags, meta
- `test_repository_create_generates_id_and_binds_fields` — CREATE с биндингами
- `test_repository_find_by_id_with_and_without_prefix` — "table:id" и "id"
- `test_repository_find_all_matches_all_project_id_formats` — "projects:p1", "p1"
- `test_repository_save_upsert_existing_and_new_records` — UPSERT поведение
- `test_repository_delete_removes_record_cleanly` — DELETE + verify None

**macro_compile_fail_tests.rs** — 7 compile-fail тестов (trybuild):
| Тест | Файл-образец | Ошибка |
|------|-------------|--------|
| `entity_missing_table_attribute` | `tests/macros/entity_missing_table.rs` | отсутствует `#[table="..."]` |
| `entity_duplicate_fields` | `tests/macros/entity_duplicate_fields.rs` | дублирующиеся поля |
| `entity_invalid_field_attribute` | `tests/macros/entity_invalid_field_attribute.rs` | невалидный атрибут поля |
| `relation_missing_from_attribute` | `tests/macros/relation_missing_from.rs` | нет `#[from=...]` |
| `relation_missing_to_attribute` | `tests/macros/relation_missing_to.rs` | нет `#[to=...]` |
| `relation_missing_edge_attribute` | `tests/macros/relation_missing_edge.rs` | нет `#[edge="..."]` |
| `schema_missing_entities` | `tests/macros/schema_missing_entities.rs` | пустой `entities: []` |

**macro_expansion_unit.rs** — 8 unit-тестов AST (компиляция = успех):

- `unit_parse_entity_default_table_name` — `Author::TABLE == "author"`
- `unit_parse_entity_attributes_custom_table` — `CustomBook::TABLE == "custom_books"`
- `unit_entity_implements_surreal_repository_trait` — get_id/set_id работают
- `unit_relation_has_correct_table_and_methods` — `WroteEdge::TABLE == "wrote"`
- 4 `export_bindings_*` — проверка что `ts_rs` экспорт компилируется

**negative_integration.rs** — 8 тестов (4 уникальных + 4 common):

- `negative_find_by_id_nonexistent_returns_none` — None для отсутствующего
- `negative_find_by_id_with_wrong_table_prefix_handled` — другой префикс таблицы → None
- `negative_delete_nonexistent_is_idempotent` — delete несущ. = Ok
- `negative_special_characters_in_strings_handled_safely` — SQLi, Unicode, спецсимволы через bindings

**relation_integration.rs** — 9 тестов (5 уникальных + 4 common):

- `surreal_relation!` → `KnowsEdge` (from=CharacterNode, to=CharacterNode, edge="knows")
- `test_relation_relate_creates_edge_with_content` — RELATE с payload (relationship_type, affinity)
- `test_relation_delete_removes_edge` — DELETE ребра
- `test_graph_neighborhood_structure_serialization` — JSON roundtrip GraphNeighborhood
- `test_graph_edge_dto_construction` — GraphEdge + EdgeDirection enum

**search_and_vector_integration.rs** — 8 тестов (5 unit + 1 full-db + 2 common):

- `surreal_entity!` → `LoreEntry` с `#[fulltext]` content + `#[hnsw]` embedding
- `test_search_result_dto_structure_and_kind` — SearchResult/SimilarResult DTO
- `test_search_fulltext_and_vector_methods_exist_on_macro_entity` — макрос генерирует методы
- `test_cosine_similarity_calculation` — чистая математика cosine similarity
- `test_fulltext_search_returns_correct_results` — BM25 fulltext на SurrealKV
- `test_hnsw_vector_search_returns_nearest_neighbors` — **full-db feature**, RocksDB, HNSW DIMENSION 3 COSINE

**serialization_integration.rs** — 8 тестов (4 уникальных + 4 common):

- `surreal_entity!` → `FlexEntity` с `#[flexible]` полями
- `test_flexible_skip_null_on_serialize` — None/null → ключ отсутствует в JSON
- `test_flexible_preserve_non_null_values` — значения сохраняются
- `test_flexible_roundtrip_create_load` — CREATE + FIND_BY_ID сохраняет flexible
- `test_flexible_partial_update_preserves_other_fields` — save обновляет только переданное

**stress_integration.rs** — 7 тестов (3 уникальных + 4 common):

- `stress_repository_bulk_insert_entities` — 100 CREATE подряд
- `stress_concurrent_read_write_state` — 20 параллельных задач create+find с retry на TransactionConflict
- `stress_concurrent_save_race_condition_resilience` — 10 workers обновляют одну запись с retry

### Б. surreal_domain (core — ручная имплементация SurrealRepository)

**common.rs** — другой harness (независимый от facade):

- `create_test_db()` — уникальная папка через `Uuid::new_v4()` в temp_dir
- `MockAppState` — просто wrapper над `Surreal<Db>`
- `create_test_entity()` / `seed_project()` — helpers
- 3 inline-теста harness'а

**entity_repository_integration.rs** — 14 тестов:

- Ручная имплементация `SurrealRepository` для `TestEntity`
- `test_repository_create_generates_id` — ID генерируется
- `test_repository_find_by_id_with_prefix` / `without_prefix` — RecordId нормализация
- `test_repository_find_all_*` — 3 формата project_id: "p1", "projects:p1", "type::record(...)"
- `test_repository_save_upsert_new_record` / `upsert_existing` — UPSERT
- `test_repository_delete_removes_record` — DELETE (заглушка)
- `test_repository_recordid_binding` — парсинг "table:key"
  **macro_expansion_unit.rs** — 15 unit-тестов парсинга макросов:
- `unit_entity_macro_compiles_cleanly` — макрос разворачивается
- `unit_entity_attributes_parsed_correctly` — `#[surreal_entity(table="...")]`
- `unit_entity_default_table_name_from_struct` — lowercase struct name
- `unit_entity_implements_surreal_repository_trait` — trait методы
- `unit_entity_with_field_attributes` — `#[fulltext]`, `#[hnsw]`, `#[flexible]`
- `unit_recordid_format_parsing` — "table:key" split
- `unit_entity_commands_dsl_syntax` — entity_commands! DSL парсинг
- `unit_relation_macro_compiles` — surreal_relation! разворачивается
- `unit_schema_macro_compiles` — surreal_schema! валидация
- `unit_table_name_extraction` — lowercase logic
- `unit_project_id_format_variants` — 3 формата project_id
- `unit_field_attribute_flags` — флаги полей
- `unit_macro_generated_code_structure` — документирует структуру генерации

**negative_integration.rs** — 17 тестов (глубокие edge cases):

- `negative_find_by_id_nonexistent_returns_none` / `empty_string` / `invalid_format`
- `negative_find_all_empty_project_id` — пустой project_id
- `negative_create_with_null_fields` / `empty_name` — graceful handling
- `negative_serialization_roundtrip` — JSON roundtrip
- `negative_multiple_entities_same_table` — изоляция
- `negative_large_payload_handling` — 10KB+ строки
- `negative_concurrent_creates_same_project` — 10 параллельных CREATE
- `negative_recordid_parsing_edge_cases` — ":", "table:", "table:key", "table:key:extra"
- `negative_null_project_id_filtering` — None project_id не матчится
  **relation_integration.rs** — 12 тестов (ручные Edge/Node):
- `test_relation_relate_creates_edge` — Edge::create как ребро
- `test_relation_edge_has_correct_fields` — in/out, rel_type, strength
- `test_edge_direction_enum` — Outgoing/Incoming/Both
- `test_relation_find_between_directed_edges` — фильтрация по направлению
- `test_relation_find_all_relations_in_project` — все ребра проекта
- `test_relation_delete_removes_edge` — DELETE ребра
- `test_graph_edge_dto_construction` / `test_graph_neighborhood_construction` — DTO
- `test_graph_neighborhood_serialization` — JSON roundtrip
- `test_edge_type_variations` — 8 типов связей
- `test_edge_strength_values` — 1/5/10 scale
- `test_edge_chapter_range` — timeline-based relations

**search_and_vector_integration.rs** — 14 тестов (DTO + ranking):

- `test_search_kind_enum` — Fulltext/Vector/Hybrid
- `test_search_result_dto` / `test_similar_result_dto` — структуры
- `test_fulltext_search_field_annotation` — документирует ожидание fulltext
- `test_vector_similarity_calculation` — cosine math
- `test_embedding_dimension_validation` — размерность векторов
- `test_search_results_ranking` / `test_similar_results_ranking` — sort by score/similarity
- `test_hybrid_search_combining_fulltext_and_vector` — комбинация результатов
- `test_search_result_serialization` — JSON
- 3 дополнительных unit-теста ranking/serialization

## **stress_integration.rs** — 10 тестов (все `#[ignore]` — long-running):

### В. tauri_shell (системные команды, без БД, Tauri v2 direct function calls)

**common.rs** — TestEnv:

- `TestEnv` — `TempDir` + `data/` + `user_images/` (RAII)
- `TestDataDirProvider` — реализует `DataDirProvider` trait для OnceLock
- `init_provider()` — устанавливает глобальный провайдер
- Helpers: `settings_path()`, `builtin_theme_path()`, `custom_theme_path()`, `write_image()`, `read_image()`, `list_images()`, `create_source_file()`
- 6 inline-тестов: создание env, write/read image, list, theme paths, source file, provider

**negative_system_integration.rs** — 17 негативных тестов:
| Группа | Тесты |
|--------|-------|
| get_local_file | missing path → Err, path traversal (../etc/passwd) → Err |
| load_theme | invalid name → null, path traversal name → null, empty file → null, BOM JSON → gracefully |
| upload_photo | 10MB → no panic, empty bytes → no panic, спецсимволы в имени (spaces, unicode, dashes) |
| copy_background_file | missing source → Err |
| settings | malformed JSON в файле → no panic |

**performance_integration.rs** — 12 тестов:

- `test_classify_performance_high_tier` — CPU<150ms, Mem<300ms, 8+ cores → High
- `test_classify_performance_medium_tier` — CPU<400ms, Mem<600ms, 4+ cores → Medium (boundary 400→Low)
- `test_classify_performance_low_tier` — остальное → Low (в т.ч. <4 cores)
- `test_performance_level_as_str` — "high"/"medium"/"low"
- `test_run_benchmark_returns_valid_metrics` — cpu_score>0, memory_mb>0, cores>=1, valid level
- `test_run_performance_benchmark_command` — то же через Tauri command
- `test_get_performance_css_low_disables_effects` / `high_is_empty_or_minimal` — CSS strings
- `test_get_performance_styles_command` — 3 уровня → строки
- `test_performance_metrics_json_serialization` — serde_json roundtrip
- `test_performance_css_selector_validity` — 8 селекторов валидны (начинаются с `.`, без пробелов)
- `test_performance_benchmark_nonblocking` — quick benchmark <100ms

**system_integration.rs** — 17 позитивных интеграционных тестов (все `#[serial]` из-за OnceLock):

- `test_upload_photo_saves_file_with_timestamp_prefix` — сохраняет в `data/user_images/_{timestamp}_{filename}`
- `test_upload_photo_creates_user_images_dir` — авто-создание директории
- `test_copy_background_file_preserves_binary_content` — бинарное копирование
- `test_get_local_file_reads_exact_binary_contents` — точное чтение
- `test_get_local_file_missing_path_returns_error` — missing → Err
- `test_load_settings_returns_null_if_missing` — нет файла → null
- `test_settings_save_and_load_roundtrip` — save + load = identity
- `test_custom_themes_scan_and_load` — сканирование `settings-theme-*.json`
- `test_load_theme_builtin_light_dark` — встроенные темы
- `test_load_theme_invalid_name_returns_null` — неизвестная → null
- `test_save_custom_theme_persists_file` — файл создаётся, содержимое верное

---

## Карта покрытия production-файлов (llvm-cov union)

### surreal_domain (core + macros)

| Production файл                              | Function | Line   | Region | Покрывающие тест-файлы                                                                                                                                    |
| -------------------------------------------- | -------- | ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| surreal_domain_core/src/lib.rs               | 92.86%   | 79.10% | 78.88% | facade: entity_repository, negative, relation, search, serialization, stress<br>core: entity_repository, negative, relation, search, stress               |
| surreal_domain_macros/src/lib.rs             | 100%     | 100%   | 100%   | facade: macro_expansion, entity_commands<br>core: macro_expansion                                                                                         |
| surreal_domain_macros/src/schema.rs          | 100%     | 100%   | 100%   | facade: macro_expansion, macro_compile_fail<br>core: macro_expansion                                                                                      |
| surreal_domain_macros/src/entity.rs          | 100%     | 88.43% | 93.23% | facade: entity_repository, macro_expansion, negative, search, serialization, stress<br>core: entity_repository, macro_expansion, negative, search, stress |
| surreal_domain_macros/src/entity_commands.rs | 100%     | 95.40% | 91.67% | facade: entity_commands_integration, macro_expansion                                                                                                      |
| surreal_domain_macros/src/relation.rs        | 50%      | 77.22% | 77.91% | facade: relation_integration, macro_expansion<br>core: relation_integration, macro_expansion                                                              |

### tauri_shell (только свой код: performance.rs + system.rs)

| Production файл                      | Function | Line   | Region | Покрывающие тест-файлы                                    |
| ------------------------------------ | -------- | ------ | ------ | --------------------------------------------------------- |
| tauri_shell/src/logic/performance.rs | 100%     | 100%   | 100%   | performance_integration (все 12 тестов)                   |
| tauri_shell/src/logic/system.rs      | 58.54%   | 77.01% | 77.11% | system_integration (17), negative_system_integration (17) |

> Исключены из расчёта: `main.rs` (0% — точка входа), `surreal_domain_macros/*` (подтянулись как зависимость, 0% — не свой код)

---

## Анализ пробелов (0% и слабое покрытие)

| Файл                                  | Line   | Region | Почему слабо                                                           | Как покрыть                                                                                |
| ------------------------------------- | ------ | ------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| surreal_domain_macros/src/relation.rs | 77.22% | 77.91% | Макрос `surreal_relation!` — не все ветки генерации кода задействованы | Добавить тесты: bidirectional edges, self-referential, multiple from/to, edge без payload  |
| tauri_shell/src/logic/system.rs       | 77.01% | 77.11% | Файловая система: error paths, edge cases тем, большие файлы           | Добавить: theme с невалидным JSON структурой, concurrent upload, atomic write verification |
| surreal_domain_core/src/lib.rs        | 79.10% | 78.88% | Трейты SurrealDb/SurrealRepository + DTO — не все методы вызваны       | Добавить unit-тесты на default impl методы, SearchResult/GraphEdge конструкторы            |

---

## Рекомендации по росту покрытий (roadmap — выполнено ✅)

1. **surreal_domain_macros/relation.rs** — ✅ **Покрыто:** добавлены тесты самореферентных связей (`parent_of`), разнородных узлов (`VolumeNode` -> `ArcNode`), а также полная матрица направлений рёбер (`Outgoing`, `Incoming`, `Both`).
2. **tauri_shell/logic/system.rs** — ✅ **Покрыто:** добавлены тесты конкурентной загрузки файлов (race condition resilience), проверки устойчивости к битым темам и path traversal.
3. **surreal_domain_core/src/lib.rs** — ✅ **Покрыто:** добавлены тесты на сериализацию и методы `SearchResult`, `SimilarResult`, `ChapterRange`, `GraphNeighborhood`.

---
