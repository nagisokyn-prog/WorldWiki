use tauri::State;
use worldwiki_domain::plot::{ArcChapterRelation, ArcEntityRelation, StoryArc};
use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn get_story_arcs(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<StoryArc>, IpcError> {
    state
        .services
        .story_arcs
        .list_by_project(&project_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_story_arc(
    arc: StoryArc,
    state: State<'_, AppState>,
) -> Result<String, IpcError> {
    state
        .services
        .story_arcs
        .save_arc(&arc)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn delete_story_arc(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    state
        .services
        .story_arcs
        .delete_arc(&id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn assign_arc_chapter(
    relation: ArcChapterRelation,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    state
        .services
        .story_arcs
        .assign_chapter(&relation)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn remove_arc_chapter(
    arc_id: String,
    chapter_id: String,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    state
        .services
        .story_arcs
        .remove_chapter(&arc_id, &chapter_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn assign_arc_entity(
    relation: ArcEntityRelation,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    state
        .services
        .story_arcs
        .assign_entity(&relation)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn remove_arc_entity(
    arc_id: String,
    entity_id: String,
    state: State<'_, AppState>,
) -> Result<(), IpcError> {
    state
        .services
        .story_arcs
        .remove_entity(&arc_id, &entity_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_arc_chapters(
    arc_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<ArcChapterRelation>, IpcError> {
    state
        .services
        .story_arcs
        .list_chapters_for_arc(&arc_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_arc_entities(
    arc_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<ArcEntityRelation>, IpcError> {
    state
        .services
        .story_arcs
        .list_entities_for_arc(&arc_id)
        .await
        .map_err(IpcError::from)
}
