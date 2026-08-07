# План 1: Архитектура и Конфигурация Сборки

## Цели и Задачи
- Организовать единый монолитный бинарник для Tauri-бэкенда.
- Настроить 3 варианта сборки (без ИИ, с облачным ИИ, с локальным LLM) через систему `features` в Rust (`Cargo.toml`).
- Встроить (статически слинковать) `llama-turboquant-cpp` прямо внутрь приложения WorldWiki, чтобы пользователю не приходилось скачивать отдельные `.exe` файлы.

## 1. Релизы через Cargo Features
В файле `src-tauri/Cargo.toml` мы добавим фичи, которые позволят компилировать 3 разные версии приложения:

```toml
[features]
default = []
# Версия 2: Интеграция с claw-code (только внешние API - OpenAI, Anthropic и т.д.)
ai-cloud = ["dep:claw-runtime", "dep:claw-api"]
# Версия 3: Всё из Версии 2 + локальная LLM llama-turboquant-cpp
ai-local = ["ai-cloud", "dep:llama-sys"]
```
- **Версия 1 (Без ИИ)**: Компилируется без фич `ai-cloud` и `ai-local`. Код, связанный с ИИ, закрывается макросами `#[cfg(feature = "ai-cloud")]`. Приложение весит мало, UI чата просто не регистрируется или отображает заглушку.
- **Версия 2 (С облачным ИИ)**: Подтягивает крейты из `claw-code` (Runtime, API, Tools). Добавляет в бинарник логику работы агентов, MCP и запросы по сети.
- **Версия 3 (С локальным ИИ)**: Подтягивает крейт, отвечающий за сборку `llama-turboquant-cpp` и запуск инференса прямо внутри приложения. 

## 2. Интеграция `llama-turboquant-cpp` в бинарник
Чтобы `llama-cpp` стала частью `.exe`, нам необходимо:
1. Создать промежуточный Rust-крейт `llama-sys` (например, в `src-tauri/llama-sys`).
2. Написать для него `build.rs`, который будет использовать крейт `cmake` для автоматической компиляции исходников из `vendor/llama-turboquant-cpp` при сборке проекта.
   ```rust
   // Пример build.rs
   let dst = cmake::Config::new("../../vendor/llama-turboquant-cpp")
       .define("GGML_CUDA", "ON")
       .define("CMAKE_CUDA_ARCHITECTURES", "75;80;86;89;120;121") // Архитектуры RTX
       .build();
   println!("cargo:rustc-link-search=native={}/lib", dst.display());
   println!("cargo:rustc-link-lib=static=llama");
   println!("cargo:rustc-link-lib=static=ggml");
   ```
3. Сгенерировать FFI-биндинги к `llama.h` через `bindgen`, чтобы Rust мог вызывать функции инференса (загрузить модель, передать токены, получить стрим) напрямую.
4. **Резервный вариант:** Если FFI окажется слишком нестабильным из-за специфики TurboQuant, C++ код можно собрать в статический бинарник сервера, который запускается Tauri в отдельном скрытом процессе (Sidecar), а Rust общается с ним по REST API. Это всё ещё будет 1 скачиваемый установщик.

## 3. Интеграция `claw-code`
- Берём `crates/runtime`, `crates/api`, `crates/tools` из `vendor/claw-code/rust/`.
- Подключаем их как локальные зависимости в Tauri (`path = "../vendor/claw-code/rust/crates/runtime"`).
- Отключаем `rusty-claude-cli` (CLI обёртку). Вся инициализация сессии (Agent Loop) будет вызываться из команд Tauri (Rust-методы, которые дёргает Vue).
