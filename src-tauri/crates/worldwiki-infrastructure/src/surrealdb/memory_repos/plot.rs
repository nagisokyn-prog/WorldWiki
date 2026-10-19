use async_trait::async_trait;
use dashmap::DashMap;
use std::sync::Arc;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::{Plan, PlotPromise, PromiseStatus};
use worldwiki_ports::repositories::{PlanRepository, PlotPromiseRepository};

#[derive(Default, Clone)]
pub struct InMemoryPlotPromiseRepository {
    storage: Arc<DashMap<String, PlotPromise>>,
}

#[async_trait]
impl PlotPromiseRepository for InMemoryPlotPromiseRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<PlotPromise>, DomainError> {
        Ok(self.storage.get(id).map(|r| r.value().clone()))
    }

    async fn save(&self, promise: &PlotPromise) -> Result<(), DomainError> {
        self.storage.insert(promise.id.clone(), promise.clone());
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.remove(id);
        Ok(())
    }

    async fn list_by_chapter(&self, chapter_id: &str) -> Result<Vec<PlotPromise>, DomainError> {
        let clean = chapter_id.trim_start_matches("chapters:");
        let list = self
            .storage
            .iter()
            .filter(|r| {
                r.value().milestones.iter().any(|m| {
                    m.chapter_id.as_deref().map(|c| c.trim_start_matches("chapters:")) == Some(clean)
                })
            })
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }

    async fn list_unresolved_by_volume(&self, _volume_id: &str) -> Result<Vec<PlotPromise>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().status != PromiseStatus::Resolved)
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }
}

#[derive(Default, Clone)]
pub struct InMemoryPlanRepository {
    storage: Arc<DashMap<String, Plan>>,
}

#[async_trait]
impl PlanRepository for InMemoryPlanRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Plan>, DomainError> {
        Ok(self.storage.get(id).map(|r| r.value().clone()))
    }

    async fn save(&self, plan: &Plan) -> Result<(), DomainError> {
        self.storage.insert(plan.id.clone(), plan.clone());
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.remove(id);
        Ok(())
    }

    async fn list_by_parent(&self, parent_ref: &str) -> Result<Vec<Plan>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().parent_ref.as_deref() == Some(parent_ref))
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }

    async fn list_pending_by_volume(&self, volume_id: &str) -> Result<Vec<Plan>, DomainError> {
        let list = self
            .storage
            .iter()
            .filter(|r| r.value().parent_ref.as_deref() == Some(volume_id) && !r.value().completed)
            .map(|r| r.value().clone())
            .collect();
        Ok(list)
    }
}
