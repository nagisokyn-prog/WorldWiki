use std::sync::Arc;
use worldwiki_domain::manuscript::{Chapter, TextBlock};
use worldwiki_ports::events::{ChapterUpdatedEvent, EventPublisherExt, EventPublisherPort};
use worldwiki_ports::repositories::ChapterRepository;
use crate::errors::ApplicationError;
use chrono::Utc;

pub struct SaveChapterWithMentionsWorkflow {
    repo: Arc<dyn ChapterRepository>,
    events: Arc<dyn EventPublisherPort>,
}

impl SaveChapterWithMentionsWorkflow {
    pub fn new(repo: Arc<dyn ChapterRepository>, events: Arc<dyn EventPublisherPort>) -> Self {
        Self { repo, events }
    }

    pub async fn execute(&self, mut chapter: Chapter) -> Result<Vec<String>, ApplicationError> {
        // 1. Extract entity mentions from markdown text
        let mentions = TextBlock::extract_entity_mentions(&chapter.content);

        // 2. Update word count
        chapter.update_content(chapter.content.clone());

        // 3. Save chapter
        self.repo.save(&chapter).await?;

        // 4. Sync appearance edges (source = 'mention') without removing 'manual' or 'scene'
        self.repo.sync_mentions_appearances(&chapter.id, &mentions).await?;

        // 5. Emit event
        self.events
            .publish(ChapterUpdatedEvent {
                chapter_id: chapter.id.clone(),
                word_count: chapter.word_count,
                timestamp: Utc::now().timestamp(),
            })
            .await?;

        Ok(mentions)
    }
}
