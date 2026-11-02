pub mod arc_services;

pub use arc_services::StoryArcServices;
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use worldwiki_domain::plot::{PlotPromise, Todo};
use worldwiki_ports::repositories::{PlotPromiseRepository, TodoRepository};
use worldwiki_ports::events::{EventPublisherPort, EventPublisherExt, PlotPromiseUpdatedEvent};
use crate::errors::ApplicationError;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeAuditReport {
    pub volume_id: String,
    pub has_blockers: bool,
    pub pending_todos_count: usize,
    pub pending_todos: Vec<Todo>,
    pub unresolved_promises_count: usize,
    pub unresolved_promises: Vec<PlotPromise>,
}

pub struct PlotServices {
    pub promise_repo: Arc<dyn PlotPromiseRepository>,
    pub todo_repo: Arc<dyn TodoRepository>,
    pub events: Arc<dyn EventPublisherPort>,
}

impl PlotServices {
    pub fn new(
        promise_repo: Arc<dyn PlotPromiseRepository>,
        todo_repo: Arc<dyn TodoRepository>,
        events: Arc<dyn EventPublisherPort>,
    ) -> Self {
        Self {
            promise_repo,
            todo_repo,
            events,
        }
    }

    pub async fn plant_promise(&self, promise: &PlotPromise) -> Result<(), ApplicationError> {
        self.promise_repo.save(promise).await?;
        self.events
            .publish(PlotPromiseUpdatedEvent {
                promise_id: promise.id.clone(),
                status: "planted".to_string(),
                timestamp: Utc::now().timestamp(),
            })
            .await?;
        Ok(())
    }

    pub async fn save_promise(&self, promise: &PlotPromise) -> Result<PlotPromise, ApplicationError> {
        self.promise_repo.save(promise).await?;
        self.events
            .publish(PlotPromiseUpdatedEvent {
                promise_id: promise.id.clone(),
                status: "updated".to_string(),
                timestamp: Utc::now().timestamp(),
            })
            .await?;
        Ok(promise.clone())
    }

    pub async fn delete_promise(&self, promise_id: &str) -> Result<(), ApplicationError> {
        self.promise_repo.delete(promise_id).await?;
        self.events
            .publish(PlotPromiseUpdatedEvent {
                promise_id: promise_id.to_string(),
                status: "deleted".to_string(),
                timestamp: Utc::now().timestamp(),
            })
            .await?;
        Ok(())
    }

    pub async fn create_todo(&self, owner_id: &str, text: &str, sort_order: i32) -> Result<String, ApplicationError> {
        let todo = Todo::new(owner_id, text, sort_order);
        let id = self.todo_repo.save(&todo).await?;
        Ok(id)
    }

    pub async fn create_todo_ext(
        &self,
        owner_id: &str,
        text: &str,
        sort_order: i32,
        arc_id: Option<String>,
        depends_on: Option<String>,
    ) -> Result<String, ApplicationError> {
        let mut todo = Todo::new(owner_id, text, sort_order);
        todo.arc_id = arc_id;
        if let Some(dep) = depends_on {
            todo = todo.with_depends_on(dep);
        }
        let id = self.todo_repo.save(&todo).await?;
        Ok(id)
    }

    pub async fn set_todo_status(&self, todo_id: &str, status: &str) -> Result<Todo, ApplicationError> {
        if let Some(updated) = self.todo_repo.set_status(todo_id, status).await? {
            Ok(updated)
        } else if let Some(mut todo) = self.todo_repo.get_by_id(todo_id).await? {
            let st = match status {
                "in_progress" => worldwiki_domain::plot::TodoStatus::InProgress,
                "done" => worldwiki_domain::plot::TodoStatus::Done,
                "blocked" => worldwiki_domain::plot::TodoStatus::Blocked,
                _ => worldwiki_domain::plot::TodoStatus::Planned,
            };
            todo.set_status(st);
            self.todo_repo.save(&todo).await?;
            Ok(todo)
        } else {
            Err(ApplicationError::NotFound(format!("Todo {todo_id} not found")))
        }
    }

    pub async fn auto_start_chapter(&self, chapter_id: &str) -> Result<(), ApplicationError> {
        let todos = self.todo_repo.list_by_owner(chapter_id).await?;
        for t in todos {
            if t.status == worldwiki_domain::plot::TodoStatus::Planned {
                let _ = self.set_todo_status(&t.id, "in_progress").await;
                break;
            }
        }
        Ok(())
    }

    pub async fn update_todo(&self, todo_id: &str, text: &str) -> Result<(), ApplicationError> {
        if let Some(mut todo) = self.todo_repo.get_by_id(todo_id).await? {
            todo.text = text.to_string();
            self.todo_repo.save(&todo).await?;
            Ok(())
        } else {
            Err(ApplicationError::NotFound(format!("Todo {todo_id} not found")))
        }
    }

    pub async fn complete_todo(&self, todo_id: &str) -> Result<(), ApplicationError> {
        if let Some(mut todo) = self.todo_repo.get_by_id(todo_id).await? {
            if !todo.is_done {
                todo.is_done = true;
                self.todo_repo.save(&todo).await?;
            }
            Ok(())
        } else {
            Err(ApplicationError::NotFound(format!("Todo {todo_id} not found")))
        }
    }

    pub async fn toggle_todo(&self, todo_id: &str) -> Result<Todo, ApplicationError> {
        if let Some(mut todo) = self.todo_repo.get_by_id(todo_id).await? {
            todo.toggle();
            self.todo_repo.save(&todo).await?;
            Ok(todo)
        } else {
            Err(ApplicationError::NotFound(format!("Todo {todo_id} not found")))
        }
    }

    pub async fn delete_todo(&self, todo_id: &str) -> Result<(), ApplicationError> {
        self.todo_repo.delete(todo_id).await?;
        Ok(())
    }

    pub async fn list_todos_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, ApplicationError> {
        let list = self.todo_repo.list_by_owner(owner_id).await?;
        Ok(list)
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
