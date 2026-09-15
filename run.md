# 🚀 WorldWiki — Справочник команд (Сборка, Проверка, Тесты, Запуск)

> Данная шпаргалка содержит все команды для фронтенда, бэкенда (Rust/Tauri/SurrealDB) и вендорных модулей проекта.

---

## 📑 Содержание
1. [Быстрый старт (Разработка)](#1-быстрый-старт-разработка)
2. [Сборка (Build)](#2-сборка-build)
3. [Проверка типов и Линтинг (Typecheck & Lint)](#3-проверка-типов-и-линтинг-typecheck--lint)
4. [Тестирование (Tests)](#4-тестирование-tests)
5. [Бэкенд и Rust (Cargo)](#5-бэкенд-и-rust-cargo)
6. [Кодогенерация и Скрипты](#6-кодогенерация-и-скрипты)

---

## 1. Быстрый старт (Разработка)

### Запуск всего Desktop-приложения (Tauri + Frontend + SurrealDB):
```powershell
pnpm tauri dev
# или через npm:
npm run tauri dev
```

### Запуск только Frontend Dev-сервера (в браузере):
```powershell
# Запуск dev-сервера SPA:
pnpm --filter @worldwiki/spa dev
# или из корня через Turbo:
pnpm dev
# или через npm:
npm run dev
```

---

## 2. Сборка (Build)

### 📦 Сборка готового Desktop-релиза (.exe):
Компилирует весь фронтенд, упаковывает ассеты и собирает финальный бинарник в `src-tauri/target/release/`:
```powershell
pnpm tauri build
# или через npm:
npm run tauri build
```

### 🌐 Сборка Frontend-пакетов (Turborepo):
```powershell
# Собрать все воркспейсы (spa, components, resources):
pnpm build
# или через npm:
npm run build

# Принудительная чистая пересборка без кеша Turbo:
npm run build -- --force
```

### 🎯 Сборка конкретного пакета:
```powershell
# Только SPA (apps/spa):
pnpm --filter @worldwiki/spa build

# Только UI-компоненты (packages/components):
pnpm --filter @worldwiki/components build

# Только ресурсы и стили (packages/resources):
pnpm --filter @worldwiki/resources build
```

---

## 3. Проверка типов и Линтинг (Typecheck & Lint)

### TypeScript (Проверка типов):
```powershell
# Проверка типов во всем проекте (Turborepo):
pnpm typecheck
# или через npm:
npm run typecheck

# Прямая проверка SPA через vue-tsc:
npx vue-tsc -p apps/spa/tsconfig.json --noEmit
```

### ESLint (Проверка и автоисправление JS/TS/Vue):
```powershell
# Проверка всех файлов:
npx eslint
# или:
pnpm lint
# или:
npm run lint

# Автоисправление ошибок:
pnpm lint:fix
# или:
npm run lint:fix
```

### Stylelint (Проверка CSS):
```powershell
pnpm lint:css
# или:
npm run lint:css
```

### Форматирование кода (oxfmt):
```powershell
pnpm format
# или:
npm run format
```

---

## 4. Тестирование (Tests)

### 🧪 Тесты фронтенда (Vitest):
```powershell
# Запуск всех тестов в монорепозитории:
pnpm test
# или:
npm test

# Запуск тестов SPA:
pnpm --filter @worldwiki/spa test

# Запуск тестов компонентов:
pnpm --filter @worldwiki/components test

# Запуск тестов с покрытием (Coverage):
npm run test:coverage
```

### 🛡️ Архитектурный Фаервол и Крейты (Arch Guard):
```powershell
# Запуск ВСЕХ тестов фаервола (из любого места):
pnpm test:guard
# или через cargo alias:
cargo test-guard

# Процент покрытия (Coverage) в терминале:
pnpm cov:guard
# или:
cargo cov-guard

# Открыть интерактивный HTML-отчет в браузере:
pnpm cov:guard:html
# или:
cargo cov-guard-html

# Если вы уже находитесь в папке crates/cargo-arch-guard/:
cargo test
cargo llvm-cov
cargo llvm-cov --html --open
```

### 🎭 End-to-End тесты (Playwright):
```powershell
npx playwright test
```

---


## 5. Бэкенд и Rust (Cargo)

### 🦀 Проверка компиляции и Линтинг Rust:
```powershell
# Быстрая проверка компиляции главного бинарника Tauri:
cargo check --manifest-path src-tauri/Cargo.toml

# Полный линтинг через Clippy:
cargo clippy --manifest-path src-tauri/Cargo.toml

# Проверка доменного слоя SurrealDB:
cargo check --manifest-path tauri-surreal-kit/backend/surreal_domain/Cargo.toml

# Проверка Tauri Shell моста:
cargo check --manifest-path tauri-surreal-kit/backend/tauri_shell/Cargo.toml
```

### 🔬 Тестирование бэкенда (Rust tests):
```powershell
# Тесты доменных сервисов и репозиториев SurrealDB:
cargo test --manifest-path tauri-surreal-kit/backend/surreal_domain/Cargo.toml

# Тесты shell-команд и IPC:
cargo test --manifest-path tauri-surreal-kit/backend/tauri_shell/Cargo.toml

# Интеграционный тест AI-пайплайна (с фичей agent-pipeline):
cargo test --manifest-path src-tauri/Cargo.toml --lib --features agent-pipeline

# Тесты AI-библиотеки claw-code (vendor):
cargo test --manifest-path vendor/claw-code/rust/Cargo.toml
```

---

## 6. Кодогенерация и Скрипты

### ⚙️ Генерация API-клиента и типов из Rust:
Генерирует TypeScript-типы и RPC-вызовы на основе структур Rust:
```powershell
pnpm generate:api
# или:
npm run generate:api
# или напрямую:
node scripts/codegen.js
```

### 🔤 Загрузка локальных шрифтов:
```powershell
powershell -ExecutionPolicy Bypass -File download-fonts.ps1
```

### ⚡ Быстрый запуск через батник:
```powershell
.\start_wiki.bat
```
