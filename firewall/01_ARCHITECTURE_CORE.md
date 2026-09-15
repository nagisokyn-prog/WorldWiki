# 🦀 01. АРХИТЕКТУРА ЯДРА `cargo-arch-guard` (RUST CORE)

> **Назначение**: Автономный Rust CLI-инструмент для глубокого AST-анализа, топологической проверки архитектуры и Bounded Taint-to-Sink анализа (глубина $\le$ 3).

---

## 1. Стек и Зависимости Крейта

```toml
[package]
name = "cargo-arch-guard"
version = "0.1.0"
edition = "2021"

[dependencies]
# 1. Парсинг структуры и метаданных воркспейса
cargo_metadata = "0.18"
clap = { version = "4.4", features = ["derive", "env"] }

# 2. Быстрый AST-анализ синтаксиса Rust
syn = { version = "2.0", features = ["full", "visit", "extra-traits"] }
proc-macro2 = "1.0"
quote = "1.0"

# 3. Графы зависимостей и потоков данных (Taint)
petgraph = "0.6"

# 4. Безопасность и хранение ключей
keyring = "2.1"
sha2 = "0.10"
hmac = "0.12"
chrono = { version = "0.4", features = ["serde"] }

# 5. Высокопроизводительный параллелизм
rayon = "1.8"
walkdir = "2.4"

# 6. Сериализация и отчеты
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
toml = "0.8"
colored = "2.1"
```

---

## 2. Архитектура Модулей `cargo-arch-guard`

```
crates/cargo-arch-guard/src/
├── main.rs                  # CLI entrypoint, аргументы командной строки
├── config/                  # Загрузка rules.json и Cargo.toml в runtime
│   ├── mod.rs
│   ├── loader.rs            # Runtime-загрузка rules.json (путь --rules-path)
│   ├── rules.rs             # Модели и валидатор правил
│   └── preset.rs            # Встроенные пресеты (hexagonal, layered, hardened)
├── ast/                     # Движок обхода AST синтаксиса (syn)
│   ├── visitor.rs           # Архитектурный Visitor (сбор use, fn, struct, async)
│   ├── imports.rs           # Анализ запрещенных cross-crate импортов
│   ├── async_rules.rs       # Поиск MutexGuard через .await и зомби tokio::spawn
│   └── capabilities.rs      # Проверка прямого вызова std::env, std::net, std::process
├── taint/                   # Движок Bounded Taint-to-Sink Data-Flow анализа (depth <= 3)
│   ├── graph.rs             # Граф потока данных переменной
│   ├── sources.rs           # Детектор источников (tauri::command arguments)
│   ├── sanitizers.rs        # Белый список валидаторов и атрибутов #[arch_guard(sanitizes)]
│   └── sinks.rs             # Детектор опасных стоков (Command::new, fs::write)
├── metrics/                 # Математический аппарат связности
│   ├── martin.rs            # Расчет Ca, Ce, Instability (I), Abstractness (A), Distance (D)
│   └── pressure.rs          # Расчет Architectural Complexity Score (S_arch)
├── ledger/                  # Криптографический реестр исключений
│   ├── suppress.rs          # Парсер атрибутов #[arch_guard(suppress = ...)]
│   ├── storage.rs           # KeyStorage trait: KeychainStorage, FileStorage, MockStorage
│   └── hmac_validator.rs    # Валидация подписей в guardian-ledger.lock
└── report/                  # Форматирование вывода
    ├── console.rs           # Человекочитаемый красивый вывод с цветами
    ├── sarif.rs             # SARIF для интеграции с IDE и GitHub Code Scanning
    └── json.rs              # JSON для CI пайплайнов
```

---

## 3. Фундаментальный Контракт: Структура `Violation`

