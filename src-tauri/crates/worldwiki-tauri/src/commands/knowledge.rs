use tauri::State;
use worldwiki_domain::knowledge::{Entity, EntityRelation};
use worldwiki_application::knowledge::EntityCardDto;
use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn get_entity(
    state: State<'_, AppState>,
    entity_id: String,
) -> Result<Entity, IpcError> {
    state
        .services
        .knowledge
        .get_entity(&entity_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_entity_full_card(
    state: State<'_, AppState>,
    entity_id: String,
) -> Result<EntityCardDto, IpcError> {
    state
        .services
        .knowledge
        .get_full_card(&entity_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_entity(
    state: State<'_, AppState>,
    entity: Entity,
) -> Result<(), IpcError> {
    state
        .services
        .knowledge
        .save_entity(&entity)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn add_entity_relation(
    state: State<'_, AppState>,
    relation: EntityRelation,
) -> Result<(), IpcError> {
    state
        .services
        .knowledge
        .add_relation(&relation)
        .await
        .map_err(IpcError::from)
}
