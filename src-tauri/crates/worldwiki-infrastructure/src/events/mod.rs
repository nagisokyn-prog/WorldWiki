use async_trait::async_trait;
use serde_json::Value;
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::events::EventPublisherPort;

#[derive(Default, Clone)]
pub struct InMemoryEventPublisher;

#[async_trait]
impl EventPublisherPort for InMemoryEventPublisher {
    async fn publish_raw(&self, _event_name: &str, _payload: Value) -> Result<(), DomainError> {
        // In-memory receiver/logger for testing
        Ok(())
    }
}
