# 📦 Crate: `cargo-cerberus`

> **Основной CLI-инструмент и Composition Root архитектурного фаервола Cerberus.**

---

## 📑 Содержание

1. [Назначение крейта](#-назначение-крейта)
2. [Архитектурная роль (Composition Root)](#-архитектурная-роль-composition-root)
3. [Пофайловая структура и ответственность](#-пофайловая-структура-и-ответственность)
4. [Поддерживаемые команды и флаги CLI](#-поддерживаемые-команды-и-флаги-cli)
5. [Взаимодействие со слоями системы](#-взаимодействие-со-слоями-системы)

---

## 🌟 Назначение крейта

`cargo-cerberus` предоставляет удобный интерфейс командной строки (CLI), интегрируемый с `cargo` в виде плагина `cargo cerberus <SUBCOMMAND>`. Крейт отвечает за парсинг аргументов командной строки, сборку графа зависимостей (Dependency Injection) для Use Case'ов и вывод результатов в терминал разработчика или CI/CD пайплайн.

---

## 🏛️ Архитектурная роль (Composition Root)

В соответствии с принципами гексагональной архитектуры, `cargo-cerberus` является **точкой сборки** приложения:

1. Он инстанциирует конкретные адаптеры из [`cerberus-infrastructure`](../cerberus-infrastructure/README.md) (файловые хранилища, парсеры Syn/Vue, DBSCAN-кластеризатор, ONNX-эмбеддер).
2. Оборачивает их в интерфейсы трейтов из [`cerberus-ports`](../cerberus-ports/README.md).
3. Передает зависимости в конструкторы Use Case'ов из [`cerberus-application`](../cerberus-application/README.md).
4. Запускает исполнение сценариев и транслирует результаты нарушений в коды возврата (`std::process::ExitCode`).

---

## 📁 Пофайловая структура и ответственность

```
crates/cargo-cerberus/src/
├── main.rs              # 🚀 Бинарная точка входа CLI
├── lib.rs               # 📚 Экспортируемый API библиотеки, хелперы запуска
├── cli.rs               # 🎛️ Декларативное описание аргументов и флагов (Clap)
├── commands.rs          # 🛠️ Верхнеуровневые хэндлеры команд (Check, Init, Tree)
├── check_runner.rs      # 🏃 Конвейер аудита (сборка сканеров, запуск Use Case, экспорт)
├── model_commands.rs    # 🧠 Управление моделями ONNX и вызов объяснений (Explain)
└── ledger_commands.rs   # 🔐 Криптографический реестр подавлений и Baseline
```

### 1. [`main.rs`](./src/main.rs)

- **Ответственность**: Точка входа для бинарного файла `cargo-cerberus.exe`.
- **Как работает**:
  - Считывает аргументы вызова через `cargo_cerberus::cli::parse_cli()`.
  - Передает управление в `cargo_cerberus::cli::run_app(cli)`.
  - При возникновении ошибки выводит сообщение в stderr с префиксом `❌ Error:` и завершает процесс с кодом `1`.

### 2. [`lib.rs`](./src/lib.rs)

- **Ответственность**: Библиотечный интерфейс крейта, реэкспорт ключевых типов для тестирования и внешнего встраивания.
- **Как работает**:
  - Экспортирует модули `check_runner`, `cli`, `commands`, `ledger_commands`, `model_commands`.
  - Реэкспортирует порты (`ports`), доменные правила (`rules`), хранилища (`RulesJsonRepository`) и функции `run_check`, `run_app`.
  - Позволяет запускать проверки программно в интеграционных тестах без вызова процесса через ОС.

### 3. [`cli.rs`](./src/cli.rs)

- **Ответственность**: Определение структуры CLI через `clap(derive)`.
- **Как работает**:
  - Определяет корневую структуру `Cli` (с поддержкой вызова как `cargo cerberus ...`, так и прямого `cargo-cerberus ...`).
  - Описывает перечисление `Commands`:
    - `Check`: запуск статического анализа проекта.
    - `Explain`: семантический анализ кластеров долга.
    - `Ledger`: криптографическое управление подавлениями (`Sign`, `ReSign`, `Verify`).
    - `Baseline`: сверка и нормализация baseline-файла (`Reconcile`).
    - `Model`: управление нейросетевыми ONNX-моделями (`Download`, `Status`, `Clean`).
    - `Tree`: визуализация дерева модулей и компонентов с метриками.
    - `Init`: инициализация дефолтного `.cerberus/rules.json`.

### 4. [`commands.rs`](./src/commands.rs)

- **Ответственность**: Диспетчеризация базовых команд системы.
- **Как работает**:
  - `handle_init(path)`: создает конфигурационный каталог `.cerberus/` и генерирует эталонный файл правил `rules.json` с дефолтными политиками.
  - `handle_tree(path, options)`: инстанциирует `WalkdirScannerAdapter`, `RenderTreeUseCase` и `TreeFormatterReporter`, формируя консольное дерево с индикаторами SLOC и Blast Radius.
  - `validate_rules_repository(repo)`: выполняет проверку целостности загруженного файла правил (отсутствие дубликатов ID, корректность severity).

### 5. [`check_runner.rs`](./src/check_runner.rs)

- **Ответственность**: Ядро выполнения команды `cargo cerberus check`.
- **Как работает**:
  - Принимает структуру параметров `CheckExecutionOptions` (путь, репозиторий правил, флаги `--sarif`, `--json`, `--ci`, `--frontend-only`, `--backend-only`).
  - Собирает граф инфраструктуры: `WalkdirScannerAdapter`, `ParallelEngineAdapter`, `FileStorageAdapter` (для подавлений) и `FileBaselineStorageAdapter`.
  - Создает и исполняет `ScanWorkspaceUseCase`.
  - Передает список нарушений репортерам (`ConsoleReporter`, `SarifReporter`, `JsonReporter`).
  - Если активен флаг `--ci` и обнаружено хотя бы одно нарушение уровня `Severity::Deny`, возвращает `Err(...)`, что приводит к завершению с кодом 1 в CI.

### 6. [`model_commands.rs`](./src/model_commands.rs)

- **Ответственность**: Обслуживание локальной нейросетевой модели и запуск семантической кластеризации.
- **Как работает**:
  - `handle_model(action)` / `handle_model_with_downloader(...)`:
    - `Download`: загружает `model.onnx` и `tokenizer.json` из HuggingFace в каталог кэша `~/.cache/cerberus/models/` через `ModelDownloaderPort`.
    - `Status`: проверяет наличие и валидность кэшированных файлов ONNX.
    - `Clean`: удаляет кэшированные веса модели.
  - `handle_explain(path, details)`:
    - Запускает предварительное сканирование проекта для получения активных нарушений.
    - Выбирает доступный векторизатор: `OnnxEmbedder` (если модель скачана) или fallback на `SemanticEmbedder` (Subword TF-IDF).
    - Вызывает `ExplainClustersUseCase` с `DbscanClustererAdapter`.
    - Форматирует и выводит таблицу семантических кластеров и изолированных проблем.

### 7. [`ledger_commands.rs`](./src/ledger_commands.rs)

- **Ответственность**: Защита архитектурного реестра от несанкционированного изменения.
- **Как работает**:
  - `handle_ledger(action)`:
    - `Sign`: вычисляет HMAC-SHA256 подпись через `SignSuppressionUseCase` и мастер-ключ, сохраняя запись в `.cerberus/suppressions.lock`.
    - `ReSign`: пакетно переподписывает все действующие подавления при ротации мастер-ключа (`ReSignAllUseCase`).
  - `handle_baseline(action)`:
    - `Reconcile`: запускает `ReconcileBaselineUseCase`, нормализует JSON-файл baseline, сортирует хэши и удаляет дубликаты.

---

## 🎛️ Поддерживаемые команды и флаги CLI

| Команда              | Флаги                  | Описание                                                              |
| -------------------- | ---------------------- | --------------------------------------------------------------------- |
| `check`              | `--path <DIR>`         | Путь к корню анализируемого проекта (по умолчанию `.`).               |
|                      | `--rules <FILE>`       | Путь к кастомному файлу правил (по умолчанию `.cerberus/rules.json`). |
|                      | `--ci`                 | Режим непрерывной интеграции: падение с кодом 1 при наличии `Deny`.   |
|                      | `--sarif <FILE>`       | Экспорт отчета в формате SARIF v2.1.0 для GitHub Code Scanning.       |
|                      | `--json <FILE>`        | Экспорт полного отчета в машиночитаемый JSON.                         |
|                      | `--frontend-only`      | Сканировать только Vue SFC и TypeScript файлы.                        |
|                      | `--backend-only`       | Сканировать только Rust модули и Cargo.toml.                          |
| `explain`            | `--details`            | Показать подробные сниппеты кода для каждого кластера нарушений.      |
| `tree`               | `--max-depth <N>`      | Ограничение глубины отображения дерева компонентов.                   |
| `ledger sign`        | `--rule <ID>`          | ID подавляемого правила (например, `ARCH-001`).                       |
|                      | `--fingerprint <HASH>` | Отпечаток нарушенного участка кода.                                   |
|                      | `--reason <TEXT>`      | Обоснование временного подавления.                                    |
|                      | `--author <EMAIL>`     | Автор подавления.                                                     |
| `baseline reconcile` | `--file <PATH>`        | Путь к файлу `cerberus-baseline.json`.                                |
| `model download`     | —                      | Загрузить нейросетевую модель CodeBERTa ONNX.                         |
| `model status`       | —                      | Проверить готовность кэша нейросети.                                  |
| `model clean`        | —                      | Очистить локальный кэш модели.                                        |
