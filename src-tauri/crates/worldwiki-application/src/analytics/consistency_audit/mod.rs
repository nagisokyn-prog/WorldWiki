pub mod rules;
#[cfg(test)]
mod tests;

use std::sync::Arc;
use worldwiki_domain::analytics::ConsistencyAuditReportDto;
use worldwiki_ports::repositories::{
    AnalyticsRepositoryPort, ChapterRepository, EntityRepository, PlotPromiseRepository,
    TimelineEventRepository,
};
use crate::errors::ApplicationError;
use rules::{
    eval_absence_rules, eval_anachronism_rules, eval_bilocation_rules, eval_birth_rules,
    eval_deceased_rules, eval_item_rules,
};

pub struct ConsistencyAuditWorkflow {
    pub analytics_repo: Arc<dyn AnalyticsRepositoryPort>,
    pub entity_repo: Arc<dyn EntityRepository>,
    pub chapter_repo: Arc<dyn ChapterRepository>,
    pub timeline_repo: Arc<dyn TimelineEventRepository>,
    pub promise_repo: Arc<dyn PlotPromiseRepository>,
}

impl ConsistencyAuditWorkflow {
    pub fn new(
        analytics_repo: Arc<dyn AnalyticsRepositoryPort>,
        entity_repo: Arc<dyn EntityRepository>,
        chapter_repo: Arc<dyn ChapterRepository>,
        timeline_repo: Arc<dyn TimelineEventRepository>,
        promise_repo: Arc<dyn PlotPromiseRepository>,
    ) -> Self {
        Self {
            analytics_repo,
            entity_repo,
            chapter_repo,
            timeline_repo,
            promise_repo,
        }
    }

    pub async fn execute(&self, project_id: &str) -> Result<ConsistencyAuditReportDto, ApplicationError> {
        let mut anomalies = Vec::new();

        let matrix = self.analytics_repo.get_cross_reference_matrix(project_id).await?;
        let timeline_data = self.analytics_repo.get_timeline_inspector_data(project_id).await?;
        let item_tracker = self.analytics_repo.get_item_tracker(project_id).await.ok();

        eval_deceased_rules(&matrix, &timeline_data, &mut anomalies);
        eval_birth_rules(&matrix, &timeline_data, &mut anomalies);
        eval_anachronism_rules(&timeline_data, &mut anomalies);
        eval_bilocation_rules(&matrix, &timeline_data, &mut anomalies);
        eval_absence_rules(&matrix, &mut anomalies);

        if let Some(tracker) = item_tracker {
            eval_item_rules(&tracker, &timeline_data, &mut anomalies);
        }

        Ok(ConsistencyAuditReportDto::from_anomalies(anomalies))
    }
}
