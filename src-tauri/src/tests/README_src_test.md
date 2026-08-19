# Интеграционные тесты WorldWiki  
### `src-tauri/src/tests/` — инвентарь, карта покрытий и анализ пробелов

> Документ сопоставляет каждый файл интеграционных тестов с покрываемыми **production-источниками**
> и статистикой покрытий из единого прогона `cargo llvm-cov`.
>
> ⚠️ покрытие измеряется **на production-файлах**, а не на самих файлах тестов.  
> Проценты — это **совокупное (union) покрытие** файла за весь прогон, а не «чисто» одного теста.

---

## Как запустить

Официальный способ воспроизвести отчёт (Windows / PowerShell):

```powershell
cd src-tauri
$env:CARGO_TARGET_DIR = "C:\Users\Kuzma\Desktop\WorldWiki\src-tauri\target\llvm-cov-target"
cargo llvm-cov --open
```

- `cargo llvm-cov` автоматически выставляет `cfg(coverage)` (сообщение: `info:
  cargo-llvm-cov currently setting cfg(coverage); you can opt-out it by passing --no-cfg-coverage`).
- Используются **default features** = `["ai-cloud"]` (т.е. включены `claw_runtime` +
  `claw_api`). Без `ai-cloud` тесты `ai_integration.rs` и `chat_integration.rs` не
  скомпилируются — `logic/mod.rs` объявляет `pub mod ai;` **без** `#[cfg(feature)]`.
- Фича `ai-local = ["ai-cloud", "dep:llama-sys"]` **не требуется** для прогона тестов
  (локальные LLM/ONNX не вызываются интеграционными тестами).
- `surreal_domain` (путь `tauri-surreal-kit/backend/surreal_domain/surreal_domain_facade`)
  подключается как path-зависимость и участвует в сборке.
- Тесты находятся внутри `lib`-крейта (`src/lib.rs:201` → `#[cfg(test)] mod tests;`),
  поэтому запускаются как `unittests src/lib.rs`.

### Производительность и изоляция

- `common::create_test_db()` открывает **уникальный временный каталог**
  (`%TMP%/worldwiki-test-<pid>-<idx>-<uuid>`) для каждого теста, а не `SurrealKv("memory")`
  в корне: в Windows `memory` создаёт файл `memory` в cwd, из‑за чего параллельные тесты
  конфликтуют (`os error 33`). Уникальный каталог → гарантированная изоляция + no sharing
  violation.
- Схема применяется из `apps/spa/src/logic/surreal_schema.surql` через `include_str!`.

---

## Статистика прогона (Report 2 — `2026-08-19 00:37`, `src-tauri`)

```
running 139 tests
...
test result: ok. 139 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

- **77 тестов** относятся к файлам из `src-tauri/src/tests/` (перечислены ниже).
- **62 теста** — inline `#[cfg(test)]` юниты внутри production-модулей
  (`logic::*::tests`, `logic::models::export_bindings_*`, `logic::models::ts_export_tests`).
- `main.rs` — 0 тестов (выделенный `unittests src\main.rs` → `0 passed`), что объясняет
  его **0%** покрытие.

---

## Инвентарь тестов (15 файлов)

