//! Multi-turn autonomous agent execution loop with streaming, tool invocations, and cancellation.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};
use std::collections::HashMap;
use serde_json::Value;
use tokio::sync::oneshot;
use worldwiki_ports::ai::{
    AiProfileRepository, ChatRepository, LlmStreamPort, RAGContextPort, SkillRepositoryPort,
    StreamRequest, ToolUseCall,
};
use worldwiki_ports::events::EventPublisherPort;

use crate::ai::prompt::{
    history_to_input_messages, normalize_mode, InputContentBlock, InputMessage, MAX_AGENT_ITERATIONS,
};
use crate::ai::tools::AiToolFacades;
use super::agent_emitter::AgentEmitter;
use super::rag_context::{AssemblePromptParams, ChatContextBuilder};
use super::tool_dispatcher::{ChatToolDispatcher, ToolInvocationContext};

pub struct AgentLoopParams<'a> {
    pub chat_repo: &'a Arc<dyn ChatRepository>,
    pub profile_repo: &'a Arc<dyn AiProfileRepository>,
    pub stream_port: &'a Arc<dyn LlmStreamPort>,
    pub event_publisher: &'a Arc<dyn EventPublisherPort>,
    pub rag_port: &'a Option<Arc<dyn RAGContextPort>>,
    pub skill_repo: &'a Option<Arc<dyn SkillRepositoryPort>>,
    pub ai_tools: &'a Option<Arc<AiToolFacades>>,
    pub active_cancellations: &'a Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,
    pub pending_approvals: &'a Arc<RwLock<HashMap<String, oneshot::Sender<bool>>>>,
    pub project_id: &'a str,
    pub chat_id: &'a str,
    pub assistant_msg_id: &'a str,
    pub user_text: &'a str,
    pub mode_slug: Option<String>,
}

pub struct ChatAgentLoop;

