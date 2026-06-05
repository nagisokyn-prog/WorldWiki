# 🦀 SurrealDB Rust Macro System — Архитектурный проект

> **Цель:** Универсальная proc-macro библиотека для любой предметной области.
> Любой разработчик описывает домен декларативно — макрос генерирует всё остальное.
> **Для НИР:** Демонстрирует синергию Rust type-system + SurrealDB multi-model возможностей.

---

## КОНЦЕПЦИЯ

Программист пишет **только декларацию домена**. Макрос генерирует:

1. Rust-структуры с полной типизацией
2. SurrealQL DDL (схема, индексы, HNSW, FULLTEXT)
3. Async CRUD-методы
4. Граф-траверсальные методы (RELATE, ->edge->)
5. Поисковые методы (fulltext + vector)
6. Tauri-команды (опционально)
7. GraphRAG-хелперы для AI

---

## СИНТАКСИС МАКРОСА

### Базовый пример — любая предметная область

```rust
use surreal_domain::*;

// Декларация сущности
surreal_entity! {
    /// Любая сущность в любом домене
    #[table = "characters"]
    #[project_scoped]          // фильтрация по project_id
    pub struct Character {
        #[required]
        pub name: String,

        #[fulltext]            // → FULLTEXT INDEX
        pub description: Option<String>,

        pub age: Option<i64>,

        #[flexible]            // → TYPE object (любые доп. поля)
        pub attributes: serde_json::Value,

        #[hnsw(dim=1536, distance=Cosine)]  // → HNSW INDEX, AI embedding
        pub embedding: Option<Vec<f32>>,

        #[tags]                // → array<record<tags>>
        pub tags: Vec<RecordId>,

        #[auto]
        pub created_at: DateTime,
        #[auto, on_update]
        pub updated_at: DateTime,
    }
}

// Декларация типа связи
surreal_relation! {
    #[edge = "knows"]
    #[from = Character]
    #[to = Character]
    pub struct Knows {
        pub strength: Option<i64>,    // 1-10
        pub since: Option<String>,
        pub description: Option<String>,

        #[chapter_range]              // → start_chapter, end_chapter как record<Chapter>
        pub period: Option<ChapterRange>,
    }
}

surreal_relation! {
    #[edge = "located_in"]
    #[from = Character]
    #[to = Location]          // Location — другая surreal_entity!
    pub struct LocatedIn {
        pub role: Option<String>,
    }
}

surreal_relation! {
    #[edge = "appears_in"]
    #[from = Character]
    #[to = Chapter]
    pub struct AppearsIn {
        pub role: Option<String>,
        pub notes: Option<String>,
    }
}
```

---

## ЧТО ГЕНЕРИРУЕТ МАКРОС

### Из `surreal_entity!(Character {...})`

#### 1. Rust-структура
```rust
// ГЕНЕРИРУЕТСЯ АВТОМАТИЧЕСКИ:
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Character {
    pub id: Option<String>,
    pub project_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub age: Option<i64>,
    pub attributes: serde_json::Value,
    pub embedding: Option<Vec<f32>>,
    pub tags: Vec<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

// Builder для создания
impl Character {
    pub fn new(name: impl Into<String>) -> Self { ... }
    pub fn with_description(mut self, d: impl Into<String>) -> Self { ... }
    pub fn with_attributes(mut self, attrs: serde_json::Value) -> Self { ... }
    pub fn with_embedding(mut self, emb: Vec<f32>) -> Self { ... }
}
```

