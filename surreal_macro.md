# 🗺️ МАКРОС: World Wiki × SurrealDB — Полный план

> **SurrealDB версия:** 3.0.4 (обновлено пользователем) ✅

> **Статус:** В разработке | **Версия БД:** SurrealDB 2.1.4 (Cargo) → план миграции на 3.x
> **Принцип:** Никакого хардкода. Всё динамично. Любые сущности. Граф связывает всё.

---

## ЧАСТЬ 1: АНАЛИЗ ТЕКУЩЕГО БЭКЕНДА

### 1.1 Что есть сейчас

**Стек:** Tauri 2 + Rust + SurrealDB 2.1.4 (embedded SurrealKV) + TypeScript/Vue фронт

**Таблицы в схеме (`surreal_schema.surql`):**

| Таблица | Назначение | Проблема |
|---------|-----------|---------|
| `projects` | Проекты пользователя | OK |
| `volumes` | Тома (верхний уровень иерархии) | OK |
| `arcs` | Арки (средний уровень) | OK |
| `chapters` | Главы с текстом | OK |
| `dynamic_entities` | ВСЕ сущности (персонажи, локации и т.д.) | ⚠️ Проблема: всё в одной таблице, `data: object` — schemaless внутри schemafull |
| `tags` | Теги проекта | OK |
| `entity_connections` | Связи между сущностями | ⚠️ Используется как граф через RELATE, но `start_chapter`/`end_chapter` — строки, не Record |
| `calendars` | Настройки календаря | OK |
| `plans` | Пункты плана | ⚠️ `parent_id` — строка, не Record |

**Команды Tauri (main.rs):**
- Проекты: `get_projects`, `create_project`, `get_project_config`, `save_project_config`, `delete_project`
- Сущности: `get_entities`, `save_entity`, `delete_entity`, `get_entity_details`, `get_schemas`
- Иерархия: `get_chapter_hierarchy`, `create_volume`, `update_volume`, `delete_volume`, `create_arc`, `update_arc`, `delete_arc`, `assign_chapter`, `reorder_node`
- Планы: `get_plan_items`, `save_plan_item`, `delete_plan_item`, `toggle_plan_item`
- Теги: `get_tags`, `save_tag`, `delete_tag`
- Главы: `get_chapters_list`, `get_chapter`, `save_chapter_data`, `delete_chapter_data`
- Связи: `get_connections`, `save_connections`, `remove_connections_by_source`
- Прочее: `save_calendar`, `export_chapters`, `upload_photo`, `get_local_file`, `save_settings`, `load_settings`

### 1.2 Критические проблемы текущей архитектуры

**Проблема 1: `dynamic_entities` — антипаттерн**
```rust
// Сейчас: всё в одном поле data: object
DEFINE FIELD data ON dynamic_entities TYPE object;
// Нет типизации, нет индексов по полям, нет векторного поиска
```

**Проблема 2: Связи не используют граф правильно**
```rust
// Сейчас: entity_connections через RELATE, но
// start_chapter / end_chapter — просто строки
DEFINE FIELD start_chapter ON entity_connections TYPE string;
// Должно быть: TYPE option<record<chapters>>
```

**Проблема 3: `plans.parent_id` — строка, не Record**
```rust
DEFINE FIELD parent_id ON plans TYPE string;
// Нельзя делать граф-траверсал
```

**Проблема 4: Нет векторных индексов**
- Нет embedding-полей нигде
- Нет HNSW-индексов
- AI-поиск невозможен в текущей схеме

**Проблема 5: `save_connections` — DELETE ALL + переписать**
```rust
// Сейчас: удаляем ВСЕ связи проекта и создаём заново
db.query("DELETE entity_connections WHERE project_id = $proj")
// Это O(n) потеря истории и граф-данных
```

**Проблема 6: `entity_connections` — не истинные граф-рёбра SurrealDB**
```rust
// RELATE используется, но поля проекта и метаданные хранятся
// внутри ребра как обычные поля — это правильно
// Но тип ребра один на всё: entity_connections
// Нужно: разные типы рёбер для разных типов связей
```

