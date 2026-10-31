use worldwiki_application::analytics::ManuscriptStatisticsDto;
use worldwiki_domain::analytics::{
    CharacterJourneyDto, ConsistencyAuditReportDto, CrossRefMatrixDto,
    ItemJourneyDto, ItemTrackerDto, JourneyFilterMode,
    MultiJourneyResponseDto, TimelineInspectorDto,
};
use crate::error::IpcError;
use crate::bridge_command;

bridge_command!(
    get_cross_reference_matrix(project_id: String) -> Result<CrossRefMatrixDto, IpcError>
        => cross_ref_service.get_matrix(&project_id)
);

bridge_command!(
    audit_manuscript_consistency(project_id: String) -> Result<ConsistencyAuditReportDto, IpcError>
        => consistency_workflow.execute(&project_id)
);

bridge_command!(
    get_timeline_inspector_data(
        project_id: String,
        reader_chapter_order_limit: Option<i32>,
    ) -> Result<TimelineInspectorDto, IpcError>
        => timeline_inspector_service.get_inspector_data(&project_id, reader_chapter_order_limit)
);


bridge_command!(
    get_character_journey(
        project_id: String,
        entity_id: String,
    ) -> Result<CharacterJourneyDto, IpcError>
        => character_journey_service.get_journey(&project_id, &entity_id)
);

bridge_command!(
    get_multi_character_journey(
        project_id: String,
        entity_ids: Vec<String>,
        mode: Option<JourneyFilterMode>,
    ) -> Result<MultiJourneyResponseDto, IpcError>
        => character_journey_service.get_multi_journey(&project_id, &entity_ids, mode.unwrap_or_default())
);

bridge_command!(
    get_item_tracker(project_id: String) -> Result<ItemTrackerDto, IpcError>
        => item_tracker_service.get_item_tracker(&project_id)
);

bridge_command!(
    get_item_journey(
        project_id: String,
        item_id: String,
    ) -> Result<ItemJourneyDto, IpcError>
        => item_tracker_service.get_item_journey(&project_id, &item_id)
);

bridge_command!(
    get_manuscript_statistics(project_id: String) -> Result<ManuscriptStatisticsDto, IpcError>
        => manuscript_stats_service.get_statistics(&project_id)
);

