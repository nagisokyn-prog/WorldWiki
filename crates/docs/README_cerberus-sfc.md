# 🌐 Crate: `cerberus-sfc`

> **Специализированный автономный CLI-инструмент для экспресс-аудита Vue 3 Single File Components (SFC) и CSS дизайн-систем.**

---

## 📑 Содержание

1. [Назначение крейта](#-назначение-крейта)
2. [Архитектурная роль](#-архитектурная-роль)
3. [Пофайловая структура и ответственность](#-пофайловая-структура-и-ответственность)
4. [Поддерживаемые правила и проверки](#-поддерживаемые-правила-и-проверки)
5. [CLI интерфейс и примеры использования](#-cli-интерфейс-и-примеры-использования)

---

## 🌟 Назначение крейта

`cerberus-sfc` — это легковесный, узкоспециализированный CLI-инструмент, сфокусированный исключительно на контроле чистоты и качества фронтенд-кода (Vue 3 SFC, TypeScript, Scoped CSS). Он может использоваться как отдельный pre-commit хук для фронтенд-разработчиков или как шаг сборки в CI без необходимости запуска полного Rust-анализа.

---

## 🏛️ Архитектурная роль

`cerberus-sfc` выступает в качестве альтернативного **Composition Root**, оптимизированного для фронтенда:
- Использует доменные модели из [`cerberus-domain`](../cerberus-domain/README_cerberus-domain.md).
- Инстанциирует фронтенд-парсеры и правила из [`cerberus-infrastructure`](../cerberus-infrastructure/README_cerberus-infrastructure.md) (`VueSfcParserAdapter`, `VueRulesChecker`, `CssRulesChecker`, `FsdRulesChecker`, `PerfRulesChecker`).
- Предоставляет изолированный бинарник `cerberus-sfc.exe`.

---

## 📁 Пофайловая структура и ответственность

```
crates/cerberus-sfc/src/
├── main.rs          # 🚀 Бинарная точка входа CLI (cerberus-sfc.exe)
├── lib.rs           # 📚 Библиотечный API и реэкспорт функций запуска
├── cli.rs           # 🎛️ Декларативное описание аргументов и флагов (Clap)
└── app_runner.rs    # 🏃 Конвейер аудита фронтенда и форматирование вывода
```

### 1. [`main.rs`](./src/main.rs)
- **Ответственность**: Точка входа для запуска бинарника `cerberus-sfc`.
- **Как работает**:
  - Парсит CLI-аргументы через `cerberus_sfc::cli::parse_cli()`.
  - Вызывает `cerberus_sfc::app_runner::run_sfc_app(cli)`.
  - При наличии критических ошибок завершает процесс с кодом `1`.

### 2. [`lib.rs`](./src/lib.rs)
- **Ответственность**: Экспорт библиотеки для программного использования и интеграционного тестирования.
- **Экспортирует**: функции `run_sfc_app`, `parse_cli`, типы `Cli`, `AppRunnerOptions`.

### 3. [`cli.rs`](./src/cli.rs)
- **Ответственность**: Конфигурация аргументов командной строки через `clap`.
- **Флаги**:
  - `--path <DIR>`: путь к каталогу с фронтенд-компонентами (по умолчанию `.`).
  - `--rules <FILE>`: путь к файлу правил `.cerberus/rules.json`.
  - `--ci`: режим CI с возвратом кода 1 при наличии `Deny`.
  - `--sarif <FILE>`: экспорт результатов в SARIF.
  - `--json <FILE>`: экспорт результатов в JSON.
  - `--css-only`: ограничить проверку только CSS дизайн-токенами.
  - `--vue-only`: ограничить проверку только структурой Vue-компонентов.

### 4. [`app_runner.rs`](./src/app_runner.rs)
- **Ответственность**: Оркестрация процесса проверки компонентов.
- **Как работает**:
  - Сканирует целевую директорию на наличие файлов `.vue` и `.ts`.
  - Загружает правила из `RulesJsonRepository`.
  - Передает каждый компонент в `VueSfcParserAdapter`.
  - Запускает цепочку правил:
    1. `VueRulesChecker` (монолиты `<script setup>`, компаньоны `use*.ts`, типы в `*.model.ts`).
    2. `CssRulesChecker` (Hex-цвета, HTML-цвета, `rgb()`, `border-radius`, раздувание стилей).
    3. `FsdRulesChecker` (границы слоев FSD).
    4. `PerfRulesChecker` (утечки IPC listeners, deep watch, отсутствие `shallowRef`).
  - Выводит результаты аудита с префиксом `[cerberus-sfc]` в цветном консольном формате.
  - При необходимости экспортирует SARIF и JSON отчеты.

---

## 📋 Поддерживаемые правила и проверки

| Код Правила | Название | Описание |
|---|---|---|
| `VUE-001` | Vue Script Setup Monolith | Запрет тяжелой логики в `<script setup>` (предел 15–30 строк клея). |
| `VUE-002` | Missing Composable Companion | Обязательное наличие хука-компаньона `use<Component>.ts`. |
| `VUE-003` | Types Inside Vue SFC | Запрет объявления типов и интерфейсов внутри `.vue` (вынос в `*.model.ts`). |
| `VUE-004` | Deep Reactive on Heavy Data | Запрет `reactive()` / `ref()` на тяжелых структурах (требуется `shallowRef`). |
| `VUE-005` | Unconstrained Deep Watch | Запрет глубоких `watch(..., { deep: true })` без явного ограничения глубины. |
| `VUE-006` | Tauri IPC Listener Leak | Обязательная очистка слушателей Tauri IPC Events в `onUnmounted`. |
| `CSS-001` | Hex Color Hardcode | Полный запрет Hex-цветов (`#fff`, `#0f1218`) — строго дизайн-токены. |
| `CSS-002` | Named Color Hardcode | Запрет именованных цветов (`red`, `black`, `white`, `blue`). |
| `CSS-003` | Direct RGB/RGBA/HSL | Запрет прямых вызовов функций цвета в обход токенов. |
| `CSS-004` | Hardcoded Border Radius | Запрет прямого указания радиусов (`border-radius: 8px`). |
| `CSS-005` | CSS Style Bloat | Блоки `<style>` не должны превышать 50–70 строк. |

---

## 🚀 CLI интерфейс и примеры использования

```bash
# 1. Запуск проверки фронтенда в текущей папке
cerberus-sfc --path apps/spa/src

# 2. Проверка только CSS дизайн-токенов
cerberus-sfc --path apps/spa/src --css-only

# 3. Запуск в CI/CD с генерацией SARIF
cerberus-sfc --path apps/spa/src --ci --sarif target/frontend-report.sarif
```