### 1.3 Что работает хорошо

- Паттерн `type::thing('table', $id)` везде — правильно для SurrealDB 2.x
- `UPSERT` для проектов и тегов — правильно
- `processIds` на фронте для конвертации RecordId — нужен
- `RELATE` для связей — правильное направление
- Embedded SurrealKV — правильный выбор для desktop-app

---

## ЧАСТЬ 2: НОВАЯ АРХИТЕКТУРА СХЕМЫ

### 2.1 Принципы новой схемы

1. **Нет хардкода типов сущностей** — пользователь создаёт любые типы
2. **Граф везде** — все связи через RELATE с типизированными рёбрами
3. **AI-ready с рождения** — embedding-поля и HNSW-индексы сразу
4. **Динамические атрибуты** — через `attributes: object` (flexible schema)
5. **Полнотекстовый + векторный поиск** на всех текстовых полях

### 2.2 Новая схема таблиц

```sql
-- ═══════════════════════════════════════════════
-- МЕТА: Типы сущностей (определяет пользователь)
-- ═══════════════════════════════════════════════
DEFINE TABLE entity_schemas SCHEMAFULL;
DEFINE FIELD project_id   ON entity_schemas TYPE record<projects>;
DEFINE FIELD type_key     ON entity_schemas TYPE string;  -- "character", "location", "faction"
DEFINE FIELD type_name    ON entity_schemas TYPE string;  -- "Персонаж", "Локация"
DEFINE FIELD icon         ON entity_schemas TYPE string;  -- "👤", "🗺️"
DEFINE FIELD color        ON entity_schemas TYPE string;  -- "#FF6B6B"
DEFINE FIELD fields_schema ON entity_schemas TYPE array<object>; -- [{key, label, type, required}]
DEFINE FIELD created_at   ON entity_schemas TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_schema_type ON entity_schemas FIELDS project_id, type_key UNIQUE;

-- ═══════════════════════════════════════════════
-- СУЩНОСТИ (универсальная таблица)
-- ═══════════════════════════════════════════════
DEFINE TABLE entities SCHEMAFULL;
DEFINE FIELD project_id   ON entities TYPE record<projects>;
DEFINE FIELD entity_type  ON entities TYPE string;       -- ключ из entity_schemas
DEFINE FIELD name         ON entities TYPE string;       -- главное имя (для поиска)
DEFINE FIELD description  ON entities TYPE option<string>;
DEFINE FIELD attributes   ON entities TYPE object;       -- все доп. поля (flexible)
DEFINE FIELD tags         ON entities TYPE array<record<tags>> DEFAULT [];
DEFINE FIELD embedding    ON entities TYPE option<array<float>>; -- AI: 1536d
DEFINE FIELD created_at   ON entities TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at   ON entities TYPE datetime DEFAULT time::now();

-- Индексы
DEFINE INDEX idx_entity_project ON entities FIELDS project_id;
DEFINE INDEX idx_entity_type    ON entities FIELDS project_id, entity_type;
DEFINE INDEX idx_entity_name_ft ON entities FIELDS name FULLTEXT;
DEFINE INDEX idx_entity_desc_ft ON entities FIELDS description FULLTEXT;
DEFINE INDEX idx_entity_emb     ON entities FIELDS embedding
    HNSW DIMENSION 1536 DISTANCE COSINE;

-- ═══════════════════════════════════════════════
-- ТИПЫ ГРАФ-РЁБЕР (определяет пользователь)
-- ═══════════════════════════════════════════════
DEFINE TABLE relation_schemas SCHEMAFULL;
DEFINE FIELD project_id   ON relation_schemas TYPE record<projects>;
DEFINE FIELD rel_key      ON relation_schemas TYPE string;  -- "knows", "lives_in"
DEFINE FIELD rel_name     ON relation_schemas TYPE string;  -- "Знает", "Живёт в"
DEFINE FIELD icon         ON relation_schemas TYPE string;
DEFINE FIELD color        ON relation_schemas TYPE string;
DEFINE FIELD directed     ON relation_schemas TYPE bool DEFAULT true;
DEFINE FIELD from_types   ON relation_schemas TYPE array<string>; -- допустимые типы source
DEFINE FIELD to_types     ON relation_schemas TYPE array<string>; -- допустимые типы target

-- ═══════════════════════════════════════════════
-- ГРАФ-РЁБРА: Связи между сущностями
-- ═══════════════════════════════════════════════
DEFINE TABLE entity_rel TYPE RELATION IN entities OUT entities SCHEMAFULL;
DEFINE FIELD project_id   ON entity_rel TYPE record<projects>;
DEFINE FIELD rel_type     ON entity_rel TYPE string;       -- ключ из relation_schemas
DEFINE FIELD description  ON entity_rel TYPE option<string>;
DEFINE FIELD strength     ON entity_rel TYPE option<int>;  -- 1-10
DEFINE FIELD attributes   ON entity_rel TYPE object;       -- доп. данные связи
DEFINE FIELD start_chapter ON entity_rel TYPE option<record<chapters>>;
DEFINE FIELD end_chapter  ON entity_rel TYPE option<record<chapters>>;
DEFINE FIELD created_at   ON entity_rel TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_rel_project ON entity_rel FIELDS project_id;
DEFINE INDEX idx_rel_type    ON entity_rel FIELDS rel_type;

-- ═══════════════════════════════════════════════
-- СВЯЗИ: Сущность ↔ Глава (появление в главе)
-- ═══════════════════════════════════════════════
DEFINE TABLE appears_in TYPE RELATION IN entities OUT chapters SCHEMAFULL;
DEFINE FIELD project_id ON appears_in TYPE record<projects>;
DEFINE FIELD role       ON appears_in TYPE option<string>; -- "главный", "упоминание"
DEFINE FIELD notes      ON appears_in TYPE option<string>;

-- ═══════════════════════════════════════════════
-- ГЛАВЫ (расширенная версия)
-- ═══════════════════════════════════════════════
DEFINE TABLE chapters SCHEMAFULL;
DEFINE FIELD project_id  ON chapters TYPE record<projects>;
DEFINE FIELD title       ON chapters TYPE string;
DEFINE FIELD content     ON chapters TYPE string;
DEFINE FIELD summary     ON chapters TYPE option<string>;   -- AI: краткое содержание
DEFINE FIELD arc_id      ON chapters TYPE option<record<arcs>>;
DEFINE FIELD volume_id   ON chapters TYPE option<record<volumes>>;
DEFINE FIELD word_count  ON chapters TYPE int DEFAULT 0;
DEFINE FIELD sort_order  ON chapters TYPE int DEFAULT 0;
DEFINE FIELD embedding   ON chapters TYPE option<array<float>>; -- AI: 1536d
DEFINE FIELD created_at  ON chapters TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at  ON chapters TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_chapter_ft  ON chapters FIELDS content FULLTEXT;
DEFINE INDEX idx_chapter_emb ON chapters FIELDS embedding
    HNSW DIMENSION 1536 DISTANCE COSINE;

-- ═══════════════════════════════════════════════
-- ПЛАНЫ (с правильными Record-ссылками)
-- ═══════════════════════════════════════════════
DEFINE TABLE plans SCHEMAFULL;
DEFINE FIELD project_id  ON plans TYPE record<projects>;
DEFINE FIELD title       ON plans TYPE string;
DEFINE FIELD parent_ref  ON plans TYPE record;             -- chapter/arc/volume — любой Record
DEFINE FIELD parent_type ON plans TYPE string;             -- "chapter"|"arc"|"volume"
DEFINE FIELD sort_order  ON plans TYPE int DEFAULT 0;
DEFINE FIELD completed   ON plans TYPE bool DEFAULT false;
DEFINE FIELD created_at  ON plans TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at  ON plans TYPE datetime DEFAULT time::now();

-- ═══════════════════════════════════════════════
-- AI: Блоки текста (Семантический чанкинг: мысли, диалоги, описание)
-- ═══════════════════════════════════════════════
DEFINE TABLE text_blocks SCHEMAFULL;
DEFINE FIELD project_id  ON text_blocks TYPE record<projects>;
DEFINE FIELD chapter_id  ON text_blocks TYPE record<chapters>;
DEFINE FIELD block_type  ON text_blocks TYPE string; -- "thought", "dialogue", "description"
DEFINE FIELD order_index ON text_blocks TYPE int;
DEFINE FIELD content     ON text_blocks TYPE string;
DEFINE FIELD embedding   ON text_blocks TYPE option<array<float>>;

DEFINE INDEX idx_blocks_ft  ON text_blocks FIELDS content FULLTEXT;
DEFINE INDEX idx_blocks_emb ON text_blocks FIELDS embedding HNSW DIMENSION 1536 DISTANCE COSINE;

-- ═══════════════════════════════════════════════
-- AI: Древовидный Чат (С ветвлением и цитированием)
-- ═══════════════════════════════════════════════
DEFINE TABLE chat_messages SCHEMAFULL;
DEFINE FIELD project_id    ON chat_messages TYPE record<projects>;
DEFINE FIELD role          ON chat_messages TYPE string; -- "user", "assistant"
DEFINE FIELD content       ON chat_messages TYPE string;
DEFINE FIELD parent_msg_id ON chat_messages TYPE option<record<chat_messages>>;
DEFINE FIELD version       ON chat_messages TYPE int DEFAULT 0;
DEFINE FIELD quoted_context ON chat_messages TYPE option<object>; -- На что ссылается

-- Механизм RLHF (исправление ошибок модели юзером)
DEFINE FIELD edited_content   ON chat_messages TYPE option<string>;
DEFINE FIELD feedback_comment ON chat_messages TYPE option<string>;
DEFINE FIELD rag_was_bad      ON chat_messages TYPE bool DEFAULT false;

DEFINE FIELD embedding     ON chat_messages TYPE option<array<float>>;
DEFINE FIELD created_at    ON chat_messages TYPE datetime DEFAULT time::now();

-- ═══════════════════════════════════════════════
-- AI: Динамический словарь
-- ═══════════════════════════════════════════════
DEFINE TABLE user_dictionary SCHEMAFULL;
DEFINE FIELD project_id   ON user_dictionary TYPE record<projects>;
DEFINE FIELD word         ON user_dictionary TYPE string;
DEFINE FIELD definition   ON user_dictionary TYPE option<string>;
DEFINE FIELD is_approved  ON user_dictionary TYPE bool DEFAULT true;
DEFINE FIELD confidence   ON user_dictionary TYPE float;

DEFINE INDEX idx_dict_word ON user_dictionary FIELDS project_id, word UNIQUE;

-- ═══════════════════════════════════════════════
-- AI: Кэш интернета
-- ═══════════════════════════════════════════════
DEFINE TABLE web_cache SCHEMAFULL;
DEFINE FIELD project_id   ON web_cache TYPE record<projects>;
DEFINE FIELD url          ON web_cache TYPE string;
DEFINE FIELD source_type  ON web_cache TYPE string;
DEFINE FIELD content      ON web_cache TYPE string;
DEFINE FIELD embedding    ON web_cache TYPE option<array<float>>;
DEFINE FIELD fetched_at   ON web_cache TYPE datetime DEFAULT time::now();
DEFINE FIELD expires_at   ON web_cache TYPE option<datetime>;

-- ═══════════════════════════════════════════════
-- AI: Межчатовая память и сжатый контекст
-- ═══════════════════════════════════════════════
DEFINE TABLE agent_memory SCHEMAFULL;
DEFINE FIELD project_id   ON agent_memory TYPE record<projects>;
DEFINE FIELD memory_type  ON agent_memory TYPE string; -- "summary", "preference", "fact"
DEFINE FIELD content      ON agent_memory TYPE string;
DEFINE FIELD embedding    ON agent_memory TYPE option<array<float>>;
DEFINE FIELD importance   ON agent_memory TYPE int DEFAULT 5;
DEFINE FIELD created_at   ON agent_memory TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_memory_emb ON agent_memory FIELDS embedding HNSW DIMENSION 1536 DISTANCE COSINE;
```

