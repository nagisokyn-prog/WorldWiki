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
- **Поддерживаемые команды**:
  - `check`: статический анализ файлов `.vue`, `.css`, `.ts` (`--path`, `--rules-path`, `--ci`, `--sarif`, `--json`).
  - `rule`: офлайн-документация frontend-правил (`list`, `explain <ID>` с `--json`, `--markdown`).
  - `init`: инициализация frontend-конфигурации `cerberus.json` (`--adopt`, `--force`, `--path`).
  - `tree`: построение дерева компонентов и метрик сложности (`--json`).

### 4. [`app_runner.rs`](./src/app_runner.rs)
- **Ответственность**: Главный раннер фронтенд-аудита.
- **Как работает**:
  - `run_check`: запускает `ScanWorkspaceUseCase` с фильтрацией `ScanScope::FrontendOnly`.
  - `handle_rule`: выводит офлайн-карточки правил через `ExplainRuleUseCase`.
  - `handle_init`: генерирует frontend-ориентированный `cerberus.json` и baseline через `ScaffoldUseCase`.
  - `handle_tree`: строит иерархическое дерево фронтенда.

---

## 📋 Поддерживаемые правила и проверки

### Vue 3 SFC & Реактивность
| Код Правила | Название | Уровень | Описание |
|---|---|:---:|---|
| `VUE-001` | Vue Script Setup Monolith | 🛑 Deny | Запрет тяжелой логики в `<script setup>` (предел 15–30 строк связующего клея). |
| `VUE-002` | Missing Composable Companion | 🛑 Deny | Обязательное наличие хука-компаньона `use<Component>.ts` для бизнес-компонентов. |
| `VUE-003` | Types Inside Vue SFC | 🛑 Deny | Запрет объявления типов и интерфейсов внутри `.vue` (вынос в `*.model.ts`). |
| `VUE-007` | Reactivity Loss | 🛑 Deny | Запрет деструктуризации реактивных `props` или Pinia store без `toRefs()`. |
| `VUE-008` | Direct Props Mutation | 🛑 Deny | Запрет прямой мутации входных `props` (мутирование полей, `.push()` и т.д.). |
| `VUE-009` | Heavy Function in v-for | 🛑 Deny | Запрет вызова некэшируемых тяжелых методов внутри директивы `v-for`. |
| `PERF-001` | Deep Reactive on Heavy Data | 🛑 Deny | Запрет `reactive()` / `ref()` на тяжелых структурах данных (требуется `shallowRef`). |
| `PERF-002` | Proxy on External Instances | 🛑 Deny | Оборачивание инстансов Canvas, Three.js, Monaco в Proxy (требуется `markRaw`). |
| `PERF-005` | Unconstrained Deep Watch | 🛑 Deny | Запрет глубоких `watch(..., { deep: true })` без явного ограничения глубины. |
| `LEAK-001` | Event Listener Leak | 🛑 Deny | Обязательная симметричная очистка слушателей Tauri IPC, таймеров и DOM в `onUnmounted`. |

### CSS Design Tokens & Дизайн-Система
| Код Правила | Название | Уровень | Описание |
|---|---|:---:|---|
| `CSS-001` | Hex Color Hardcode | 🛑 Deny | Полный запрет Hex-цветов (`#fff`, `#0f1218`) — строго токены дизайн-системы. |
| `CSS-002` | Named & Hardcoded Units | 🛑 Deny | Запрет именованных цветов (`red`, `black`) и захардкоженных радиусов (`8px`). |
| `CSS-003` | Direct RGB/RGBA/HSL | 🛑 Deny | Запрет прямых вызовов функций цвета в обход CSS Custom Properties. |
| `CSS-004` | CSS Style Bloat | 🛑 Deny | Блоки `<style>` не должны превышать 50–70 строк. |
| `CSS-005` | String Color in TS | 🛑 Deny | Запрет строковых литералов цветов (Hex/RGB) в TypeScript и коде Composable. |
| `CSS-006` | Important Overuse | 🛑 Deny | Запрет использования `!important` в scoped-стилях компонентов. |
| `DS-001` | Spectral Tokens Tier-1 | 🛑 Deny | Запрет прямого использования спектральных токенов (`--blue-500`) в UI-компонентах. |
| `DS-002` | Local Theme Override | 🛑 Deny | Запрет локальных переопределений тем в листовых CSS файлах. |
| `DS-003` | Token Role Mismatch | 🛑 Deny | Запрет фоновых токенов в `color:` и текстовых токенов в `background:`. |

### Производительность Рендеринга & FSD
| Код Правила | Название | Уровень | Описание |
|---|---|:---:|---|
| `CSS-PERF-001` | Excessive will-change | ⚠️ Warn | Превышение лимита GPU-слоев и статических `will-change`. |
| `CSS-PERF-002` | Heavy Filter/Blur | ⚠️ Warn | Превышение порога радиуса размытия `blur > 30px` или вложенности фильтров. |
| `CSS-PERF-003` | Layout Animation | 🛑 Deny | Запрет анимации геометрических свойств (`width`, `height`, `margin`, `box-shadow`). |
| `CSS-PERF-004` | Transition All | 🛑 Deny | Полный запрет `transition: all` (требуется явное перечисление анимируемых свойств). |
| `FSD-001..004` | Feature-Sliced Design | 🛑 Deny | Контроль иерархии FSD-слоев (`app -> pages -> widgets -> features -> entities -> shared`). |

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