impl ChatAgentLoop {
    pub async fn run(params: AgentLoopParams<'_>) {
        let profile = match params.profile_repo.get_active_profile(params.project_id).await {
            Ok(Some(p)) => p,
            Ok(None) => {
                let err =
                    "Нет активного AI-профиля. Настройте провайдера в настройках ИИ.".to_string();
                AgentEmitter::save_assistant_text(params.chat_repo, params.chat_id, params.assistant_msg_id, &err, None, None)
                    .await;
                AgentEmitter::emit_chunk(params.event_publisher, params.chat_id, params.assistant_msg_id, err, true, "text")
                    .await;
                return;
            }
            Err(e) => {
                let err = format!("Ошибка чтения AI-профиля: {e}");
                AgentEmitter::save_assistant_text(params.chat_repo, params.chat_id, params.assistant_msg_id, &err, None, None)
                    .await;
                AgentEmitter::emit_chunk(params.event_publisher, params.chat_id, params.assistant_msg_id, err, true, "text")
                    .await;
                return;
            }
        };

        let history_msgs = params.chat_repo
            .get_messages(params.chat_id)
            .await
            .unwrap_or_default();
        let history_vals: Vec<Value> = history_msgs
            .iter()
            .map(|m| serde_json::to_value(m).unwrap_or_default())
            .collect();

        let mut prompt_messages = history_to_input_messages(&history_vals, params.assistant_msg_id);
        if prompt_messages.is_empty() {
            let err = "История чата пуста.".to_string();
            AgentEmitter::save_assistant_text(params.chat_repo, params.chat_id, params.assistant_msg_id, &err, None, None)
                .await;
            AgentEmitter::emit_chunk(params.event_publisher, params.chat_id, params.assistant_msg_id, err, true, "text")
                .await;
            return;
        }

        let last_user_query = prompt_messages
            .iter()
            .rev()
            .find(|m| m.role == "user")
            .and_then(|m| {
                m.content.iter().find_map(|b| match b {
                    InputContentBlock::Text { text } => Some(text.as_str()),
                    _ => None,
                })
            })
            .unwrap_or("");

        let retrieved_context = ChatContextBuilder::retrieve_context(params.rag_port, params.project_id, last_user_query).await;

        let mode = normalize_mode(params.mode_slug.as_deref().unwrap_or("companion"));
        let system_prompt = ChatContextBuilder::assemble_skills_and_prompt(AssemblePromptParams {
            skill_repo: params.skill_repo,
            event_publisher: params.event_publisher,
            profile: &profile,
            project_id: params.project_id,
            chat_id: params.chat_id,
            mode,
            last_user_query,
            retrieved_context: retrieved_context.as_deref(),
        }).await;

        println!("[AGENT] started: chat={} project={} mode={}", params.chat_id, params.project_id, mode);

        let cancel_flag = Arc::new(AtomicBool::new(false));
        if let Ok(mut map) = params.active_cancellations.write() {
            map.insert(params.chat_id.to_string(), cancel_flag.clone());
        }

        let mut accumulated_reasoning = String::new();
        let mut all_tool_logs: Vec<String> = Vec::new();
        let mut last_text = String::new();
        let mut final_answer: Option<String> = None;

        for iteration in 0..MAX_AGENT_ITERATIONS {
            if cancel_flag.load(Ordering::Relaxed) {
                println!("[AGENT] Aborted by user request before iteration {} for chat={}", iteration + 1, params.chat_id);
                break;
            }
            println!("[AGENT] Iteration {}/{}", iteration + 1, MAX_AGENT_ITERATIONS);
            let stream_req = StreamRequest {
                profile: profile.clone(),
                system_prompt: system_prompt.clone(),
                messages: prompt_messages
                    .iter()
                    .map(|m| serde_json::to_value(m).unwrap_or_default())
                    .collect(),
                tools: Some(AiToolFacades::tool_definitions_for_mode(mode)),
            };

            let (tx, mut rx) = tokio::sync::mpsc::channel(128);
            let stream_port_clone = params.stream_port.clone();

            let stream_handle =
                tokio::spawn(async move { stream_port_clone.stream_chat(stream_req, tx).await });

            let mut assistant_text = String::new();
            let mut tool_uses: Vec<ToolUseCall> = Vec::new();

            while let Some(event) = rx.recv().await {
                if cancel_flag.load(Ordering::Relaxed) {
                    println!("[AGENT] Aborted by user during streaming for chat={}", params.chat_id);
                    break;
                }
                if let Some(text) = event.text_delta {
                    assistant_text.push_str(&text);
                    AgentEmitter::emit_chunk(params.event_publisher, params.chat_id, params.assistant_msg_id, text, false, "text")
                        .await;
                }
                if let Some(thinking) = event.reasoning_delta {
                    accumulated_reasoning.push_str(&thinking);
                    AgentEmitter::emit_chunk(params.event_publisher, params.chat_id, params.assistant_msg_id, thinking, false, "reasoning")
                        .await;
                }
                if let Some(usage_val) = event.usage {
                    if let Ok(tok_usage) = serde_json::from_value::<worldwiki_domain::ai::TokenUsage>(
                        usage_val.clone(),
                    ) {
                        let _ = params.chat_repo.update_token_usage(params.chat_id, &tok_usage).await;
                    }
                    AgentEmitter::emit_chunk(
                        params.event_publisher,
                        params.chat_id,
                        params.assistant_msg_id,
                        usage_val.to_string(),
                        false,
                        "usage",
                    )
                    .await;
                }
                if let Some(tool) = event.tool_use {
                    let log_msg = format!("Используется инструмент: {}", tool.name);
                    all_tool_logs.push(log_msg.clone());
                    println!(
                        "[AGENT TOOL CALL] name={} id={} args={}",
                        tool.name, tool.id, tool.input
                    );
                    AgentEmitter::emit_chunk(params.event_publisher, params.chat_id, params.assistant_msg_id, log_msg, false, "tool_log")
                        .await;
                    tool_uses.push(tool);
                }
                if event.is_done {
                    break;
                }
            }

            let mut stream_failed = false;
            let stream_res = stream_handle.await;
            if let Ok(Err(e)) = stream_res {
                println!("[AGENT STREAM ERROR] {e}");
                stream_failed = true;
                if assistant_text.is_empty() {
                    let err_msg = format!("Ошибка генерации ответа: {e}");
                    assistant_text = err_msg.clone();
                    AgentEmitter::emit_chunk(params.event_publisher, params.chat_id, params.assistant_msg_id, err_msg, true, "error")
                        .await;
                }
            }

            last_text = assistant_text.clone();

            if stream_failed {
                final_answer = Some(assistant_text);
                break;
            }

            if cancel_flag.load(Ordering::Relaxed) {
                println!("[AGENT] Generation cancelled for chat={}", params.chat_id);
                final_answer = Some(assistant_text);
                break;
            }

            if tool_uses.is_empty() {
                final_answer = Some(assistant_text);
                println!("[AGENT DONE] No more tool calls. Final answer emitted.");
                break;
            }

            let mut blocks = Vec::new();
            if !assistant_text.is_empty() {
                blocks.push(InputContentBlock::Text {
                    text: assistant_text,
                });
            }
            for tool in &tool_uses {
                blocks.push(InputContentBlock::ToolUse {
                    id: tool.id.clone(),
                    name: tool.name.clone(),
                    input: tool.input.clone(),
                });
            }
            prompt_messages.push(InputMessage {
                role: "assistant".to_string(),
                content: blocks,
            });

            for tool in &tool_uses {
                if cancel_flag.load(Ordering::Relaxed) {
                    println!("[AGENT] Aborted before executing tool={} for chat={}", tool.name, params.chat_id);
                    break;
                }
                AgentEmitter::emit_tool(
                    params.event_publisher,
                    params.chat_id,
                    params.assistant_msg_id,
                    tool.name.clone(),
                    tool.input.clone(),
                )
                .await;
                let (res_str, is_err) = ChatToolDispatcher::execute_tool(ToolInvocationContext {
                    ai_tools: params.ai_tools,
                    event_publisher: params.event_publisher,
                    pending_approvals: params.pending_approvals,
                    project_id: params.project_id,
                    chat_id: params.chat_id,
                    assistant_msg_id: params.assistant_msg_id,
                    mode,
                    name: &tool.name,
                    input: &tool.input,
                })
                .await;
                println!(
                    "[AGENT TOOL RESULT] name={} result_len={} is_err={}",
                    tool.name,
                    res_str.len(),
                    is_err
                );
                prompt_messages.push(InputMessage::user_tool_result(
                    tool.id.clone(),
                    res_str,
                    is_err,
                ));
            }
        }

        if let Ok(mut map) = params.active_cancellations.write() {
            map.remove(params.chat_id);
        }

        let answer = final_answer.unwrap_or(last_text);
        AgentEmitter::save_assistant_text(
            params.chat_repo,
            params.chat_id,
            params.assistant_msg_id,
            &answer,
            if accumulated_reasoning.is_empty() {
                None
            } else {
                Some(&accumulated_reasoning)
            },
            if all_tool_logs.is_empty() {
                None
            } else {
                Some(&all_tool_logs)
            },
        )
        .await;

        AgentEmitter::emit_chunk(params.event_publisher, params.chat_id, params.assistant_msg_id, String::new(), true, "text")
            .await;
    }
}