| # | Файл | Тестов | Тип | Главное покрываемое назначение | Используемые хелперы `common` |
|---|---|---|---|---|---|
| 1 | `mod.rs` | 0 | регистратор | декларация `pub mod *` для 13 остальных | — |
| 2 | `common.rs` | 0 | хелперы | `create_test_db`, `seed_project`, `seed_chapter` — изолированная in-memory БД + сидеры | — |
| 3 | `smoke_schema.rs` | 2 | smoke | DDL `surreal_schema.surql`, 23 таблицы, fulltext analyzer `like`, `INFO FOR DB` | `create_test_db` |
| 4 | `timeline_integration.rs` | 11 | интеграционный | `Chapter::find_all` (timeline), `save_global_timeline_inner`, `chapter_revisions`, pin/unpin | `create_test_db`, локальный `seed_project` |
| 5 | `hierarchy_integration.rs` | 8 | интеграционный | `volumes.rs`: create/update volume, arc, assign_chapter, reorder, get_chapter_hierarchy; ребра `contains` | `create_test_db`, `seed_project`, `seed_chapter` |
| 6 | `entity_integration.rs` | 7 | интеграционный | `entities.rs`: CRUD, upsert, scopes/filter, `entity_rel`, cascade delete entities+relations+revisions, schema + history snapshot, pin revision, relations | `create_test_db`, `seed_project` |
| 7 | `text_blocks_integration.rs` | 3 | интеграционный | `chapters.rs` → `save_text_blocks_inner`: HTML→text_blocks, семантические теги (`desc`/`dialog`/`custom_action`), ACID replace, очистка | `create_test_db`, `seed_project`, `seed_chapter` |
| 8 | `project_integration.rs` | 6 | интеграционный | `projects.rs`: CRUD, config get/save, cascade delete через триггер `delete_project_data` | `create_test_db`, `seed_project`, `seed_chapter` |
| 9 | `ai_integration.rs` | 7 | интеграционный | `prompt.rs` (build_system_prompt, history_to_input_messages), `tools/mod.rs` (WorldWikiTools: search/get/chapters_list/create_entity/create_relation/rag_search + unknown tool) | `create_test_db`, `seed_project`, `seed_chapter` |
| 10 | `embeddings_integration.rs` | 2 | интеграционный | 1536-мерные вектора в `embeddings.openai`, KNN cosine через `idx_entity_emb_openai` (HNSW) | `create_test_db`, `seed_project` |
| 11 | `stress_integration.rs` | 5 | стресс/нагрузка | bulk insert 10k entities, 3k text_blocks, 50-worker concurrency, 1100-node дерево, cascade delete 1500+ | `create_test_db`, `seed_project`, `seed_chapter` |
| 12 | `negative_integration.rs` | 10 | негативный | error path: ghost-type, malformed id (SQL-injection attempt), SCHEMAFULL reject, idempotent delete, rollback transaction, phantom endpoints, reorder missing, broken HTML | `create_test_db`, `seed_project` |
| 13 | `batch_and_connections_integration.rs` | 6 | интеграционный | `batch.rs` (get_entities_batch, save_entity_with_relations, upsert_connections_batch), `connections.rs` (get/save/remove_connections_by_source) | `create_test_db`, `seed_project` |
| 14 | `chat_integration.rs` | 3 | интеграционный | `ai/chat/tree.rs` (get_chat_messages/tree/get_chat_tree), `ai/chat/operations.rs` (fork_chat) | `create_test_db`, `seed_project` |
| 15 | `export_integration.rs` | 7 | интеграционный | `export.rs`: export_chapters, create_cloud_backup (.wwiki zip), restore_from_backup roundtrip, негатив (missing file / no database.surql), get_launch_args | `create_test_db`, `seed_project`, локальный `tmp_dir` |

**Итого в `tests/`: 77 тестов · Всего: 139.**

---

## Карта покрытий: тест → production-источник

Ниже — для каждого файла теста перечислены **production-источники**, которые он
непосредственно порождает, с их совокупными цифрами из Report 2
(`func / line / region` = покрыто / всего). Показатели — за весь прогон, т.к.
`cargo llvm-cov` исполняет все тесты вместе в одном `unittests`-бинаре.

---

### 3. `smoke_schema.rs` — 2 теста → DDL-схема
Проверка: полное накатывание `surreal_schema.surql`, 23 таблицы, fulltext analyzer `like`,
`SELECT count()` по пустым таблицам.

- `logic/schema.rs` → **0.00 %** (func 0/1 · line 0/3 · region 0/3)
  Схема применяется через `common::create_test_db` напрямую `db.query(include_str!(…))`,
  минуя `schema.rs` (runtime‑миграции) → 0 %. Это запланированный разрыв.
