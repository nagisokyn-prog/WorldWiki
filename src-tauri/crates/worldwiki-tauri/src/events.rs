use async_trait::async_trait;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::events::EventPublisherPort;

pub struct TauriEventPublisher {
    app_handle: AppHandle,
}

impl TauriEventPublisher {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }
}

#[async_trait]
impl EventPublisherPort for TauriEventPublisher {
    async fn publish_raw(&self, event_name: &str, payload: Value) -> Result<(), DomainError> {
        self.app_handle
            .emit(event_name, &payload)
            .map_err(|e| DomainError::ConstraintViolation(format!("Tauri event emit failed: {e}")))?;
        Ok(())
    }
}
