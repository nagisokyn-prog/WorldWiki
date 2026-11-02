pub mod arc_services;
pub mod audit_services;
pub mod todo_services;

pub use arc_services::StoryArcServices;
pub use audit_services::{AuditServices, VolumeAuditReport};
pub use todo_services::TodoServices;

use std::sync::Arc;
use chrono::Utc;
use worldwiki_domain::plot::{PlotPromise, Todo};
use worldwiki_ports::repositories::{PlotPromiseRepository, TodoRepository};
use worldwiki_ports::events::{EventPublisherPort, EventPublisherExt, PlotPromiseUpdatedEvent};
use crate::errors::ApplicationError;

pub struct PlotServices {
    pub promise_repo: Arc<dyn PlotPromiseRepository>,
    pub todo_repo: Arc<dyn TodoRepository>,
    pub events: Arc<dyn EventPublisherPort>,
    pub todos: TodoServices,
    pub audit: AuditServices,
}

impl PlotServices {
    pub fn new(
        promise_repo: Arc<dyn PlotPromiseRepository>,
        todo_repo: Arc<dyn TodoRepository>,
        events: Arc<dyn EventPublisherPort>,
    ) -> Self {
        Self {
            promise_repo: Arc::clone(&promise_repo),
            todo_repo: Arc::clone(&todo_repo),
            events,
            todos: TodoServices::new(Arc::clone(&todo_repo)),
            audit: AuditServices::new(promise_repo, todo_repo),
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
        self.todos.create_todo(owner_id, text, sort_order).await
    }

    pub async fn create_todo_ext(
        &self,
        owner_id: &str,
        text: &str,
        sort_order: i32,
        arc_id: Option<String>,
        depends_on: Option<String>,
    ) -> Result<String, ApplicationError> {
        self.todos.create_todo_ext(owner_id, text, sort_order, arc_id, depends_on).await
    }

    pub async fn set_todo_status(&self, todo_id: &str, status: &str) -> Result<Todo, ApplicationError> {
        self.todos.set_todo_status(todo_id, status).await
    }

    pub async fn auto_start_chapter(&self, chapter_id: &str) -> Result<(), ApplicationError> {
        self.todos.auto_start_chapter(chapter_id).await
    }

    pub async fn update_todo(&self, todo_id: &str, text: &str) -> Result<(), ApplicationError> {
        self.todos.update_todo(todo_id, text).await
    }

    pub async fn complete_todo(&self, todo_id: &str) -> Result<(), ApplicationError> {
        self.todos.complete_todo(todo_id).await
    }

    pub async fn toggle_todo(&self, todo_id: &str) -> Result<Todo, ApplicationError> {
        self.todos.toggle_todo(todo_id).await
    }

    pub async fn delete_todo(&self, todo_id: &str) -> Result<(), ApplicationError> {
        self.todos.delete_todo(todo_id).await
    }

    pub async fn list_todos_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, ApplicationError> {
        self.todos.list_todos_by_owner(owner_id).await
    }

    pub async fn audit_volume(&self, volume_id: &str) -> Result<VolumeAuditReport, ApplicationError> {
        self.audit.audit_volume(volume_id).await
    }
}
