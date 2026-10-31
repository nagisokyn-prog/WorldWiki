use async_trait::async_trait;
use dashmap::DashMap;
use std::sync::Arc;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::manuscript::Chapter;
use worldwiki_ports::repositories::ChapterRepository;

#[derive(Default, Clone)]
pub struct InMemoryChapterRepository {
    storage: Arc<DashMap<String, Chapter>>,
}

#[async_trait]
impl ChapterRepository for InMemoryChapterRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Chapter>, DomainError> {
        Ok(self.storage.get(id).map(|r| r.value().clone()))
    }

    async fn save(&self, chapter: &Chapter) -> Result<(), DomainError> {
        self.storage.insert(chapter.id.clone(), chapter.clone());
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.remove(id);
        Ok(())
    }

    async fn list_by_project(&self, _project_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let list = self
            .storage
            .iter()
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }

    async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().volume_id == volume_id)
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }

    async fn sync_mentions_appearances(&self, _chapter_id: &str, _entity_names: &[String]) -> Result<(), DomainError> {
        Ok(())
    }
}
