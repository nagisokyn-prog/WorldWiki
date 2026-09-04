# tauri-surreal-kit/backend — Документация папки

> **Назначение**: Переиспользуемая библиотека (kit) для построения Tauri + SurrealDB приложений. Состоит из трёх crate'ов: `surreal_domain` (core + macros + facade) и `tauri_shell` (шаблон приложения).

---

## 📁 Структура папки

```
tauri-surreal-kit/backend/
├── surreal_domain/
│   ├── Cargo.toml                    # Workspace для surreal_domain
│   ├── surreal_domain_core/          # Core трейты и DTO
│   │   ├── Cargo.toml
│   │   └── src/lib.rs                # SurrealDb, SurrealRepository, SearchResult, GraphEdge, ...
│   ├── surreal_domain_macros/        # Proc-макросы кодогенерации
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs                # Экспорт макросов
│   │       ├── entity.rs             # surreal_entity! — генерация структур, CRUD, команд
│   │       ├── relation.rs           # surreal_relation! — генерация ребер, CRUD, команд
│   │       ├── schema.rs             # surreal_schema! — регистрация для кодогенерации
│   │       └── entity_commands.rs    # entity_commands! — сборка tauri::generate_handler!
│   └── surreal_domain_facade/        # Реэкспорт core + macros
│       ├── Cargo.toml
│       └── src/lib.rs                # pub use surreal_domain_core::*; pub use surreal_domain_macros::*;
│
└── tauri_shell/                      # Domain-agnostic Tauri template
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    └── src/
        ├── main.rs                   # Bootstrap, init_database, регистрация системных команд
        ├── lib.rs                    # pub mod logic
        └── logic/
            ├── mod.rs                # pub mod performance; pub mod system;
            ├── system.rs             # Файловая система, настройки, темы, окно, производительность
            └── performance.rs        # Бенчмарк CPU/памяти, адаптивный CSS
```

---

## 📄 Описание каждого crate/файла

### surreal_domain_core (`surreal_domain/surreal_domain_core/src/lib.rs`)

**Назначение**: Фундаментальные трейты и DTO, независимые от макросов. Используются и макросами, и пользовательским кодом.

**Экспорты**:

| Элемент             | Тип    | Описание                                                                              |
| ------------------- | ------ | ------------------------------------------------------------------------------------- |
| `SurrealDb`         | Trait  | Трейт, который должен реализовать `AppState` пользователя для доступа к `Surreal<Db>` |
| `SurrealRepository` | Trait  | CRUD трейт, реализуется макросом `surreal_entity!` для каждой сущности                |
| `SearchKind`        | Enum   | `Fulltext \| Vector \| Hybrid` — вид поиска                                           |
| `SearchResult<T>`   | Struct | Результат поиска: `entity`, `score`, `kind`                                           |
| `SimilarResult<T>`  | Struct | Результат векторного поиска: `entity`, `similarity`                                   |
| `EdgeDirection`     | Enum   | `Outgoing \| Incoming \| Both` — направление ребра                                    |
| `GraphEdge<E, T>`   | Struct | Ребро графа: `edge_id`, `edge_data`, `node`, `direction`                              |
| `GraphNeighborhood` | Struct | Окрестность графа: `center_id`, `nodes[]`, `edges[]`, `depth`                         |
| `ChapterRange`      | Struct | Диапазон глав: `start_chapter`, `end_chapter`                                         |

**SurrealDb trait**:

```rust
pub trait SurrealDb: Send + Sync + 'static {
    type Connection: surrealdb::Connection;
    fn surreal_db(&self) -> &surrealdb::Surreal<Self::Connection>;
}
```

**SurrealRepository trait** — предоставляет дефолтную реализацию:

- `create()` — INSERT с биндингами параметров, поддержка RecordId
- `find_by_id()` — SELECT по ID
- `find_all()` — SELECT с фильтром по `project_id` (3 варианта формата)
- `save()` — UPSERT с нормализацией полей
- `delete()` — DELETE по ID

---

### surreal_domain_macros (`surreal_domain/surreal_domain_macros/src/`)