---

## ЧАСТЬ 3: НОВЫЕ RUST-КОМАНДЫ И МОДУЛИ

### 3.1 Обновление Cargo.toml

```toml
# rusqlite — УДАЛИТЬ, не нужен с SurrealDB
surrealdb = { version = "3.0.4", features = ["kv-surrealkv"] }
# Добавить если нужен отдельный tokio runtime:
# tokio = { version = "1", features = ["full"] }
```

### 3.2 Новая структура модулей

```
src-tauri/src/logic/
├── mod.rs
├── projects.rs         -- без изменений
├── entity_schemas.rs   -- НОВЫЙ: CRUD типов сущностей
├── entities.rs         -- ПЕРЕПИСАТЬ: таблица entities
├── relations.rs        -- НОВЫЙ: RELATE + граф-траверсал
├── relation_schemas.rs -- НОВЫЙ: типы связей
├── chapters.rs         -- обновить: sort_order, summary, embedding
├── volumes.rs          -- без изменений
├── tags.rs             -- без изменений
├── plans.rs            -- ПЕРЕПИСАТЬ: parent_ref как Record
├── search.rs           -- НОВЫЙ: fulltext + vector
├── ai_context.rs       -- НОВЫЙ: AI-память
├── calendar.rs         -- без изменений
├── export.rs           -- без изменений
└── performance.rs      -- без изменений
```

