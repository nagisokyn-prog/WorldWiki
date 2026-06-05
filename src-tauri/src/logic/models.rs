use surreal_domain::*;

// =====================================================
// AI-ИНФРАСТРУКТУРА (системные таблицы)
// =====================================================

// 1. Семантический чанкинг
surreal_entity! {
    #[table = "text_blocks"]
    #[project_scoped]
    #[tauri_commands]
    pub struct TextBlock {
        pub chapter_id: String,
        pub block_type: String, // "thought", "dialogue", "description"
        pub order_index: i64,
        #[fulltext] pub content: String,
        #[hnsw] pub embedding: Option<Vec<f32>>,
    }
}

// 2. Древовидный чат с ветвлением и цитированием
surreal_entity! {
    #[table = "chat_messages"]
    #[project_scoped]
    #[tauri_commands]
    pub struct ChatMessage {
        pub session_id: String,
        pub role: String, // "user", "assistant"
        #[fulltext] pub content: String,
        pub parent_msg_id: Option<String>,
        pub version: i64,
        #[flexible] pub quoted_context: Option<serde_json::Value>,
        #[fulltext] pub edited_content: Option<String>,
        pub feedback_comment: Option<String>,
        pub rag_was_bad: bool,
        #[hnsw] pub embedding: Option<Vec<f32>>,
    }
}

// 3. Динамический словарь
surreal_entity! {
    #[table = "user_dictionary"]
    #[project_scoped]
    #[tauri_commands]
    pub struct DictionaryWord {
        pub word: String,
        #[fulltext] pub definition: Option<String>,
        pub is_approved: bool,
        pub confidence: f64,
    }
}

// 4. Кэш знаний из интернета
surreal_entity! {
    #[table = "web_cache"]
    #[project_scoped]
    #[tauri_commands]
    pub struct WebCache {
        pub url: String,
        pub source_type: String,
        #[fulltext] pub content: String,
        #[hnsw] pub embedding: Option<Vec<f32>>,
        pub fetched_at: String,
        pub expires_at: Option<String>,
    }
}

// 5. Межчатовая память
surreal_entity! {
    #[table = "agent_memory"]
    #[project_scoped]
    #[tauri_commands]
    pub struct AgentMemory {
        pub memory_type: String, // "summary", "user_preference", "fact"
        #[fulltext] pub content: String,
        #[hnsw] pub embedding: Option<Vec<f32>>,
        pub importance: i64,
    }
}

// =====================================================
// СИСТЕМНЫЕ СУЩНОСТИ (фиксированная схема)
// =====================================================

// Forced rebuild for macro update
surreal_entity! {
    #[table = "calendars"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Calendar {
        pub name: String,
        #[serde(skip_serializing_if = "Option::is_none")] pub description: Option<String>,
        #[flexible] pub data: serde_json::Value,
        pub is_default: bool,
    }
}

surreal_entity! {
    #[table = "volumes"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Volume {
        pub title: String,
        pub sort_order: i64,
    }
}

surreal_entity! {
    #[table = "arcs"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Arc {
        pub title: String,
        #[serde(rename = "volumeId")] pub volume_id: Option<String>,
        pub sort_order: i64,
    }
}

surreal_entity! {
    #[table = "chapters"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Chapter {
        pub title: String,
        pub content: String,
        #[serde(alias = "arcId", skip_serializing_if = "Option::is_none")] pub arc_id: Option<String>,
        #[serde(alias = "volumeId", skip_serializing_if = "Option::is_none")] pub volume_id: Option<String>,
        #[serde(default, alias = "wordCount")] pub word_count: i64,
        #[serde(default, alias = "sortOrder")] pub sort_order: i64,
        // Поля которые раньше терялись в normalize_chapter_data (#8 fix)
        #[flexible] #[serde(skip_serializing_if = "Option::is_none")] pub footnotes: Option<serde_json::Value>,
        #[serde(alias = "timelineEvents", skip_serializing_if = "Option::is_none")] #[flexible] pub timeline_events: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")] pub participants: Option<Vec<String>>,
    }
}