#### 2. SurrealQL DDL (генерируется как &'static str)
```rust
impl Character {
    pub const DDL: &'static str = "
        DEFINE TABLE characters SCHEMAFULL;
        DEFINE FIELD project_id   ON characters TYPE option<record<projects>>;
        DEFINE FIELD name         ON characters TYPE string;
        DEFINE FIELD description  ON characters TYPE option<string>;
        DEFINE FIELD age          ON characters TYPE option<int>;
        DEFINE FIELD attributes   ON characters TYPE object;
        DEFINE FIELD embedding    ON characters TYPE option<array<float>>;
        DEFINE FIELD tags         ON characters TYPE array<record<tags>> DEFAULT [];
        DEFINE FIELD created_at   ON characters TYPE datetime DEFAULT time::now();
        DEFINE FIELD updated_at   ON characters TYPE datetime DEFAULT time::now();

        DEFINE INDEX idx_characters_project
            ON characters FIELDS project_id;
        DEFINE INDEX idx_characters_name_ft
            ON characters FIELDS name FULLTEXT;
        DEFINE INDEX idx_characters_desc_ft
            ON characters FIELDS description FULLTEXT;
        DEFINE INDEX idx_characters_embedding
            ON characters FIELDS embedding
            HNSW DIMENSION 1536 DISTANCE COSINE;
    ";
}
```

#### 3. CRUD-репозиторий
```rust
impl Character {
    // CREATE
    pub async fn create(db: &Surreal<Db>, project: &str, entity: Character)
        -> Result<Character, SurrealError> { ... }

    // READ
    pub async fn find_by_id(db: &Surreal<Db>, id: &str)
        -> Result<Option<Character>, SurrealError> { ... }

    pub async fn find_all(db: &Surreal<Db>, project: &str)
        -> Result<Vec<Character>, SurrealError> { ... }

    pub async fn find_by_field(db: &Surreal<Db>, project: &str,
        field: &str, value: &serde_json::Value)
        -> Result<Vec<Character>, SurrealError> { ... }

    // UPDATE
    pub async fn save(db: &Surreal<Db>, entity: &Character)
        -> Result<Character, SurrealError> { ... }

    pub async fn update_field(db: &Surreal<Db>, id: &str,
        field: &str, value: serde_json::Value)
        -> Result<(), SurrealError> { ... }

    // DELETE
    pub async fn delete(db: &Surreal<Db>, id: &str)
        -> Result<(), SurrealError> { ... }

    // SEARCH: fulltext
    pub async fn search(db: &Surreal<Db>, project: &str, query: &str)
        -> Result<Vec<SearchResult<Character>>, SurrealError> { ... }

    // SEARCH: vector (AI)
    pub async fn search_similar(db: &Surreal<Db>, project: &str,
        embedding: Vec<f32>, k: usize)
        -> Result<Vec<SimilarResult<Character>>, SurrealError> { ... }

    // UPSERT embedding
    pub async fn set_embedding(db: &Surreal<Db>, id: &str, embedding: Vec<f32>)
        -> Result<(), SurrealError> { ... }
}
```

#### 4. Граф-методы (из surreal_relation!)
```rust
impl Character {
    // Исходящие рёбра ->knows->
    pub async fn get_knows(db: &Surreal<Db>, id: &str)
        -> Result<Vec<GraphEdge<Knows, Character>>, SurrealError> { ... }

    // Входящие рёбра <-knows<-
    pub async fn get_known_by(db: &Surreal<Db>, id: &str)
        -> Result<Vec<GraphEdge<Knows, Character>>, SurrealError> { ... }

    // N-hop траверсал (->knows->characters->knows->characters...)
    pub async fn traverse_knows(db: &Surreal<Db>, id: &str, depth: u8)
        -> Result<GraphNeighborhood, SurrealError> { ... }

    // Появления в главах
    pub async fn get_chapters(db: &Surreal<Db>, id: &str)
        -> Result<Vec<GraphEdge<AppearsIn, Chapter>>, SurrealError> { ... }

    // Локации
    pub async fn get_locations(db: &Surreal<Db>, id: &str)
        -> Result<Vec<GraphEdge<LocatedIn, Location>>, SurrealError> { ... }
}
```

