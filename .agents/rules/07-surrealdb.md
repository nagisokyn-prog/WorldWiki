# 🗄️ ПРАВИЛО 07: УНИВЕРСАЛЬНЫЙ ИНЖЕНЕРНЫЙ СТАНДАРТ РАБОТЫ С SURREALDB (v3.2+)

> **ОБЛАСТЬ ДЕЙСТВИЯ**: Любой сервис, бекенд-модуль, скрипт миграции или DDL-файл монорепозитория, взаимодействующий с SurrealDB (Embedded SurrealKV / Remote WebSocket / HTTP).  
> **ЦЕЛЕВАЯ ВЕРСИЯ ДВИЖКА**: **SurrealDB v3.2+**  
> **СТАТУС**: КРИТИЧЕСКИЙ АРХИТЕКТУРНЫЙ СТАНДАРТ (Автоматический аудит и блокировка PR/коммитов).

---

## 🛑 1. ЖЕСТКИЙ РЕЕСТР ИНВАРИАНТОВ И КРИТЕРИЕВ (HARD INVARIANTS)

Каждый агент и разработчик обязан неукоснительно соблюдать следующие правила:

| Код | Инвариант | Требование | Ошибка аудита |
|---|---|---|---|
| **SDB-001** | **Строгая типизация `SCHEMAFULL`** | Все таблицы по умолчанию объявляются `SCHEMAFULL`. | 🔴 Использование `SCHEMALESS` или `TYPE NORMAL` для доменных сущностей. |
| **SDB-002** | **100% Идемпотентность DDL** | Любое DDL-выражение обязано содержать ключевое слово `OVERWRITE`. | 🔴 `DEFINE TABLE/FIELD/INDEX` без `OVERWRITE` (приводит к падению повторной накатки). |
| **SDB-003** | **100% Параметризация запросов** | Любой динамический параметр передается **СТРОГО** через `.bind()`. | 🔴 **CRITICAL**: Строковая конкатенация / `format!("SELECT ... WHERE id = '{id}'")`. |
| **SDB-004** | **Защита ревизий от векторов** | Тяжелые float-массивы (HNSW/embeddings) **ЗАПРЕЩЕНО** сохранять в исторические снимки/ревизии. | 🔴 Копирование `$before` с полем `embeddings` в таблицы аудита/версий. |
| **SDB-005** | **Изоляция низкоуровневых типов** | Типы драйвера (`surrealdb::sql::Thing`, `surrealdb::Value`) **НЕ ДОЛЖНЫ** покидать слой инфраструктуры. | 🔴 Проникновение `Thing` или `Value` в доменные структуры или сигнатуры `application`. |
| **SDB-006** | **Обязательные FK-индексы** | Все поля внешних связей (`*_id`, `parent_ref`) обязаны иметь явный B-Tree индекс `FIELDS`. | 🔴 Отсутствие `DEFINE INDEX` на поле, используемом в `WHERE` каскадного удаления. |
| **SDB-007** | **Атомарные выборки через `fn::*`** | Сложные выборки (RAG, граф, агрегации) упаковываются в хранимые функции, а не циклы в коде. | 🔴 Серия из 5+ последовательных мелких запросов из бэкенда вместо 1 вызова `fn::*`. |
| **SDB-008** | **Каскад на уровне DDL-событий** | Удаление дерева дочерних записей реализуется через `EVENT ... WHEN $event = "DELETE"`. | 🔴 Ручные циклы удаления зависимостей в коде Rust/TypeScript. |

---

## 📦 2. РЕКОМЕНДУЕМЫЙ СТЕК, ЗАВИСИМОСТИ И ТАКСОНОМИЯ ФАЙЛОВ

### 2.1. Оптимальные Rust-зависимости (Crates)
Для максимальной производительности встроенного движка SurrealDB (SurrealKV) и эргономичной работы рекомендуется стек:
* `surrealdb = { version = "2.2", features = ["kv-surrealkv"] }` (или `v3.x`) — Встраиваемый KV-движок без внешних демонов.
* `serde = { version = "1.0", features = ["derive"] }` + `serde_json` — Строго типизированная сериализация DTO.
* `async-trait = "0.1"` — Реализация портов репозиториев поверх `Surreal<Db>`.
* `tokio = { version = "1.0", features = ["full"] }` — Асинхронный рантайм.
* `uuid = { version = "1.0", features = ["v4", "serde"] }` — Генерация детерминированных ID.

### 2.2. Паттерн Модульной Схемы (Modular Schema Files)
Вместо единого монолитного файла на 2000 строк схема разделяется на **строго упорядоченные слои**:

```
logic/schema/
├── 01_core.surql             # 🟢 Ядро: базовые сущности, связи, ревизии, каскадный триггер
├── 02_ai_workspace.surql     # 🧠 ИИ-слой: чаты, контекст, память, конфигурации моделей
├── 03_web_research.surql     # 🌐 Веб-слой: кэш страниц, база фактов и доказательств
├── 04_embeddings_hnsw.surql  # ⚡ Векторный слой: HNSW-индексы и чанки эмбеддингов
└── 05_functions.surql        # 🔮 Аналитический слой: хранимые функции (fn::gather_rag_bundle)
```

**Преимущества паттерна**:
1. **Продуктовые редакции (Editions)**: Легковесная версия накатывает только `01_core.surql`, Ultra-версия — все модули.
2. **Бесшовный накопительный апгрейд**: Переход на расширенную редакцию — это просто донакатка файлов `02..05`.
3. **Dead Code Elimination**: Тесты или сборки без ИИ компилируются без лишних индексов.

---

## 🏛️ 3. ПАТТЕРНЫ МОДЕЛИРОВАНИЯ СХЕМЫ (SURREALQL DDL)

### 3.1. Каноническое объявление таблицы и полей
```sql
-- 1. Таблица со строгой схемой и changefeed для реактивной синхронизации
DEFINE TABLE OVERWRITE entities SCHEMAFULL CHANGEFEED 30d;

-- 2. Строгие поля с дефолтными значениями
DEFINE FIELD OVERWRITE project_id   ON entities TYPE record<projects>;
DEFINE FIELD OVERWRITE name         ON entities TYPE string;
DEFINE FIELD OVERWRITE description  ON entities TYPE option<string>;
DEFINE FIELD OVERWRITE tags         ON entities TYPE array<string> DEFAULT [];
DEFINE FIELD OVERWRITE created_at   ON entities TYPE datetime DEFAULT time::now();
DEFINE FIELD OVERWRITE updated_at   ON entities TYPE datetime DEFAULT time::now();

-- 3. FLEXIBLE разрешён ТОЛЬКО для динамических пользовательских данных
DEFINE FIELD OVERWRITE attributes   ON entities TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE embeddings   ON entities TYPE object FLEXIBLE DEFAULT {};
```

### 3.2. Стратегия Индексации: B-Tree, BM25 и Векторный HNSW
```sql
-- А. B-Tree индекс для быстрых выборок и каскадных удалений
DEFINE INDEX OVERWRITE idx_entity_project ON entities FIELDS project_id;

-- Б. Полнотекстовый многоязычный BM25 поиск
DEFINE ANALYZER OVERWRITE ru_en_analyzer TOKENIZERS class, blank FILTERS lowercase, snowball(russian), snowball(english);
DEFINE INDEX OVERWRITE idx_entity_name_ft ON entities COLUMNS name FULLTEXT ANALYZER ru_en_analyzer BM25;

-- В. Векторный HNSW индекс с косинусным расстоянием
DEFINE INDEX OVERWRITE idx_entity_emb_nemotron ON entities COLUMNS embeddings.nemotron HNSW DIMENSION 2048 DIST COSINE;
```

### 3.3. Нативные Графовые Рёбра (Graph Relations)
Вместо связующих таблиц Many-to-Many с двумя ID используются нативные типизированные рёбра:
```sql
DEFINE TABLE OVERWRITE entity_rel TYPE RELATION IN entities OUT entities SCHEMAFULL;
DEFINE FIELD OVERWRITE project_id  ON entity_rel TYPE record<projects>;
DEFINE FIELD OVERWRITE rel_type    ON entity_rel TYPE string;
DEFINE FIELD OVERWRITE strength    ON entity_rel TYPE option<int>;
DEFINE FIELD OVERWRITE attributes  ON entity_rel TYPE object FLEXIBLE DEFAULT {};

DEFINE INDEX OVERWRITE idx_rel_project ON entity_rel FIELDS project_id;
```

### 3.4. Двухуровневая История и Защита от Раздувания (CHANGEFEED vs Revisions)

В SurrealDB строго разделяются два слоя отслеживания изменений:
1. **`CHANGEFEED 30d` (Реактивный поток дельт)**: Предназначен для `LIVE SELECT` синхронизации окон UI и сессионного undo. Не используется для долговременного git-подобного отката из-за TTL 30 дней и замусоривания фоновыми векторными апдейтами.
2. **`*_revisions` (Семантические Git-like снимки)**: Долгосрочная типизированная история правок автора, очищенная от векторов.