### 3.3 Новые Tauri-команды

```rust
// === ENTITY SCHEMAS ===
get_entity_schemas(project) -> Vec<EntitySchema>
save_entity_schema(project, schema) -> EntitySchema
delete_entity_schema(project, type_key)

// === ENTITIES v2 (таблица entities) ===
get_entities_v2(project, entity_type) -> Vec<Entity>
get_entity_v2(id) -> Entity
save_entity_v2(project, entity_type, data, id?) -> {id}
delete_entity_v2(id)
search_entities(project, query) -> Vec<SearchResult>

// === RELATION SCHEMAS ===
get_relation_schemas(project) -> Vec<RelationSchema>
save_relation_schema(project, schema) -> RelationSchema
delete_relation_schema(project, rel_key)

// === ГРАФ ===
get_entity_relations(entity_id) -> GraphData        // связи сущности
get_graph_neighborhood(entity_id, depth) -> GraphData // N-hop траверсал
save_relation(project, from, to, rel_type, data) -> {id}
delete_relation(relation_id)
get_entity_appearances(entity_id) -> Vec<Appearance> // в каких главах
get_chapter_entities(chapter_id) -> Vec<Appearance>  // сущности главы
save_appearance(entity_id, chapter_id, role, notes)
delete_appearance(entity_id, chapter_id)

// === ПОИСК ===
search_fulltext(project, query) -> Vec<SearchResult>
search_vector(project, embedding, k) -> Vec<SearchResult>

// === AI CONTEXT ===
save_ai_context(project, content, embedding, source_type, source_id)
get_relevant_context(project, embedding, k) -> Vec<AiContext>
```

