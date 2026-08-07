# План 6: Архитектура Бэкенда (Rust + Tauri + SurrealDB)

## Цели и Задачи
- Спроектировать структуру файлов в `src-tauri` для нового функционала ИИ.
- Интегрировать таблицы ИИ из `surreal_schema.surql` с системой макросов `tauri-surreal-kit`.
- Определить, где будет жить Agent Loop (clawrust) и Local LLM (llama-turboquant-cpp).

## 1. Модели данных и Макросы (Файл `logic/models.rs`)
В `surreal_schema.surql` уже заложены таблицы для ИИ (`auto_approval_settings`, `chats`, `chat_messages`, `agent_memory`, `ai_profiles`, `artifacts`). 

Нам **не нужно** писать новые макросы. Мы будем использовать мощь уже существующего `surreal_entity!`, который сам сгенерирует CRUD и Tauri-команды.

В файл `src-tauri/src/logic/models.rs` мы добавим:
```rust
surreal_entity! {
    #[table="chats"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Chat {
        pub title: String,
        pub tag: Option<String>,
        pub parent_chat_id: Option<String>,
        pub session_context: Vec<Value>, // закрепленные тома/арки
    }
}

surreal_entity! {
    #[table="chat_messages"]
    #[project_scoped]
    #[tauri_commands]
    pub struct ChatMessage {
        pub chat_id: String,
        pub parent_msg_id: Option<String>,
        pub role: String,
        pub content: String,
        pub edited_content: Option<String>,
        #[flexible]
        pub quoted_context: Option<Value>,
    }
}

surreal_entity! {
    #[table="auto_approval_settings"]
    #[project_scoped]
    #[tauri_commands]
    pub struct AutoApprovalSettings {
        pub enabled: bool,
        #[flexible]
        pub categories: Value,
        #[flexible]
        pub allowlist: Value,
        #[flexible]
        pub denylist: Value,
    }
}
```
*Также добавим эти структуры в `surreal_schema!` и `@entities: [Chat, ChatMessage, AutoApprovalSettings]` в `main.rs`, чтобы мгновенно получить готовые `get_chats`, `save_chat` для фронтенда.*

## 2. Структура новых файлов в `src-tauri/src/logic/`
Мы добавим новые модули:

### `logic/ai_chat.rs`
**Назначение**: Кастомные запросы для чатов, которые сложнее обычного CRUD.
**Команды**:
- `get_chat_tree(project_id)`: Возвращает дерево чатов для левой панели.
- `get_message_branch(leaf_msg_id)`: Рекурсивно поднимается вверх по `parent_msg_id` через SurrealQL, собирая линейную историю сообщений для ветки.
- `fork_chat(message_id)`: Создаёт новый `Chat`, копируя состояние ветки.

### `logic/agent_runtime.rs` (Интеграция Clawrust)
**Назначение**: Инкапсуляция цикла агента (Agent Loop). Перенос логики из `claw-code`.
**Флоу работы**:
1. Функция спавнит `tokio::task` (чтобы не блокировать UI Tauri).
2. Читает `AiProfile` (какой провайдер) и `AutoApprovalSettings`.
3. Дёргает LLM. Когда получает стрим ответа, использует `app_handle.emit_all("ai_stream_chunk", chunk)`.
4. Если LLM выдаёт `<tool_call>`, агент парсит его и проверяет через политику Auto-Approval:
   - Если автоодобрено: сам вызывает Rust-функцию.
   - Если нет: кидает эвент `ai_tool_approval_required` и ждёт `oneshot`-сигнала от Vue (`approve_tool_call`).

### `logic/local_llm.rs` (Интеграция llama-turboquant-cpp)
**Назначение**: Связующее звено (Bridge) между Rust и C++ движком Llama. Управляет жизненным циклом локальной модели.
**Ключевые функции**:
- `load_model(model_path)`: Вызывает C++ API для загрузки модели в RAM/VRAM. Настраивает TurboQuant квантование и TriAttention (KV Cache pruning) из документации `llama-turboquant-cpp`.
- `generate_stream(prompt)`: Передаёт токены в C++ инференс и стримит результат обратно в Rust (а затем во Vue).
- `save_kv_cache_to_disk()`: Фича KV-swap. Выгружает контекст графовой базы (сохранённый KV-кэш) на диск при закрытии приложения, чтобы не пересчитывать токены заново и экономить SSD. Возвращает кэш в RAM при запуске.

### `logic/model_hub.rs`
**Назначение**: Встроенный магазин моделей.
**Команды**:
- `fetch_hf_models()`: Делает GET-запрос к API Hugging Face.
- `download_model(repo, filename)`: Запускает асинхронное скачивание `.gguf` файла в папку `AppData/Local/WorldWiki/models` с прогресс-баром (Tauri events).

## 3. Набор Инструментов (MCP Tools)
Мы не будем тащить весь CLI-хлам из `clawrust`. Вместо этого мы реализуем трейт `McpTool` для наших уже существующих Rust-модулей!
Например, инструмент `search_entities` просто вызывает внутреннюю функцию из `logic::entities::search_entities_internal(db, query)`. Инструмент `create_volume` вызывает логику из `logic::volumes::create_volume`.

Таким образом, ИИ работает ровно с теми же бизнес-функциями, что и сам UI WorldWiki. Это гарантирует 100% совместимость данных и отработку всех графовых эвентов (`ON TABLE ... WHEN "DELETE"`).

## 4. Сборка и Линковка (Tauri Build)
Файл `src-tauri/build.rs` будет модифицирован.
Если включена фича `ai-local`, `build.rs` запустит CMake-скрипт, который:
1. Скомпилирует `llama-turboquant-cpp` с флагами `GGML_CUDA=ON` и архитектурами `75;80;86;89;120;121`.
2. Положит `llama.lib` и `ggml.lib` (или `.a` на Linux) в папку `target/release/build/`.
3. Сгенерирует FFI-биндинги (через `bindgen` к `llama.h`).
4. Cargo статически прилинкует C++ код к `.exe` файлу WorldWiki, обеспечивая единый бинарник для пользователей.
