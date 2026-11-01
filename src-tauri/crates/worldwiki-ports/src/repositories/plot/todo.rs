use async_trait::async_trait;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::Todo;

#[async_trait]
pub trait TodoRepository: Send + Sync {
    async fn get_by_id(&self, id: &str) -> Result<Option<Todo>, DomainError>;
    async fn save(&self, todo: &Todo) -> Result<String, DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn list_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, DomainError>;
    async fn list_by_owners(&self, owner_ids: &[&str]) -> Result<Vec<Todo>, DomainError>;
}

