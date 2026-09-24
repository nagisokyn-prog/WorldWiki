use std::sync::Arc;
use worldwiki_domain::analytics::CharacterJourneyDto;
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
}