- Таблицы/анализаторы — часть `surreal_schema.surql` (не .rs): 23 ключевых таблиц
  (`projects, volumes, arcs, chapters, text_blocks, entities, entity_schemas,
  relation_schemas, schema_history, entity_rel, contains, calendars, tags,
  user_dictionary, chat_messages, chats, agent_memory, plans, entity_revisions,
  chapter_revisions, ai_modes, ai_profiles, ai_skills`, `appears_in`, `artifacts`,
  `web_cache`).

---

### 4. `timeline_integration.rs` — 11 тестов → `chapters.rs` (таймлайн)
Главный потребитель: `Chapter::find_all` (через `SurrealRepository`) →
`get_global_timeline`, `save_global_timeline_inner`, DDL‑события
`log_chapter_revision`, `toggle_chapter_history_pin_inner`.

- `logic/chapters.rs` → 35.14 % func (13/37) · **67.12 % line (147/219)** · 73.86 % region (260/352)
- `logic/models.rs` → 72.87 % line (побочно — `Chapter` struct)
- `surreal_domain_facade/surreal_domain.rs` → trait `find_all` impl

Сценарии: scoping по project_id, пустой таймлайн, roundtrip `save_global_timeline`,
откат non-array / missing chapter_id, snapshot через UPDATE → `log_chapter_revision`,
toggle `is_pinned` chapter_revisions.

---

### 5. `hierarchy_integration.rs` — 8 тестов → `volumes.rs`
Граф иерархии Том → Арка → Глава через ребра `contains`.

- `logic/volumes.rs` → 49.25 % func (33/67) · **70.62 % line (226/320)** · 77.00 % region (405/526)
- `logic/chapters.rs` → 67.12 % line (через `get_chapter_hierarchy_inner`)

Сценарии: `create_volume_inner` + ребро `contains`/`sort_order`, `create_arc_inner`
с volume_id, `assign_chapter_inner` (перемещение между аркой/томом), `reorder_node_inner`,
`get_chapter_hierarchy` (5 томов/25 арок/500 глав).

---

### 6. `entity_integration.rs` — 7 тестов → `entities.rs` + `models.rs`
CRUD сущностей, схемы, `entity_rel`, cascade delete + ревизии.

- `logic/entities.rs` → 27.08 % func (39/144) · **57.70 % line (528/915)** · 60.04 % region (840/1399)
- `logic/models.rs` → 60.87 % func (28/46) · **72.87 % line (94/129)** · 77.01 % region (201/261)
- `logic/calendar_math.rs` → 93.43 % line (побочно — `created_at`)

Сценарии: create/get/upsert, scopes+filter, create+delete `entity_rel`, cascade delete
(entities → `entity_rel` + `entity_revisions`), snapshot схемы в `schema_history`,
toggle `is_pinned` ревизий.

---

### 7. `text_blocks_integration.rs` — 3 теста → `chapters.rs` (text_blocks)
Нарезка HTML‑главы на семантические блоки + ACID‑замена.

- `logic/chapters.rs` → `save_text_blocks_inner` (входит в 67.12 % line, 35.14 % func)
- `logic/models.rs` → `text_blocks`, `TextBlock` (72.87 % line)

Сценарии: 3 блока `desc`/`dialog`/`custom_action` с `order_index`, атомарная замена
3 → 1 (старые удаляются транзакцией), очистка пустым HTML.

---

### 8. `project_integration.rs` — 6 тестов → `projects.rs` + DDL `delete_project_data`
- `logic/projects.rs` → 27.03 % func (10/37) · **59.40 % line (79/133)** · 62.87 % region (127/202)
- `logic/models.rs` → 72.87 % line (побочно — `Project` + `data`)
- `logic/entities.rs` → побочно (очистка entities при delete_project) — 57.70 % line

Сценарии: create/get (2 проекта), config get/save (FLEXIBLE `data`),
cascade delete → volumes/chapters/entities/text_blocks удаляются DDL‑событием
`delete_project_data`; `data: {}`‑дефолт; префикс `projects:` в get/delete.

