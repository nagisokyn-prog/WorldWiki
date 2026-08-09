# Задачи по внедрению ИИ (Фаза 3 - Agent Loop)

- `[x]` Шаг 1: Добавление зависимостей
  - `[x]` Добавить `dashmap` в `src-tauri/Cargo.toml`
- `[x]` Шаг 2: Реализация `agent_runtime.rs`
  - `[x]` Создать файл `src-tauri/src/logic/agent_runtime.rs`
  - `[x]` Реализовать структуру для хранения сессий
  - `[x]` Реализовать асинхронный цикл `run_agent_loop`
  - `[x]` Настроить Tauri события (`chat_stream_chunk`, `tool_call_requested`)
- `[x]` Шаг 3: Обновление Tauri-команд
  - `[x]` Написать реализацию `send_chat_message` в `ai_chat.rs`
  - `[x]` Написать реализацию `approve_tool_call` в `ai_chat.rs`
- `[x]` Шаг 4: Интеграция в `main.rs`
  - `[x]` Зарегистрировать `ActiveSessionsState` в `setup`
  - `[x]` Зарегистрировать новые команды
