use async_trait::async_trait;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::manuscript::{Chapter, Volume};

#[async_trait]
pub trait ChapterRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<Chapter>, DomainError>;
    async fn save(&self, chapter: &Chapter) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Chapter>, DomainError>;
    async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<Chapter>, DomainError>;
    async fn sync_mentions_appearances(&self, chapter_id: &str, entity_names: &[String]) -> Result<(), DomainError>;
}

#[async_trait]
pub trait VolumeRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<Volume>, DomainError>;
    async fn save(&self, volume: &Volume) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Volume>, DomainError>;
}