---

### 9. `ai_integration.rs` — 7 тестов → `prompt.rs` + `tools/mod.rs` (лучший AI‑файл)
- `logic/ai/agent/prompt.rs` → **83.33 % func (5/6) · 87.85 % line (94/107) · 90.08 % region (109/121)** ← лучший AI‑файл
  покрыто: `build_system_prompt` (Golden Rules, LORE LOCK, роль, проект, инструкции),
  `history_to_input_messages` (рекурсивный обход по `parent_id`, ветвление А/Б).
- `logic/ai/tools/mod.rs` → 31.33 % func (26/83) · **36.38 % line (219/602)** · 41.05 % region (436/1062)
  покрыто 7 из 19 инструментов: `search_entities`, `get_entity`, `get_chapters_list`,
  `get_chapter`, `create_entity`, `create_relation`, `rag_search`, + ветка `unknown tool`
  → Err «unknown tool».
- `logic/entities.rs` → побочно (`save_entity_inner` для сидинга) — 57.70 % line

Не покрыта 1‑я функция prompt.rs (5/6) — вероятно редкая ветка `get_ai_profile_context`/fallback.

---

### 10. `embeddings_integration.rs` — 2 теста → векторные embeddings
- `logic/entities.rs` → save_entity_inner с `embeddings.openai` (1536 dim) → **57.70 % line**
- `surreal_schema.surql` → HNSW‑индекс `idx_entity_emb_openai`, cosine similarity

Сценарии: сохранение 1536‑мерного unit‑вектора, чтение обратно
(`SELECT embeddings FROM type::record($id)`), KNN cosine
(`ORDER BY sim DESC LIMIT 1`, `vector::similarity::cosine`) — ближайший сосед
определяется корректно (>0.95).

---

### 11. `stress_integration.rs` — 5 тестов → bulk + concurrency + cascade delete
- `logic/batch.rs` → 55.26 % func (21/38) · **81.11 % line (262/323)** · 82.72 % region (584/706)
- `logic/entities.rs` → побочно (bulk insert) — 57.70 % line
- `logic/volumes.rs` + `logic/chapters.rs` → 1100‑узловое дерево (10 томов × 5 арок × 20 глав)
- DDL‑триггер `delete_project_data` → cascade delete 1500+ записей

Сценарии: 10 000 entities транзакциями ×500, 3000 text_blocks в одном HTML,
50 tokio‑workerов одновременно читают/пишут граф, глубокое дерево иерархии,
удаление проекта с 1500+ записями (entities+chapters).

---

### 12. `negative_integration.rs` — 10 тестов → error path cross‑module
Покрывает error‑ветки нескольких модулей (все цифры — совокупные):
- `entities.rs`: `get_entities_inner` ghost‑type → пусто; `get_entity_inner` malformed id
  (`'; DROP TABLE projects; --`) → не паникует, `None`.
- `projects.rs`: `create_project_inner` без `name` → Err «No name»; удаление nonexistent → idempotent.
- `volumes.rs`: `reorder_node_inner` nonexistent → OK.
- `chapters.rs`: `save_text_blocks_inner` битый HTML без тегов → 1 блок default `description`.
- `connections.rs`/`relations.rs`: phantom endpoints.
- **транзакции:** `save_entity_with_relations` в `BEGIN/COMMIT` с нарушением схемы →
  `ROLLBACK` (запись «Предмет Транзакции» не попадает в БД).

---

### 13. `batch_and_connections_integration.rs` — 6 тестов → batch + edges
- `logic/batch.rs` → 55.26 % func (21/38) · **81.11 % line (262/323)** · 82.72 % region (584/706)
- `logic/connections.rs` → 31.82 % func (7/22) · **72.86 % line (102/140)** · 80.35 % region (229/285)
- `logic/entities.rs` → побочно (save_entity_inner) — 57.70 % line

