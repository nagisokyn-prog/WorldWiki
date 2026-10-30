use async_trait::async_trait;
use worldwiki_domain::analytics::{
    CharacterJourneyDto, CrossRefMatrixDto, ItemJourneyDto, ItemTrackerDto,
    JourneyFilterMode, MultiJourneyResponseDto, TimelineInspectorDto,
};
use worldwiki_domain::errors::DomainError;

#[async_trait]
pub trait AnalyticsRepositoryPort: Send + Sync {
    async fn get_cross_reference_matrix(&self, project_id: &str) -> Result<CrossRefMatrixDto, DomainError>;
    async fn get_timeline_inspector_data(&self, project_id: &str) -> Result<TimelineInspectorDto, DomainError>;
    async fn get_character_journey(&self, project_id: &str, entity_id: &str) -> Result<CharacterJourneyDto, DomainError>;
    async fn get_multi_character_journey(
        &self,
        project_id: &str,
        entity_ids: &[String],
        mode: JourneyFilterMode,
    ) -> Result<MultiJourneyResponseDto, DomainError>;
    async fn get_item_tracker(&self, project_id: &str) -> Result<ItemTrackerDto, DomainError>;
    async fn get_item_journey(&self, project_id: &str, item_id: &str) -> Result<ItemJourneyDto, DomainError>;
}

