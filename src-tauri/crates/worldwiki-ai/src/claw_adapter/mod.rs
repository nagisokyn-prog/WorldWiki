pub mod payload_builder;
pub mod stream_consumer;
pub(crate) mod types;

use async_trait::async_trait;
use tokio::sync::mpsc::Sender;
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::{LlmStreamPort, StreamEventDto, StreamRequest};

use super::client::build_provider_client;
use payload_builder::ClawPayloadBuilder;
use stream_consumer::ClawStreamConsumer;

pub struct ClawStreamAdapter;

impl ClawStreamAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Default for ClawStreamAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl LlmStreamPort for ClawStreamAdapter {
    async fn stream_chat(
        &self,
        request: StreamRequest,
        sender: Sender<StreamEventDto>,
    ) -> Result<(), DomainError> {
        let profile = &request.profile;
        let provider = &profile.provider;
        let api_key = profile.api_key.as_deref().unwrap_or("");
        let base_url = profile.base_url.clone();

            if api_key.is_empty() && provider != "local" && provider != "ollama" {
                return Err(DomainError::Validation(
                    "API key is not configured for active profile".to_string(),
                ));
            }

            let provider_client = build_provider_client(provider, api_key, base_url)?;

            let message_req = ClawPayloadBuilder::build_message_request(request);

            let stream = provider_client
                .stream_message(&message_req)
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

            ClawStreamConsumer::consume_stream(stream, &sender).await
        }
    }
}