#### `lib.rs` — Точка входа макросов

Экспортирует 4 proc-макроса:

- `surreal_entity!` → `entity::impl_surreal_entity`
- `surreal_relation!` → `relation::impl_surreal_relation`
- `surreal_schema!` → `schema::impl_surreal_schema`
- `entity_commands!` → `entity_commands::impl_entity_commands`

#### `entity.rs` — `surreal_entity!` макрос

**Назначение**: Генерация структуры сущности + CRUD + Tauri-команд + TS типов.

**Атрибуты структуры**:
| Атрибут | Описание |
|---------|----------|
| `#[table = "name"]` | Имя таблицы (по умолчанию lowercase имени структуры) |
| `#[project_scoped]` | Маркер (не используется в коде, для семантики) |
| `#[tauri_commands]` | Включает генерацию Tauri-команд |

**Атрибуты полей**:
| Атрибут | Описание |
|---------|----------|
| `#[fulltext]` | Поле добавляется в полнотекстовый поиск |
| `#[hnsw]` | Поле добавляется в векторный поиск (HNSW) |
| `#[flexible]` | Тип в TS = `any`, поле пропускается при сериализации null |

**Генерирует**:

1. **Struct** с полями + `id`, `project_id`, `serde`/`ts_rs` деривами
2. **Impl блок** с `TABLE` константой + `search_fulltext` / `search_similar` методы (если есть атрибуты)
3. **SurrealRepository impl** — дефолтный CRUD через trait
4. **Модуль `{Name}_commands`** (если `#[tauri_commands]`) с командами:
   - `get_{name}s(project, state)` → `find_all`
   - `get_{name}(id, state)` → `find_by_id`
   - `save_{name}(data, state)` → десериализация + `save` + нормализация RecordId
   - `delete_{name}(id, state)` → `delete`
   - `search_{name}s(project, query, state)` → `search_fulltext` (если `#[fulltext]`)

**Нормализация RecordId в save\_**: Преобразует `{"tb": "...", "id": "..."}` объекты в строки `"table:id"`, массивы рекурсивно.

#### `relation.rs` — `surreal_relation!` макрос

**Назначение**: Генерация структуры ребра (edge) + графовые методы + Tauri-команд.

**Атрибуты структуры**:
| Атрибут | Описание |
|---------|----------|
| `#[edge = "name"]` | Имя таблицы ребра (по умолчанию lowercase) |
| `#[from = Type]` | Исходная таблица (по умолчанию `entities`) |
| `#[to = Type]` | Целевая таблица (по умолчанию `entities`) |
| `#[project_scoped]` | Маркер |
| `#[tauri_commands]` | Включает генерацию команд |

**Генерирует**:

1. **Struct** с полями + `id`, `in`, `out`, `project_id`
2. **Impl блок** с константами `TABLE`, `FROM`, `TO` + методами:
   - `relate(db, from_id, to_id, data)` — `RELATE from->TABLE->to CONTENT data`
   - `find_between(db, from_id, to_id)` — SELECT по in/out
   - `find_all(db, project_id)` — все ребра проекта
   - `delete(db, edge_id)` — DELETE
3. **Модуль `{Name}_commands`** (если `#[tauri_commands]`) с командами:
   - `get_{name}s(from_id, to_id, state)` → `find_between`
   - `create_{name}(from_id, to_id, data, state)` → `relate`
   - `delete_{name}(id, state)` → `delete`

#### `schema.rs` — `surreal_schema!` макрос

**Назначение**: Регистрация списка сущностей и релей для кодогенерации (используется в `models.rs` для экспорта TS типов).

**Синтаксис**:

```rust
surreal_schema! {
    entities: [Type1, Type2, ...],
    relations: [Rel1, Rel2, ...]
}
```

Расширяется в пустой `TokenStream` (нет кодогенерации в рантайме), используется только для `ts_rs` экспорта в тестах.

#### `entity_commands.rs` — `entity_commands!` макрос

**Назначение**: Сборка `tauri::generate_handler!` из списка команд и генерируемых модулей.

