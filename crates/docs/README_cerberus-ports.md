# 🔌 Crate: `cerberus-ports`

> **Интерфейсный слой портов гексагональной архитектуры Cerberus.**

---

## 📑 Содержание

1. [Назначение крейта](#-назначение-крейта)
2. [Архитектурная роль (Ports Layer)](#-архитектурная-роль-ports-layer)
3. [Пофайловая структура и ответственность интерфейсов](#-пофайловая-структура-и-ответственность-интерфейсов)
4. [Контракты портов и сигнатуры методов](#-контракты-портов-и-сигнатуры-методов)
5. [Связи в гексагональной структуре](#-связи-в-гексагональной-структуре)

---

## 🌟 Назначение крейта

`cerberus-ports` определяет абстрактные интерфейсы (Rust-трейты), через которые ядро приложения ([`cerberus-application`](../cerberus-application/README.md)) взаимодействует с внешним миром: файловой системой, синтаксическими парсерами, нейросетевыми ONNX-рантаймами, генераторами отчетов и хранилищами ключей.

---

## 🏛️ Архитектурная роль (Ports Layer)

Слой портов гарантирует **Принцип инверсии зависимостей (Dependency Inversion Principle)**:
- Слой бизнес-логики (`cerberus-application`) зависит от стабильных абстракций в `cerberus-ports`.
- Слой инфраструктуры (`cerberus-infrastructure`) реализует трейты из `cerberus-ports`.
- В `cerberus-ports` **НЕТ** реализаций, зависимостей от конкретных библиотек или прямого ввода-вывода.

```
cerberus-application ──(зависит от трейтов)──► cerberus-ports ◄──(реализует)── cerberus-infrastructure
```

---

## 📁 Пофайловая структура и ответственность интерфейсов

```
crates/cerberus-ports/src/
├── lib.rs            # 📚 Корневой модуль, реэкспорт всех трейтов портов
├── scanner.rs        # 🔍 SourceScannerPort (Обход файловой системы)
├── parser.rs         # 🧩 FileParserPort & AstParserPort (Парсинг Rust/Vue)
├── reporter.rs       # 📑 ReporterPort & TreeReporterPort (Генерация отчетов)
├── storage.rs        # 💾 StoragePort, BaselineStoragePort, RulesRepositoryPort
├── embedder.rs       # 🧠 CodeEmbedderPort (Векторизация сниппетов кода)
├── clusterer.rs      # 📊 ClustererPort (Кластеризация векторов DBSCAN)
├── downloader.rs     # ⬇️ ModelDownloaderPort (Загрузка весов моделей по сети)
└── manifest.rs       # 📦 ManifestParserPort (Анализ Cargo.toml / package.json)
```

---

## 📋 Контракты портов и сигнатуры методов

### 1. [`scanner.rs`](./src/scanner.rs) — `SourceScannerPort`
- **Назначение**: Абстракция рекурсивного обнаружения файлов в рабочей директории.
- **Сигнатура**:
  ```rust
  pub trait SourceScannerPort: Send + Sync {
      fn scan_files(&self, root: &Path) -> Result<Vec<PathBuf>, String>;
  }
  ```

### 2. [`parser.rs`](./src/parser.rs) — `FileParserPort` & `AstParserPort`
- **Назначение**: Абстракция синтаксического разбора файлов и извлечения нарушений/метрик.
- **Сигнатура**:
  ```rust
  pub trait FileParserPort: Send + Sync {
      fn parse_and_validate(
          &self,
          file_path: &Path,
          rules_repo: &dyn RulesRepositoryPort,
      ) -> Result<Vec<Violation>, String>;
  }
  ```

### 3. [`reporter.rs`](./src/reporter.rs) — `ReporterPort` & `TreeReporterPort`
- **Назначение**: Абстракция форматирования и публикации отчетов анализатора.
- **Сигнатура**:
  ```rust
  pub trait ReporterPort {
      fn report(&self, violations: &[Violation]) -> Result<(), String>;
  }

  pub trait TreeReporterPort {
      fn render_tree(&self, root: &ComponentNode) -> Result<String, String>;
  }
  ```

### 4. [`storage.rs`](./src/storage.rs) — `StoragePort`, `BaselineStoragePort`, `RulesRepositoryPort`
- **Назначение**: Абстракция долговременного хранения данных.
- **Сигнатуры**:
  ```rust
  // Хранилище криптографических записей подавлений
  pub trait StoragePort: Send + Sync {
      fn load_suppressions(&self) -> Result<Vec<SuppressionRecord>, String>;
      fn save_suppression(&self, record: &SuppressionRecord) -> Result<(), String>;
      fn get_master_key(&self) -> Result<Vec<u8>, String>;
  }

  // Хранилище baseline-хэшей
  pub trait BaselineStoragePort: Send + Sync {
      fn read(&self, path: &Path) -> Result<Option<String>, String>;
      fn write(&self, path: &Path, content: &str) -> Result<(), String>;
  }

  // Репозиторий правил конфигурации
  pub trait RulesRepositoryPort: Send + Sync {
      fn get_rule(&self, id: &str) -> Option<Rule>;
      fn get_effective_severity(&self, id: &str) -> Severity;
      fn is_enabled(&self, id: &str) -> bool;
  }
  ```

### 5. [`embedder.rs`](./src/embedder.rs) — `CodeEmbedderPort`
- **Назначение**: Абстракция векторизатора исходного кода.
- **Сигнатура**:
  ```rust
  pub trait CodeEmbedderPort: Send + Sync {
      fn embed_batch(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, String>;
  }
  ```

### 6. [`clusterer.rs`](./src/clusterer.rs) — `ClustererPort`
- **Назначение**: Абстракция алгоритма группировки векторов нарушений.
- **Сигнатура**:
  ```rust
  pub trait ClustererPort: Send + Sync {
      fn cluster_embeddings(
          &self,
          embeddings: &[Vec<f32>],
          violations: &[Violation],
      ) -> Result<Vec<ViolationCluster>, String>;
  }
  ```

### 7. [`downloader.rs`](./src/downloader.rs) — `ModelDownloaderPort`
- **Назначение**: Абстракция загрузчика файлов из сети (позволяет мокать сетевые операции в юнит-тестах).
- **Сигнатура**:
  ```rust
  pub trait ModelDownloaderPort: Send + Sync {
      fn download_file(&self, url: &str, dest_path: &Path) -> Result<(), String>;
  }
  ```

### 8. [`manifest.rs`](./src/manifest.rs) — `ManifestParserPort`
- **Назначение**: Абстракция парсера файлов конфигурации пакетов.
- **Сигнатура**:
  ```rust
  pub trait ManifestParserPort: Send + Sync {
      fn analyze_manifest(&self, manifest_path: &Path) -> Result<Vec<Violation>, String>;
  }
  ```

---

## 🔗 Связи в гексагональной структуре

- Использует типы из [`cerberus-domain`](../cerberus-domain/README.md) (`Rule`, `Violation`, `Severity`, `SuppressionRecord`, `ComponentNode`).
- Предоставляет интерфейсы для [`cerberus-application`](../cerberus-application/README.md).
- Реализуется в [`cerberus-infrastructure`](../cerberus-infrastructure/README.md).