### 3.4 Ключевые паттерны Rust для SurrealDB 3.x

#### RELATE — создать граф-ребро
```rust
pub async fn save_relation(
    db: &Surreal<Db>, project: &str,
    from_id: &str, to_id: &str,
    rel_type: &str, data: &Value,
) -> Result<Value, String> {
    let mut res = db.query(
        "RELATE type::thing('entities', $from)
             ->entity_rel->
             type::thing('entities', $to)
         SET project_id = type::thing('projects', $proj),
             rel_type   = $rel_type,
             description = $desc,
             strength   = $strength,
             attributes = $attrs,
             created_at = time::now()
         RETURN type::string(id) AS id"
    )
    .bind(json!({
        "from": from_id, "to": to_id, "proj": project,
        "rel_type": rel_type,
        "desc":     data["description"].as_str().unwrap_or(""),
        "strength": data["strength"].as_i64().unwrap_or(5),
        "attrs":    data.get("attributes").cloned().unwrap_or(json!({}))
    }))
    .await.map_err(|e| e.to_string())?;
    let val: Option<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(val.unwrap_or(json!({"error": "not created"})))
}
```

#### Граф-траверсал
```rust
pub async fn get_entity_relations(
    db: &Surreal<Db>, entity_id: &str,
) -> Result<Value, String> {
    let mut res = db.query(
        "SELECT id, name,
            ->entity_rel->{rel_type, description, strength,
                out.{id, name, entity_type}} AS outgoing,
            <-entity_rel->{rel_type, description, strength,
                in.{id, name, entity_type}}  AS incoming
         FROM type::thing('entities', $id)"
    )
    .bind(json!({ "id": entity_id }))
    .await.map_err(|e| e.to_string())?;
    let val: Option<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(val.unwrap_or(json!({})))
}
```