**Синтаксис**:

```rust
entity_commands![
    // Обычные и модульные команды (поддерживаются полные пути `path::to::cmd`)
    cmd1, 
    my_module::cmd2,
    worldwiki_tauri::commands::ai_query_world,

    // Автогенерация для сущностей (CRUD)
    @entities: [Chapter, Volume, Arc, Plan, Tag, Calendar, PlotPromise],

    // Автогенерация для поисковых сущностей (CRUD + search)
    @searchable: [TextBlock, ChatMessage, AgentMemory, WebCache, DictionaryWord],

    // Автогенерация для релей (get, create, delete)
    @relations: [Cites]
]
```

**Парсинг**:

- Идентификаторы и пути модулей (`syn::Path`) без `@` → `normal_commands`
- `@entities: [...]` → генерирует 4 команды на тип (`get_<plural>`, `get_<item>`, `save_<item>`, `delete_<item>`)
- `@searchable: [...]` → 5 команд (4 CRUD + `search_<plural>`)
- `@relations: [...]` → 3 команды (`get_<plural>`, `create_<singular>`, `delete_<singular>`)

**Результат**: `tauri::generate_handler![...]` со всеми функциями и путями.

---

### surreal_domain_facade (`surreal_domain/surreal_domain_facade/src/lib.rs`)

**Назначение**: Единая точка реэкспорта для пользователей kit'а.

```rust
pub use surreal_domain_core::*;
pub use surreal_domain_macros::*;
```

Позволяет писать `use surreal_domain::*;` вместо импорта из двух crate'ов.

---

### tauri_shell (`tauri_shell/src/`)

#### `main.rs` — Bootstrap шаблона

**Назначение**: Демонстрационный/шаблонный `main.rs` для новых проектов на базе kit'а.

**Ключевые элементы**:

- `AppState { db: Surreal<Db> }` + `impl SurrealDb for AppState`
- `init_database(ns, db)` — параметризованная инициализация (namespace, database name)
- `main()` — регистрация **системных команд** через `entity_commands!`:
  - Файловая система: `upload_photo`, `copy_background_file`, `get_local_file`
  - Производительность: `run_performance_benchmark`, `get_performance_styles`
  - Настройки: `save_settings`, `load_settings`
  - Окно: `toggle_fullscreen`
  - Темы: `get_custom_themes`, `load_theme`, `save_custom_theme`
- Комментарии с инструкцией: заменить `"my_app"` на свой namespace, добавить доменные команды

#### `lib.rs` — Реэкспорт logic

```rust
pub mod logic;
```

#### `logic/mod.rs` — Реэкспорт подмодулей

```rust
pub mod performance;
pub mod system;
```

#### `logic/system.rs` — Системные Tauri-команды

**Назначение**: Доменно-независимые утилиты для любого Tauri+SurrealDB приложения.

**Команды — Файловая система**:
| Команда | Описание |
|---------|----------|
| `upload_photo(bytes, filename)` | Сохранение в `data/user_images/{timestamp}_{filename}` |
| `copy_background_file(source_path)` | Копирование в `data/user_images/` с timestamp |
| `get_local_file(path)` | Чтение файла → `Vec<u8>` (для сервировки картинок в webview) |

**Команды — Производительность**:
| Команда | Описание |
|---------|----------|
| `run_performance_benchmark()` → `PerformanceInfo` | CPU (DOM-like), Memory (20MB alloc), Cores |
| `get_performance_styles(level)` → `String` | CSS overrides для Low/Medium/High |

**Команды — Настройки**:
| Команда | Описание |
|---------|----------|
| `save_settings(Value)` | Запись в `data/settings.json` |
| `load_settings()` → `Value` | Чтение из `data/settings.json` или `Null` |

**Команды — Окно**:
| Команда | Описание |
|---------|----------|
| `toggle_fullscreen(window)` | Переключение полноэкранного режима |

