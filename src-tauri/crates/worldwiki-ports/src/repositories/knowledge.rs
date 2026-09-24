use async_trait::async_trait;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::knowledge::{Entity, EntityRelation};

#[async_trait]
pub trait EntityRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<Entity>, DomainError>;
    async fn save(&self, entity: &Entity) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn search(&self, project_id: &str, query: &str, top_k: usize) -> Result<Vec<Entity>, DomainError>;
    async fn list_by_type(&self, project_id: &str, type_key: &str) -> Result<Vec<Entity>, DomainError>;
    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Entity>, DomainError>;
}

#[async_trait]
pub trait RelationRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<EntityRelation>, DomainError>;
    async fn save(&self, rel: &EntityRelation) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn get_entity_relations(&self, entity_id: &str) -> Result<Vec<EntityRelation>, DomainError>;
}