#### Полнотекстовый поиск
```rust
pub async fn search_fulltext(
    db: &Surreal<Db>, project: &str, query: &str,
) -> Result<Value, String> {
    let mut res = db.query(
        "SELECT 'entity' AS kind, type::string(id) AS id,
                name, entity_type, search::score(1) AS score
         FROM entities
         WHERE project_id = type::thing('projects', $proj)
           AND (name @@@ $q OR description @@@ $q)
         UNION ALL
         SELECT 'chapter' AS kind, type::string(id) AS id,
                title AS name, NULL AS entity_type, search::score(1) AS score
         FROM chapters
         WHERE project_id = type::thing('projects', $proj)
           AND (title @@@ $q OR content @@@ $q)
         ORDER BY score DESC LIMIT 20"
    )
    .bind(json!({ "proj": project, "q": query }))
    .await.map_err(|e| e.to_string())?;
    let results: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(json!(results))
}
```

#### Векторный поиск (AI)
```rust
// embedding приходит с фронта (сгенерирован OpenRouter/Ollama)
pub async fn search_vector(
    db: &Surreal<Db>, project: &str,
    embedding: Vec<f32>, k: i64,
) -> Result<Value, String> {
    let mut res = db.query(
        "SELECT type::string(id) AS id, name, entity_type,
                vector::distance::cosine(embedding, $emb) AS similarity
         FROM entities
         WHERE project_id = type::thing('projects', $proj)
           AND embedding != NONE
           AND embedding <|$k, COSINE|> $emb
         ORDER BY similarity ASC LIMIT $k"
    )
    .bind(json!({ "proj": project, "emb": embedding, "k": k }))
    .await.map_err(|e| e.to_string())?;
    let results: Vec<Value> = res.take(0).map_err(|e| e.to_string())?;
    Ok(json!(results))
}
```

---

## ЧАСТЬ 4: МИГРАЦИЯ ДАННЫХ

### 4.1 Порядок шагов

```
1. Добавить новые таблицы в surreal_schema.surql
   (НЕ удалять старые — dynamic_entities, entity_connections)

2. Запустить миграционный SurrealQL (один раз):
   dynamic_entities → entities
   entity_connections → entity_rel

3. Проверить данные

4. Обновить Rust-команды (читать/писать из entities)

5. Обновить api.service.ts

6. Удалить старые таблицы
```

### 4.2 Миграционный скрипт (SurrealQL)

```sql
-- Мигрировать записи
FOR $e IN (SELECT * FROM dynamic_entities) {
    LET $name = $e.data.name
             ?? $e.data.имя
             ?? $e.data.название
             ?? "Без имени";
    LET $desc = $e.data.description
             ?? $e.data.описание
             ?? NONE;
    CREATE entities CONTENT {
        project_id:  $e.project_id,
        entity_type: $e.schema_type,
        name:        $name,
        description: $desc,
        attributes:  $e.data,
        created_at:  $e.created_at,
        updated_at:  $e.updated_at
    };
};

-- Мигрировать связи
FOR $c IN (SELECT *, type::string(in) AS src, type::string(out) AS tgt
           FROM entity_connections) {
    LET $from_id = $c.src.split(':')[1];
    LET $to_id   = $c.tgt.split(':')[1];
    RELATE type::thing('entities', $from_id)
        ->entity_rel->
        type::thing('entities', $to_id)
    SET project_id  = $c.project_id,
        rel_type    = $c.role,
        description = $c.description,
        created_at  = time::now();
};

-- Создать entity_schemas из уникальных типов
FOR $t IN (SELECT DISTINCT entity_type AS t FROM entities) {
    UPSERT entity_schemas SET type_key  = $t.t,
                              type_name = $t.t,
                              icon = "📄", color = "#888888"
    WHERE type_key = $t.t;
};
```

