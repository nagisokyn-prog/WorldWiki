use std::sync::Arc;
use worldwiki_domain::analytics::{ItemJourneyDto, ItemTrackerDto};
use worldwiki_ports::repositories::AnalyticsRepositoryPort;
use crate::errors::ApplicationError;

pub struct ItemTrackerService {
    analytics_repo: Arc<dyn AnalyticsRepositoryPort>,
}

impl ItemTrackerService {
    pub fn new(analytics_repo: Arc<dyn AnalyticsRepositoryPort>) -> Self {
        Self { analytics_repo }
    }

    pub async fn get_item_tracker(&self, project_id: &str) -> Result<ItemTrackerDto, ApplicationError> {
        self.analytics_repo
            .get_item_tracker(project_id)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn get_item_journey(
        &self,
        project_id: &str,
        item_id: &str,
    ) -> Result<ItemJourneyDto, ApplicationError> {
        self.analytics_repo
            .get_item_journey(project_id, item_id)
            .await
            .map_err(ApplicationError::from)
    }
}
