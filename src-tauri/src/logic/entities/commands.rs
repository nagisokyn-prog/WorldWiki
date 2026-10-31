//! IPC-слой сущностей: только `#[tauri::command]`-обёртки.
//! Вся бизнес-логика живёт в `mod.rs` (функции `*_inner`).
//! Архитектурное соглашение: типовые команды генерируются через `forward_ipc!`,
//! команды с кастомным логированием или сайд-эффектами остаются явными.

use super::{
    create_entity_relation_inner, delete_entity_inner, delete_entity_relation_inner,
    delete_entity_schema_inner, delete_relation_schema_inner, get_entities_inner, get_entity_inner,
    get_entity_relations_inner, get_entity_revisions_inner, get_entity_schemas_inner,
    get_relation_schemas_inner, get_schema_history_inner, save_entity_inner,
    save_entity_schema_inner, save_relation_schema_inner, search_entities_inner,
    toggle_entity_history_pin_inner, toggle_schema_history_pin_inner, EntityError,
    SchemaHistoryEntry,
};
use crate::forward_ipc;
use crate::logic::models::{Entity, EntityRel, EntitySchema, RelationSchema};
use serde_json::Value;

forward_ipc!(
    get_entities(project: String, entity_type: Option<String>) -> Result<Vec<Entity>, EntityError>
        => get_entities_inner(&project, entity_type)
);

forward_ipc!(
    get_entity(id: String) -> Result<Option<Entity>, EntityError>
        => get_entity_inner(&id)
);

forward_ipc!(
    save_entity(project: String, entity: Entity) -> Result<Entity, EntityError>
        => save_entity_inner(&project, entity)
);

/// Удаление сущности сохраняется в явном виде из-за подробного диагностического трейсинга.
#[tauri::command]
pub async fn delete_entity(
    id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), EntityError> {
    eprintln!("[IPC command] delete_entity requested for id='{}'", id);
    match delete_entity_inner(&state.db, &id).await {
        Ok(()) => {
            eprintln!("[IPC command] delete_entity succeeded for id='{}'", id);
            Ok(())
        }
        Err(e) => {
            eprintln!("[IPC command] delete_entity failed for id='{}': {:?}", id, e);
            Err(e)
        }
    }
}

forward_ipc!(
    search_entities(project: String, query: String, entity_type: Option<String>) -> Result<Vec<Entity>, EntityError>
        => search_entities_inner(&project, &query, entity_type)
);

forward_ipc!(
    get_entity_schemas(project: String) -> Result<Vec<EntitySchema>, EntityError>
        => get_entity_schemas_inner(&project)
);

forward_ipc!(
    save_entity_schema(project: String, schema: EntitySchema, max_saves: Option<usize>) -> Result<EntitySchema, EntityError>
        => save_entity_schema_inner(&project, schema, max_saves)
);

forward_ipc!(
    delete_entity_schema(project: String, type_key: String) -> Result<(), EntityError>
        => delete_entity_schema_inner(&project, &type_key)
);

forward_ipc!(
    get_schema_history(project: String, type_key: String) -> Result<Vec<SchemaHistoryEntry>, EntityError>
        => get_schema_history_inner(&project, &type_key)
);

forward_ipc!(
    toggle_schema_history_pin(history_id: String, is_pinned: bool) -> Result<(), EntityError>
        => toggle_schema_history_pin_inner(&history_id, is_pinned)
);

forward_ipc!(
    get_entity_relations(project: String, entity_id: Option<String>) -> Result<Vec<EntityRel>, EntityError>
        => get_entity_relations_inner(&project, entity_id)
);

forward_ipc!(
    create_entity_relation(project: String, from_id: String, to_id: String, rel: EntityRel) -> Result<EntityRel, EntityError>
        => create_entity_relation_inner(&project, &from_id, &to_id, rel)
);

forward_ipc!(
    delete_entity_relation(id: String) -> Result<(), EntityError>
        => delete_entity_relation_inner(&id)
);

forward_ipc!(
    get_relation_schemas(project: String) -> Result<Vec<RelationSchema>, EntityError>
        => get_relation_schemas_inner(&project)
);

forward_ipc!(
    save_relation_schema(project: String, schema: RelationSchema) -> Result<RelationSchema, EntityError>
        => save_relation_schema_inner(&project, schema)
);

forward_ipc!(
    delete_relation_schema(project: String, rel_key: String) -> Result<(), EntityError>
        => delete_relation_schema_inner(&project, &rel_key)
);

forward_ipc!(
    get_entity_revisions(_project: String, entity_id: String) -> Result<Vec<Value>, EntityError>
        => get_entity_revisions_inner(&entity_id)
);

forward_ipc!(
    toggle_entity_history_pin(history_id: String, is_pinned: bool) -> Result<(), EntityError>
        => toggle_entity_history_pin_inner(&history_id, is_pinned)
);
