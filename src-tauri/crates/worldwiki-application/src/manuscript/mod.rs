use std::sync::Arc;
use worldwiki_domain::manuscript::Chapter;
use worldwiki_ports::repositories::ChapterRepository;
use worldwiki_ports::events::{EventPublisherPort, EventPublisherExt, ChapterUpdatedEvent};
use crate::errors::ApplicationError;
use chrono::Utc;

pub struct ManuscriptServices {
    pub repo: Arc<dyn ChapterRepository>,
    pub events: Arc<dyn EventPublisherPort>,
}

impl ManuscriptServices {
    pub fn new(repo: Arc<dyn ChapterRepository>, events: Arc<dyn EventPublisherPort>) -> Self {
        Self { repo, events }
    }

    pub async fn get_chapter(&self, chapter_id: &str) -> Result<Chapter, ApplicationError> {
        self.repo
            .get_by_id(chapter_id)
            .await?
            .ok_or_else(|| ApplicationError::NotFound(format!("Chapter {chapter_id} not found")))
    }

    pub async fn save_chapter(&self, chapter: &Chapter) -> Result<(), ApplicationError> {
        self.repo.save(chapter).await?;
        self.events
            .publish(ChapterUpdatedEvent {
                chapter_id: chapter.id.clone(),
                word_count: chapter.word_count,
                timestamp: Utc::now().timestamp(),
            })
            .await?;
        Ok(())
    }
}