```sql
DEFINE TABLE OVERWRITE entity_revisions SCHEMAFULL;
DEFINE FIELD OVERWRITE target_id   ON entity_revisions TYPE record<entities>;
DEFINE FIELD OVERWRITE project_id  ON entity_revisions TYPE record<projects>;
DEFINE FIELD OVERWRITE content     ON entity_revisions TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD OVERWRITE created_at  ON entity_revisions TYPE datetime DEFAULT time::now();

-- Триггер срабатывает ТОЛЬКО на содержательные изменения, игнорируя пересчёт векторов
DEFINE EVENT OVERWRITE log_entity_revision ON TABLE entities 
    WHEN $event = "UPDATE" 
    AND (
        $before.name != $after.name 
        OR $before.description != $after.description 
        OR $before.attributes != $after.attributes 
        OR $before.tags != $after.tags
    ) 
    THEN {
        CREATE entity_revisions SET 
            target_id = $before.id, 
            project_id = $before.project_id, 
            content = {
                name: $before.name,
                description: $before.description,
                attributes: $before.attributes,
                tags: $before.tags
            }, 
            created_at = time::now();
    };

-- Версионирование связей лора: CREATE, UPDATE и DELETE
DEFINE EVENT OVERWRITE log_entity_rel_create ON TABLE entity_rel 
    WHEN $event = "CREATE" 
    THEN {
        CREATE entity_rel_revisions SET 
            target_id = $after.id, 
            project_id = $after.project_id, 
            in_id = $after.in, 
            out_id = $after.out, 
            action = "CREATE", 
            content = { rel_type: $after.rel_type, strength: $after.strength, attributes: $after.attributes }, 
            created_at = time::now();
    };

DEFINE EVENT OVERWRITE log_entity_rel_delete ON TABLE entity_rel 
    WHEN $event = "DELETE" 
    THEN {
        CREATE entity_rel_revisions SET 
            target_id = $before.id, 
            project_id = $before.project_id, 
            in_id = $before.in, 
            out_id = $before.out, 
            action = "DELETE", 
            content = { rel_type: $before.rel_type, strength: $before.strength, attributes: $before.attributes }, 
            created_at = time::now();
    };
```

---

## 🦀 4. ПАТТЕРНЫ ВЗАИМОДЕЙСТВИЯ НА БЭКЕНДЕ (RUST SDK)

### 4.1. Безопасный параметризованный запрос
```rust
pub async fn search_entities(
    db: &Surreal<Db>,
    project_id: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<EntityDto>, DomainError> {
    let clean_pid = clean_record_id("projects", project_id);
    
    let sql = "SELECT * FROM entities WHERE project_id = type::record('projects', $pid) AND (name @1@ $q OR description @1@ $q) LIMIT $limit;";
    
    let mut response = db.query(sql)
        .bind(("pid", clean_pid))
        .bind(("q", query.to_string()))
        .bind(("limit", limit as i64))
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        
    let entities: Vec<EntityDto> = response.take(0)
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        
    Ok(entities)
}
```

### 4.2. Канонизация и очистка Record ID
```rust
/// Очищает ID от скобок SurrealDB ⟨...⟩, кавычек и гарантирует префикс таблицы
pub fn clean_record_id(default_table: &str, raw: &str) -> String {
    let trimmed = raw.trim().trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'');
    if trimmed.is_empty() {
        return String::new();
    }
    if let Some((tbl, id_part)) = trimmed.split_once(':') {
        let clean_id = id_part.trim().trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'');
        format!("{}:{}", tbl.trim(), clean_id)
    } else {
        format!("{}:{}", default_table, trimmed)
    }
}
```

### 4.3. Вызов Хранимых Функций (Atomic Roundtrip)
```rust
pub async fn gather_rag_bundle(
    db: &Surreal<Db>,
    project_id: &str,
    query: &str,
    top_k: usize,
) -> Result<RagBundleDto, DomainError> {
    let clean_pid = clean_record_id("projects", project_id);
    let sql = "RETURN fn::gather_rag_bundle(type::record('projects', $pid), $q, $limit, $rel_limit);";
    
    let mut resp = db.query(sql)
        .bind(("pid", clean_pid))
        .bind(("q", query.to_string()))
        .bind(("limit", top_k as i64))
        .bind(("rel_limit", (top_k * 2) as i64))
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        
    let bundle: Option<RagBundleDto> = resp.take(0).ok().flatten();
    bundle.ok_or_else(|| DomainError::NotFound("Empty RAG bundle".to_string()))
}
```

---

## 🎨 5. СТАНДАРТЫ ПЕРЕДАЧИ ДАННЫХ НА ФРОНТЕНД (IPC / DTO)

1. **Плоская DTO-сериализация**:
   * Все `record<...>` сериализуются в строковые идентификаторы вида `"entities:char_123"`.
   * Даты сериализуются в стандартный ISO-8601 (`"2026-09-11T12:00:00Z"`).
2. **Событийная реактивность (Event-Driven UI)**:
   * Мутации в БД публикуют события в шину (`EventPublisherPort`).
   * UI подписывается на события через IPC и обновляет локальные Pinia Stores оптимистично или реактивно без полной перезагрузки экрана (F5).
3. **Строгая типизация контрактов**:
   * Для каждой таблицы в базе на фронтенде создается парный TypeScript-интерфейс в `*.model.ts` с идентичными именами полей.
