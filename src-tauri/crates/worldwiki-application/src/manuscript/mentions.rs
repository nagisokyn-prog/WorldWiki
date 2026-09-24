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

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use tokio::sync::Mutex;
    use worldwiki_domain::errors::DomainError;
    use worldwiki_ports::events::DomainEvent;

    struct MockChapterRepo {
        saved: Mutex<Option<Chapter>>,
        synced_mentions: Mutex<Vec<String>>,
    }

    #[async_trait]
    impl ChapterRepository for MockChapterRepo {
        async fn get_by_id(&self, _id: &str) -> Result<Option<Chapter>, DomainError> {
            Ok(self.saved.lock().await.clone())
        }
        async fn save(&self, chapter: &Chapter) -> Result<(), DomainError> {
            *self.saved.lock().await = Some(chapter.clone());
            Ok(())
        }
        async fn delete(&self, _id: &str) -> Result<(), DomainError> {
            Ok(())
        }
        async fn list_by_project(&self, _project_id: &str) -> Result<Vec<Chapter>, DomainError> {
            Ok(vec![])
        }
        async fn list_by_volume(&self, _volume_id: &str) -> Result<Vec<Chapter>, DomainError> {
            Ok(vec![])
        }
        async fn sync_mentions_appearances(&self, _chapter_id: &str, entity_names: &[String]) -> Result<(), DomainError> {
            *self.synced_mentions.lock().await = entity_names.to_vec();
            Ok(())
        }
    }

    struct MockEvents;
    #[async_trait]
    impl EventPublisherPort for MockEvents {
        async fn publish_raw(&self, _event_type: &str, _payload: serde_json::Value) -> Result<(), DomainError> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_save_chapter_with_mentions_success() {
        let repo = Arc::new(MockChapterRepo {
            saved: Mutex::new(None),
            synced_mentions: Mutex::new(Vec::new()),
        });
        let events = Arc::new(MockEvents);
        let workflow = SaveChapterWithMentionsWorkflow::new(repo.clone(), events);

        let mut ch = Chapter::new("proj_1", "Глава 1", 1);
        ch.id = "chapters:ch1".to_string();
        ch.content = "В комнату вошел ((Арагорн)) с мечом ((Нарсиль)).".to_string();

        let extracted = workflow.execute(ch).await.unwrap();
        assert_eq!(extracted, vec!["Арагорн", "Нарсиль"]);
        assert_eq!(*repo.synced_mentions.lock().await, vec!["Арагорн", "Нарсиль"]);
    }
}
