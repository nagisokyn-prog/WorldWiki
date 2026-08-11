# Интеграция clawrust (vendor/claw-code) — статус

## Что сделано (реальные изменения)

- `[x]` Включён крейт `claw_api` (`vendor/claw-code/rust/crates/api`) — транспорт/стриминг,
  `default = ["ai-cloud"]` в `src-tauri/Cargo.toml`, `tokio` дополнен фичами.
- `[x]` Новый модуль `src-tauri/src/logic/ai_agent.rs`:
  - провайдеры из профиля БД (`anthropic`, `openai`, `openrouter`, `gemini`, `local`, `ollama`, `deepseek`)
    через `ProviderClient` / `OpenAiCompatClient` / `AnthropicClient` с явными api_key + base_url;
  - read-only tool-слой (RAG) поверх SurrealDB: `rag_search`, `search_entities`, `get_entity`,
    `get_relations`, `get_chapter`, `get_timeline`, `get_calendar`;
  - `run_agent_loop`: живой SSE-стрим → `chat_stream_chunk`, сборка tool-use, исполнение тулов,
    сохранение ответа в `chat_messages`.
- `[x]` `agent_runtime.rs` и `ai_permissions.rs` удалены (заменены `ai_agent.rs`).
- `[x]` `ai_chat.rs`: импорт переведён на `ai_agent::run_agent_loop`, `approve_tool_call` удалён.
- `[x]` `main.rs`: убрана регистрация `approve_tool_call` и `ActiveSessionsState`.
- `[x]` `cargo check` и `cargo build` — зелёные.
- `[x]` Хардинг на сегодня:
  - `run_agent_loop` обёрнут в `tokio::time::timeout` (180 с): зависший провайдер не вешает UI,
    финальный чанк `is_done: true` уходит в любой ветке (включая таймаут).
  - `max_tokens` берётся из `AiProfileSettings` (fallback `DEFAULT_MAX_TOKENS`).
  - `project_id` извлекается устойчиво (строка или RecordId-объект) в `ai_chat.rs`;
    запрос профиля в `ai_agent.rs` при пустом `project_id` падает на глобальный профиль.
- `[x]` Привязка RAG-тулов к реальной схеме `surreal_schema.surql`:
  - project-scoped запросы на `RecordId::new("projects", ...)` (поля — record<projects>);
  - история чата: двойной бинд `chat_id` (строка + RecordId), заглушка исключается по RecordId;
  - `get_relations` → `entity_rel` (`in`/`out`), а не несуществующую `entity_relations`;
  - `get_timeline` → агрегирует `chapters.timeline_events` (таблицы `timeline` нет);
  - `search_entities` фильтрует по `entity_type`, а не `type_key`;
  - `rag_search` обходит `entities, chapters, text_blocks, volumes, arcs, user_dictionary`.

## Не взято из clawrust (намеренно)

- `rusty-claude-cli` / `commands` — обёртки CLI, не нужны.
- `tools` — файловые/bash-тулы (в режиме Редактор доступ к ФС запрещён).
- `ConversationRuntime` из `runtime` — синхронный стрим и файловая ориентация; сейчас тонкий цикл
  поверх `claw_api`. При переходе на write-режимы/авто-одобрение стоит принять `runtime`
  (permissions/MCP уже там).

## Следующие шаги (очередь)

- [ ] Режимы агента (Собеседник/Редактор/Аналитик) + write-тулы + система авто-одобрения
      (категории/allowlist/denylist из `чат_требования.txt`).
- [ ] `PermissionPrompter` → Vue (событие подтверждения → `approve`-команда).
- [ ] Ветвление: история строго по `parent_msg_id` (сейчас линейная по `created_at`).
- [ ] MCP-серверы из `runtime` (`mcp_server`, `mcp_tool_bridge`).
- [ ] Custom modes из `.wwmodels`.