**Команды — Темы**:
| Команда | Описание |
|---------|----------|
| `get_custom_themes()` → `Vec<String>` | Сканирует `data/settings-*.json`, `data/settings-theme-*.json` |
| `load_theme(name)` → `Value` | Загружает `settings-{name}.json` или `settings-theme-{name}.json` |
| `save_custom_theme(name, Value)` | Сохраняет в `data/settings-theme-{name}.json` |

**Хелпер**: `get_data_dir()` — определяет папку `data/` (dev: от `target/`, prod: `cwd/data/`)

#### `logic/performance.rs` — Бенчмарк и адаптивный CSS

**Назначение**: Измерение производительности устройства и генерация CSS для деградации UI.

**Структуры**:

```rust
enum PerformanceLevel { Low, Medium, High }

struct PerformanceInfo {
    level: String,
    cpu_score: u64,      // ms для 100k DOM-like ops
    memory_mb: u64,      // ms для 20MB alloc+touch
    cores: usize,
}
```

**Алгоритм классификации**:
| Уровень | CPU < | Memory < | Cores ≥ |
|---------|-------|----------|---------|
| High | 150ms | 300ms | 8 |
| Medium | 400ms | 600ms | 4 |
| Low | — | — | — |

**CSS overrides**:

- **Low**: отключает `backdrop-filter`, `transition`, `hover transform`, glow-эффекты
- **Medium**: `backdrop-filter: blur(10px)`, `opacity: 0.3` для glow
- **High**: пустая строка (полные эффекты)

---

## 🔗 Mermaid: Crate Dependency Graph

```mermaid
flowchart TD
    subgraph SurrealDomain["surreal_domain workspace"]
        Core["surreal_domain_core"]
        Macros["surreal_domain_macros"]
        Facade["surreal_domain_facade"]
    end

    subgraph TauriShell["tauri_shell"]
        ShellMain["main.rs"]
        ShellLogic["logic/system.rs, performance.rs"]
    end

    subgraph UserApp["User Application (например, src-tauri)"]
        UserMain["main.rs"]
        UserModels["models.rs"]
        UserLogic["logic/*.rs"]
    end

    Core -->|"trait SurrealRepository / DTO types"| Macros
    Macros -->|"uses SurrealDb, SurrealRepository"| Core
    Facade -->|"re-export"| Core
    Facade -->|"re-export"| Macros

    ShellMain -->|"use surreal_domain::*"| Facade
    ShellLogic -->|"use surreal_domain::SurrealDb"| Facade

    UserMain -->|"use surreal_domain::*"| Facade
    UserModels -->|"surreal_entity!, surreal_relation!"| Facade
    UserLogic -->|"uses SurrealDb trait"| Facade

    Macros -.->|"proc-macro expansion at compile time"| UserModels
    Macros -.->|"entity_commands! at compile time"| UserMain
```

---

## 🔄 Mermaid: DFD (Data Flow Diagram) — Code Generation

```mermaid
flowchart TD
    subgraph CompileTime["Compile Time - Proc Macros"]
        UserCode["User Code / models.rs"]
        EntityMacro["surreal_entity!"]
        RelationMacro["surreal_relation!"]
        SchemaMacro["surreal_schema!"]
        CommandsMacro["entity_commands!"]
    end

    subgraph Generated["Generated Code"]
        Structs["Struct Definitions (+ serde/TS derives)"]
        RepoImpl["SurrealRepository Impl (CRUD methods)"]
        SearchMethods["search_fulltext / search_similar"]
        CommandMods["Command Modules (get_*, save_*, delete_*)"]
        Handler["tauri::generate_handler!"]
    end

    subgraph Runtime["Runtime"]
        TauriApp["Tauri App"]
        SurrealDB[("SurrealDB")]
        Frontend["Frontend TS"]
    end

    UserCode --> EntityMacro
    UserCode --> RelationMacro
    UserCode --> SchemaMacro
    UserCode --> CommandsMacro

    EntityMacro --> Structs
    EntityMacro --> RepoImpl
    EntityMacro --> SearchMethods
    EntityMacro --> CommandMods

    RelationMacro --> Structs
    RelationMacro --> RepoImpl
    RelationMacro --> CommandMods

    SchemaMacro -->|"registers for TS export"| Structs

    CommandsMacro -->|"collects"| CommandMods
    CommandsMacro -->|"generates"| Handler

    Handler -->|"registered in main"| TauriApp
    TauriApp -->|"queries"| SurrealDB
    TauriApp -->|"invoke/response"| Frontend

    Frontend -.->|"TS types via ts_rs"| Structs
```

