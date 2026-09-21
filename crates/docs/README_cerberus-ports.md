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

`cerberus-ports` определяет абстрактные интерфейсы (Rust-трейты), через которые ядро приложения ([`cerberus-application`](../cerberus-application/README_cerberus-application.md)) взаимодействует с внешним миром: файловой системой, синтаксическими парсерами, нейросетевыми ONNX-рантаймами, генераторами отчетов и хранилищами ключей.

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
├── scanner.rs        # 🔍 FileSystemScannerPort, ScannedSourceFile, ScanScope
├── parser.rs         # 🧩 AstParserPort & AstEnginePort (Парсинг Rust/Vue)
├── reporter.rs       # 📑 ReportPublisherPort (Генерация отчетов)
├── storage.rs        # 💾 KeyStoragePort, BaselineStoragePort, RulesRepositoryPort
├── embedder.rs       # 🧠 VectorEmbedderPort (Векторизация сниппетов кода)
├── clusterer.rs      # 📊 ClustererPort (Кластеризация векторов DBSCAN)
├── downloader.rs     # ⬇️ ModelDownloaderPort (Загрузка весов моделей по сети)
└── manifest.rs       # 📦 ManifestParserPort (Анализ Cargo.toml / package.json)
```

---

## 📋 Контракты портов и сигнатуры методов

### 1. [`scanner.rs`](./src/scanner.rs) — `FileSystemScannerPort`
- **Назначение**: Абстракция рекурсивного обнаружения файлов в рабочей директории с учетом `.gitignore` и фильтрации `ScanScope`.
- **Сигнатура**:
  ```rust
  pub trait FileSystemScannerPort: Send + Sync {
      fn scan_workspace(&self, root: &Path, scope: &ScanScope) -> Result<Vec<ScannedSourceFile>, String>;
  }
  ```

### 2. [`parser.rs`](./src/parser.rs) — `AstParserPort` & `AstEnginePort`
- **Назначение**: Абстракция синтаксического разбора файлов и параллельного пакетного анализа.
- **Сигнатура**:
  ```rust
  pub trait AstParserPort: Send + Sync {
      fn can_parse(&self, path: &Path) -> bool;
      fn parse_file(&self, path: &Path, crate_name: &str) -> Result<Vec<Violation>, String>;
  }

  pub trait AstEnginePort: Send + Sync {
      fn parse_batch(&self, files: &[ScannedSourceFile]) -> (Vec<Violation>, Vec<String>);
  }
  ```

### 3. [`reporter.rs`](./src/reporter.rs) — `ReportPublisherPort`
- **Назначение**: Абстракция форматирования и публикации отчетов анализатора.
- **Сигнатура**:
  ```rust
  pub trait ReportPublisherPort {
      fn publish(&self, violations: &[Violation]) -> Result<(), String>;
  }
  ```

### 4. [`storage.rs`](./src/storage.rs) — `KeyStoragePort`, `BaselineStoragePort`, `RulesRepositoryPort`
- **Назначение**: Абстракция долговременного хранения данных.
- **Сигнатуры**:
  ```rust
  // Хранилище криптографических записей подавлений и ключей
  pub trait KeyStoragePort: Send + Sync {
      fn load_suppressions(&self) -> Result<Vec<SuppressionRecord>, String>;
      fn save_suppression(&self, record: &SuppressionRecord) -> Result<(), String>;
      fn get_master_key(&self) -> Result<Vec<u8>, String>;
  }

  // Хранилище baseline-хэшей
  pub trait BaselineStoragePort: Send + Sync {
      fn read_baseline(&self, path: &Path) -> Result<Option<String>, String>;
      fn write_baseline(&self, path: &Path, content: &str) -> Result<(), String>;
  }

  // Репозиторий правил конфигурации
  pub trait RulesRepositoryPort: Send + Sync {
      fn get_rule(&self, id: &str) -> Option<Rule>;
      fn get_effective_severity(&self, id: &str) -> Severity;
      fn is_enabled(&self, id: &str) -> bool;
  }
  ```

### 5. [`embedder.rs`](./src/embedder.rs) — `VectorEmbedderPort`
- **Назначение**: Абстракция векторизатора исходного кода.
- **Сигнатура**:
  ```rust
  pub trait VectorEmbedderPort: Send + Sync {
      fn embed(&self, text: &str) -> Result<Vec<f32>, String>;
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

- Использует типы из [`cerberus-domain`](../cerberus-domain/README_cerberus-domain.md) (`Rule`, `Violation`, `Severity`, `SuppressionRecord`, `ComponentNode`).
- Предоставляет интерфейсы для [`cerberus-application`](../cerberus-application/README_cerberus-application.md).
- Реализуется в [`cerberus-infrastructure`](../cerberus-infrastructure/README_cerberus-infrastructure.md).
