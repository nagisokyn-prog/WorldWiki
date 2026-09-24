use std::sync::Arc;
use worldwiki_domain::analytics::TimelineInspectorDto;
use worldwiki_ports::repositories::AnalyticsRepositoryPort;
use crate::errors::ApplicationError;

pub struct TimelineInspectorService {
    pub repo: Arc<dyn AnalyticsRepositoryPort>,
}

impl TimelineInspectorService {
    pub fn new(repo: Arc<dyn AnalyticsRepositoryPort>) -> Self {
        Self { repo }
    }

    pub async fn get_inspector_data(
        &self,
        project_id: &str,
        reader_chapter_order_limit: Option<i32>,
    ) -> Result<TimelineInspectorDto, ApplicationError> {
        let mut data = self.repo.get_timeline_inspector_data(project_id).await?;

        // If reader mode is active: filter out reveals and events that happened after reader's current chapter
        if let Some(limit) = reader_chapter_order_limit {
            for ev in &mut data.events {
                ev.reveals.retain(|r| r.chapter_sort_order <= limit);
            }
            data.events.retain(|ev| !ev.reveals.is_empty());
            data.chapters.retain(|c| c.sort_order <= limit);
        }

        Ok(data)
    }
}