---

## 🏗 Mermaid: Class/Function Interaction Diagrams

### surreal_domain_macros/entity.rs — Генерация сущности

```mermaid
classDiagram
    class SurrealEntityMacro {
        <<proc-macro>>
        +impl_surreal_entity(ast) TokenStream
    }

    class InputAST {
        +ident: Ident
        +attrs: Vec~Attribute~
        +data: Data
        +generics: Generics
    }

    class ParsedAttrs {
        +table_name: String
        +is_project_scoped: bool
        +generate_commands: bool
        +field_idents: Vec<String>
        +fulltext_fields: Vec<String>
        +vector_fields: Vec<String>
    }

    class GeneratedOutput {
        +struct_def: TokenStream
        +impl_block: TokenStream
        +repo_impl: TokenStream
        +commands_mod: TokenStream
        +search_methods: TokenStream
    }

    SurrealEntityMacro --> InputAST : parse
    InputAST --> ParsedAttrs : extract attrs
    ParsedAttrs --> GeneratedOutput : build quote!
    GeneratedOutput --> TokenStream : expanded.into()

    note for SurrealEntityMacro "2 passes over fields:\n1. collect idents, strip attrs\n2. collect fulltext/hnsw"
    note for ParsedAttrs "fulltext_fields → search_fulltext()\nvector_fields → search_similar()"
    note for GeneratedOutput "Commands mod only if\ngenerate_commands=true"
```

---

### surreal_domain_macros/entity_commands.rs — Сборка handler'а

```mermaid
classDiagram
    class EntityCommandsMacro {
        <<proc-macro>>
        +impl_entity_commands(input) TokenStream
    }

    class CommandList {
        +normal_commands: Vec~Ident~
        +entities: Vec~Ident~
        +searchable: Vec~Ident~
        +relations: Vec~Ident~
    }

    class Parser {
        +parse(input) CommandList
    }

    class GeneratedCalls {
        +normal: Vec~TokenStream~
        +from_entities: Vec~TokenStream~
        +from_searchable: Vec~TokenStream~
        +from_relations: Vec~TokenStream~
    }

    class HandlerOutput {
        +tauri::generate_handler![...]
    }

    EntityCommandsMacro --> Parser : parse_macro_input!
    Parser --> CommandList : struct CommandList
    CommandList --> GeneratedCalls : iterate & build idents
    GeneratedCalls --> HandlerOutput : quote! generate_handler!
    HandlerOutput --> TokenStream : expanded.into()

    note for CommandList "@entities → 4 cmds each\n@searchable → 5 cmds each\n@relations → 3 cmds each"
    note for GeneratedCalls "Mod name: {Type}_commands\nFn names: get_{plural}, get_{singular},\nsave_{singular}, delete_{singular},\nsearch_{plural} (for searchable)"
```

---

### tauri_shell/logic/system.rs — Системные команды

```mermaid
classDiagram
    class SystemCommands {
        +upload_photo(bytes, filename) String
        +copy_background_file(source) String
        +get_local_file(path) Vec~u8~
        +run_performance_benchmark() PerformanceInfo
        +get_performance_styles(level) String
        +save_settings(Value) ()
        +load_settings() Value
        +toggle_fullscreen(window) ()
        +get_custom_themes() Vec~String~
        +load_theme(name) Value
        +save_custom_theme(name, Value) ()
    }

    class DataDirHelper {
        +get_data_dir() PathBuf
    }

    class FileSystem {
        +create_dir_all()
        +write()
        +read()
        +copy()
        +read_dir()
    }

    class TauriWindow {
        +is_fullscreen() bool
        +set_fullscreen(bool)
    }

    SystemCommands --> DataDirHelper : uses
    SystemCommands --> FileSystem : uses
    SystemCommands --> TauriWindow : uses
    DataDirHelper --> std::env : current_exe/current_dir

    note for DataDirHelper "Dev: target/debug → target → root/data\nProd: cwd/data"
    note for SystemCommands "All #[tauri::command]\nasync except toggle_fullscreen"
```

