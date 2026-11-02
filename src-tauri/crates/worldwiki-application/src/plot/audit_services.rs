use std::sync::Arc;
use serde::{Deserialize, Serialize};
use worldwiki_domain::plot::{PlotPromise, Todo};
use worldwiki_ports::repositories::{PlotPromiseRepository, TodoRepository};
use crate::errors::ApplicationError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeAuditReport {
    pub volume_id: String,
    pub has_blockers: bool,
    pub pending_todos_count: usize,
    pub pending_todos: Vec<Todo>,
    pub unresolved_promises_count: usize,
    pub unresolved_promises: Vec<PlotPromise>,
}

pub struct AuditServices {
    pub promise_repo: Arc<dyn PlotPromiseRepository>,
    pub todo_repo: Arc<dyn TodoRepository>,
}

impl AuditServices {
    pub fn new(
        promise_repo: Arc<dyn PlotPromiseRepository>,
        todo_repo: Arc<dyn TodoRepository>,
    ) -> Self {
        Self {
            promise_repo,
            todo_repo,
        }
    }

    pub async fn audit_volume(&self, volume_id: &str) -> Result<VolumeAuditReport, ApplicationError> {
        let all_todos = self.todo_repo.list_by_owner(volume_id).await?;
        let pending_todos: Vec<Todo> = all_todos.into_iter().filter(|t| !t.is_done).collect();
        let unresolved_promises = self.promise_repo.list_unresolved_by_volume(volume_id).await?;

        let has_blockers = !pending_todos.is_empty() || !unresolved_promises.is_empty();

        Ok(VolumeAuditReport {
            volume_id: volume_id.to_string(),
            has_blockers,
            pending_todos_count: pending_todos.len(),
            pending_todos,
            unresolved_promises_count: unresolved_promises.len(),
            unresolved_promises,
        })
    }
}
