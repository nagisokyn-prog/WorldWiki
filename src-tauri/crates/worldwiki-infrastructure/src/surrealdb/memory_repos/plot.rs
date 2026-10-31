use async_trait::async_trait;
use dashmap::DashMap;
use std::sync::Arc;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::{PlotPromise, PromiseStatus, Todo};
use worldwiki_ports::repositories::{PlotPromiseRepository, TodoRepository};

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
pub struct InMemoryTodoRepository {
    storage: Arc<DashMap<String, Todo>>,
}

#[async_trait]
impl TodoRepository for InMemoryTodoRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Todo>, DomainError> {
        Ok(self.storage.get(id).map(|r| r.value().clone()))
    }

    async fn save(&self, todo: &Todo) -> Result<String, DomainError> {
        let id = if todo.id.is_empty() {
            uuid::Uuid::new_v4().to_string()
        } else {
            todo.id.clone()
        };
        let mut t = todo.clone();
        t.id = id.clone();
        self.storage.insert(id.clone(), t);
        Ok(id)
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        self.storage.remove(id);
        Ok(())
    }

    async fn list_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, DomainError> {
        let mut list: Vec<Todo> = self
            .storage
            .iter()
            .filter(|r| r.value().owner_id == owner_id)
            .map(|r| r.value().clone())
            .collect();
        list.sort_by_key(|t| t.sort_order);
        Ok(list)
    }

    async fn list_by_owners(&self, owner_ids: &[&str]) -> Result<Vec<Todo>, DomainError> {
        let mut list: Vec<Todo> = self
            .storage
            .iter()
            .filter(|r| owner_ids.contains(&r.value().owner_id.as_str()))
            .map(|r| r.value().clone())
            .collect();
        list.sort_by_key(|t| t.sort_order);
        Ok(list)
    }
}
