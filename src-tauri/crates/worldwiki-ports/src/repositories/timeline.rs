use async_trait::async_trait;
use worldwiki_domain::calendar::{EventReveal, TimelineEvent};
use worldwiki_domain::errors::DomainError;

#[async_trait]
pub trait TimelineEventRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<TimelineEvent>, DomainError>;
    async fn save(&self, event: &TimelineEvent) -> Result<String, DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn list_by_project(&self, project_id: &str) -> Result<Vec<TimelineEvent>, DomainError>;
    async fn add_reveal(&self, reveal: &EventReveal) -> Result<(), DomainError>;
    async fn remove_reveal(&self, event_id: &str, chapter_id: &str) -> Result<(), DomainError>;
}
