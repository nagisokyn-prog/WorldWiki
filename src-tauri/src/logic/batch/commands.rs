//! IPC layer for module `batch`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;
use crate::logic::models::{Entity, EntityRel};
use serde_json::{Map, Value};

#[tauri::command]
pub async fn get_entities_batch(
    project: String,
    entity_types: Vec<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Map<String, Value>, String> {
    get_entities_batch_inner(&state.db, &project, entity_types).await
}

#[tauri::command]
pub async fn upsert_connections_batch(
    project: String,
    source_type: String,
    source_id: String,
    connections: Vec<EntityRel>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    upsert_connections_batch_inner(&state.db, &project, &source_type, &source_id, connections).await
}

#[tauri::command]
pub async fn save_entity_with_relations(
    project: String,
    entity: Entity,
    foreign_updates: Vec<Entity>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Entity, String> {
    save_entity_with_relations_inner(&state.db, &project, entity, foreign_updates).await
}
