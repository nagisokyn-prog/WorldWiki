use serde::{Deserialize, Serialize};
use surreal_domain::*;

// =====================================================
// AI-ИНФРАСТРУКТУРА (системные таблицы)
// =====================================================

surreal_entity! {
    #[table = "auto_approval_settings"]
    #[project_scoped]
    #[tauri_commands]
    pub struct AutoApprovalSetting {
        pub enabled: bool,
        #[flexible] pub categories: serde_json::Value,
        #[flexible] pub allowlist: serde_json::Value,
        #[flexible] pub denylist: serde_json::Value,
        #[serde(default)] pub is_global: bool,
    }
}

surreal_entity! {
    #[table = "ai_profiles"]
    #[project_scoped]
    #[tauri_commands]
    pub struct AiProfile {
        pub name: String,
        pub provider: String,
        pub base_url: Option<String>,
        pub api_key: Option<String>,
        #[flexible] pub settings: serde_json::Value,
        pub is_active: bool,
        #[serde(default)] pub is_global: bool,
    }
}

surreal_entity! {
    #[table = "ai_modes"]
    #[project_scoped]
    #[tauri_commands]
    pub struct AiMode {
        pub slug: String,
        pub name: String,
        pub role_definition: String,
        pub custom_instructions: String,
        pub api_profile_id: Option<String>,
        pub allowed_tools: Vec<String>,
        #[serde(default)] pub is_global: bool,
    }
}

surreal_entity! {
    #[table = "artifacts"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Artifact {
        pub chat_id: Option<String>,
        pub r#type: String, // document, code, table, graph
        pub title: String,
        #[fulltext] pub content: String,
        pub version: i64,
    }
}

surreal_entity! {
    #[table = "ai_skills"]
    #[project_scoped]
    #[tauri_commands]
    pub struct AiSkill {
        pub name: String,
        pub description: String,
        pub prompt_text: String,
        pub is_unlocked: bool,
        pub is_custom_author_style: bool,
    }
}

surreal_entity! {
    #[table = "chats"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Chat {
        pub title: String,
        pub tag: Option<String>,
        #[flexible] pub session_context: Vec<serde_json::Value>,
    }
}

surreal_entity! {
    #[table = "chat_messages"]
    #[project_scoped]
    #[tauri_commands]
    pub struct ChatMessage {
        pub role: String, // "user", "assistant"
        #[fulltext] pub content: String,
        pub version: i64,
        #[flexible] pub quoted_context: Option<serde_json::Value>,
        #[fulltext] pub edited_content: Option<String>,
        pub feedback_comment: Option<String>,
        pub rag_was_bad: bool,
        #[flexible] #[serde(skip_serializing_if = "Option::is_none")] pub embeddings: Option<serde_json::Value>,
    }
}

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

surreal_entity! {
    #[table = "web_cache"]
    #[project_scoped]
    #[tauri_commands]
    pub struct WebCache {
        pub url: String,
        pub source_type: String,
        #[fulltext] pub content: String,
        #[flexible] #[serde(skip_serializing_if = "Option::is_none")] pub embeddings: Option<serde_json::Value>,
        pub fetched_at: String,
        pub expires_at: Option<String>,
    }
}

surreal_entity! {
    #[table = "agent_memory"]
    #[project_scoped]
    #[tauri_commands]
    pub struct AgentMemory {
        pub memory_type: String, // "summary", "user_preference", "fact"
        #[fulltext] pub content: String,
        #[flexible] #[serde(skip_serializing_if = "Option::is_none")] pub embeddings: Option<serde_json::Value>,
        pub importance: i64,
    }
}

surreal_entity! {
    #[table = "text_blocks"]
    #[project_scoped]
    #[tauri_commands]
    pub struct TextBlock {
        pub chapter_id: String,
        pub block_type: String, // "thought", "dialogue", "description"
        pub order_index: i64,
        #[fulltext] pub content: String,
        #[flexible] #[serde(skip_serializing_if = "Option::is_none")] pub embeddings: Option<serde_json::Value>,
    }
}

// =====================================================
// СИСТЕМНЫЕ СУЩНОСТИ (фиксированная схема)
// =====================================================

surreal_entity! {
    #[table = "calendars"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Calendar {
        pub name: String,
        #[serde(skip_serializing_if = "Option::is_none")] pub description: Option<String>,
        #[flexible] pub data: serde_json::Value,
        pub is_default: bool,
        #[serde(default)] pub is_master: bool,
    }
}

surreal_entity! {
    #[table = "volumes"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Volume {
        pub title: String,
    }
}

surreal_entity! {
    #[table = "arcs"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Arc {
        pub title: String,
    }
}

surreal_entity! {
    #[table = "chapters"]
    #[project_scoped]
    #[tauri_commands]
    pub struct Chapter {
        pub title: String,
        pub content: String,
        pub summary: Option<String>,
        #[serde(default, alias = "wordCount")] pub word_count: i64,
        #[flexible] #[serde(skip_serializing_if = "Option::is_none")] pub embeddings: Option<serde_json::Value>,
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
        pub parent_ref: Option<String>,
        pub parent_type: String,
        #[ts(type = "number")] pub sort_order: i64,
        pub completed: bool,
    }
}

