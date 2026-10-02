use tauri::State;
use worldwiki_application::analytics::ManuscriptStatisticsDto;
use worldwiki_domain::analytics::{
    CharacterJourneyDto, ConsistencyAuditReportDto, CrossRefMatrixDto,
    GraphTimeSliceDto, ItemJourneyDto, ItemTrackerDto, JourneyFilterMode,
    MultiJourneyResponseDto, TimelineInspectorDto,
};
use crate::error::IpcError;
use crate::state::AppState;

#[tauri::command]
pub async fn get_cross_reference_matrix(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<CrossRefMatrixDto, IpcError> {
    state
        .services
        .cross_ref_service
        .get_matrix(&project_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn audit_manuscript_consistency(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<ConsistencyAuditReportDto, IpcError> {
    state
        .services
        .consistency_workflow
        .execute(&project_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_timeline_inspector_data(
    project_id: String,
    reader_chapter_order_limit: Option<i32>,
    state: State<'_, AppState>,
) -> Result<TimelineInspectorDto, IpcError> {
    state
        .services
        .timeline_inspector_service
        .get_inspector_data(&project_id, reader_chapter_order_limit)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_graph_time_slice(
    project_id: String,
    reader_chapter_order: Option<i32>,
    m_abs_limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<GraphTimeSliceDto, IpcError> {
    state
        .services
        .graph_web_slice_service
        .get_time_slice(&project_id, reader_chapter_order, m_abs_limit)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_character_journey(
    project_id: String,
    entity_id: String,
    state: State<'_, AppState>,
) -> Result<CharacterJourneyDto, IpcError> {
    state
        .services
        .character_journey_service
        .get_journey(&project_id, &entity_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_multi_character_journey(
    project_id: String,
    entity_ids: Vec<String>,
    mode: Option<JourneyFilterMode>,
    state: State<'_, AppState>,
) -> Result<MultiJourneyResponseDto, IpcError> {
    state
        .services
        .character_journey_service
        .get_multi_journey(&project_id, &entity_ids, mode.unwrap_or_default())
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_item_tracker(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<ItemTrackerDto, IpcError> {
    state
        .services
        .item_tracker_service
        .get_item_tracker(&project_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_item_journey(
    project_id: String,
    item_id: String,
    state: State<'_, AppState>,
) -> Result<ItemJourneyDto, IpcError> {
    state
        .services
        .item_tracker_service
        .get_item_journey(&project_id, &item_id)
        .await
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_manuscript_statistics(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<ManuscriptStatisticsDto, IpcError> {
    state
        .services
        .manuscript_stats_service
        .get_statistics(&project_id)
        .await
        .map_err(IpcError::from)
}

