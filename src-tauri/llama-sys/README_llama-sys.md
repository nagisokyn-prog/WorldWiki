# 🏎️ llama-sys — Низкоуровневый C FFI-крейт к llama-turboquant-cpp (CUDA)

> **Слой Cerberus**: `infrastructure`.  
> **Назначение**: Сборка и статическая линковка C++ движка `vendor/llama-turboquant-cpp` (`llama.cpp` + `ggml`) с поддержкой CUDA и генерация Rust FFI-биндингов через `bindgen`.

---

## 📦 Зависимости (`Cargo.toml`)

- **Build-dependencies**: `bindgen`, `cc`.
- **Dependencies**: `libc`.

---

## 🏛️ Структура файлов

| Файл | Назначение |
|---|---|
| [`src/lib.rs`](./src/lib.rs) | Подключает сгенерированные биндинги `include!(concat!(env!("OUT_DIR"), "/bindings.rs"))` с подавлением C-стилевых предупреждений именования. |
| [`build.rs`](./build.rs) | Точка входа build-скрипта: вызывает `build_cmake::build_and_link` и `build_bindings::generate` для `../../vendor/llama-turboquant-cpp` и кэша `prebuilt-libs/`. |
| [`build_cmake.rs`](./build_cmake.rs) | CMake-сборка, кэширование в `prebuilt-libs/build` (маркер `.build-ok`), директивы статической линковки. |
| [`build_bindings.rs`](./build_bindings.rs) | Генерация Rust FFI через `bindgen` по `include/llama.h` с фолбэком на кэш `prebuilt-libs/bindings.rs`. |

---

## ⚙️ Особенности сборки и кэширования

- **CMake-флаги (`build_cmake.rs`)**:
  - `CMAKE_BUILD_TYPE=Release`, `BUILD_SHARED_LIBS=OFF`.
  - `GGML_CUDA=ON`, `CMAKE_CUDA_ARCHITECTURES=75` (архитектура Turing и выше через PTX JIT).
  - `GGML_TCQ=ON` (TurboQuant), `LLAMA_SWA=ON` (Sliding Window Attention), `LLAMA_HYBRID_RECURRENT=ON`.
  - Отключены тесты, примеры, сервер и утилиты (`LLAMA_BUILD_*=OFF`, `LLAMA_CURL=OFF`, `LLAMA_LLAMAFILE=OFF`).
- **Принудительная пересборка**: задайте переменную окружения `LLAMA_SYS_FORCE_REBUILD=1` (или `true`).
- **Статическая линковка**: `llama`, `ggml`, `ggml-base`, `ggml-cpu`, `ggml-cuda`, а на Windows дополнительно `cudart_static`, `cublas`, `cublasLt`, `cuda`, `msvcprt` (поиск по `CUDA_PATH` / `CUDA_TOOLKIT_ROOT_DIR`).
- **Windows Clang/MSVC (`build_bindings.rs`)**: автоматический поиск `libclang.dll` (если не задан `LIBCLANG_PATH`) и системных заголовков `INCLUDE` через `cc::Build`.
