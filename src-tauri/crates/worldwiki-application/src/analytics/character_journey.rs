use std::sync::Arc;
use worldwiki_domain::analytics::{CharacterJourneyDto, JourneyFilterMode, MultiJourneyResponseDto};
use worldwiki_ports::repositories::AnalyticsRepositoryPort;
use crate::errors::ApplicationError;

pub struct CharacterJourneyService {
    pub repo: Arc<dyn AnalyticsRepositoryPort>,
}

impl CharacterJourneyService {
    pub fn new(repo: Arc<dyn AnalyticsRepositoryPort>) -> Self {
        Self { repo }
    }

    pub async fn get_journey(&self, project_id: &str, entity_id: &str) -> Result<CharacterJourneyDto, ApplicationError> {
        Ok(self.repo.get_character_journey(project_id, entity_id).await?)
    }

    pub async fn get_multi_journey(
        &self,
        project_id: &str,
        entity_ids: &[String],
        mode: JourneyFilterMode,
    ) -> Result<MultiJourneyResponseDto, ApplicationError> {
        Ok(self.repo.get_multi_character_journey(project_id, entity_ids, mode).await?)
    }
}
