# 🧱 Crate: `cerberus-infrastructure`

> **Слой конкретных инфраструктурных адаптеров, синтаксических парсеров, AI-движков и систем хранения.**

---

## 📑 Содержание

1. [Назначение крейта](#-назначение-крейта)
2. [Архитектурная роль (Infrastructure Layer)](#-архитектурная-роль-infrastructure-layer)
3. [Модульная структура и ответственность компонентов](#-модульная-структура-и-ответственность-компонентов)
   - [3.1. AST & Rust Analysis (`ast/`)](#31-ast--rust-analysis-ast)
   - [3.2. Frontend & Vue SFC (`frontend/`)](#32-frontend--vue-sfc-frontend)
   - [3.3. Parsers & Multi-threading (`parsers/`)](#33-parsers--multi-threading-parsers)
   - [3.4. Scanner (`scanner/`)](#34-scanner-scanner)
   - [3.5. Metrics & Topology (`metrics/`)](#35-metrics--topology-metrics)
   - [3.6. Vector & AI Clustering (`vector/`)](#36-vector--ai-clustering-vector)
   - [3.7. Storage & Cryptography (`storage/`)](#37-storage--cryptography-storage)
   - [3.8. Taint Analysis (`taint/`)](#38-taint-analysis-taint)
   - [3.9. Manifests (`manifest/`)](#39-manifests-manifest)
   - [3.10. Reporters (`reporters/`)](#310-reporters-reporters)
   - [3.11. Git Hooks (`hooks/`)](#311-git-hooks-hooks)
4. [Используемые библиотеки и драйверы](#-используемые-библиотеки-и-драйверы)

---

## 🌟 Назначение крейта

`cerberus-infrastructure` — это крупнейший крейт экосистемы, содержащий все низкоуровневые реализации интерфейсов ([`cerberus-ports`](../cerberus-ports/README_cerberus-ports.md)). Здесь инкапсулирована работа с внешними библиотеками: синтаксическим парсером `syn`, рантаймом машинного обучения `ort` (ONNX), многопоточным движком `rayon`, токенизатором `tokenizers`, криптографическим хэшированием и файловой системой.

---

## 🏛️ Архитектурная роль (Infrastructure Layer)

Инфраструктурный слой изолирует внешние зависимости от доменной логики:
- Реализует трейты из `cerberus-ports`.
- Транслирует низкоуровневые ошибки сторонних библиотек (I/O, ONNX, Parse errors) в доменные ошибки.
- Предоставляет конкретные структуры (`RulesJsonRepository`, `WalkdirScannerAdapter`, `RustSynParserAdapter`, `DbscanClustererAdapter`, `OnnxEmbedder` и др.) для сборки в Composition Root ([`cargo-cerberus`](../cargo-cerberus/README_cargo-cerberus.md)).

---

## 📁 Модульная структура и ответственность компонентов

```
crates/cerberus-infrastructure/src/
├── ast/          # 🦀 Глубокий синтаксический анализ Rust AST (syn)
├── frontend/     # ⚡ Парсинг Vue 3 SFC, CSS токенов, FSD и жизненного цикла
├── parsers/      # 🧩 Адаптеры парсеров и многопоточный пул Rayon
├── scanner/      # 🔍 Сканер директорий с поддержкой правил игнорирования
├── metrics/      # 📐 Анализ сложности AST, SLOC и топологии пакетов
├── vector/       # 🧠 ONNX CodeBERTa, Subword TF-IDF и DBSCAN кластеризация
├── storage/      # 🔐 Хранилища правил, подписей HMAC-SHA256 и baseline
├── taint/        # 🎯 Построение Taint Graph (Source -> Sanitizer -> Sink)
├── manifest/     # 📦 Анализ Cargo.toml и транзитивных прав зависимостей
├── reporters/    # 📑 Генераторы отчетов: Console, SARIF v2.1.0, JSON, Tree
└── hooks/        # 🪝 Менеджер установки Git Pre-commit / Pre-push хуков
```

---

### 3.1. AST & Rust Analysis (`ast/`)

- [`visitor.rs`](./src/ast/visitor.rs) — `AstVisitor`: базовый обходчик синтаксического дерева `syn::File`. Собирает декларации функций, вызовы макросов, блоки `unsafe`, операторы паники и конструкции `use`.
- [`imports.rs`](./src/ast/imports.rs) — `ImportsChecker`: инспектирует деревья `syn::UseTree`, проверяя правила изоляции слоев `ARCH-001`..`ARCH-008`, `MOD-001`, `CQRS-001`, `EVT-001`. Предотвращает импорт внешних SDK (`tauri`, `tokio`, `surrealdb`) в чистый домен.
- [`panic_vector.rs`](./src/ast/panic_vector.rs) — `PanicVectorVisitor`: находит неконтролируемые вызовы `panic!`, `.unwrap()`, `.expect()`, `unreachable!()` (правило `ROB-001`), требуя перехода на безопасные методы и типизированные `Result<T, E>`.
- [`ai_defense.rs`](./src/ast/ai_defense.rs) — `AiDefenseChecker`: защита от деструктивных действий AI (`AI-001` подделка правил, `AI-003` зондирование среды, `AI-008` недоказанный `unsafe`, `AI-009` нерегламентированные `TODO`, `AI-013` неавторизованные `#[allow(...)]`).
- [`ai_slop.rs`](./src/ast/ai_slop.rs) — `AiSlopVisitor`: выявляет оставленные артефакты генерации кода и чрезмерный оверхед (`todo!()`, `unimplemented!()`, правило `SLOP-001`).
- [`error_rules.rs`](./src/ast/error_rules.rs) — `ErrorRulesChecker`: контроль качества обработки ошибок (`ERR-001` тихое подавление `let _ = result;`, `ERR-002` паника в `Drop`, `ERR-003` нетипизированный `Result<T, String>`, `ERR-005` паника в библиотеке).
- [`concurrency_rules.rs`](./src/ast/concurrency_rules.rs) — `ConcurrencyRulesChecker`: предотвращение `CONC-002` (брошенные `tokio::spawn`), `CONC-006` (Double Lock Deadlock), `CONC-008` (`static mut`).
- [`rust_perf.rs`](./src/ast/rust_perf.rs) — `RustPerfChecker`: правила производительности бэкенда (`PERF-006` блокирующий I/O в `Drop`, `PERF-011` I/O в циклах N+1, `PERF-012` unbounded mpsc channels).
- [`testability.rs`](./src/ast/testability.rs) — `TestabilityChecker`: проверка детерминизма и чистоты домена (`TEST-002` глобальное состояние, `TEST-003` инфраструктурные адаптеры в домене, `TEST-005` `SystemTime::now()`/`Instant::now()`/`Uuid::new_v4()` в домене).
- [`macros.rs`](./src/ast/macros.rs) — `MacroVisitor`: валидирует использование макросов, запрещая опасные глобальные состояния (`lazy_static!`).
- [`async_rules.rs`](./src/ast/async_rules.rs) — `MutexGuardVisitor`: проверяет асинхронный код на удержание `std::sync::MutexGuard` через точки прерывания `.await` (`ASYNC-001`) и блокирующий сон в async (`ASYNC-002`).
- [`capabilities.rs`](./src/ast/capabilities.rs) — `CapabilitiesVisitor`: анализирует прямой доступ к системным возможностям (FS, Sockets, Processes) в недопустимых слоях.
- [`bevy/`](./src/ast/bevy/) — Специализированный статический анализатор Bevy ECS (0.18.1+):
  - `api_checker.rs`: проверка устаревших API `BEVY-API-001..006`.
  - `sched_checker.rs`: контроль блокировок шедулера `BEVY-SCHED-001..005`.
  - `ecs_checker.rs`: правила гигиены компонентов и клонирования `BEVY-ECS-001..007`.
  - `query_checker.rs`: инварианты запросов и ресурсов `BEVY-QUERY-001..005`.
  - `async_checker.rs`: безопасность асинхронных задач `BEVY-ASYNC-001..004`.
  - `perf_checker.rs`: аудит утечек VRAM, рекурсивного despawn и мутаций `BEVY-PERF-*` (15 правил).
  - `context.rs`: извлечение контекста Bevy-систем, Startup/Update очередей и версий.

---

### 3.2. Frontend & Vue SFC (`frontend/`)

- [`sfc_parser.rs`](./src/frontend/sfc_parser.rs) — `VueSfcParser`: потоковый Zero-DOM лексер компонентов Vue 3 Single File Component (.vue). Извлекает секции `<template>`, `<script setup>`, `<style>` и их атрибуты (`lang="ts"`, `scoped`).
- [`vue_rules.rs`](./src/frontend/vue_rules.rs) — `VueRulesChecker`:
  - `VUE-001`: аудит монолитов в `<script setup>` (порог: не более 15–30 строк связующего клея).
  - `VUE-002`: контроль наличия хука-компаньона `use<Component>.ts`.
  - `VUE-003`: запрет объявления интерфейсов типов внутри шаблона `.vue`.
  - `VUE-007`: предотвращение разрушения реактивности (деструктуризация `props`/`store`).
  - `VUE-008`: запрет мутации входных `props`.
  - `VUE-009`: вызовы тяжелых функций внутри `v-for`.
- [`css_rules.rs`](./src/frontend/css_rules.rs) & [`design_system_rules.rs`](./src/frontend/design_system_rules.rs):
  - `CSS-001`: запрет Hex/RGB/HSL и именованных HTML-цветов (строго токены дизайн-системы).
  - `CSS-002`: запрет захардкоженных радиусов и таймингов.
  - `CSS-004`: контроль раздувания CSS (блоки `<style>` > 50–70 строк).
  - `CSS-005`: запрет строковых Hex/RGB литералов в коде TS/Composable.
  - `CSS-006`: запрет `!important` в scoped-стилях.
  - `DS-001..DS-003`: контроль ролей семантических токенов и запрет локальных переопределений тем.
- [`css_perf_rules.rs`](./src/frontend/css_perf_rules.rs):
  - `CSS-PERF-001..005`: контроль GPU-бюджета `will-change`, тяжелых `backdrop-filter`, layout animations и `transition: all`.
- [`fsd_rules.rs`](./src/frontend/fsd_rules.rs) — `FsdRulesChecker`: проверка архитектурных границ Feature-Sliced Design (`app` $\to$ `pages` $\to$ `widgets` $\to$ `features` $\to$ `entities` $\to$ `shared`, `FSD-001..FSD-004`).
- [`perf_rules.rs`](./src/frontend/perf_rules.rs) — `PerfRulesChecker`: проверка правил реактивности (`PERF-001` `shallowRef`, `PERF-002` `markRaw` для Canvas/Monaco, `PERF-003` `requestAnimationFrame`, `PERF-004` вызовы в шаблоне, `PERF-005` глубокие `watch`).
- [`lifecycle_rules.rs`](./src/frontend/lifecycle_rules.rs) — `LifecycleRulesChecker`: проверка симметричной очистки слушателей Tauri IPC, таймеров и DOM-слушателей в `onUnmounted` (`LEAK-001` / `FE-RAII-001`).

---

### 3.3. Parsers & Multi-threading (`parsers/`)

- [`rust_syn.rs`](./src/parsers/rust_syn.rs) — `RustSynParserAdapter`: реализует `FileParserPort` для Rust-файлов. Собирает цепочку проверок AST, Taint, Macros и метрик.
- [`vue_sfc.rs`](./src/parsers/vue_sfc.rs) — `VueSfcParserAdapter`: реализует `FileParserPort` для Vue SFC файлов.
- [`parallel_engine.rs`](./src/parsers/parallel_engine.rs) — `ParallelEngineAdapter`: параллельный движок на базе Rayon. Распределяет файлы по потокам CPU, обеспечивая обработку тысяч файлов за сотни миллисекунд.

---

### 3.4. Scanner (`scanner/`)

- [`walkdir_scanner.rs`](./src/scanner/walkdir_scanner.rs) — `WalkdirScannerAdapter`: рекурсивно обходит каталоги проекта. Автоматически исключает папки `target/`, `node_modules/`, `.git/`, `dist/`, а также файлы, подпадающие под `.gitignore`.

---

### 3.5. Metrics & Topology (`metrics/`)

- [`ast_complexity.rs`](./src/metrics/ast_complexity.rs) — `AstComplexityAnalyzer`: вычисляет количество функций, цикломатическую сложность (ветвления `if`, `match`, `while`, `for`, `?`) и максимальную глубину синтаксического дерева.
- [`sloc.rs`](./src/metrics/sloc.rs) — `SlocCounter`: быстрый лексический анализатор физических строк, чистого исходного кода (SLOC), комментариев и пустых строк.
- [`blast_radius.rs`](./src/metrics/blast_radius.rs) — `BlastRadiusCalculator`: вычисляет количество зависимых файлов при потенциальном изменении целевого модуля.
- [`package_topology.rs`](./src/metrics/package_topology.rs) — `PackageTopologyAnalyzer`: строит граф зависимостей крейтов, вычисляет входящие ($C_a$) и исходящие ($C_e$) зацепления, метрику нестабильности $I$ и находит циклы.

---

### 3.6. Vector & AI Clustering (`vector/`)

- [`onnx_embedder.rs`](./src/vector/onnx_embedder.rs) — `OnnxEmbedder`: векторизатор кода на базе ONNX Runtime (`ort`) и HuggingFace `tokenizers`. Генерирует 768-мерные dense-эмбеддинги через модель CodeBERTa.
- [`semantic_embedder.rs`](./src/vector/semantic_embedder.rs) — `SemanticEmbedder`: быстрый субвордовый TF-IDF векторизатор для работы в офлайн-режиме без ONNX-весов.
- [`dbscan.rs`](./src/vector/dbscan.rs) — `DbscanClustererAdapter`: реализация алгоритма пространственной плотностной кластеризации DBSCAN ($O(N \log N)$ с метрикой косинусного расстояния).
- [`cache.rs`](./src/vector/cache.rs) — `EmbeddingCache`: локальный дисковый кэш вычисленных векторов по хэшу текста для ускорения повторного анализа.
- [`model_downloader.rs`](./src/vector/model_downloader.rs) — `ModelDownloaderAdapter`: реализация `ModelDownloaderPort` для загрузки моделей по HTTP с проверкой контрольных сумм.

---

### 3.7. Storage & Cryptography (`storage/`)

- [`rules_json.rs`](./src/storage/rules_json.rs) — `RulesJsonRepository`: чтение, парсинг и валидация конфигурации правил из файла `.cerberus/rules.json`.
- [`file_key.rs`](./src/storage/file_key.rs) — `FileStorageAdapter`: чтение и сохранение записей подавлений в `.cerberus/suppressions.lock` с вычислением подписи HMAC-SHA256 (`ring`).
- [`keyring_key.rs`](./src/storage/keyring_key.rs) — `KeyringStorageAdapter`: адаптер для защищенного хранения мастер-ключа в системном хранилище ключей ОС (Windows Credential Manager / macOS Keychain / Secret Service API).
- [`mock_key.rs`](./src/storage/mock_key.rs) — `MockStorageAdapter`: реализация хранилища в памяти для быстрых юнит-тестов.
- [`baseline_file.rs`](./src/storage/baseline_file.rs) — `FileBaselineStorageAdapter`: адаптер чтения/записи файла `cerberus-baseline.json`.

---

### 3.8. Taint Analysis (`taint/`)

- [`graph.rs`](./src/taint/graph.rs) — `TaintGraphBuilder`: построение графа потоков данных.
- [`sources.rs`](./src/taint/sources.rs) — реестр источников потенциально небезопасных данных (аргументы Tauri IPC, тела сетевых запросов).
- [`sinks.rs`](./src/taint/sinks.rs) — реестр опасных операций-приемников (SQL-запросы, файловые операции, запуск процессов ОС).
- [`sanitizers.rs`](./src/taint/sanitizers.rs) — реестр методов валидации и санитизации (безопасные касты, параметризация через `.bind()`, нормализация путей).

---

### 3.9. Manifests (`manifest/`)

- [`cargo_manifest.rs`](./src/manifest/cargo_manifest.rs) — `CargoManifestAdapter`: валидация секций `[dependencies]` в `Cargo.toml`. Контролирует отсутствие запрещенных крейтов в доменных пакетах.
- [`transitive_capabilities.rs`](./src/manifest/transitive_capabilities.rs) — аудит транзитивного дерева зависимостей (`Cargo.lock`) на предмет скрытых уязвимостей.

---

### 3.10. Reporters (`reporters/`)

- [`console.rs`](./src/reporters/console.rs) — `ConsoleReporter`: форматированный цветной вывод в терминал с понятными блоками ошибок, сниппетами кода и советами по исправлению (Remediation).
- [`json.rs`](./src/reporters/json.rs) — `JsonReporter`: экспорт полной структуры анализа в машиночитаемый JSON.
- [`sarif.rs`](./src/reporters/sarif.rs) — `SarifReporter`: генерация отчета по стандарту OASIS SARIF v2.1.0 для бесшовной интеграции с GitHub Code Scanning и pull request annotations.
- [`tree_formatter.rs`](./src/reporters/tree_formatter.rs) — `TreeFormatterReporter`: консольная визуализация иерархического дерева компонентов с псевдографикой (`├─`, `└─`) и колонками метрик (SLOC, Blast Radius, $S_{\text{arch}}$).

---

### 3.11. Git Hooks (`hooks/`)

- [`git_hooks.rs`](./src/hooks/git_hooks.rs) — `GitHooksManager`: установка и валидация pre-commit/pre-push хуков в `.git/hooks` для автоматической блокировки коммитов с архитектурными нарушениями.

---

## 🛠️ Используемые библиотеки и драйверы

| Библиотека | Назначение |
|---|---|
| `syn` & `quote` | Синтаксический разбор и анализ Rust AST |
| `ort` | Запуск нейросетевых ONNX моделей на CPU |
| `tokenizers` | Быстрая HuggingFace BPE/WordPiece токенизация |
| `rayon` | Параллельная многопоточная обработка файлов |
| `walkdir` | Эффективный рекурсивный обход файловой системы |
| `ring` & `sha2` | Криптографические хэши SHA-256 и подписи HMAC-SHA256 |
| `serde` & `serde_json` | Сериализация и десериализация JSON/SARIF |
| `colored` | Стилизация и цветовая разметка консольного вывода |
| `keyring` | Интеграция с безопасными хранилищами ключей ОС |
