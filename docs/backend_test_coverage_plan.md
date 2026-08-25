# 📋 План повышения покрытия бэкенда (`src-tauri`)

> Текущее покрытие: **~35% строк**. Цель: покрыть все функции бэкенда.
> Исключения: `tauri-surreal-kit/*`, `main.rs`, `logic/schema.rs`.
>
> Легенда типов тестов:
> - **Unit** — чистая функция без БД/сети, изолированная проверка логики;
> - **Integration** — интеграционный тест с реальной SurrealDB (`create_test_db()`);
> - **Mock** — проверка с замоканным внешним сервисом (HTTP-провайдер, embedder-сервер);
> - **Negative** — негативный сценарий (ошибки, мусорные входные данные);
> - **Smoke** — поверхностная проверка «не падает и возвращает разумное».

---

## `lib.rs`

| Функция | Тесты |
|---|---|
| `surreal_db` | Integration: создаёт SurrealKv по пути, use_ns/use_db проходит. |
| `init_database` | Integration: применяет схему на чистую БД → smoke-таблицы существуют; повторный вызов идемпотентен (OVERWRITE). |

## `logic/batch.rs`

| Функция | Тесты |
|---|---|
| `safe_pid`, `safe_id`, `flatten_thing` | ✅ Уже покрыты unit-тестами в модуле. |
| `get_entities_batch_inner` | Integration: несколько типов → карта type→rows; пустой список типов → пустая карта; несуществующий проект → пустые списки без ошибки. |
| `upsert_connections_batch_inner` | Integration: пакетная вставка связей; повторный upsert не дублирует; Negative: связь с несуществующими endpoint'ами. |
| `save_entity_with_relations_inner` | Integration: сущность + связи атомарно; Negative: невалидная связь откатывает всё (транзакционность). |

## `logic/calendar_math.rs`

| Функция | Тесты |
|---|---|
| Основные функции | ✅ Уже покрыты (~93% строк). Дополнить: |
| `convert_absolute_to_local` | Unit: граничные значения (минута 0, последняя минута года), кастомные настройки времени. |
| `get_date_from_absolute` | Unit: roundtrip для 10k случайных минут (property-тест). |

## `logic/chapters.rs`

| Функция | Тесты |
|---|---|
| `save_global_timeline_inner` | ✅ Частично (`timeline_integration`). Negative: timeline с дублирующимися chapter_id. |
| `save_text_blocks_inner` | ✅ Частично. Вложенные теги; порядок блоков сохраняется; Negative: HTML без тегов. |
| `get_chapter_revisions_inner` | Integration: N обновлений → N ревизий по убыванию времени; ревизия содержит старый контент ($before). |
| `toggle_chapter_history_pin_inner` | Integration: pin/unpin roundtrip; пин не задевает чужие ревизии. |

## `logic/connections.rs`

| Функция | Тесты |
|---|---|
| `get_connections_inner` | Integration: фильтр по project_id; пустой проект → []. |
| `remove_connections_by_source_inner` | Integration: удаляются только связи указанного source; idempotent при отсутствии. |
| `save_connections_inner` | Integration: save→get roundtrip; перезапись существующих; Negative: malformed payload. |

## `logic/entities.rs`

| Функция | Тесты |
|---|---|
| Хелперы (`flatten_thing`, `safe_pid`, `safe_id`) | ✅ Покрыты. |
| `get_entity_inner` | Integration: получение по id; несуществующий id → None/Err. |
| `save_entity_inner` | ✅ Частично. Сохранение с embeddings; update обновляет updated_at. |
| `delete_entity_inner` | ✅ Частично (cascade). Повторное удаление; удаление последней сущности типа. |
| `search_entities_inner` | Integration: подстрока имени; регистронезависимость; поиск по tags; пустой запрос → []. |
| `get/save_entity_schema_inner` | ✅ Частично. Схема с кастомными полями разных типов; перезапись обновляет историю. |
| `delete_entity_schema_inner` | Integration: удаление схемы; поведение со связанными сущностями задокументировано. |
| `get_schema_history_inner` / `toggle_schema_history_pin_inner` | Integration: история пишется при каждом изменении; pin/unpin roundtrip. |
| `get/create/delete_entity_relation_inner` | ✅ Частично. Связь с атрибутами; Negative: self-relation, связь между проектами. |
| `make_record` | Unit: string → RecordId, RecordId → без изменений, мусор → None. |
| `get_relation_schemas_inner` / `save_relation_schema` / `delete_relation_schema` | Integration: CRUD roundtrip схем связей. |
| `get_entity_revisions` / `toggle_entity_history_pin_inner` | ✅ Частично. Лимит количества ревизий. |