Сценарии: `get_entities_batch_inner` (3 типа за 1 запрос, пустой тип → `[]`,
empty types → ранний `Ok({})`), `save_entity_with_relations_inner` (транзакция,
`foreach` foreign_updates), `upsert_connections_batch_inner`, `save_connections_inner`
(replace/empty‑array clears edges), `get_connections_inner`,
`remove_connections_by_source_inner`.

---

### 14. `chat_integration.rs` — 3 теста → `ai/chat/{tree,operations}.rs`
- `logic/ai/chat/tree.rs` → 30.00 % func (6/20) · **62.39 % line (68/109)** · 64.42 % region (105/163)
- `logic/ai/chat/operations.rs` → 4.92 % func (3/61) · **16.60 % line (84/506)** · 21.05 % region (189/898)
- `logic/ai/chat/mod.rs` → 41.67 % func (5/12) · 48.89 % line (22/45)

Сценарии: `CREATE chats` + `chat_messages` (user/assistant + `parent_id`),
`get_chat_messages_impl` (roundtrip 2 сообщения), `fork_chat_impl` (копия истории
до target‑message; msg_3 не попадает в форк), `get_chat_tree_impl` (ребро `contains`
чат↔чат, `parent_chat_id`, `sort_order`).

> `operations.rs` 16.60 %: реализованы лишь `get_chat_messages_impl`,
> `fork_chat_impl`, `get_chat_tree_impl`. Остальные 58 функций
> (`send_chat_message_impl`, `cancel_generation`, `regenerate`, `edit`, `delete`, …)
> на 0 % — их покрытие требует LLM‑стек/mock‑провайдеров, чего эти тесты не делают.

---

### 15. `export_integration.rs` — 7 тестов → `export.rs`
- `logic/export.rs` → 11.11 % func (8/72) · **34.26 % line (136/397)** · 37.52 % region (227/605)
- `logic/calendar_math.rs` → побочно (конвертация дат) — 93.43 % line

Сценарии: `export_chapters_inner` (md/txt, fallback title/content),
`create_cloud_backup_inner` (.wwiki zip → `database.surql`), `restore_from_backup_inner`
roundtrip, негатив: missing file → «does not exist», zip без `database.surql` → Err,
`get_launch_args()` без `*.wwiki` → None.

---

## Сводка покрытий (Report 2 — `2026-08-19 00:37`, `src-tauri`, весь прогон)

| Метрика | Значение |
|---|---|
| Function Coverage | **28.98 %** (224 / 773) |
| Line Coverage | **43.01 %** (2317 / 5387) |
| Region Coverage | **45.12 %** (4125 / 9143) |

| production-файл | Line | Region | покрывают |
|---|---:|---:|---|
| `logic/ai/agent/prompt.rs` | 87.85 % | 90.08 % | ai_integration |
| `logic/batch.rs` | 81.11 % | 82.72 % | batch_and_connections, stress |
| `logic/connections.rs` | 72.86 % | 80.35 % | batch_and_connections |
| `logic/calendar_math.rs` | 93.43 % | 92.96 % | entity(inline), export, stress |
| `logic/chapters.rs` | 67.12 % | 73.86 % | timeline, hierarchy, text_blocks, negative |
| `logic/volumes.rs` | 70.62 % | 77.00 % | hierarchy, negative |
| `logic/models.rs` | 72.87 % | 77.01 % | entity, project, batch, stress |
| `logic/ai/chat/tree.rs` | 62.39 % | 64.42 % | chat |
| `logic/entities.rs` | 57.70 % | 60.04 % | entity, ai, embeddings, batch, stress, negative |
| `logic/projects.rs` | 59.40 % | 62.87 % | project, negative |
| `logic/ai/tools/mod.rs` | 36.38 % | 41.05 % | ai |
| `logic/export.rs` | 34.26 % | 37.52 % | export |
| `logic/ai/chat/operations.rs` | 16.60 % | 21.05 % | chat |
| `logic/ai/chat/mod.rs` | 48.89 % | 43.43 % | chat |
| `logic/schema.rs` | 0.00 % | 0.00 % | (пропущен — DDL raw) |
| `logic/ai/agent/runner.rs` | 0.00 % | 0.00 % | (LLM не мокается) |
| `logic/ai/providers/fetch.rs` | 0.00 % | 0.00 % | (не вызывается) |
| `lib.rs` | 0.00 % | 0.00 % | (run() не вызывается) |
| `main.rs` | 0.00 % | 0.00 % | (main не тестируется) |

