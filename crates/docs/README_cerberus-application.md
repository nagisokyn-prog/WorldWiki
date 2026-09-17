# ⚙️ Crate: `cerberus-application`

> **Слой сценариев использования (Use Cases) и оркестрации бизнес-логики Cerberus.**

---

## 📑 Содержание

1. [Назначение крейта](#-назначение-крейта)
2. [Архитектурная роль (Application Layer)](#-архитектурная-роль-application-layer)
3. [Пофайловая структура и ответственность Use Case'ов](#-пофайловая-структура-и-ответственность-use-cases)
4. [Подробное описание каждого Use Case](#-подробное-описание-каждого-use-case)
5. [Связи со слоями Domain, Ports и Infrastructure](#-связи-со-слоями-domain-ports-и-infrastructure)

---

## 🌟 Назначение крейта

`cerberus-application` реализует всю прикладную бизнес-логику системы. Он координирует выполнение операций аудита, связывая доменные правила ([`cerberus-domain`](../cerberus-domain/README.md)) и порты ввода-вывода ([`cerberus-ports`](../cerberus-ports/README.md)). Крейт полностью изолирован от деталей конкретных технологий (баз данных, парсеров, веб-фреймворков).

---

## 🏛️ Архитектурная роль (Application Layer)

Слой Application:
- Не зависит от `cerberus-infrastructure` или `cargo-cerberus`.
- Зависит **ТОЛЬКО** от `cerberus-domain` и `cerberus-ports`.
- Все Use Case'ы принимают зависимости в виде трейтов (`Arc<dyn Port>`) через конструктор `new(...)`.
- Это позволяет выполнять 100% покрытие юнит-тестами с легковесными Mock-объектами в оперативной памяти без обращения к диску или сети.

---

## 📁 Пофайловая структура и ответственность Use Case'ов

```
crates/cerberus-application/src/
├── lib.rs                  # 📚 Корневой модуль, реэкспорт всех Use Case'ов
├── scan_workspace.rs       # 🔍 ScanWorkspaceUseCase (Главный сценарий аудита)
├── explain_clusters.rs     # 🧠 ExplainClustersUseCase (Семантическая кластеризация AI)
├── render_tree.rs          # 🌳 RenderTreeUseCase (Построение дерева компонентов)
├── tree_hierarchy.rs       # 🌲 Сборка иерархии узлов дерева ComponentNode
├── tree_metrics.rs         # 📐 Агрегация метрик сложности и давления для дерева
├── sign_suppression.rs     # ✍️ SignSuppressionUseCase (Подписание подавления HMAC-SHA256)
├── re_sign_all.rs          # 🔄 ReSignAllUseCase (Ротация ключей и переподписание реестра)
├── reconcile_baseline.rs   # 📄 ReconcileBaselineUseCase (Нормализация cerberus-baseline.json)
└── download_model.rs       # ⬇️ DownloadModelUseCase (Загрузка и верификация ONNX-модели)
```

---

## 🔬 Подробное описание каждого Use Case

### 1. [`scan_workspace.rs`](./src/scan_workspace.rs) — `ScanWorkspaceUseCase`
- **Назначение**: Основной конвейер статического анализа проекта.
- **Алгоритм работы**:
  1. Вызывает `SourceScannerPort::scan_files` для получения списка файлов (.rs, .vue, .ts).
  2. Передает файлы в `FileParserPort::parse_and_validate`, получая полный список сырых нарушений (`raw_violations`).
  3. Загружает активные подавления из `StoragePort::load_suppressions`.
  4. Проверяет криптографические подписи каждой записи через мастер-ключ (`verify_signature`) и проверяет срок годности (TTL).
  5. Считывает хэши baseline через `BaselineStoragePort::read`.
  6. Фильтрует нарушения: если отпечаток (`fingerprint`) нарушения присутствует в валидных подавлениях или в baseline — оно исключается из активных.
  7. Возвращает список `active_violations` для генерации отчетов.

### 2. [`explain_clusters.rs`](./src/explain_clusters.rs) — `ExplainClustersUseCase`
- **Назначение**: AI-группировка нарушений по смысловым паттернам.
- **Алгоритм работы**:
  1. Формирует текстовые сниппеты для каждого активного нарушения (ID правила, файл, фрагмент кода, сообщение).
  2. Вызывает `CodeEmbedderPort::embed_batch`, преобразуя текст в $N$-мерные векторы признаков.
  3. Передает матрицу векторов в `ClustererPort::cluster_embeddings` (DBSCAN с радиусом окрестности $\varepsilon = 0.35$).
  4. Группирует нарушения в кластеры `ViolationCluster`, вычисляет центроиды и определяет плотность каждого очага техдолга.

### 3. [`render_tree.rs`](./src/render_tree.rs) — `RenderTreeUseCase`
- **Назначение**: Построение интерактивной карты архитектуры приложения.
- **Алгоритм работы**:
  1. Сканирует файловую структуру через `SourceScannerPort`.
  2. Вызывает `tree_hierarchy::build_tree` для построения корневого `ComponentNode`.
  3. Вызывает `tree_metrics::enrich_tree_metrics` для расчета цикломатической сложности, SLOC и радиуса взрыва (`Blast Radius`).
  4. Возвращает готовое дерево для форматирования в консоли или экспорта в JSON.

### 4. [`tree_hierarchy.rs`](./src/tree_hierarchy.rs)
- **Назначение**: Алгоритмы сборки дерева компонентов из плоского списка путей.
- **Как работает**:
  - Нормализует пути относительно корня проекта.
  - Определяет тип компонента (Rust Module, Vue Component, TypeScript Service, FSD Slice).
  - Строит иерархические связи `children` и связывает каждый узел с родительским контекстом.

### 5. [`tree_metrics.rs`](./src/tree_metrics.rs)
- **Назначение**: Агрегация инженерных метрик по дереву.
- **Как работает**:
  - Рекурсивно обходит узлы снизу вверх (post-order traversal).
  - Суммирует физические строки кода (LOC) и чистый код (SLOC).
  - Рассчитывает интегральное архитектурное давление:
    $$S_{\text{arch}} = (N_{\text{functions}} \times 1.5) + (\text{Cyclomatic} \times 2.0) + (\text{MaxDepth} \times 3.0)$$
  - Помечает узлы с высоким риском регрессий.

### 6. [`sign_suppression.rs`](./src/sign_suppression.rs) — `SignSuppressionUseCase`
- **Назначение**: Криптографическое подписание подавления нарушения.
- **Алгоритм работы**:
  1. Принимает параметры: `rule_id`, `fingerprint`, `reason`, `author`, `expires_at`.
  2. Извлекает мастер-ключ HMAC-SHA256 из `StoragePort::get_master_key`.
  3. Формирует доменную запись `SuppressionRecord` и вычисляет криптографическую подпись `compute_signature`.
  4. Сохраняет запись в защищенный реестр через `StoragePort::save_suppression`.
  5. Возвращает сгенерированную сигнатуру подписи.

### 7. [`re_sign_all.rs`](./src/re_sign_all.rs) — `ReSignAllUseCase`
- **Назначение**: Безопасная ротация криптографических ключей реестра подавлений.
- **Алгоритм работы**:
  1. Считывает все записи из текущего `.cerberus/suppressions.lock`.
  2. Проверяет валидность каждой записи со старым мастер-ключом.
  3. Генерирует новые подписи HMAC-SHA256 с новым мастер-ключом.
  4. Атомарно перезаписывает реестр подавлений.

### 8. [`reconcile_baseline.rs`](./src/reconcile_baseline.rs) — `ReconcileBaselineUseCase`
- **Назначение**: Нормализация файла `cerberus-baseline.json` после мержа веток Git.
- **Алгоритм работы**:
  1. Читает содержимое файла через `BaselineStoragePort::read`.
  2. Функция `extract_unique_hashes` парсит все 64-значные шестнадцатеричные хэши (SHA-256).
  3. Удаляет дубликаты с помощью структуры `BTreeSet<String>` (обеспечивая детерминированный лексикографический порядок).
  4. Форматирует и сохраняет отсортированный JSON через `BaselineStoragePort::write`.
  5. Возвращает количество уникальных записей.

### 9. [`download_model.rs`](./src/download_model.rs) — `DownloadModelUseCase`
- **Назначение**: Управление жизненным циклом нейросетевых моделей.
- **Алгоритм работы**:
  1. Принимает целевой каталог кэша и `ModelDownloaderPort`.
  2. Скачивает файл весов `model.onnx` (CodeBERTa) и `tokenizer.json` из официального репозитория.
  3. Метод `status` проверяет наличие и размер файлов в каталоге кэша.
  4. Метод `clean` производит безопасную очистку кэшированных файлов.

---

## 🔗 Связи со слоями Domain, Ports и Infrastructure

```
┌────────────────────────────────────────────────────────┐
│                  cerberus-application                  │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
      (Использует типы)         (Вызывает методы)
               │                          │
┌──────────────▼───────────┐ ┌────────────▼──────────────┐
│      cerberus-domain     │ │      cerberus-ports       │
└──────────────────────────┘ └───────────────────────────┘
```
