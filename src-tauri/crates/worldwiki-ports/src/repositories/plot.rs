use async_trait::async_trait;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::{Plan, PlotPromise};

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
