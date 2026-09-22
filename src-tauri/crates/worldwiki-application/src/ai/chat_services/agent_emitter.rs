use serde_json::Value;
use std::sync::Arc;
use worldwiki_domain::ai::{AgentToolEvent, ChatMessage, MessageRole, StreamChunk};
use worldwiki_ports::ai::ChatRepository;
use worldwiki_ports::events::EventPublisherPort;

pub struct AgentEmitter;

impl AgentEmitter {
    pub async fn emit_chunk(
        event_publisher: &Arc<dyn EventPublisherPort>,
        chat_id: &str,
        assistant_msg_id: &str,
        text: String,
        is_done: bool,
        chunk_type: &str,
    ) {
        let event = StreamChunk {
            chat_id: chat_id.to_string(),
            message_id: assistant_msg_id.to_string(),
            text,
            is_done,
            chunk_type: chunk_type.to_string(),
        };
        let _ = event_publisher
            .publish_raw(
                "chat_stream_chunk",
                serde_json::to_value(&event).unwrap_or_default(),
            )
            .await;
    }

    pub async fn emit_tool(
        event_publisher: &Arc<dyn EventPublisherPort>,
        chat_id: &str,
        assistant_msg_id: &str,
        tool_name: String,
        tool_args: Value,
    ) {
        let event = AgentToolEvent {
            chat_id: chat_id.to_string(),
            message_id: assistant_msg_id.to_string(),
            tool_name,
            tool_args,
        };
        let _ = event_publisher
            .publish_raw(
                "agent_tool",
                serde_json::to_value(&event).unwrap_or_default(),
            )
            .await;
    }

    pub async fn save_assistant_text(
        chat_repo: &Arc<dyn ChatRepository>,
        chat_id: &str,
        assistant_msg_id: &str,
        content: &str,
        reasoning: Option<&str>,
        tool_logs: Option<&[String]>,
    ) {
        if let Ok(msgs) = chat_repo.get_messages(chat_id).await {
            let clean_target = assistant_msg_id
                .trim_start_matches("chat_messages:")
                .trim_matches('`')
                .trim_matches('⟨')
                .trim_matches('⟩');
            if let Some(mut m) = msgs.into_iter().find(|m| {
                m.id == assistant_msg_id
                    || m.id == clean_target
                    || m.id
                        .trim_start_matches("chat_messages:")
                        .trim_matches('`')
                        .trim_matches('⟨')
                        .trim_matches('⟩')
                        == clean_target
            }) {
                m.content = content.to_string();
                m.reasoning = reasoning.map(|s| s.to_string());
                m.tool_logs = tool_logs.map(|l| l.to_vec());
                let _ = chat_repo.save_message(&m).await;
            } else {
                let m = ChatMessage {
                    id: format!("chat_messages:{clean_target}"),
                    project_id: "".to_string(),
                    chat_id: chat_id.to_string(),
                    role: MessageRole::Assistant,
                    content: content.to_string(),
                    reasoning: reasoning.map(|s| s.to_string()),
                    tool_logs: tool_logs.map(|l| l.to_vec()),
                    version: 1,
                    quoted_context: None,
                    citations: None,
                    parent_id: None,
                    is_active: true,
                    created_at: None,
                    updated_at: None,
                };
                let _ = chat_repo.save_message(&m).await;
            }
        }
    }
}
