//! IPC-слой сущностей: только `#[tauri::command]`-обёртки.
//! Вся бизнес-логика живёт в `mod.rs` (функции `*_inner`).
//! Архитектурное соглашение: этот файл не содержит логики —
//! каждая команда распаковывает `State` и вызывает ядро.

use super::{
    get_entity_revisions_inner, get_entities_inner, get_entity_inner, get_entity_relations_inner,
    get_entity_schemas_inner, get_relation_schemas_inner, get_schema_history_inner,
    save_entity_inner, save_entity_schema_inner, save_relation_schema_inner,
    search_entities_inner, toggle_entity_history_pin_inner, toggle_schema_history_pin_inner,
    create_entity_relation_inner, delete_entity_inner, delete_entity_relation_inner,
    delete_entity_schema_inner, delete_relation_schema_inner, SchemaHistoryEntry,
};
use crate::logic::models::{Entity, EntityRel, EntitySchema, RelationSchema};
use serde_json::Value;

#[tauri::command]
pub async fn get_entities(
    project: String,
    entity_type: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Entity>, String> {
    get_entities_inner(&state.db, &project, entity_type).await
}

#[tauri::command]
pub async fn get_entity(
    id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Option<Entity>, String> {
    get_entity_inner(&state.db, &id).await
}

#[tauri::command]
pub async fn save_entity(
    project: String,
    entity: Entity,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Entity, String> {
    save_entity_inner(&state.db, &project, entity).await
}

#[tauri::command]
pub async fn delete_entity(
    id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    delete_entity_inner(&state.db, &id).await
}

#[tauri::command]
pub async fn search_entities(
    project: String,
    query: String,
    entity_type: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Entity>, String> {
    search_entities_inner(&state.db, &project, &query, entity_type).await
}

#[tauri::command]
pub async fn get_entity_schemas(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<EntitySchema>, String> {
    get_entity_schemas_inner(&state.db, &project).await
}

#[tauri::command]
pub async fn save_entity_schema(
    project: String,
    schema: EntitySchema,
    max_saves: Option<usize>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<EntitySchema, String> {
    save_entity_schema_inner(&state.db, &project, schema, max_saves).await
}

#[tauri::command]
pub async fn delete_entity_schema(
    project: String,
    type_key: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    delete_entity_schema_inner(&state.db, &project, &type_key).await
}

#[tauri::command]
pub async fn get_schema_history(
    project: String,
    type_key: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<SchemaHistoryEntry>, String> {
    get_schema_history_inner(&state.db, &project, &type_key).await
}

#[tauri::command]
pub async fn toggle_schema_history_pin(
    history_id: String,
    is_pinned: bool,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    toggle_schema_history_pin_inner(&state.db, &history_id, is_pinned).await
}

#[tauri::command]
pub async fn get_entity_relations(
    project: String,
    entity_id: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<EntityRel>, String> {
    get_entity_relations_inner(&state.db, &project, entity_id).await
}

#[tauri::command]
pub async fn create_entity_relation(
    project: String,
    from_id: String,
    to_id: String,
    rel: EntityRel,
    state: tauri::State<'_, crate::AppState>,
) -> Result<EntityRel, String> {
    create_entity_relation_inner(&state.db, &project, &from_id, &to_id, rel).await
}

#[tauri::command]
pub async fn delete_entity_relation(
    id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    delete_entity_relation_inner(&state.db, &id).await
}

#[tauri::command]
pub async fn get_relation_schemas(
    project: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<RelationSchema>, String> {
    get_relation_schemas_inner(&state.db, &project).await
}

#[tauri::command]
pub async fn save_relation_schema(
    project: String,
    schema: RelationSchema,
    state: tauri::State<'_, crate::AppState>,
) -> Result<RelationSchema, String> {
    save_relation_schema_inner(&state.db, &project, schema).await
}

#[tauri::command]
pub async fn delete_relation_schema(
    project: String,
    rel_key: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    delete_relation_schema_inner(&state.db, &project, &rel_key).await
}

#[tauri::command]
pub async fn get_entity_revisions(
    _project: String,
    entity_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<Value>, String> {
    get_entity_revisions_inner(&state.db, &entity_id).await
}

#[tauri::command]
pub async fn toggle_entity_history_pin(
    history_id: String,
    is_pinned: bool,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    toggle_entity_history_pin_inner(&state.db, &history_id, is_pinned).await
}