### Из `surreal_relation!(Knows {...})`
```rust
impl Knows {
    pub const DDL: &'static str = "
        DEFINE TABLE knows TYPE RELATION IN characters OUT characters SCHEMAFULL;
        DEFINE FIELD strength    ON knows TYPE option<int>;
        DEFINE FIELD since       ON knows TYPE option<string>;
        DEFINE FIELD description ON knows TYPE option<string>;
        DEFINE FIELD start_chapter ON knows TYPE option<record<chapters>>;
        DEFINE FIELD end_chapter   ON knows TYPE option<record<chapters>>;
        DEFINE FIELD created_at  ON knows TYPE datetime DEFAULT time::now();
        DEFINE INDEX idx_knows_from ON knows FIELDS in;
        DEFINE INDEX idx_knows_to   ON knows FIELDS out;
    ";

    pub async fn relate(db: &Surreal<Db>,
        from_id: &str, to_id: &str, edge_data: Knows)
        -> Result<String, SurrealError> { ... }

    pub async fn delete(db: &Surreal<Db>, edge_id: &str)
        -> Result<(), SurrealError> { ... }

    pub async fn update(db: &Surreal<Db>, edge_id: &str, data: Knows)
        -> Result<(), SurrealError> { ... }

    pub async fn find_between(db: &Surreal<Db>, from_id: &str, to_id: &str)
        -> Result<Option<Knows>, SurrealError> { ... }
}
```

---

## ВСПОМОГАТЕЛЬНЫЕ ТИПЫ (не генерируются — предоставляются библиотекой)

```rust
// Результат поиска
pub struct SearchResult<T> {
    pub entity: T,
    pub score: f64,
    pub kind: SearchKind,  // Fulltext | Vector | Hybrid
}

// Результат похожести (векторный поиск)
pub struct SimilarResult<T> {
    pub entity: T,
    pub similarity: f64,  // 0.0..1.0, cosine
}

// Граф-ребро с данными
pub struct GraphEdge<E, T> {
    pub edge_id: String,
    pub edge_data: E,
    pub node: T,
    pub direction: EdgeDirection, // Outgoing | Incoming
}

// Окрестность графа (N-hop)
pub struct GraphNeighborhood {
    pub center_id: String,
    pub nodes: Vec<serde_json::Value>,
    pub edges: Vec<serde_json::Value>,
    pub depth: u8,
}

// Диапазон глав для связи
pub struct ChapterRange {
    pub start_chapter: Option<String>,
    pub end_chapter: Option<String>,
}

pub enum EdgeDirection { Outgoing, Incoming, Both }
pub enum SearchKind   { Fulltext, Vector, Hybrid }
pub enum Distance     { Cosine, Euclidean, Manhattan }
```

---

## МАКРОС ИНИЦИАЛИЗАЦИИ СХЕМЫ

```rust
// Регистрация всех сущностей домена одним вызовом
surreal_schema! {
    entities:  [Character, Location, Faction, Chapter, Item],
    relations: [Knows, LocatedIn, AppearsIn, BelongsTo, Owns],
}

// Генерирует:
pub struct DomainSchema;

impl DomainSchema {
    /// Весь DDL домена одной строкой — для запуска при старте
    pub const FULL_DDL: &'static str = /* конкатенация всех DDL */;

    /// Применить схему к базе данных
    pub async fn apply(db: &Surreal<Db>) -> Result<(), SurrealError> {
        db.query(Self::FULL_DDL).await?;
        Ok(())
    }

    /// Версия схемы (hash от DDL)
    pub const SCHEMA_VERSION: &'static str = /* compile-time hash */;
}
```

---

## МАКРОС TAURI-КОМАНД (опционально)

