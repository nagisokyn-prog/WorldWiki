//! IPC layer for module `batch`: #[tauri::command] wrappers only.
//! All business logic lives in mod.rs (*_inner).

use super::*;
use crate::forward_ipc;
use crate::logic::models::{Entity, EntityRel};
use serde_json::{Map, Value};

forward_ipc!(
    get_entities_batch(project: String, entity_types: Vec<String>) -> Result<Map<String, Value>, BatchError>
        => get_entities_batch_inner(&project, entity_types)
);

forward_ipc!(
    upsert_connections_batch(project: String, source_type: String, source_id: String, connections: Vec<EntityRel>) -> Result<(), BatchError>
        => upsert_connections_batch_inner(&project, &source_type, &source_id, connections)
);

forward_ipc!(
    save_entity_with_relations(project: String, entity: Entity, foreign_updates: Vec<Entity>) -> Result<Entity, BatchError>
        => save_entity_with_relations_inner(&project, entity, foreign_updates)
);
