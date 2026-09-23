use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::oneshot;
use worldwiki_ports::events::EventPublisherPort;
use crate::errors::ApplicationError;

pub struct ConsequentialApproval;

impl ConsequentialApproval {
    pub async fn request_and_await_approval(
        pending_approvals: &Arc<RwLock<HashMap<String, oneshot::Sender<bool>>>>,
        event_publisher: &Arc<dyn EventPublisherPort>,
        chat_id: &str,
        assistant_msg_id: &str,
        tool_name: &str,
        input: &Value,
    ) -> Result<(), ApplicationError> {
        let call_id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();
        if let Ok(mut map) = pending_approvals.write() {
            map.insert(call_id.clone(), tx);
        }

        let approval_event = json!({
            "call_id": call_id,
            "chat_id": chat_id,
            "message_id": assistant_msg_id,
            "assistant_msg_id": assistant_msg_id,
            "tool_name": tool_name,
            "action": input.get("action").and_then(|v| v.as_str()).unwrap_or("edit"),
            "input": input,
            "payload": input,
            "description": format!("Вызов инструмента: {}", tool_name)
        });

        if let Err(e) = event_publisher
            .publish_raw("ww-ai-tool-approval-request", approval_event)
            .await
        {
            eprintln!("[TOOL APPROVAL] Event publish error: {e}");
        }

        // Await approval up to 120 seconds
        match tokio::time::timeout(std::time::Duration::from_secs(120), rx).await {
            Ok(Ok(true)) => {
                println!("[TOOL APPROVAL] Approved by user: call_id={call_id}");
                Ok(())
            }
            Ok(Ok(false)) => {
                println!("[TOOL APPROVAL] Rejected by user: call_id={call_id}");
                Err(ApplicationError::PermissionDenied("Действие отклонено пользователем.".to_string()))
            }
            _ => {
                println!("[TOOL APPROVAL] Timeout or channel dropped: call_id={call_id}");
                if let Ok(mut map) = pending_approvals.write() {
                    map.remove(&call_id);
                }
                Err(ApplicationError::ExecutionFailed("Время ожидания подтверждения действия истекло.".to_string()))
            }
        }
    }
}