```rust
// Для Tauri-приложений: авто-генерация invoke_handler
surreal_tauri_commands! {
    entities: [Character, Location, Faction],
    relations: [Knows, LocatedIn],
    prefix: "v2_",  // все команды: v2_create_character, v2_get_character, ...
}

// Генерирует функции вида:
#[tauri::command]
async fn v2_create_character(
    project: String,
    data: serde_json::Value,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let entity = serde_json::from_value::<Character>(data)
        .map_err(|e| e.to_string())?;
    let created = Character::create(&state.db, &project, entity)
        .await.map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(created).unwrap())
}

#[tauri::command]
async fn v2_get_characters(
    project: String, entity_type: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
async fn v2_save_character(
    project: String, id: Option<String>, data: serde_json::Value,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
async fn v2_delete_character(
    id: String, state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
async fn v2_search_characters(
    project: String, query: String,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
async fn v2_get_character_relations(
    id: String, state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
async fn v2_relate_knows(
    project: String, from_id: String, to_id: String,
    data: serde_json::Value, state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> { ... }
```

---

## GRAPHRAG МАКРОС (AI)

```rust
surreal_graphrag! {
    // Какие поля использовать как текст для embedding
    context_fields: {
        Character: [name, description],
        Location:  [name, description],
        Chapter:   [title, content, summary],
    },
    // Граф для расширения контекста
    traverse: {
        Character: { knows: 2, located_in: 1, appears_in: 1 },
        Location:  { located_in: 1 },
    },
    embedding_dim: 1536,
}

// Генерирует:
impl GraphRag {
    /// Семантический поиск + граф-расширение контекста
    pub async fn retrieve(
        db: &Surreal<Db>,
        project: &str,
        query_embedding: Vec<f32>,
        k: usize,
    ) -> Result<GraphRagContext, SurrealError> { ... }
    // Возвращает: seed-сущности + их граф-соседи + связанные главы
}
```

---

## СТРУКТУРА CRATE

```
surreal_domain/           ← корневой crate (re-exports всё)
├── surreal_domain_core/  ← типы: SearchResult, GraphEdge, etc.
│   └── src/
│       ├── lib.rs
│       ├── types.rs
│       ├── error.rs
│       └── helpers.rs    ← SurrealQL строители
├── surreal_domain_macros/ ← proc-macro crate
│   └── src/
│       ├── lib.rs        ← регистрация макросов
│       ├── entity.rs     ← surreal_entity! proc-macro
│       ├── relation.rs   ← surreal_relation! proc-macro
│       ├── schema.rs     ← surreal_schema! proc-macro
│       ├── tauri_cmds.rs ← surreal_tauri_commands! proc-macro
│       ├── graphrag.rs   ← surreal_graphrag! proc-macro
│       └── codegen/      ← генераторы кода
│           ├── ddl.rs    ← генерация SurrealQL
│           ├── crud.rs   ← генерация CRUD методов
│           ├── graph.rs  ← генерация граф-методов
│           └── search.rs ← генерация поисковых методов
└── surreal_domain/       ← фасад
    └── src/
        └── lib.rs
```

---

## АТРИБУТЫ ПОЛЕЙ — ПОЛНАЯ СПЕЦИФИКАЦИЯ

| Атрибут | Применение | Что генерирует |
|---------|-----------|----------------|
| `#[required]` | поле | `TYPE string` (без option) + валидация |
| `#[fulltext]` | String поле | `DEFINE INDEX ... FULLTEXT` |
| `#[hnsw(dim=N, distance=X)]` | Vec<f32> поле | `DEFINE INDEX ... HNSW DIMENSION N DISTANCE X` |
| `#[flexible]` | Value поле | `TYPE object` (schemaless внутри schemafull) |
| `#[tags]` | Vec<RecordId> | `TYPE array<record<tags>>` |
| `#[auto]` | DateTime | `DEFAULT time::now()` |
| `#[auto, on_update]` | DateTime | `DEFAULT time::now() VALUE time::now()` |
| `#[computed(expr)]` | любое | `COMPUTED <expr>` (SurrealDB 3.x) |
| `#[unique]` | поле | `DEFINE INDEX ... UNIQUE` |
| `#[reference(Table)]` | RecordId | `TYPE record<Table>` |
| `#[project_scoped]` | на struct | добавляет `project_id` + фильтрацию |
| `#[chapter_range]` | ChapterRange | два поля `start_chapter`, `end_chapter` |