---

## Анализ пробелов (0 % и слабое покрытие)

| Файл | Line | Почему 0 % / слабо | Как покрыть |
|---|---|---|---|
| `lib.rs` | 0.00 % | тесты вызывают `_inner` напрямую, минуя `run()`/`invoke_handler` | e2e‑тест через `#[tauri::test]` либо unit‑тест `run()` с mock‑runtime |
| `main.rs` | 0.00 % | `main()` стартует Tauri‑приложение; в `cfg(test)` нет unit‑тестов | покрывается E2E/сценариями запуска |
| `logic/schema.rs` | 0.00 % | DDL применяется raw‑SQL из `common.rs`, а не через runtime‑миграции | добавить тест, который вызывает `apply_schema`/мigrator из `schema.rs` (если он существует) |
| `logic/ai/agent/runner.rs` | 0.00 % | стрим + tool‑use цикл требует LLM‑ответов; пока нет mock‑провайдера в тестовом пути | `mock-anthropic-service` (уже в dev‑deps) → `build_provider_client`‑тест с `mockito`‑подобным stub; покрыть `run_agent_loop` до 8 итераций + `cancel_generation` |
| `logic/ai/providers/fetch.rs` | 0.00 % | `fetch_ai_models` не вызывается | тест с stub‑HTTP (mockito/wiremock) для `idx_entity_emb_*`‑provider‑catalog |
| `logic/export.rs` | 34.26 % | покрыты 8 из 72 fn | дописать Yandex‑disk flow (oauth token exchange) + `convert_absolute_to_local` |
| `logic/entities.rs` | 57.70 % | большой файл (915 line); слабы редкие ветки `get_entity_relations`‑scopes | дополнить `negative`/`entity` кейсами на edge‑relations |
| `logic/ai/chat/operations.rs` | 16.60 % | покрыты 3 из 61 fn | добавить тесты на `send_chat_message_impl` с mock‑LLM + `cancel_generation`/`regenerate`/`edit`/`delete` |
| `logic/ai/tools/mod.rs` | 36.38 % | покрыто 7 из 19 инструментов | добавить тесты для `update_chapter`, `delete_entity`, `list_entities`, `update_entity`, `get_entity_schemas`, `save_relation_schema`, `get_ai_profile`/settings |

---

## Рекомендации по росту покрытий (для ТЗ / roadmap)

1. **AI‑pipeline (самый большой просвет):** подключить `mock-anthropic-service`
   (уже в `dev-dependencies`) в `ai_integration.rs`/`chat_integration.rs`, чтобы покрыть
   `run_agent_loop`, `send_chat_message_impl`, `cancel_generation` и `fetch_ai_models`.
   Целевой порог: `runner.rs` ≥ 70 %, `operations.rs` ≥ 50 %, `fetch.rs` ≥ 60 %.
2. **export.rs:** изолировать Yandex‑HTTP через stub‑client, добавить 3‑4 теста → цель 60 %.
3. **schema.rs:** покрыть runtime‑миграцию отдельной test‑фичей, чтобы вывести из 0 %.
4. **lib.rs / main.rs:** один `#[tauri::test]` на `setup`+`state` (`AppState.db`) даст
   покрытие инициализации DB + `init_database()`.
5. **Stress → в CI:** `stress_integration.rs` долгий — вынести в `#[ignore]` + nightly,
   чтобы default `cargo test` был < 1 мин, а `cargo llvm-cov --include-ignored` — полный.