---

### tauri_shell/logic/performance.rs — Бенчмарк

```mermaid
classDiagram
    class PerformanceLevel {
        <<enumeration>>
        Low
        Medium
        High
        +as_str() &str
    }

    class PerformanceInfo {
        +level: String
        +cpu_score: u64
        +memory_mb: u64
        +cores: usize
    }

    class BenchmarkRunner {
        +run_benchmark() PerformanceInfo
        +get_performance_css(level) String
    }

    BenchmarkRunner --> PerformanceInfo : creates
    BenchmarkRunner --> PerformanceLevel : classifies
    PerformanceInfo --> PerformanceLevel : level field

    note for BenchmarkRunner "CPU test: 100k sin/cos + String alloc\nMem test: 20MB alloc + touch\nCores: available_parallelism()"
    note for get_performance_css "Low: no backdrop-filter, no transitions\nMedium: blur(10px), glow opacity 0.3\nHigh: empty string"
```

---

## 🔁 Mermaid: Sequence Diagrams — Ключевые флоу

### Инициализация приложения на базе kit'а

```mermaid
sequenceDiagram
    actor Dev
    participant Shell as tauri_shell/main.rs
    participant Facade as surreal_domain_facade
    participant Core as surreal_domain_core
    participant DB as SurrealDB

    Dev->>Shell: cargo run (или копирует template)
    Shell->>Facade: use surreal_domain::*
    Shell->>Core: impl SurrealDb for AppState
    Shell->>Shell: init_database("my_app", "my_app")
    Shell->>DB: Surreal::new(SurrealKv)
    DB-->>Shell: Connection
    Shell->>DB: use_ns/use_db
    Shell->>DB: query(DDL) -- опционально
    Shell->>Shell: entity_commands![system_cmds...]
    Shell->>Facade: entity_commands! macro expands
    Facade-->>Shell: tauri::generate_handler![...]
    Shell->>Tauri: .invoke_handler(handler)
    Tauri-->>Dev: App running
```

---

### Кодогенерация сущности пользователем

```mermaid
sequenceDiagram
    actor Dev
    participant Models as models.rs
    participant Macro as surreal_entity!
    participant Core as surreal_domain_core
    participant TS as ts_rs export

    Dev->>Models: struct MyEntity { ... }
    Dev->>Models: surreal_entity! { #[table="x"] #[tauri_commands] pub struct MyEntity {...} }
    Models->>Macro: proc-macro invocation
    Macro->>Core: uses SurrealRepository trait
    Macro->>Macro: parse attrs (table, tauri_commands)
    Macro->>Macro: parse fields (fulltext, hnsw, flexible)
    Macro->>Macro: generate Struct + Impl + Repo + Commands
    Macro-->>Models: expanded TokenStream
    Models->>TS: #[ts(export)] on struct
    TS-->>Models: TS types in ../../apps/spa/src/ts/types/generated/

    Note over Dev,TS: At compile time
    Note over Models,Core: SurrealRepository provides\ncreate/find_all/find_by_id/save/delete
```

---

### Регистрация команд через entity_commands!

```mermaid
sequenceDiagram
    actor Dev
    participant Main as main.rs
    participant Macro as entity_commands!
    participant Generated as Generated Modules
    participant Tauri as Tauri Builder

    Dev->>Main: entity_commands![cmd1, @entities:[A,B], @searchable:[C], @relations:[R]]
    Main->>Macro: macro invocation
    Macro->>Macro: parse normal_commands
    Macro->>Macro: parse @entities → 4 cmds each
    Macro->>Macro: parse @searchable → 5 cmds each
    Macro->>Macro: parse @relations → 3 cmds each
    Macro->>Generated: resolves A_commands::get_as etc.
    Macro->>Macro: builds generate_handler![...]
    Macro-->>Main: expanded TokenStream
    Main->>Tauri: .invoke_handler(handler)
    Tauri-->>Dev: All commands registered
```