---

## АТРИБУТЫ ОТНОШЕНИЙ

| Атрибут | Применение | Что генерирует |
|---------|-----------|----------------|
| `#[edge = "name"]` | на struct | имя таблицы-ребра |
| `#[from = Type]` | на struct | `IN <table>` в DEFINE TABLE |
| `#[to = Type]` | на struct | `OUT <table>` в DEFINE TABLE |
| `#[bidirectional]` | на struct | методы для обоих направлений |
| `#[project_scoped]` | на struct | добавляет `project_id` на ребро |

---

## ПРИМЕР ИСПОЛЬЗОВАНИЯ В WORLD-WIKI

```rust
// src-tauri/src/domain.rs

use surreal_domain::*;

surreal_entity! {
    #[table = "entities"]
    #[project_scoped]
    pub struct Entity {
        #[required]
        pub name: String,
        pub entity_type: String,
        #[fulltext]
        pub description: Option<String>,
        #[flexible]
        pub attributes: serde_json::Value,
        #[hnsw(dim=1536, distance=Cosine)]
        pub embedding: Option<Vec<f32>>,
        #[tags]
        pub tags: Vec<RecordId>,
        #[auto] pub created_at: DateTime,
        #[auto, on_update] pub updated_at: DateTime,
    }
}

surreal_entity! {
    #[table = "chapters"]
    #[project_scoped]
    pub struct Chapter {
        #[required] pub title: String,
        #[fulltext] pub content: String,
        pub summary: Option<String>,
        pub word_count: i64,
        pub sort_order: i64,
        #[reference(Volume)] pub volume_id: Option<RecordId>,
        #[reference(Arc)]    pub arc_id:    Option<RecordId>,
        #[hnsw(dim=1536, distance=Cosine)]
        pub embedding: Option<Vec<f32>>,
        #[auto] pub created_at: DateTime,
        #[auto, on_update] pub updated_at: DateTime,
    }
}

surreal_relation! {
    #[edge = "entity_rel"]
    #[from = Entity] #[to = Entity]
    #[project_scoped]
    pub struct EntityRel {
        pub rel_type: String,
        pub description: Option<String>,
        pub strength: Option<i64>,
        #[flexible] pub attributes: serde_json::Value,
        #[chapter_range] pub period: Option<ChapterRange>,
    }
}

surreal_relation! {
    #[edge = "appears_in"]
    #[from = Entity] #[to = Chapter]
    pub struct AppearsIn {
        pub role: Option<String>,
        pub notes: Option<String>,
    }
}

surreal_schema! {
    entities:  [Entity, Chapter, Volume, Arc, Tag],
    relations: [EntityRel, AppearsIn],
}

surreal_tauri_commands! {
    entities: [Entity, Chapter],
    relations: [EntityRel, AppearsIn],
}
```

---

## ПРИМЕР ИСПОЛЬЗОВАНИЯ В ДРУГОМ ДОМЕНЕ (e-commerce)

```rust
surreal_entity! {
    #[table = "products"]
    pub struct Product {
        #[required] pub name: String,
        #[fulltext] pub description: Option<String>,
        pub price: f64,
        pub stock: i64,
        #[flexible] pub specs: serde_json::Value,
        #[hnsw(dim=1536, distance=Cosine)]
        pub embedding: Option<Vec<f32>>,
        #[auto] pub created_at: DateTime,
    }
}

surreal_entity! {
    #[table = "customers"]
    pub struct Customer {
        #[required, unique] pub email: String,
        pub name: String,
        #[hnsw(dim=512, distance=Cosine)]
        pub preference_embedding: Option<Vec<f32>>,
    }
}

surreal_relation! {
    #[edge = "purchased"]
    #[from = Customer] #[to = Product]
    pub struct Purchased {
        pub quantity: i64,
        pub price_paid: f64,
        pub purchased_at: String,
    }
}

surreal_relation! {
    #[edge = "similar_to"]
    #[from = Product] #[to = Product]
    #[bidirectional]
    pub struct SimilarTo {
        pub similarity_score: f64,
    }
}
```

