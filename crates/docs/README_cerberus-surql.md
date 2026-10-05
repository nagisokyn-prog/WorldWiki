# 🔮 Cerberus Surql (`cerberus-surql`)

> **Высокопроизводительный AST-парсер, статический анализатор и линтер запросов SurrealDB v3.2+ для Rust и `.surql` схем.**

---

## 📑 Оглавление

1. [Архитектурное назначение](#1-архитектурное-назначение)
2. [Структура и компоненты крейта](#2-структура-и-компоненты-крейта)
3. [Двухпроходной парсер и система типов](#3-двухпроходной-парсер-и-система-типов)
4. [Анализ Rust-кода через AST-бридж](#4-анализ-rust-кода-через-ast-бридж)
5. [Полный реестр 26 правил Cerberus SURQL](#5-полный-реестр-26-правил-cerberus-surql)
6. [Конфигурация (`SurqlConfig`)](#6-конфигурация-surqlconfig)
7. [Метрики качества и покрытие тестами](#7-метрики-качества-и-покрытие-тестами)

---

## 1. Архитектурное назначение

Крейт `cerberus-surql` обеспечивает **100% автономный статический контроль** безопасности, производительности и реляционной чистоты запросов к графо-документной базе данных **SurrealDB v3.2+**. Анализ выполняется как для файлов схем/миграций (`.surql`), так и для встроенных строковых литералов и запросов в исходном коде Rust (`.rs`).

Ключевые преимущества:

- **Zero-Dependency Core**: Не зависит от тяжелого рантайма самого SurrealDB, что гарантирует мгновенный статический анализ тысяч строк кода за миллисекунды.
- **Двухпроходная сборка схемы**: Сначала собирается реестр таблиц, полей и индексов (`SchemaRegistry`), затем по нему валидируются все селекты, мутации и сортировки.
- **Глубокая защита от N+1 и деградации производительности**: Выявление скрытых сканирований таблиц, отсутствующих BM25 индексов в полнотекстовом поиске и раздувания ревизий тяжелыми векторами эмбеддингов.

---

## 2. Структура и компоненты крейта

```
crates/cerberus-surql/src/
├── ast/                        # 🧠 Лексер и модульный AST-парсер
│   ├── lexer.rs                # Разбиение на стейтменты с учетом кавычек, комментариев и блоков
│   ├── ddl_parser.rs           # Парсинг DEFINE TABLE / FIELD / INDEX / FUNCTION
│   ├── query_parser.rs         # Парсинг SELECT (поля, WHERE, GROUP BY, ORDER BY, LIMIT, подзапросы)
│   ├── mutation_parser.rs      # Парсинг UPDATE, CREATE, DELETE, RELATE, FOR loops
│   ├── dml_parser.rs           # Унифицированный фасад для DML выражений
│   ├── node.rs                 # Типизированные AST-узлы (Statement, TableDef, FieldDef, etc.)
│   ├── document.rs             # SurqlDocument с картой смещений строк и байтов
│   └── parser.rs               # Оркестратор парсинга исходного кода
├── schema/                     # 🏛️ Система типов и реестр схемы
│   ├── types.rs                # Алгебра типов SurqlType (Option, Array, Record, Union, Flexible)
│   ├── registry.rs             # SchemaRegistry (метаданные таблиц, индексов и полей)
│   └── collector.rs            # Сборщик схемы из AST-дерева DDL
├── bridge/                     # 🦀 Сканирование Rust AST
│   └── rust_scanner.rs         # Поиск format!, конкатенаций и сырых вызовов db.query()
├── rules/                      # 🛡️ 26 строгих инвариантов SurrealDB
│   ├── dml.rs                  # SURQL-001..006, 013..015 (Запросы и мутации)
│   ├── ddl.rs                  # SURQL-007..012 (Схемы и строгая типизация)
│   ├── storage.rs              # SURQL-016..019 (Хранение, FK, индексы)
│   ├── functions.rs            # SURQL-020, SURQL-026 (Хранимые функции fn::*)
│   ├── fts.rs                  # SURQL-021..025 (Полнотекстовый поиск BM25)
│   └── mod.rs                  # Трейт SurqlRule и фабрика правил
├── config.rs                   # Конфигурация порогов, исключений и паттернов
├── engine.rs                   # Движок аудита SurqlEngine
└── lib.rs                      # Публичный интерфейс библиотеки
```

---

## 3. Двухпроходной парсер и система типов

### 3.1. `SurqlType` (Алгебра типов SurrealDB)

Реализует парсинг и валидацию типовых конструкций:

- `SurqlType::Record(target)` — строгие внешние ключи `record<user>`.
- `SurqlType::Option(inner)` — опциональные поля.
- `SurqlType::Array(inner)` — типизированные списки.
- `SurqlType::Union(variants)` — объединения `bool | null`, `string | number`.
- `SurqlType::Flexible(inner)` — динамические объекты (разрешены только для `attributes`/`embeddings`).

Инспекторы типов выявляют критические дефекты:

- `is_nullable()`: проверка допустимости `null`.
- `is_bool_nullable_hazard()`: обнаружение опасной трехзначной логики SQL (`bool | null`).
- `is_collection()`: выявление `array<...>` и `set<...>`.

---

## 4. Анализ Rust-кода через AST-бридж

Модуль `bridge::rust_scanner::SurqlRustScanner` выполняет обход синтаксического дерева Rust (`syn::File`) и перехватывает:

1. **SQL-инъекции и строковую конкатенацию**: обнаружение вызовов `format!("SELECT * FROM {}", table)` или операторов бинарного сложения строк `sql + param`.
2. **Сырые литералы без параметризации**: извлечение запросов внутри `db.query("...")` и отправка их на полный аудит в `SurqlEngine`.
3. **Обнаружение антипаттернов**: применение `SURQL-001..026` к запросам, генерируемым непосредственно в Rust-адаптерах.

---

## 5. Полный реестр 26 правил Cerberus SURQL

| ID            | Категория       | Severity | Название правила                         | Описание инварианта                                                                                                 |
| ------------- | --------------- | -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **SURQL-001** | `Performance`   | **Deny** | Mutation Inside FOR Loop                 | Запрещены циклические мутации `CREATE/UPDATE/DELETE` внутри цикла `FOR`. Требуется пакетная вставка массивом.       |
| **SURQL-002** | `Performance`   | **Warn** | Unbounded SELECT * Query                 | Запрещен неконтролируемый `SELECT *` без `LIMIT` или точечного фильтра по первичному ключу.                         |
| **SURQL-003** | `Performance`   | **Deny** | SELECT * Inside Stored Function          | Запрещен возврат `SELECT *` из хранимых функций `fn::*`. Требуется явная проекция полей.                            |
| **SURQL-004** | `Performance`   | **Deny** | Unbounded Table Scan in Function         | Запрещены выборки без ограничения выборки (`LIMIT` / фильтрации) внутри функций `fn::*`.                            |
| **SURQL-005** | `Performance`   | **Deny** | Projection Subquery N+1                  | Запрещены скалярные подзапросы `SELECT (SELECT ... FROM ...)` в проекции, порождающие N+1 запросов.                 |
| **SURQL-006** | `DataIntegrity` | **Deny** | Multi-Mutation Block Without Transaction | Мутации 2+ сущностей подряд обязаны быть обернуты в `BEGIN TRANSACTION ... COMMIT TRANSACTION`.                     |
| **SURQL-007** | `DataIntegrity` | **Deny** | Schemaless Table Definition              | Все таблицы обязаны создаваться строго с ключевым словом `SCHEMAFULL`.                                              |
| **SURQL-008** | `Robustness`    | **Deny** | Non-Idempotent DDL Statement             | Все DDL-команды (`DEFINE TABLE/FIELD/INDEX/EVENT/ANALYZER`) обязаны содержать `OVERWRITE`.                          |
| **SURQL-009** | `DataIntegrity` | **Deny** | Nullable Relation Endpoints              | Поля `in` и `out` в реляционных таблицах (`TYPE RELATION`) запрещено делать опциональными/nullable.                 |
| **SURQL-010** | `Robustness`    | **Warn** | Three-Valued Boolean Field               | Поля типа `bool                                                                                                     | null`или`option<bool>`приводят к ошибкам трехзначной логики SQL. Требуется`TYPE bool DEFAULT false`. |
| **SURQL-011** | `DataIntegrity` | **Warn** | Nullable Collection Field                | Коллекции (`array`, `set`) запрещено делать `nullable`. При отсутствии элементов сохраняется пустой массив `[]`.    |
| **SURQL-012** | `Robustness`    | **Warn** | Naked option<T> JSON Null Hazard         | Использование `option<T>` без явного `VALUE $value OR ...` приводит к сериализации в `NONE` вместо `NULL`.          |
| **SURQL-013** | `DataIntegrity` | **Deny** | Scalar Aggregate Without GROUP BY        | Скалярные агрегаты (`count()`, `math::sum()`) в одном селекте с другими полями требуют явного `GROUP BY`.           |
| **SURQL-014** | `Performance`   | **Warn** | Subquery Array Indexing Scan             | Индексация `(SELECT ...)[0]` без сортировки и лимита загружает весь массив перед взятием элемента.                  |
| **SURQL-015** | `DataIntegrity` | **Deny** | Mass Mutation Without WHERE Clause       | Запрещены массовые `UPDATE` и `DELETE` без фильтра `WHERE` или явного целевого Record ID.                           |
| **SURQL-016** | `Performance`   | **Deny** | Heavy Type in Revision Table             | Запрещено сохранять эмбеддинги (`array<float>`, `vector`) в таблицы снимков/ревизий (`*_history`, `*_snapshot`).    |
| **SURQL-017** | `Performance`   | **Warn** | Unindexed Foreign Key Record Field       | Поля типа `record<target>` обязаны иметь покрывающий B-Tree индекс `FIELDS`.                                        |
| **SURQL-018** | `Performance`   | **Warn** | Unindexed ORDER BY Sort Field            | Сортировка `ORDER BY` по полям без покрывающего B-Tree индекса приводит к дорогой сортировке в памяти.              |
| **SURQL-019** | `Architecture`  | **Warn** | Array Contains Instead of Graph Edge     | Хранение связей через `array<record>` и поиск через `CONTAINS` уступает графовым связям `->relation->`.             |
| **SURQL-020** | `Robustness`    | **Deny** | Untyped Function Parameter               | Все аргументы хранимых функций `fn::*` обязаны иметь явную аннотацию типов `$param: type`.                          |
| **SURQL-021** | `Performance`   | **Warn** | Unranked Predicate FTS Search            | Полнотекстовый поиск `@1@` в `WHERE` обязан сопровождаться ранжированием `ORDER BY search::score(1) DESC`.          |
| **SURQL-022** | `Robustness`    | **Deny** | Dangling FTS Score Function              | Вызов `search::score(N)` без соответствующего предиката `@N@` в блоке `WHERE` приводит к ошибке выполнения.         |
| **SURQL-023** | `Performance`   | **Deny** | FTS Operator on Unindexed Field          | Использование операторов `@@` или `@N@` на полях без активного Full-Text индекса вызывает панику в рантайме.        |
| **SURQL-024** | `Performance`   | **Warn** | String Linear Scan on FTS Field          | Использование `string::lowercase(...) CONTAINS` на поле с FTS-индексом деградирует поиск до линейного сканирования. |
| **SURQL-025** | `Performance`   | **Warn** | Multiple FTS Indexes In OR Clause        | Предикаты `field1 @1@ $q OR field2 @2@ $q` вызывают разделение индекса. Требуется объединенный multi-field индекс.  |
| **SURQL-026** | `Robustness`    | **Warn** | Datetime Coerced to String               | Использование строк для дат нарушает хронологические запросы. Требуется нативный тип `datetime` / `time::now()`.    |

---

## 6. Конфигурация (`SurqlConfig`)

Поведение линтера настраивается через структуру `SurqlConfig` (или файл `cerberus.json`):

```json
{
  "surql": {
    "enabled": true,
    "max_subquery_depth": 3,
    "heavy_data": {
      "historical_table_patterns": [
        ".*_history$",
        ".*_revision$",
        ".*_snapshot$"
      ],
      "heavy_field_types": ["array<float>", "vector"],
      "exempt_tables": ["temp_vector_import"]
    },
    "fts": {
      "require_score_on_predicate": true,
      "max_or_clauses": 2
    }
  }
}
```

---

## 7. Метрики качества и покрытие тестами

- **Function Coverage**: **100.0%** (все 26 правил, парсеры, коллекторы схемы и AST-бридж).
- **Line & Region Coverage**: **> 96%**.
- **Clippy**: **0 предупреждений** при `--all-targets`.