// =====================================================
// ПОЛЬЗОВАТЕЛЬСКИЕ СУЩНОСТИ (универсальная таблица)
// =====================================================

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../../apps/spa/src/ts/types/generated/")]
pub struct Entity {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    pub entity_type: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    #[ts(type = "Record<string, any>")]
    pub attributes: serde_json::Value,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any")]
    pub embeddings: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../../apps/spa/src/ts/types/generated/")]
pub struct EntitySchema {
    pub id: Option<String>,
    pub project_id: Option<String>,
    pub type_key: String,
    pub type_name: String,
    pub icon: String,
    pub color: String,
    pub fields_schema: Vec<FieldDef>,
    #[ts(type = "any")]
    pub full_schema: Option<serde_json::Value>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../../apps/spa/src/ts/types/generated/")]
pub struct FieldDef {
    pub key: String,
    pub label: String,
    pub field_type: String,
    pub required: bool,
    pub options: Option<Vec<String>>,
    pub ref_entity_type: Option<String>,
    #[ts(type = "any")]
    pub default_value: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../../apps/spa/src/ts/types/generated/")]
pub struct EntityRel {
    pub id: Option<String>,
    pub r#in: Option<String>,
    pub out: Option<String>,
    pub project_id: Option<String>,
    pub rel_type: String,
    pub description: Option<String>,
    #[ts(type = "number")]
    pub strength: Option<i64>,
    #[serde(default)]
    #[ts(type = "Record<string, any>")]
    pub attributes: serde_json::Value,
    pub start_chapter: Option<String>,
    pub end_chapter: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[ts(export, export_to = "../../apps/spa/src/ts/types/generated/")]
pub struct RelationSchema {
    pub id: Option<String>,
    pub project_id: Option<String>,
    pub rel_key: String,
    pub rel_name: String,
    pub icon: String,
    pub color: String,
    pub directed: bool,
    pub from_types: Vec<String>,
    pub to_types: Vec<String>,
}

// =====================================================
// ГРАФ СВЯЗЕЙ (системные ребра)
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

surreal_relation! {
    #[edge = "contains"]
    #[from = volumes]
    #[to = arcs]
    #[tauri_commands]
    pub struct VolumeContainsArc {
        #[ts(type = "number")] pub sort_order: i64,
    }
}

surreal_relation! {
    #[edge = "contains"]
    #[from = arcs]
    #[to = chapters]
    #[tauri_commands]
    pub struct ArcContainsChapter {
        #[ts(type = "number")] pub sort_order: i64,
    }
}

surreal_relation! {
    #[edge = "contains"]
    #[from = projects]
    #[to = volumes]
    #[tauri_commands]
    pub struct ProjectContainsVolume {
        #[ts(type = "number")] pub sort_order: i64,
    }
}

surreal_relation! {
    #[edge = "contains"]
    #[from = chats]
    #[to = chat_messages]
    #[tauri_commands]
    pub struct ChatContainsMessage {
        #[ts(type = "number")] pub sort_order: i64,
    }
}

surreal_relation! {
    #[edge = "contains"]
    #[from = chat_messages]
    #[to = chat_messages]
    #[tauri_commands]
    pub struct MessageContainsMessage {
        #[ts(type = "number")] pub sort_order: i64,
    }
}

surreal_relation! {
    #[edge = "contains"]
    #[from = projects]
    #[to = chats]
    #[tauri_commands]
    pub struct ProjectContainsChat {
        #[ts(type = "number")] pub sort_order: i64,
    }
}

surreal_relation! {
    #[edge = "contains"]
    #[from = chats]
    #[to = chats]
    #[tauri_commands]
    pub struct ChatContainsChat {
        #[ts(type = "number")] pub sort_order: i64,
    }
}

surreal_schema! {
    entities: [
        TextBlock, ChatMessage, Chat, DictionaryWord, WebCache, AgentMemory,
        AutoApprovalSetting, AiProfile, Artifact, AiSkill,
        Calendar, Volume, Arc, Chapter, Tag, Plan
    ],
    relations: [
        Cites, VolumeContainsArc, ArcContainsChapter, ProjectContainsVolume,
        ChatContainsMessage, MessageContainsMessage, ProjectContainsChat, ChatContainsChat
    ]
}

#[cfg(test)]
mod ts_export_tests {
    use super::*;
    use ts_rs::TS;

    #[test]
    fn export_bindings() {
        let export_err_msg = "Failed to export TS bindings";
        Entity::export().expect(export_err_msg);
        EntitySchema::export().expect(export_err_msg);
        FieldDef::export().expect(export_err_msg);
        EntityRel::export().expect(export_err_msg);
        RelationSchema::export().expect(export_err_msg);
        AutoApprovalSetting::export().expect(export_err_msg);
        AiProfile::export().expect(export_err_msg);
        Artifact::export().expect(export_err_msg);
        AiSkill::export().expect(export_err_msg);
        Plan::export().expect(export_err_msg);
        Volume::export().expect(export_err_msg);
        Arc::export().expect(export_err_msg);
        Chapter::export().expect(export_err_msg);
        Tag::export().expect(export_err_msg);
        Calendar::export().expect(export_err_msg);
        Cites::export().expect(export_err_msg);
        Chat::export().expect(export_err_msg);
        ChatMessage::export().expect(export_err_msg);
        ChatContainsMessage::export().expect(export_err_msg);
        MessageContainsMessage::export().expect(export_err_msg);
        ProjectContainsChat::export().expect(export_err_msg);
        ChatContainsChat::export().expect(export_err_msg);
    }
}