Все подсистемы (`cargo-arch-guard`, `sfc-guardian`, baseline, ledger, SARIF, JSON) работают со строго типизированной структурой:

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Category {
    Architecture, // Границы слоев (Domain, Application, Tauri)
    Security,     // Taint-to-Sink, Environment leaks, Capabilities
    Robustness,   // MutexGuard across .await, Panic surface, Zombie tasks
    Convention,   // SLOC, Dead code, Style, CSS
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Severity {
    Deny, // Блокирует компиляцию / CI (Exit 1)
    Warn, // Предупреждение
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Violation {
    pub rule_id: String,           // "ARCH-001", "SEC-001", "ASYNC-001"
    pub rule_version: String,      // "1.0" (для инвалидации хэша при ужесточении правил)
    pub category: Category,
    pub severity: Severity,
    pub file: PathBuf,             // Относительный путь (crates/domain/src/entity.rs)
    pub line: usize,               // 1-based (для подсветки в IDE)
    pub column: usize,
    pub symbol: String,            // Имя родительской функции/структуры
    pub snippet: String,           // Исходный фрагмент кода
    pub message: String,           // Человекочитаемое описание нарушения
    pub remediation: String,       // 💡 Четкий рецепт исправления для разработчика
    pub fingerprint: String,       // SHA-256 устойчивый хэш
}
```

---

## 4. Алгоритм Вычисления Стабильного Fingerprint

Хэш вычисляется от семантического контекста и версии правила, сохраняя стабильность при перемещении файла:

```rust
use sha2::{Sha256, Digest};

pub fn compute_fingerprint(
    rule_id: &str,
    rule_version: &str,
    symbol: &str,
    snippet: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(rule_id.as_bytes());
    hasher.update(b":");
    hasher.update(rule_version.as_bytes());
    hasher.update(b":");
    hasher.update(symbol.as_bytes());
    hasher.update(b":");
    // Нормализация сниппета: удаление пробелов, переносов строк и комментариев
    let normalized = snippet.split_whitespace().collect::<Vec<_>>().join(" ");
    hasher.update(normalized.as_bytes());
    format!("{:x}", hasher.finalize())
}
```

---

## 5. Bounded Taint-to-Sink Data-Flow Engine (Глубина $\le$ 3)

### 🎯 Семантические правила распространения Taint:
1. **Глубина Call-Graph**: анализ прослеживает аргументы максимум на **3 вызова вглубь** в рамках одного крейта.
2. **Структуры**: если хотя бы одно поле структуры помечено как `Tainted` $\implies$ вся структура считается `Tainted`.
3. **Коллекции**: если коллекция (`Vec`, `HashMap`) содержит `Tainted` элементы $\implies$ вся коллекция `Tainted`.
4. **Result / Option**: Taint передается на внутреннее значение `Ok(T)` / `Some(T)`.
5. **Примитивы**: парсинг в число (`u8..u64`, `i8..i64`, `f32/f64`) сбрасывает статус Tainted, если строка потреблена полностью и не конкатенируется обратно в шелл.
6. **Санитизаторы**:
   * ✅ Функция с явным атрибутом `#[arch_guard(sanitizes = "param_name")]`;
   * ✅ Белый список проверенных валидаторов: `validate_safe_path()`, `sanitize_filename()`;
   * ❌ `Path::canonicalize()` **НЕ ЯВЛЯЕТСЯ** санитизатором (из-за рисков TOCTOU и path traversal).

---

## 6. Детектор Scope-Aware `MutexGuard` через `.await`

### 🔍 Реализация и границы эвристики:
Поскольку `syn` анализирует синтаксис без полного вывода типов компилятора (`rustc`), детектор использует **Scope Stack** и эвристику инициализации:

1. **Отслеживание Scope**: вход в лексический блок `{ ... }` помещает новый вектор переменных в стек, выход из блока — удаляет (RAII-семантика).
2. **Эвристика инициализации**:
   * Поиск локальных связываний `let <ident> = <expr>.lock()` / `.read()` / `.write()`;
   * Игнорируются вызовы на объектах с префиксом `tokio_` или типами `tokio::sync::Mutex` (если импорт явно виден в файле);
   * Вызов `.await` внутри активного scope с удержанием `std::sync::MutexGuard` генерирует `ASYNC-001`.
   * *Ограничение*: удержание мьютекса через сторонние generic-обертки требует явного типа.

---

## 7. Обработка Ошибок Парсинга и Устойчивость

* Если `syn` встречает синтаксическую ошибку в файле:
  1. Ошибка логируется в отчет как `[PARSE-ERROR] <file>: <error>`;
  2. Файл исключается из проверки без падения процесса (`panic!`);
  3. **Пороги срабатывания**:
     * В **CI**: если повреждено $> 2\%$ от общего числа файлов воркспейса $\implies$ `Exit 1`;
     * В **Pre-commit**: порог предупреждения `5%`.

---

## 8. Области Анализа и Песочница `build.rs`

* **`src/**/*.rs`**: применяются все правила (`ARCH-*`, `SEC-*`, `ASYNC-*`, `POLICY-*`).
* **`tests/**/*.rs` и `#[cfg(test)]`**: правила архитектурной изоляции (`ARCH-*`) отключаются (разрешены моки и тестовые хелперы), но правила безопасности (`SEC-*`) продолжают действовать.
* **`build.rs` (Песочница компиляции)**:
  * ❌ Запрещен импорт `std::net::*`;
  * ❌ Запрещен импорт HTTP-клиентов (`reqwest`, `hyper`, `ureq`);
  * ❌ Запрещен вызов `Command::new` с утилитами скачивания (`curl`, `wget`, `nc`).
