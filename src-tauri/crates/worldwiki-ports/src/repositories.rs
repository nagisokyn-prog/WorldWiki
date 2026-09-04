use async_trait::async_trait;
use worldwiki_domain::manuscript::{Chapter, Volume, Arc as ArcNode};
use worldwiki_domain::knowledge::{Entity, EntityRelation};
use worldwiki_domain::plot::{PlotPromise, Plan};
use worldwiki_domain::errors::DomainError;

#[async_trait]
pub trait ChapterRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<Chapter>, DomainError>;
    async fn save(&self, chapter: &Chapter) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Chapter>, DomainError>;
    async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<Chapter>, DomainError>;
}

#[async_trait]
pub trait VolumeRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<Volume>, DomainError>;
    async fn save(&self, volume: &Volume) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Volume>, DomainError>;
}

#[async_trait]
pub trait ArcRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<ArcNode>, DomainError>;
    async fn save(&self, arc: &ArcNode) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<ArcNode>, DomainError>;
}

#[async_trait]
pub trait EntityRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<Entity>, DomainError>;
    async fn save(&self, entity: &Entity) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn search(&self, project_id: &str, query: &str, top_k: usize) -> Result<Vec<Entity>, DomainError>;
    async fn list_by_type(&self, project_id: &str, type_key: &str) -> Result<Vec<Entity>, DomainError>;
}

#[async_trait]
pub trait RelationRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<EntityRelation>, DomainError>;
    async fn save(&self, rel: &EntityRelation) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn get_entity_relations(&self, entity_id: &str) -> Result<Vec<EntityRelation>, DomainError>;
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
pub trait PlanRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<Plan>, DomainError>;
    async fn save(&self, plan: &Plan) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn list_by_parent(&self, parent_ref: &str) -> Result<Vec<Plan>, DomainError>;
    async fn list_pending_by_volume(&self, volume_id: &str) -> Result<Vec<Plan>, DomainError>;
}