---

## ЧАСТЬ 5: GRAPHRAG И AI-АРХИТЕКТУРА

### 5.1 Что создать сейчас (AI придёт позже)

| Структура | Готова сейчас | AI использует |
|-----------|-------------|--------------|
| `entity_rel` граф-рёбра | ✅ | Для GraphRAG траверсала |
| `appears_in` связи глава↔сущность | ✅ | Контекст для LLM |
| `entities.embedding` поле | ✅ (NULL пока) | Векторный поиск |
| `chapters.embedding` поле | ✅ (NULL пока) | Семантический поиск |
| `ai_context` таблица | ✅ | Память агента |
| FULLTEXT индексы | ✅ | Гибридный поиск |
| HNSW индексы | ✅ (пустые) | Ждут embeddings |

### 5.2 GraphRAG-запрос (когда AI появится)

```sql
-- Найти всё связанное с запросом пользователя
LET $seeds = SELECT id, name FROM entities
    WHERE embedding <|5, COSINE|> $query_embedding
    AND project_id = $proj;

LET $graph = SELECT id, name,
    ->entity_rel.{rel_type, description, out.{id, name}} AS out_rels,
    <-entity_rel.{rel_type, description, in.{id, name}}  AS in_rels
FROM $seeds[*].id;

LET $chapters = SELECT id, title, summary,
    <-appears_in<-entities.{name, entity_type} AS characters
FROM chapters
WHERE id INSIDE (
    SELECT ->appears_in->chapters.id FROM $seeds[*].id
);

RETURN { seeds: $seeds, graph: $graph, chapters: $chapters };
```

### 5.3 Архитектура AI-интеграции (план)

```
Фронт (Vue)
  ↓ текст запроса
OpenRouter API / Ollama
  ↓ embedding [f32; 1536]
Tauri Command: search_vector / get_relevant_context
  ↓
SurrealDB HNSW поиск
  ↓ топ-K результатов
Graф-траверсал (GraphRAG)
  ↓ расширенный контекст
OpenRouter API: LLM с контекстом
  ↓ ответ
Фронт (Vue) — отображение
```

---

## ИТОГО: ОЧЕРЁДНОСТЬ РЕАЛИЗАЦИИ

| # | Задача | Приоритет |
|---|--------|-----------|
| 1 | Обновить `surreal_schema.surql` | 🔴 СЕЙЧАС |
| 2 | `entity_schemas.rs` — CRUD типов сущностей | 🔴 СЕЙЧАС |
| 3 | `entities.rs` v2 — новая таблица | 🔴 СЕЙЧАС |
| 4 | `relations.rs` — RELATE + граф | 🔴 СЕЙЧАС |
| 5 | `relation_schemas.rs` — типы связей | 🔴 СЕЙЧАС |
| 6 | `main.rs` — зарегистрировать команды | 🔴 СЕЙЧАС |
| 7 | Миграция данных | 🟠 ВАЖНО |
| 8 | `search.rs` — fulltext поиск | 🟠 ВАЖНО |
| 9 | `api.service.ts` — новые методы | 🟠 ВАЖНО |
| 10 | `ai_context.rs` — AI-память | 🟢 БУДУЩЕЕ |
| 11 | Векторный поиск (search_vector) | 🟢 БУДУЩЕЕ |
| 12 | GraphRAG-запросы | 🟢 БУДУЩЕЕ |