---

### Runtime: Вызов сгенерированной команды save\_\*

```mermaid
sequenceDiagram
    participant Frontend
    participant Tauri as Tauri Runtime
    participant CmdMod as {Entity}_commands::save_entity
    participant Repo as SurrealRepository::save
    participant DB as SurrealDB

    Frontend->>Tauri: invoke("save_entity", {data})
    Tauri->>CmdMod: save_entity(data, state)
    CmdMod->>CmdMod: normalize RecordId in data
    CmdMod->>CmdMod: serde_json::from_value(data) → Entity
    CmdMod->>Repo: Entity::save(db, &entity)
    Repo->>DB: UPSERT/CREATE query with bindings
    DB-->>Repo: Saved record
    Repo-->>CmdMod: Entity
    CmdMod-->>Tauri: Result<Value>
    Tauri-->>Frontend: Saved entity
```

---

## 🧪 Тестирование и покрытие

> Детальный разбор — в [README_backend_test.md](./README_backend_test.md).

Запуск (Windows / PowerShell):

```powershell
# surreal_domain workspace (core + macros + facade) — Function 100% (32/32)
cd tauri-surreal-kit\backend\surreal_domain
cargo llvm-cov --open

# tauri_shell — system_core/performance 100%, system.rs 85% (__cmd__* IPC-обёртки)
cd tauri-surreal-kit\backend\tauri_shell
cargo llvm-cov --open
```

Состояние на 2026-08-24:

| Crate                        | Function        | Line   | Region |
| ---------------------------- | --------------- | ------ | ------ |
| surreal_domain_core          | 100% (19/19)    | 94.06% | 93.32% |
| surreal_domain_macros (весь) | 100% (13/13)    | ~90%   | ~92%   |
| tauri_shell logic (system_core + performance) | 100% | ~98% | ~98% |
| tauri_shell logic/system.rs  | 85.25% (52/61)¹ | 95.53% | 94.64% |

¹ Непокрытые функции — `__cmd__*` IPC-обёртки `#[tauri::command]`, выполняются
только при реальном invoke() из webview (нужен e2e / tauri-driver).

Ключевые тестовые файлы: интеграционные тесты живут в `*/tests/` каждого пакета;
branch-coverage репозитория — `surreal_domain_facade/tests/repository_branches_integration.rs`;
юнит-тесты DTO — `surreal_domain_core/src/lib.rs` (`mod dto_tests`).

---

## 📝 Примечания

1. **Architecture**: `surreal_domain` — это библиотека кодогенерации (compile-time), `tauri_shell` — шаблон runtime.
2. **Proc-macros** требуют отдельного crate'а (`surreal_domain_macros`) с `proc-macro = true` в Cargo.toml.
3. **Facade pattern** (`surreal_domain_facade`) упрощает импорт: `use surreal_domain::*;`
4. **ts_rs экспорт** происходит при компиляции пользовательского кода (в `models.rs`), генерирует TS типы в `apps/spa/src/ts/types/generated/`
5. **entity_commands!** — ключевой макрос для регистрации всех Tauri-команд одним вызовом.
6. **tauri_shell** не зависит от доменной логики — только системные команды. Пользователь добавляет свои через `@entities`, `@searchable`, `@relations`.
7. **Performance adaptation**: `run_performance_benchmark()` вызывается при старте, результат кэшируется, CSS применяется через `get_performance_styles()`.
8. **Data directory resolution**: работает и в dev (`target/debug/...` → `root/data`), и в prod (`cwd/data`).
9. **Themes**: built-in (`settings-light.json`, `settings-dark.json`) + custom (`settings-theme-{name}.json`).
10. **SurrealRepository** default impl обрабатывает RecordId биндинги автоматически (парсит `table:id` строки).
