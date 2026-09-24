use std::sync::Arc;
use serde::{Deserialize, Serialize};
use worldwiki_ports::repositories::{ChapterRepository, EntityRepository, PlotPromiseRepository};
use crate::errors::ApplicationError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManuscriptStatisticsDto {
    pub total_chapters: usize,
    pub total_words: i64,
    pub total_entities: usize,
    pub unresolved_promises: usize,
}

pub struct ManuscriptAnalyticsService {
    pub chapter_repo: Arc<dyn ChapterRepository>,
    pub entity_repo: Arc<dyn EntityRepository>,
    pub promise_repo: Arc<dyn PlotPromiseRepository>,
}

impl ManuscriptAnalyticsService {
    pub fn new(
        chapter_repo: Arc<dyn ChapterRepository>,
        entity_repo: Arc<dyn EntityRepository>,
        promise_repo: Arc<dyn PlotPromiseRepository>,
    ) -> Self {
        Self {
            chapter_repo,
            entity_repo,
            promise_repo,
        }
    }

    pub async fn get_statistics(&self, project_id: &str) -> Result<ManuscriptStatisticsDto, ApplicationError> {
        let chapters = self.chapter_repo.list_by_project(project_id).await?;
        let entities = self.entity_repo.list_by_project(project_id).await?;

        let mut total_words: i64 = 0;
        for c in &chapters {
            total_words += c.word_count as i64;
        }

        Ok(ManuscriptStatisticsDto {
            total_chapters: chapters.len(),
            total_words,
            total_entities: entities.len(),
            unresolved_promises: 0,
        })
    }
}