surreal_entity! {
    #[table = "tags"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Tag {
        pub name: String,
        pub color: String,
    }
}

surreal_entity! {
    #[table = "plans"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Plan {
        pub title: String,
        pub parent_ref: Option<String>,  // RecordId как строка
        pub parent_type: String,         // "chapter" | "arc" | "volume"
        pub sort_order: i64,
        pub completed: bool,
    }
}

// =====================================================
// ПОЛЬЗОВАТЕЛЬСКИЕ СУЩНОСТИ (универсальная таблица)
// Не используют surreal_entity! — они DTO поверх `entities` таблицы
// =====================================================

use serde::{Deserialize, Serialize};

/// Пользовательская сущность — Персонаж, Корабль, Фракция и т.д.
/// Все хранятся в одной таблице `entities` с разными `entity_type`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    #[serde(skip_serializing_if = "Option::is_none")] pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub project_id: Option<String>,
    pub entity_type: String,              // ключ из entity_schemas
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")] pub description: Option<String>,
    #[serde(default)] pub attributes: serde_json::Value,    // FLEXIBLE: все пользовательские поля
    #[serde(default)] pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub embedding: Option<Vec<f32>>,
    #[serde(skip_serializing_if = "Option::is_none")] pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] pub updated_at: Option<String>,
}

/// Схема типа сущности — определяет пользователь через UI (RedactSandbox)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitySchema {
    pub id: Option<String>,
    pub project_id: Option<String>,
    pub type_key: String,               // "character", "location", "ship"
    pub type_name: String,              // "Персонаж", "Локация", "Корабль"
    pub icon: String,
    pub color: String,
    pub fields_schema: Vec<FieldDef>,   // определения полей типа
    pub full_schema: Option<serde_json::Value>, // полный JSON макет UI
    pub created_at: Option<String>,
}

/// Определение одного поля в схеме сущности
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDef {
    pub key: String,                         // "birth_year"
    pub label: String,                       // "Год рождения"
    pub field_type: String,                  // "string" | "number" | "date" | "text" | "select" | "entity_ref"
    pub required: bool,
    pub options: Option<Vec<String>>,        // для select
    pub ref_entity_type: Option<String>,     // для entity_ref
    pub default_value: Option<serde_json::Value>,
}

/// Связь между двумя сущностями
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityRel {
    pub id: Option<String>,
    pub r#in: Option<String>,               // entities:xxx
    pub out: Option<String>,                // entities:yyy
    pub project_id: Option<String>,
    pub rel_type: String,                   // "knows", "owns", "lives_in"
    pub description: Option<String>,
    pub strength: Option<i64>,
    #[serde(default)] pub attributes: serde_json::Value,
    pub start_chapter: Option<String>,
    pub end_chapter: Option<String>,
    pub created_at: Option<String>,
}

/// Схема типа связи — определяет пользователь
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationSchema {
    pub id: Option<String>,
    pub project_id: Option<String>,
    pub rel_key: String,
    pub rel_name: String,
    pub icon: String,
    pub color: String,
    pub directed: bool,
    pub from_types: Vec<String>,  // допустимые типы source
    pub to_types: Vec<String>,    // допустимые типы target
}

// =====================================================
// ГРАФ СВЯЗЕЙ (системное ребро для AI)
// =====================================================

surreal_relation! {
    #[edge = "cites"]
    #[from = chat_messages]
    #[to = text_blocks]
    #[tauri_commands]
    pub struct Cites {
        pub relevance_score: f64,
    }
}

// Только системные сущности регистрируем через макрос (для DDL и CRUD)
surreal_schema! {
    entities: [
        TextBlock, ChatMessage, DictionaryWord, WebCache, AgentMemory,
        Calendar, Volume, Arc, Chapter, Tag, Plan
    ],
    relations: [Cites]
}
