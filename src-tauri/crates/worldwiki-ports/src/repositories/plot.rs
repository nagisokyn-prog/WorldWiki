use async_trait::async_trait;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::{ArcChapterRelation, ArcEntityRelation, PlotPromise, StoryArc, Todo};

#[async_trait]
pub trait StoryArcRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<StoryArc>, DomainError>;
    async fn save(&self, arc: &StoryArc) -> Result<String, DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn list_by_project(&self, project_id: &str) -> Result<Vec<StoryArc>, DomainError>;
    async fn assign_chapter(&self, relation: &ArcChapterRelation) -> Result<(), DomainError>;
    async fn remove_chapter(&self, arc_id: &str, chapter_id: &str) -> Result<(), DomainError>;
    async fn assign_entity(&self, relation: &ArcEntityRelation) -> Result<(), DomainError>;
    async fn remove_entity(&self, arc_id: &str, entity_id: &str) -> Result<(), DomainError>;
    async fn list_chapters_for_arc(&self, arc_id: &str) -> Result<Vec<ArcChapterRelation>, DomainError>;
    async fn list_entities_for_arc(&self, arc_id: &str) -> Result<Vec<ArcEntityRelation>, DomainError>;
}

#[async_trait]
pub trait PlotPromiseRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<PlotPromise>, DomainError>;
    async fn save(&self, promise: &PlotPromise) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn list_by_chapter(&self, chapter_id: &str) -> Result<Vec<PlotPromise>, DomainError>;
    async fn list_unresolved_by_volume(&self, volume_id: &str) -> Result<Vec<PlotPromise>, DomainError>;
}

#[async_trait]
pub trait TodoRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<Todo>, DomainError>;
    async fn save(&self, todo: &Todo) -> Result<String, DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn list_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, DomainError>;
    async fn list_by_owners(&self, owner_ids: &[&str]) -> Result<Vec<Todo>, DomainError>;
}
