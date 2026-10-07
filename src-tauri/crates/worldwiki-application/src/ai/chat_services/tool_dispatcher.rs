//! Tool execution dispatcher, role mode permission validation, and interactive confirmation.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use serde_json::{json, Value};
use tokio::sync::oneshot;
use worldwiki_ports::events::EventPublisherPort;
use crate::ai::tools::AiToolFacades;
use crate::errors::ApplicationError;

pub struct ToolInvocationContext<'a> {
    pub ai_tools: &'a Option<Arc<AiToolFacades>>,
    pub event_publisher: &'a Arc<dyn EventPublisherPort>,
    pub pending_approvals: &'a Arc<RwLock<HashMap<String, oneshot::Sender<bool>>>>,
    pub project_id: &'a str,
    pub chat_id: &'a str,
    pub assistant_msg_id: &'a str,
    pub mode: &'a str,
    pub name: &'a str,
    pub input: &'a Value,
}

pub struct ChatToolDispatcher;

impl ChatToolDispatcher {
    pub async fn execute_tool(ctx: ToolInvocationContext<'_>) -> (String, bool) {
        let start = std::time::Instant::now();
        println!(
            "\n🔥🔥🔥 [BACKEND TOOL EXECUTE] mode='{}' tool='{}' project='{}' chat='{}'\n├─ Input: {}",
            ctx.mode, ctx.name, ctx.project_id, ctx.chat_id, ctx.input
        );
        let Some(tools) = ctx.ai_tools else {
            println!("└─ Error: AI tools not available in current environment");
            return (
                "AI tools are not available in current environment".to_string(),
                true,
            );
        };

        // 1. Role Mode Defense-in-depth Check
        let norm_mode = if matches!(ctx.mode, "direct" | "all" | "*") {
            ctx.mode
        } else {
            crate::ai::prompt::normalize_mode(ctx.mode)
        };

        let is_allowed_in_mode = match norm_mode {
            "direct" | "all" | "*" => true,
            "editor" => !matches!(ctx.name, "consistency_audit" | "audit_consistency" | "task_delegate" | "delegate_task"),
            "analyst" => !matches!(ctx.name, "manuscript_edit" | "edit_manuscript" | "entity_manage" | "manage_entity"),
            _ => matches!(
                ctx.name,
                "world_query" | "query_world" | "entity_inspect" | "inspect_entity" | "manuscript_read" | "read_manuscript" | "get_chapters_list" | "timeline_manage" | "chronology" | "timeline_manager"
            ),
        };

        if !is_allowed_in_mode {
            let msg = format!("Инструмент '{}' недоступен в режиме '{norm_mode}'.", ctx.name);
            return (msg, true);
        }

        // 2. Consequential Tool Approval (Interactive Confirmation for Risky Mutations)
        let is_consequential = (matches!(ctx.name, "manuscript_edit" | "edit_manuscript")
            || (matches!(ctx.name, "entity_manage" | "manage_entity")
                && ctx.input.get("action").and_then(|v| v.as_str()) == Some("delete")))
            && !ctx.chat_id.is_empty()
            && ctx.mode != "direct";

        if is_consequential
            && let Err(msg) = super::approval::ConsequentialApproval::request_and_await_approval(
                ctx.pending_approvals,
                ctx.event_publisher,
                ctx.chat_id,
                ctx.assistant_msg_id,
                ctx.name,
                ctx.input,
            )
            .await
        {
            return (msg.to_string(), true);
        }

        // 3. Execution with Project ID Auto-injection
        let result: Result<Value, ApplicationError> = match ctx.name {
            "world_query" | "query_world" => {
                let query = ctx.input.get("query").and_then(|v| v.as_str()).unwrap_or("");
                let scope = ctx.input.get("scope").and_then(|v| v.as_str()).unwrap_or("all");
                let top_k = ctx.input.get("top_k").and_then(|v| v.as_u64()).unwrap_or(8) as usize;
                tools
                    .query_world(ctx.project_id, query, scope, top_k)
                    .await
                    .map(|list| {
                        let count = list.len();
                        json!({
                            "status": "success",
                            "count": count,
                            "query": query,
                            "results": list
                        })
                    })
            }
            "entity_inspect" | "inspect_entity" => {
                let entity_id = ctx.input
                    .get("entity_id_or_name")
                    .or_else(|| ctx.input.get("entity_id"))
                    .or_else(|| ctx.input.get("name"))
                    .or_else(|| ctx.input.get("query"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                tools.inspect_entity(ctx.project_id, entity_id).await
            }
            "entity_manage" | "manage_entity" => {
                let action = ctx.input.get("action").and_then(|v| v.as_str()).unwrap_or("");
                let mut payload = ctx.input.get("payload").cloned().unwrap_or(json!({}));
                if let Value::Object(ref mut map) = payload
                    && !map.contains_key("project_id")
                    && !ctx.project_id.is_empty()
                {
                    map.insert("project_id".to_string(), Value::String(ctx.project_id.to_string()));
                }
                tools.manage_entity(action, payload).await
            }
            "manuscript_read" | "read_manuscript" | "get_chapters_list" => {
                let chapter_id = ctx.input
                    .get("chapter_id")
                    .or_else(|| ctx.input.get("id"))
                    .or_else(|| ctx.input.get("query"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                tools.read_manuscript(ctx.project_id, chapter_id).await
            }
            "manuscript_edit" | "edit_manuscript" => match serde_json::from_value::<
                crate::workflows::EditManuscriptRequest,
            >(ctx.input.clone())
            {
                Ok(req) => tools.edit_manuscript(req).await.map(|v| json!(v)),
                Err(e) => Err(ApplicationError::Validation(e.to_string())),
            },
            "timeline_manage" | "chronology" | "timeline_manager" => {
                let action = ctx.input.get("action").and_then(|v| v.as_str()).unwrap_or("");
                let mut payload = ctx.input.get("payload").cloned().unwrap_or(json!({}));
                if let Value::Object(ref mut map) = payload
                    && !map.contains_key("project_id")
                    && !ctx.project_id.is_empty()
                {
                    map.insert("project_id".to_string(), Value::String(ctx.project_id.to_string()));
                }
                tools.chronology(action, payload).await
            }
            "consistency_audit" | "audit_consistency" => {
                let target_type = ctx.input
                    .get("target_type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("volume");
                let target_id = ctx.input
                    .get("target_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                tools.audit_consistency(target_type, target_id).await
            }
            "task_delegate" | "delegate_task" => {
                let task_id = ctx.input.get("task_id").and_then(|v| v.as_str()).unwrap_or("");
                let prompt = ctx.input.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
                tools.delegate_task(task_id, prompt).await
            }
            other => Err(ApplicationError::Validation(format!(
                "Unknown tool: {other}"
            ))),
        };

        let duration = start.elapsed().as_millis();
        match result {
            Ok(v) => {
                let s = v.to_string();
                println!("└─ Success ({duration}ms): output_len={} chars", s.len());
                (s, false)
            }
            Err(e) => {
                let s = format!("Error executing {}: {e}", ctx.name);
                println!("└─ Error ({duration}ms): {s}");
                (s, true)
            }
        }
    }
}
