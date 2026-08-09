# Задачи по внедрению ИИ (Фаза 1 и 2)

- `[x]` Шаг 1: Конфигурация Сборки (Cargo Features)
  - `[x]` Добавить фичи `ai-cloud` и `ai-local` в `src-tauri/Cargo.toml`
  - `[x]` Добавить опциональные зависимости `claw-code` (runtime, api)
- `[x]` Шаг 2: Создание крейта `llama-sys`
  - `[x]` Создать `src-tauri/llama-sys/Cargo.toml`
  - `[x]` Написать `src-tauri/llama-sys/build.rs` с использованием `-DCMAKE_CUDA_ARCHITECTURES="all"` (или `75-virtual`)
  - `[x]` Создать `src-tauri/llama-sys/src/lib.rs`
- `[x]` Шаг 3: Схема Данных и Макросы
  - `[x]` Создать `src-tauri/src/logic/ai_chat.rs` с логикой ветвления чатов
  - `[x]` Обновить `src-tauri/src/logic/mod.rs`
  - `[x]` Зарегистрировать команды в `src-tauri/src/main.rs` под `cfg(feature = "ai-cloud")`