---

## РЕАЛИЗАЦИЯ PROC-MACRO: КЛЮЧЕВЫЕ МОМЕНТЫ

### entity.rs (упрощённая схема парсинга)

```rust
// surreal_domain_macros/src/entity.rs
use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput, Fields};

pub fn impl_surreal_entity(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;
    let table_name = extract_table_attr(&input.attrs);
    let project_scoped = has_attr(&input.attrs, "project_scoped");

    let fields = extract_fields(&input.data);
    let ddl    = generate_ddl(&table_name, &fields, project_scoped);
    let crud   = generate_crud(&name, &table_name, &fields, project_scoped);
    let search = generate_search(&name, &table_name, &fields, project_scoped);

    quote! {
        #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
        pub struct #name {
            #(#fields)*
        }

        impl #name {
            pub const TABLE: &'static str = #table_name;
            pub const DDL: &'static str = #ddl;

            #crud
            #search
        }
    }.into()
}

fn generate_ddl(table: &str, fields: &[FieldDef], scoped: bool) -> String {
    let mut ddl = format!("DEFINE TABLE {} SCHEMAFULL;\n", table);
    if scoped {
        ddl += &format!(
            "DEFINE FIELD project_id ON {} TYPE option<record<projects>>;\n",
            table
        );
    }
    for f in fields {
        ddl += &format!(
            "DEFINE FIELD {} ON {} TYPE {};\n",
            f.name, table, f.surreal_type()
        );
        if f.has_attr("fulltext") {
            ddl += &format!(
                "DEFINE INDEX idx_{table}_{name}_ft ON {table} FIELDS {name} FULLTEXT;\n",
                name = f.name, table = table
            );
        }
        if let Some(hnsw) = f.hnsw_params() {
            ddl += &format!(
                "DEFINE INDEX idx_{table}_{name}_emb ON {table} FIELDS {name} \
                 HNSW DIMENSION {} DISTANCE {};\n",
                f.name, table, hnsw.dim, hnsw.distance
            );
        }
    }
    ddl
}
```

---

## ПЛАН РЕАЛИЗАЦИИ

| # | Задача | Файл | Приоритет |
|---|--------|------|-----------|
| 1 | Создать workspace с двумя crate | `Cargo.toml` (workspace) | 🔴 |
| 2 | `surreal_domain_core`: типы и хелперы | `core/src/` | 🔴 |
| 3 | `surreal_entity!` proc-macro | `macros/src/entity.rs` | 🔴 |
| 4 | DDL-генератор (все атрибуты) | `macros/src/codegen/ddl.rs` | 🔴 |
| 5 | CRUD-генератор | `macros/src/codegen/crud.rs` | 🔴 |
| 6 | `surreal_relation!` proc-macro | `macros/src/relation.rs` | 🔴 |
| 7 | Граф-методы (RELATE, траверсал) | `macros/src/codegen/graph.rs` | 🔴 |
| 8 | `surreal_schema!` (apply к БД) | `macros/src/schema.rs` | 🟠 |
| 9 | Fulltext search генератор | `macros/src/codegen/search.rs` | 🟠 |
| 10 | `surreal_tauri_commands!` | `macros/src/tauri_cmds.rs` | 🟠 |
| 11 | Vector search генератор | `macros/src/codegen/search.rs` | 🟡 |
| 12 | `surreal_graphrag!` | `macros/src/graphrag.rs` | 🟡 |
| 13 | Tests + examples | `examples/` | 🟡 |
| 14 | Документация для НИР | `README.md` | 🟡 |

---

## ПРИМЕР 3: ADVANCED DOMAINS (AI, RAG, Chat, Dictionary)

