# 🚀 src-tauri/src — Composition Root, Инициализация БД и Legacy/Macro CRUD

> **Слой Cerberus**: `tauri` (корень бинарника и библиотеки `world_wiki_lib`).  
> **Назначение**: Точка входа приложения, запуск Tauri v2, инициализация embedded SurrealDB (`SurrealKv`) с DDL-миграциями, сборка графа зависимостей `AppServices` и макро-сгенерированные команды `surreal_domain`.

---

## 🏛️ Структура директории (`src/`)

| Модуль / Файл | Назначение |
|---|---|
| [`main.rs`](./main.rs) | Точка входа бинарника (`windows_subsystem = "windows"` в релизе), вызывает `world_wiki_lib::run()`. |
| [`lib.rs`](./lib.rs) | Регистрация плагинов Tauri (`opener`, `window_state`, `dialog`, `single_instance`), подключение `surreal_domain::entity_commands!` и `build_invoke_handler!`, настройка lifecycle-хуков окна. |
| [`bootstrap/`](./bootstrap/mod.rs) | **Composition Root и жизненный цикл**: |
| ↳ [`database.rs`](./bootstrap/database.rs) | `init_database()` — старт `SurrealKv`, выбор `ns/db = worldwriter`, проверка хэша схемы и запуск DDL-пайплайна. |
| ↳ [`schema_catalog.rs`](./bootstrap/schema_catalog.rs) | Каталог `ALL_DDL_MODULES` (встраивает `.surql`-модули из `apps/spa/src/logic/schema/no_ai/` и `ai/`), `CORE_ENTITY_SCHEMAS`, `compute_schema_hash()`. |
| ↳ [`schema_migration.rs`](./bootstrap/schema_migration.rs) | `apply_schema_pipeline`, `apply_ddl_module`, `deduplicate_entity_schemas`, `sync_builtin_entity_schemas`. |
| ↳ [`services.rs`](./bootstrap/services.rs) | `build_surreal_app_services` (продакшн-граф с SurrealDB и AI/Mock адаптерами) и `build_app_services` (in-memory граф для тестов). |
| ↳ [`lifecycle.rs`](./bootstrap/lifecycle.rs) | `setup_application`, `handle_window_event` (резервный экспорт БД при закрытии окна), `AppState`, `AgentTasks`. |
| [`logic/`](./logic/mod.rs) | **Макросы, модели и модульные CRUD-операции**: |
| ↳ [`mod.rs`](./logic/mod.rs) | Макросы `with_occ_retry!` (повтор при OCC write conflict) и `forward_ipc!`, реэкспорт доменных/инфраструктурных подсистем (`calendar_math`, `documents`, `export`, `ai`). |
| ↳ [`models.rs`](./logic/models.rs) | Определение сущностей и связей через `surreal_entity!` и `surreal_relation!` с генерацией TypeScript-типов (`ts-rs`). |
| ↳ [`batch/`](./logic/batch/mod.rs) | Пакетные операции (`commands.rs`, `executor.rs`, `reader.rs`, `writer/`, `errors.rs`). |
| ↳ [`chapters/`](./logic/chapters/mod.rs) | Операции глав, текстовых блоков, ревизий и таймлайна (`commands.rs`, `crud.rs`, `revisions.rs`, `text_blocks.rs`, `timeline.rs`, `errors.rs`). |
| ↳ [`entities/`](./logic/entities/mod.rs) | CRUD сущностей, схем и связей (`commands.rs`, `entities_crud.rs`, `schemas_crud.rs`, `history_crud.rs`, `relations.rs`, `relation_schemas.rs`, `crud_helpers.rs`, `types.rs`, `errors.rs`). |
| ↳ [`schema.rs`](./logic/schema.rs) | Модуль совместимости схемы. |
| [`tests/`](./tests/README_src_test.md) | 20 файлов интеграционных и системных тестов + test harness (`common.rs`). Подробнее см. [`README_src_test.md`](./tests/README_src_test.md). |

---

## 🧪 Тестирование

```bash
# Интеграционные тесты ядра src/tests/
cargo test --lib -- tests
```
