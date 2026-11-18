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
            .map_err(DomainError::constraint_violation)?;
        self.publish_raw(name, payload).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct DummyPublisher;
    #[async_trait]
    impl EventPublisherPort for DummyPublisher {
        async fn publish_raw(&self, _event_name: &str, _payload: Value) -> Result<(), DomainError> {
            Ok(())
        }
    }

    struct FailingSerializeEvent;
    impl Serialize for FailingSerializeEvent {
        fn serialize<S: serde::Serializer>(&self, _serializer: S) -> Result<S::Ok, S::Error> {
            Err(serde::ser::Error::custom("cannot serialize"))
        }
    }
    impl ApplicationEvent for FailingSerializeEvent {
        fn event_name(&self) -> &'static str {
            "failing_event"
        }
    }

    #[tokio::test]
    async fn test_publish_returns_error_when_serialization_fails() {
        let pub_port = DummyPublisher;
        let err = pub_port.publish(FailingSerializeEvent).await.unwrap_err();
        assert!(matches!(err, DomainError::ConstraintViolation(_)));
    }
}