Макрос позволяет легко описать сложную логику AI агента: семантический чанкинг текста, древовидные чаты с версионированием, динамический словарь и межчатовую память.

```rust
// 1. Семантический чанкинг (Абзацы с тегами: !м, !д, !о)
surreal_entity! {
    #[table = "text_blocks"]
    #[project_scoped]
    pub struct TextBlock {
        #[reference(Chapter)] pub chapter_id: RecordId,
        pub block_type: String, // "thought", "dialogue", "description"
        pub order_index: i64,
        #[fulltext] pub content: String,
        #[hnsw(dim=1536, distance=Cosine)] pub embedding: Option<Vec<f32>>,
    }
}

// 2. Древовидный чат с ветвлением и цитированием (Chat Tree)
surreal_entity! {
    #[table = "chat_messages"]
    #[project_scoped]
    pub struct ChatMessage {
        #[reference(ChatSession)] pub session_id: RecordId,
        pub role: String, // "user", "assistant"
        #[fulltext] pub content: String,
        #[reference(ChatMessage)] pub parent_msg_id: Option<RecordId>, // Для ветвления
        pub version: i64, // Для регенерации
        
        // Цитирование определенного контекста (id сообщения, блока текста или сущности)
        #[flexible] pub quoted_context: Option<serde_json::Value>, 
        
        // --- Механизм RLHF / Ручной коррекции ---
        #[fulltext] pub edited_content: Option<String>, // Если юзер сам переписал ответ ИИ
        pub feedback_comment: Option<String>, // Объяснение юзера: где и в чем ошиблась модель
        pub rag_was_bad: bool, // Флаг, что RAG подтянул мусор или промазал со связями
        
        #[hnsw(dim=1536, distance=Cosine)] pub embedding: Option<Vec<f32>>,
        #[auto] pub created_at: DateTime,
    }
}

// 3. Динамический словарь пользователя (обучение ИИ)
surreal_entity! {
    #[table = "user_dictionary"]
    #[project_scoped]
    pub struct DictionaryWord {
        #[required, unique] pub word: String,
        #[fulltext] pub definition: Option<String>,
        pub is_approved: bool,
        pub confidence: f64, // Уверенность модели, что это ошибка
    }
}

// 4. Кэш знаний из интернета (Web Cache)
surreal_entity! {
    #[table = "web_cache"]
    #[project_scoped]
    pub struct WebCache {
        #[required] pub url: String,
        pub source_type: String, // "article", "author_style"
        #[fulltext] pub content: String,
        #[hnsw(dim=1536, distance=Cosine)] pub embedding: Option<Vec<f32>>,
        #[auto] pub fetched_at: DateTime,
        pub expires_at: Option<DateTime>, // TTL для протухания новостей
    }
}

// 5. & 6. Межчатовая память и Сжатый контекст
surreal_entity! {
    #[table = "agent_memory"]
    #[project_scoped]
    pub struct AgentMemory {
        pub memory_type: String, // "summary", "user_preference", "fact"
        #[fulltext] pub content: String,
        #[hnsw(dim=1536, distance=Cosine)] pub embedding: Option<Vec<f32>>,
        pub importance: i64, // 1-10, чтобы вымывать мусор
        #[auto] pub created_at: DateTime,
    }
}

// Граф для связывания всего этого богатства
surreal_relation! {
    #[edge = "cites"]
    #[from = ChatMessage] #[to = TextBlock] // Или любая другая сущность
    pub struct Cites {
        pub relevance_score: f64,
    }
}
```

Благодаря макросу, вся эта сложная структура генерируется автоматически:
- БД сразу умеет делать векторный поиск по мыслям (`block_type = "thought"`).
- Дерево чата строится через простые рекурсивные запросы `SELECT <-parent_msg_id<-chat_messages`.
- Саммари бесед автоматически становятся узлами графа `agent_memory` и подтягиваются в новый контекст.