## `logic/export.rs`

| Функция | Тесты |
|---|---|
| `export_chapters_inner` | ✅ Покрыт. |
| `create_cloud_backup_inner` | ✅ Частично. Backup c картинками и settings/*.json — всё в zip. |
| `restore_from_backup_inner` | ✅ Roundtrip покрыт. Restore поверх непустой БД; zip с битым surql → Err; регрессионный тест санитизации `.*`-полей (баг tool_logs). |
| `exchange_yandex_token` | Mock: невалидный code → Err; сеть недоступна → Err. |
| `upload_to_yandex_disk` | Mock: файла нет → Err (✅ есть); API-ошибка → Err; 200 → Ok. |
| `list_yandex_disk_backups` | Mock: пустой диск → []; парсинг списка .wwiki; ошибка API → Err. |
| `download_and_restore_yandex` | Mock: скачивание + restore сквозняком на локальном zip. |

## `logic/projects.rs`

| Функция | Тесты |
|---|---|
| `get_projects_inner` | Integration: пустая БД → []; несколько проектов → все возвращаются. |
| `create_project_inner` | ✅ Частично. Имя со спецсимволами; Negative: дубликат имени. |
| `get/save_project_config_inner` | ✅ Частично. Config с произвольным JSON; save→get roundtrip. |
| `delete_project_inner` | ✅ Cascade покрыт. Удаление проекта с чатом и AI-профилями. |

## `logic/volumes.rs`

| Функция | Тесты |
|---|---|
| `get_chapter_hierarchy_inner` | ✅ Частично. Иерархия после удаления узла; Negative: циклическая ссылка. |
| `create/update_volume_inner` | ✅ Частично. Update несуществующего volume → Err. |
| `create/update_arc_inner` | Integration: arc привязан к правильному volume; update title roundtrip. |
| `assign_chapter_inner` | ✅ Частично. Перенос главы чистит старый contains-edge. |
| `reorder_node_inner` | ✅ Частично. Reorder сохраняет порядок остальных. |
| `make_record` | Unit: нормализация префиксов таблиц. |


---

# 🤖 Модуль AI (`logic/ai/`)

## `chunker.rs`

| Функция | Тесты |
|---|---|
| `split_text` | ✅ Частично. Текст ровно chunk_size; overlap не теряет текст на границе. | ✅ Дополнено (`chunker::tests`: exact size, hard split, unicode) |
| `split_recursive` / `split_by_chars` / `get_overlap_tail` | Unit: текст без разделителей → hard split; unicode (эмодзи/CJK) не рвётся посреди кодпоинта. | ✅ Готово |

## `hardware.rs`

| Функция | Тесты |
|---|---|
| `calculate_quantization_estimates` | Unit: RAM/VRAM → рекомендации квантования; граничные значения. | ✅ Готово (`hardware::tests`: монотонность, статусы, default ctx=8k) |
| `get_hardware_info` / `query_dxgi_gpu` / `detect_gpu_info` | Smoke: возвращает структуру без паники (значения зависят от стенда). | ✅ Готово (smoke в `hardware::tests`) |
| `get_recommended_local_models` | Unit: mock HardwareInfo → ожидаемый список моделей под VRAM. | ✅ Готово (каталог-инварианты; VRAM-подбор покрывается через estimates) |

## `local_llm.rs`

| Функция | Тесты |
|---|---|
| `resolve_model_path` | Unit: абсолютный путь → как есть; имя файла → models_dir; пустая строка → дефолт. | ✅ Готово (`local_llm::tests`) |
| `tokenize` | Unit (ai-local): пустая строка → []; кириллица токенизируется. |
| `trigger_cancel_local_gen` | Smoke: без загруженной модели не паникует. |
| `load_model` / `generate_stream` / `get_embeddings` | Integration (ignored, требует GGUF): стрим выдаёт токены; embedding нужной размерности. |
| `save/load_checkpoint` | Integration (ignored): roundtrip; load несуществующего → Err. |

## `manager.rs`

| Функция | Тесты |
|---|---|
| `format_friendly_model_name` | Unit: GGUF-имена → читаемые названия; уже красивое — без изменений. | ✅ Готово (`manager::tests`) |
| `set_model_lifecycle_state` | Unit: переходы состояний loading→loaded→unloading. | ✅ Готово |
| `list_installed_models` | Integration (fs): временная папка с фейковыми .gguf → список; пустая → []. |
| `load/unload/delete_local_model` | Integration (ignored): полный lifecycle с маленьким GGUF; delete удаляет файл. |

## `model_hub.rs`

| Функция | Тесты |
|---|---|
| `detect_quant_from_filename` | Unit: `Q4_K_M`, `IQ2_XS`; отсутствие кванта → default; case-insensitive. | ✅ Готово (`model_hub::tests`, вкл. TurboQuant-семейство) |
| `fetch_hf_models` | Mock: парсинг JSON HF API; ошибка сети → Err. |
| `download_hf_model` | Mock/ignored: прогресс-колбеки; обрыв соединения → Err, частичный файл удаляется. |

## `permissions.rs`

| Функция | Тесты |
|---|---|
| `get_tool_permissions_catalog` | Smoke: каталог не пуст; уникальные имена; уровни доступа валидны. |

## `agent/prompt.rs`

| Функция | Тесты |
|---|---|
| `build_system_prompt` / `_direct` / `_with_context` | Unit: базовые инструкции присутствуют; RAG-контекст вставляется; пустой контекст → блок опущен. |
| `history_to_input_messages` | Unit: маппинг ролей; reasoning не попадает в промпт. |

## `agent/runner.rs`

| Функция | Тесты |
|---|---|
| `build_provider_client` | Unit: openai/gemini/openrouter/local → корректный конфиг; unknown → Err. |
| `run_agent_loop` | Mock: текстовый ответ → 1 итерация; tool call → инструмент исполнен, результат возвращён LLM; MAX_ITERATIONS → graceful stop. |
| `get_ai_completion` | Mock: streaming events эмитятся; отмена mid-stream. |
| `generate_chat_title` | Mock: титул обрезается до лимита; fallback при ошибке LLM. |

## `agent_runtime.rs`

| Функция | Тесты |
|---|---|
| `run_local_agent_loop` | Integration (ignored, ai-local): Auto-RAG подтягивает контекст; бюджетирование токенов обрезает историю. |

## `chat/mod.rs`, `chat/tree.rs`

| Функция | Тесты |
|---|---|
| `parse_record_id` / `clean_surreal_id` | Unit: `chats:abc`, backticks, object-Thing, мусор → None. | ✅ Готово (`chat/mod.rs::tests`) |
| `sanitize_message_ids` | Unit: рекурсивно чистит id во всём дереве. | ✅ Готово (`tree.rs::tests`, object/String/Number/NONE/null) |
| `get_chat_tree_impl` | ✅ Частично. Глубокое дерево (5+ уровней); несколько корней. |
| `get_chat_messages_impl` | Integration: ветка в хронологическом порядке от leaf к root. |
| `get_message_branch` | Integration: branch содержит только ancestors+self. |

## `chat/operations.rs`

| Функция | Тесты |
|---|---|
| `fork_chat_impl` | ✅ Частично. Fork от корня копирует всю ветку; Negative: несуществующий message → Err. |
| `update_chat_parent` | Integration: переприкрепление меняет дерево; цикл parent→child → Err. |
| `send_chat_message` | Mock/Integration: запись с parent_id; генерация стартует (мок LLM); Negative: несуществующий чат. |
| `cancel_generation` | Smoke: cancel без активной генерации — no-op. |
| `delete/edit/regenerate/switch_message_variant` | Integration: edit создаёт variant, старая сохраняется; regenerate создаёт sibling; switch вне диапазона → clamp/Err; удаление узла с потомками документировано. |
| `delete_ai_chat` | Integration: cascade удаляет все сообщения. |

## `providers/fetch.rs`

| Функция | Тесты |
|---|---|
| `fetch_ai_models` | Mock: OpenAI/Gemini форматы → Vec моделей; ошибка API key → Err; таймаут. |

## `retrieval/embedder.rs`

| Функция | Тесты |
|---|---|
| `normalize_l2` | Unit: нулевой вектор без NaN; длина после нормы = 1. | ✅ Готово (`embedder::tests`, вкл. отрицательные компоненты и epsilon) |
| `embed_query/passage/text` | Mock: префиксы `search_query:` / `search_document:` (критично для nomic); сервер недоступен → Err. |

## `retrieval/indexer.rs`

| Функция | Тесты |
|---|---|
| `reindex_project_lore_inner` | ✅ Частично. Пустой проект → Ok(0); idempotent (старые чанки чистятся); entity_id/chapter_id проставлены верно. |

## `retrieval/query_analyzer.rs`

| Функция | Тесты |
|---|---|
| `parse_roman_numeral` | Unit: I..MMMCMXCIX; невалидные → None. | ✅ Готово (`query_analyzer::tests`) |
| `parse_russian_ordinal` | Unit: «первый», «третья» → число; обычное слово → None. | ✅ Готово |
| `analyze_user_query` | Unit: извлечение intent («глава N»); вопрос без intent → default. | ✅ Готово (roman/ordinal/arabic до и после ключевого слова, chitchat, semantic_query) |

## `retrieval/router.rs`

| Функция | Тесты |
|---|---|
| `should_skip_retrieval` | Unit: приветствие → skip; вопрос про лор → not skip. | ✅ Готово (`router::tests`) |
| `RetrievalRouter::retrieve` | Integration/Mock: гибрид BM25+vector merge; пустой индекс → []; top-k respected. |

## `tools/mod.rs`

| Функция | Тесты |
|---|---|
| `tool_definitions` | Unit: у всех есть name/description/schema; нет дублей. |
| Читающие инструменты (`rag_search`, `search_entities`, `get_entity`, `get_relations`, `get_chapter(s)`, `get_timeline`, `get_calendar`) | Integration: happy path на seed-данных; Negative: несуществующий id → человекочитаемая ошибка. |
| Пишущие инструменты (`create/update_entity`, `create_relation`, `update_chapter`, `add_timeline_event`) | Integration: сквозной сценарий «агент пополняет лор». |
| Исторические (`get_entity_evolution`, `get_relation_history`) | Integration: после N revisions история видна. |
| `validate_world_consistency` | Integration: консистентный мир → ok; висячая связь → репорт. |
| `search_chat_history` | Integration: поиск по прошлым сообщениям. |
| `spawn_subagent` | Mock: sub-agent получает task и возвращает результат. |

---

## Порядок работ (рекомендация)

1. **Быстрые победы**: unit-тесты чистых функций — `query_analyzer`, `chunker`, `detect_quant_from_filename`, `format_friendly_model_name`, парсеры `chat/mod`, `normalize_l2`. Дёшево и закрывает десятки функций. — ✅ **Выполнено (волна 1)**: +~60 юнит-тестов в 11 файлах (`query_analyzer`, `router`, `embedder`, `model_hub`, `manager`, `local_llm`, `hardware`, `chunker`, `calendar_math`, `chat/mod.rs`, `chat/tree.rs`). Запуск: `cargo test -p world-wiki --lib`.
2. **Integration-волна**: `entities.rs`, `volumes.rs`, `connections.rs`, `chapters.rs` (ревизии/пины) — инфраструктура `create_test_db()` готова. — ✅ **Выполнено (волна 2)**: +~25 интеграционных тестов (`permissions.rs` каталог inline; `entity_integration`: поиск @@ / тип-фильтр / скоп проекта / связи с атрибутами / self-rel задокументирована / idempotent delete / relation_schemas roundtrip / каскад delete_entity_schema / частичный UPDATE; `project_integration`: пустая БД / спецсимволы / дубликаты upsert / merge конфига; `hierarchy_integration`: no-op update / reorder соседей / открепление на корень / арка без тома; `timeline_integration`: дубликаты chapter_id + N ревизий по убыванию; новый `retrieval_integration.rs`: reindex пустой проект → Ok(0), чанки с chapter_id, идемпотентность).
3. **AI-инструменты** (`tools/mod.rs`) — integration поверх seed-хелперов + мок LLM. — ✅ **Написано (волна 3)**: +17 тестов в новом `tests/tools_integration.rs` — диспетчер `run()` (unknown tool → Err), все читающие тулы (search_entities с тип-фильтром, get_entity null-кейс, get_relations, get_chapter компиляция блоков + SYSTEM-заглушка пустой главы, оглавление, rag_search с clamp top_k=8 и обходом глав, timeline/calendar, entity_schema), сквозной сценарий «агент пополняет лор» (create_entity → create_relation → update_entity с проверкой в БД), update_chapter/add_timeline_event (+ негатив без chapter_id), мок-тулы, search_chat_history, project_record.
4. **Mock-волна**: `runner.rs`, `operations.rs`, `fetch.rs`, `model_hub` — нужен общий mock LLM-сервер/fixtures. — 🔶 **Частично выполнено (волны 4а/4б)**:
   - **4а** — `operations.rs` отрефакторен: извлечены тестируемые ядра `update_chat_parent_impl`, `delete_chat_message_impl`, `switch_message_variant_impl`, `delete_ai_chat_impl` (+ уже был `fork_chat_impl`). Новый `tests/chat_operations_integration.rs`: +7 тестов (форк от корня с сохранением parent-связей между копиями, форк несуществующего → "Message not found", голый id без префикса, репарент/открепление/цикл-без-валидации задокументирован, idempotent delete, switch variant — один активный sibling, каскад delete chat: сообщения+рёбра+чат).
   - **4б** — DB-ядра send/edit/regenerate извлечены (`send_message_db_core`, `edit_message_db_core`, `regenerate_variant_db_core`) и покрыты (+6 тестов: автосоздание чата с заголовком, цепочка от последнего сообщения, деактивация старой версии при edit, деактивация вариантов при regenerate, негативы). Команды остались тонкими обёртками «ядро + spawn run_agent_loop».
   - **runner.rs** — inline-тесты `build_provider_client` (anthropic/openai-семейство/unsupported/base_url) + **интеграционный тест AI-пайплайна `tests/agent_pipeline.rs` — ✅ РАБОТАЕТ**: локальный raw-TCP mock OpenAI SSE-сервер + реальный `run_agent_loop` + реальная SurrealKv БД → проверка сохранения собранного из дельт ответа в assistant-сообщение. Запуск: `cargo test --test agent_pipeline --features agent-pipeline`. Уроки, найденные при отладке:
     * тестовый exe требует встроенного манифеста Common-Controls v6 (`tests.manifest`, линкуется через `cargo:rustc-link-arg-tests` в build.rs) — иначе comctl32 v5 без TaskDialogIndirect даёт краш загрузки 0xc0000139;
     * тест обязан использовать `#[tokio::test(flavor = "multi_thread")]` — на current_thread рантайме пайплайн зависает;
     * mock-сервер должен быть полностью асинхронным (tokio::net): блокирующий std::net::accept внутри tokio::spawn вешает shutdown рантайма навсегда;
     * у `ai_profiles` **base_url читается с верхнего уровня записи**, а не из settings (runner.rs).
   - Осталось: Yandex export через stub HTTP. **fetch.rs — ✅ выполнено**: `fetch_ai_models_inner` с `base_override` + 7 inline-тестов (мок-сервер на tokio::net для openrouter/openai/gemini/anthropic, short-circuit пустых ключей, unknown provider → [], local-скан GGUF через подмену APPDATA). Покрытие файла: 60% func / 85% line.

5. **Ignored-тесты**: `local_llm.rs`, `manager.rs` lifecycle — гоняются вручную с CUDA.

---

## 🪓 Архитектурная резня (отделение IPC от логики)

> Цель: каждый толстый файл (>400 строк) = папка, где `commands.rs` содержит только
> тонкие `#[tauri::command]`-обёртки, а логика (`*_inner` над `&Surreal<Db>` / чистые фн)
> живёт отдельно и полностью тестируема. Побочный эффект: непокрываемый без mock-runtime
> IPC-слой изолируется в один файл на модуль — честное исключение вместо размазни.

**Соглашение резни** (шаблон отработан на entities):
1. `файл.rs` → `файл/mod.rs` (move-only).
2. Все `#[tauri::command]` переезжают в `файл/commands.rs`; команды с инлайн-логикой
   сначала получают `_inner`-ядра в mod.rs.
3. `mod.rs`: `mod commands; pub use commands::*;` — внешние пути не меняются,
   lib.rs/codegen не трогаем.
4. В commands.rs — явные `use super::{...}` импорты ядер (glob не протаскивает приватные use).

| Файл | Строк | Статус |
|---|---|---|
| `logic/entities.rs` → `entities/{mod,commands}.rs` | 1065 | ✅ **Готово**: 18 команд изолированы (54 функции IPC в одном файле), 3 инлайн-логики извлечены в ядра (`save_relation_schema_inner`, `delete_relation_schema_inner`, `get_entity_revisions_inner`). Line-покрытие логики: 67% → **79.4%** |
| `ai/agent/runner.rs` (~840) | ~840 | 🔜 Следующий: `client.rs` (build_provider_client), `stream.rs` (два SSE-хендлера станут отдельно тестируемыми), `loop.rs` |
| `ai/tools/mod.rs` (602) | 602 | план: definitions/handlers/dispatch |
| `export.rs` (414) | 414 | план: wwiki/yandex/commands — перед мок-волной Yandex |
| `ai/chat/operations.rs`, `local_llm.rs` | 536/471 | хвосты после основных |

Текущее покрытие (после entities-резни): **func 43.6%, line 60.0%**.
Старт сессии: func 35.62%, line 44.49%.

