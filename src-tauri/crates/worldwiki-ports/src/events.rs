use async_trait::async_trait;
use serde::Serialize;
use serde_json::Value;
use worldwiki_domain::errors::DomainError;

pub trait ApplicationEvent: Send + Sync + Serialize {
    fn event_name(&self) -> &'static str;
}

#[derive(Debug, Clone, Serialize)]
pub struct ChapterUpdatedEvent {
    pub chapter_id: String,
    pub word_count: usize,
    pub timestamp: i64,
}

impl ApplicationEvent for ChapterUpdatedEvent {
    fn event_name(&self) -> &'static str {
        "chapter_updated"
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct EntityChangedEvent {
    pub entity_id: String,
    pub action: String, // "created", "updated", "deleted"
    pub timestamp: i64,
}

impl ApplicationEvent for EntityChangedEvent {
    fn event_name(&self) -> &'static str {
        "entity_changed"
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct PlotPromiseUpdatedEvent {
    pub promise_id: String,
    pub status: String,
    pub timestamp: i64,
}

impl ApplicationEvent for PlotPromiseUpdatedEvent {
    fn event_name(&self) -> &'static str {
        "plot_promise_updated"
    }
}

#[async_trait]
pub trait EventPublisherPort: Send + Sync {
    async fn publish_raw(&self, event_name: &str, payload: Value) -> Result<(), DomainError>;
}

pub trait EventPublisherExt {
    fn publish<E: ApplicationEvent>(
        &self,
        event: E,
    ) -> impl std::future::Future<Output = Result<(), DomainError>> + Send;
}

impl<T: EventPublisherPort + ?Sized> EventPublisherExt for T {
    async fn publish<E: ApplicationEvent>(&self, event: E) -> Result<(), DomainError> {
        let name = event.event_name();
        let payload = serde_json::to_value(&event)
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        self.publish_raw(name, payload).await
    }
}
