use super::prompt::{
    build_system_prompt_direct, history_to_input_messages, InputContentBlock, InputMessage,
    MAX_AGENT_ITERATIONS,
};
use super::tools::AiToolFacades;
use crate::errors::ApplicationError;
use serde_json::{json, Value};
use std::sync::Arc;
use worldwiki_domain::ai::{
    AgentToolEvent, AiModelInfo, AiProfile, Chat, ChatMessage, MessageRole, StreamChunk,
};
use worldwiki_ports::ai::{
    AiProfileRepository, ChatRepository, LlmStreamPort, RAGContextPort, SkillRepositoryPort,
    StreamRequest, ToolUseCall,
};
use worldwiki_ports::events::EventPublisherPort;

pub struct ChatServices {
    pub chat_repo: Arc<dyn ChatRepository>,
    pub profile_repo: Arc<dyn AiProfileRepository>,
    pub stream_port: Arc<dyn LlmStreamPort>,
    pub event_publisher: Arc<dyn EventPublisherPort>,
    pub rag_port: Option<Arc<dyn RAGContextPort>>,
    pub skill_repo: Option<Arc<dyn SkillRepositoryPort>>,
    pub ai_tools: Option<Arc<AiToolFacades>>,
    pub active_cancellations: Arc<std::sync::RwLock<std::collections::HashMap<String, Arc<std::sync::atomic::AtomicBool>>>>,
    pub pending_approvals: Arc<std::sync::RwLock<std::collections::HashMap<String, tokio::sync::oneshot::Sender<bool>>>>,
}

pub struct SendMessageResult {
    pub chat_id: String,
    pub user_msg_id: String,
    pub assistant_msg_id: String,
}

impl ChatServices {
    pub fn new(
        chat_repo: Arc<dyn ChatRepository>,
        profile_repo: Arc<dyn AiProfileRepository>,
        stream_port: Arc<dyn LlmStreamPort>,
        event_publisher: Arc<dyn EventPublisherPort>,
        rag_port: Option<Arc<dyn RAGContextPort>>,
        skill_repo: Option<Arc<dyn SkillRepositoryPort>>,
        ai_tools: Option<Arc<AiToolFacades>>,
    ) -> Self {
        Self {
            chat_repo,
            profile_repo,
            stream_port,
            event_publisher,
            rag_port,
            skill_repo,
            ai_tools,
            active_cancellations: Arc::new(std::sync::RwLock::new(std::collections::HashMap::new())),
            pending_approvals: Arc::new(std::sync::RwLock::new(std::collections::HashMap::new())),
        }
    }

    pub fn respond_tool_approval(&self, call_id: &str, approved: bool) -> bool {
        if let Ok(mut map) = self.pending_approvals.write() {
            if let Some(tx) = map.remove(call_id) {
                let _ = tx.send(approved);
                return true;
            }
        }
        false
    }

    pub fn abort_generation(&self, chat_id: &str) -> bool {
        if let Ok(map) = self.active_cancellations.read() {
            if let Some(flag) = map.get(chat_id) {
                flag.store(true, std::sync::atomic::Ordering::Relaxed);
                return true;
            }
        }
        false
    }

    pub async fn get_chat_tree(&self, project_id: &str) -> Result<Vec<Chat>, ApplicationError> {
        self.chat_repo
            .get_chat_tree(project_id)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn get_messages(&self, chat_id: &str) -> Result<Vec<ChatMessage>, ApplicationError> {
        self.chat_repo
            .get_messages(chat_id)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn send_message(
        &self,
        project_id: &str,
        chat_id: &str,
        text: &str,
    ) -> Result<SendMessageResult, ApplicationError> {
        let is_new = chat_id.is_empty() || chat_id == "new" || !chat_id.starts_with("chats:");
        let actual_chat_id = if is_new {
            let new_uuid = uuid::Uuid::new_v4().to_string();
            let c_id = format!("chats:{new_uuid}");
            let title: String = text.chars().take(40).collect();
            let title = if title.trim().is_empty() {
                "Новый чат".to_string()
            } else {
                title
            };

            let chat = Chat::new(c_id.clone(), project_id, title);
            self.chat_repo
                .save_chat(&chat)
                .await
                .map_err(ApplicationError::from)?;
            c_id
        } else {
            chat_id.to_string()
        };

        let existing_messages = self
            .chat_repo
            .get_messages(&actual_chat_id)
            .await
            .unwrap_or_default();

        let last_msg_id = existing_messages.last().map(|m| m.id.clone());

        let user_uuid = uuid::Uuid::new_v4().to_string();
        let user_msg_id = format!("chat_messages:{user_uuid}");
        let mut user_msg = ChatMessage::new(
            user_msg_id.clone(),
            project_id,
            actual_chat_id.clone(),
            MessageRole::User,
            text,
        );
        user_msg.parent_id = last_msg_id;

        self.chat_repo
            .save_message(&user_msg)
            .await
            .map_err(ApplicationError::from)?;

        let asst_uuid = uuid::Uuid::new_v4().to_string();
        let asst_msg_id = format!("chat_messages:{asst_uuid}");
        let mut asst_msg = ChatMessage::new(
            asst_msg_id.clone(),
            project_id,
            actual_chat_id.clone(),
            MessageRole::Assistant,
            "",
        );
        asst_msg.parent_id = Some(user_msg_id.clone());

        self.chat_repo
            .save_message(&asst_msg)
            .await
            .map_err(ApplicationError::from)?;

        Ok(SendMessageResult {
            chat_id: actual_chat_id,
            user_msg_id,
            assistant_msg_id: asst_msg_id,
        })
    }

    async fn emit_chunk(
        &self,
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
        let _ = self
            .event_publisher
            .publish_raw(
                "chat_stream_chunk",
                serde_json::to_value(&event).unwrap_or_default(),
            )
            .await;
    }

    async fn emit_tool(
        &self,
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
        let _ = self
            .event_publisher
            .publish_raw(
                "agent_tool",
                serde_json::to_value(&event).unwrap_or_default(),
            )
            .await;
    }

    pub async fn run_agent_loop(
        &self,
        project_id: &str,
        chat_id: &str,
        assistant_msg_id: &str,
        _user_text: &str,
        _mode_slug: Option<String>,
    ) {
        let profile = match self.profile_repo.get_active_profile(project_id).await {
            Ok(Some(p)) => p,
            Ok(None) => {
                let err =
                    "Нет активного AI-профиля. Настройте провайдера в настройках ИИ.".to_string();
                self.save_assistant_text(chat_id, assistant_msg_id, &err, None, None)
                    .await;
                self.emit_chunk(chat_id, assistant_msg_id, err, true, "text")
                    .await;
                return;
            }
            Err(e) => {
                let err = format!("Ошибка чтения AI-профиля: {e}");
                self.save_assistant_text(chat_id, assistant_msg_id, &err, None, None)
                    .await;
                self.emit_chunk(chat_id, assistant_msg_id, err, true, "text")
                    .await;
                return;
            }
        };

        let history_msgs = self
            .chat_repo
            .get_messages(chat_id)
            .await
            .unwrap_or_default();
        let history_vals: Vec<Value> = history_msgs
            .iter()
            .map(|m| serde_json::to_value(m).unwrap_or_default())
            .collect();

        let mut prompt_messages = history_to_input_messages(&history_vals, assistant_msg_id);
        if prompt_messages.is_empty() {
            let err = "История чата пуста.".to_string();
            self.save_assistant_text(chat_id, assistant_msg_id, &err, None, None)
                .await;
            self.emit_chunk(chat_id, assistant_msg_id, err, true, "text")
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

        let retrieved_context = if let Some(ref rag) = self.rag_port {
            let direct_ctx = if !last_user_query.is_empty() {
                match rag
                    .retrieve_context(project_id, last_user_query, "all", 5)
                    .await
                {
                    Ok(items) => {
                        let text = items
                            .into_iter()
                            .filter_map(|v| {
                                v.get("content")
                                    .or_else(|| v.get("match"))
                                    .and_then(|c| c.as_str())
                                    .map(|s| s.to_string())
                            })
                            .collect::<Vec<_>>()
                            .join("\n\n");
                        if text.trim().is_empty() {
                            None
                        } else {
                            Some(text)
                        }
                    }
                    Err(_) => None,
                }
            } else {
                None
            };

            if direct_ctx.is_some() {
                direct_ctx
            } else {
                // Fallback: minimal lore summary so AI always remembers entities and chapters
                match rag.retrieve_context(project_id, "", "all", 15).await {
                    Ok(items) if !items.is_empty() => {
                        let summary_lines = items
                            .into_iter()
                            .filter_map(|v| {
                                let st = v.get("source_type").and_then(|s| s.as_str()).unwrap_or("");
                                if st == "entity" {
                                    let name = v.get("name").and_then(|n| n.as_str()).unwrap_or("");
                                    let tk = v.get("type_key").and_then(|t| t.as_str()).unwrap_or("сущность");
                                    if !name.is_empty() {
                                        Some(format!("• {name} ({tk})"))
                                    } else {
                                        None
                                    }
                                } else if st == "chapter" {
                                    let title = v.get("title").and_then(|t| t.as_str()).unwrap_or("");
                                    if !title.is_empty() {
                                        Some(format!("• Глава: {title}"))
                                    } else {
                                        None
                                    }
                                } else {
                                    None
                                }
                            })
                            .collect::<Vec<_>>();
                        if !summary_lines.is_empty() {
                            Some(format!("[Справочник проекта]:\n{}", summary_lines.join("\n")))
                        } else {
                            None
                        }
                    }
                    _ => None,
                }
            }
        } else {
            None
        };

        let detected_skills = if let Some(ref sr) = self.skill_repo {
            if !last_user_query.is_empty() {
                sr.resolve_active_skills(Some(project_id), last_user_query, 2).await.unwrap_or_default()
            } else {
                vec![]
            }
        } else {
            vec![]
        };

        let mut active_skill_instructions = String::new();
        for skill in &detected_skills {
            let content = if !skill.prompt_text.is_empty() {
                skill.prompt_text.clone()
            } else {
                skill.description.clone()
            };
            active_skill_instructions.push_str(&format!(
                "\n\n<active_skill id=\"{}\" name=\"{}\">\n{}\n</active_skill>",
                skill.id, skill.name, content
            ));

            let _ = self.event_publisher.publish_raw(
                "ai:skill_activated",
                serde_json::json!({
                    "chat_id": chat_id,
                    "skill_id": skill.id,
                    "skill_name": skill.name,
                    "matched_via": skill.matched_via,
                    "score": skill.score
                }),
            ).await;
        }

        let mode = super::prompt::normalize_mode(_mode_slug.as_deref().unwrap_or("companion"));
        let mut system_prompt = build_system_prompt_direct(
            mode,
            profile
                .settings
                .get("custom_instructions")
                .and_then(|v| v.as_str())
                .unwrap_or(""),
            project_id,
            retrieved_context.as_deref(),
        );

        if !active_skill_instructions.is_empty() {
            system_prompt.push_str(&active_skill_instructions);
        }

        println!("[AGENT] started: chat={} project={} mode={}", chat_id, project_id, mode);
        println!(
            "\n[PROMPT ASSEMBLY TRACE]\n├─ Provider: {} | Model: {}\n├─ Auto-RAG Context: {} chars\n├─ System Prompt: {} chars\n├─ Messages Count: {}\n└─ Reasoning Effort: {:?}",
            profile.provider,
            profile
                .settings
                .get("model")
                .and_then(|v| v.as_str())
                .unwrap_or("default"),
            retrieved_context.as_ref().map(|c| c.len()).unwrap_or(0),
            system_prompt.len(),
            prompt_messages.len(),
            profile
                .settings
                .get("reasoning_effort")
                .and_then(|v| v.as_str())
        );

        let cancel_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
        if let Ok(mut map) = self.active_cancellations.write() {
            map.insert(chat_id.to_string(), cancel_flag.clone());
        }

        let mut accumulated_reasoning = String::new();
        let mut all_tool_logs: Vec<String> = Vec::new();
        let mut last_text = String::new();
        let mut final_answer: Option<String> = None;

        for iteration in 0..MAX_AGENT_ITERATIONS {
            if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
                println!("[AGENT] Aborted by user request before iteration {} for chat={}", iteration + 1, chat_id);
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
            let stream_port = self.stream_port.clone();

            let stream_handle =
                tokio::spawn(async move { stream_port.stream_chat(stream_req, tx).await });

            let mut assistant_text = String::new();
            let mut tool_uses: Vec<ToolUseCall> = Vec::new();

            while let Some(event) = rx.recv().await {
                if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
                    println!("[AGENT] Aborted by user during streaming for chat={}", chat_id);
                    break;
                }
                if let Some(text) = event.text_delta {
                    assistant_text.push_str(&text);
                    self.emit_chunk(chat_id, assistant_msg_id, text, false, "text")
                        .await;
                }
                if let Some(thinking) = event.reasoning_delta {
                    accumulated_reasoning.push_str(&thinking);
                    self.emit_chunk(chat_id, assistant_msg_id, thinking, false, "reasoning")
                        .await;
                }
                if let Some(usage_val) = event.usage {
                    println!("[STREAM USAGE] {}", usage_val);
                    if let Ok(tok_usage) = serde_json::from_value::<worldwiki_domain::ai::TokenUsage>(
                        usage_val.clone(),
                    ) {
                        let _ = self.chat_repo.update_token_usage(chat_id, &tok_usage).await;
                    }
                    self.emit_chunk(
                        chat_id,
                        assistant_msg_id,
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
                    self.emit_chunk(chat_id, assistant_msg_id, log_msg, false, "tool_log")
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
                    self.emit_chunk(chat_id, assistant_msg_id, err_msg, true, "error")
                        .await;
                }
            }

            last_text = assistant_text.clone();

            if stream_failed {
                final_answer = Some(assistant_text);
                break;
            }

            if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
                println!("[AGENT] Generation cancelled for chat={}", chat_id);
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
                if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
                    println!("[AGENT] Aborted before executing tool={} for chat={}", tool.name, chat_id);
                    break;
                }
                self.emit_tool(
                    chat_id,
                    assistant_msg_id,
                    tool.name.clone(),
                    tool.input.clone(),
                )
                .await;
                let (res_str, is_err) =
                    self.execute_tool(project_id, chat_id, assistant_msg_id, mode, &tool.name, &tool.input).await;
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

        if let Ok(mut map) = self.active_cancellations.write() {
            map.remove(chat_id);
        }

        let answer = final_answer.unwrap_or(last_text);
        self.save_assistant_text(
            chat_id,
            assistant_msg_id,
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

        self.emit_chunk(chat_id, assistant_msg_id, String::new(), true, "text")
            .await;
    }

    pub async fn execute_tool(
        &self,
        project_id: &str,
        chat_id: &str,
        assistant_msg_id: &str,
        mode: &str,
        name: &str,
        input: &Value,
    ) -> (String, bool) {
        let start = std::time::Instant::now();
        println!("\n🔥🔥🔥 [BACKEND TOOL EXECUTE] mode='{mode}' tool='{name}' project='{project_id}' chat='{chat_id}'\n├─ Input: {input}");
        let Some(ref tools) = self.ai_tools else {
            println!("└─ Error: AI tools not available in current environment");
            return (
                "AI tools are not available in current environment".to_string(),
                true,
            );
        };

        // 1. Role Mode Defense-in-depth Check
        let norm_mode = if matches!(mode, "direct" | "all" | "*") {
            mode
        } else {
            super::prompt::normalize_mode(mode)
        };

        let is_allowed_in_mode = match norm_mode {
            "direct" | "all" | "*" => true,
            "editor" => !matches!(name, "consistency_audit" | "audit_consistency" | "task_delegate" | "delegate_task"),
            "analyst" => !matches!(name, "manuscript_edit" | "edit_manuscript" | "entity_manage" | "manage_entity"),
            _ => matches!(
                name,
                "world_query" | "query_world" | "entity_inspect" | "inspect_entity" | "manuscript_read" | "read_manuscript" | "get_chapters_list" | "timeline_manage" | "chronology" | "timeline_manager"
            ),
        };

        if !is_allowed_in_mode {
            let msg = format!("Инструмент '{name}' недоступен в режиме '{norm_mode}'.");
            return (msg, true);
        }

        // 2. Consequential Tool Approval (Interactive Confirmation for Risky Mutations)
        let is_consequential = (matches!(name, "manuscript_edit" | "edit_manuscript")
            || (matches!(name, "entity_manage" | "manage_entity")
                && input.get("action").and_then(|v| v.as_str()) == Some("delete")))
            && !chat_id.is_empty()
            && mode != "direct";

        if is_consequential {
            let call_id = uuid::Uuid::new_v4().to_string();
            let (tx, rx) = tokio::sync::oneshot::channel();
            if let Ok(mut map) = self.pending_approvals.write() {
                map.insert(call_id.clone(), tx);
            }

            let approval_event = json!({
                "call_id": call_id,
                "chat_id": chat_id,
                "message_id": assistant_msg_id,
                "assistant_msg_id": assistant_msg_id,
                "tool_name": name,
                "action": input.get("action").and_then(|v| v.as_str()).unwrap_or("edit"),
                "input": input,
                "payload": input,
                "description": format!("Вызов инструмента: {name}")
            });

            let _ = self
                .event_publisher
                .publish_raw("ww-ai-tool-approval-request", approval_event)
                .await;

            // Await approval up to 120 seconds
            match tokio::time::timeout(std::time::Duration::from_secs(120), rx).await {
                Ok(Ok(true)) => {
                    println!("[TOOL APPROVAL] Approved by user: call_id={call_id}");
                }
                Ok(Ok(false)) => {
                    println!("[TOOL APPROVAL] Rejected by user: call_id={call_id}");
                    return ("Действие отклонено пользователем.".to_string(), true);
                }
                _ => {
                    println!("[TOOL APPROVAL] Timeout or channel dropped: call_id={call_id}");
                    if let Ok(mut map) = self.pending_approvals.write() {
                        map.remove(&call_id);
                    }
                    return ("Время ожидания подтверждения действия истекло.".to_string(), true);
                }
            }
        }

        // 3. Execution with Project ID Auto-injection
        let result: Result<Value, ApplicationError> = match name {
            "world_query" | "query_world" => {
                let query = input.get("query").and_then(|v| v.as_str()).unwrap_or("");
                let scope = input.get("scope").and_then(|v| v.as_str()).unwrap_or("all");
                let top_k = input.get("top_k").and_then(|v| v.as_u64()).unwrap_or(8) as usize;
                tools
                    .query_world(project_id, query, scope, top_k)
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
                let entity_id = input
                    .get("entity_id_or_name")
                    .or_else(|| input.get("entity_id"))
                    .or_else(|| input.get("name"))
                    .or_else(|| input.get("query"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                tools.inspect_entity(project_id, entity_id).await
            }
            "entity_manage" | "manage_entity" => {
                let action = input.get("action").and_then(|v| v.as_str()).unwrap_or("");
                let mut payload = input.get("payload").cloned().unwrap_or(json!({}));
                if let Value::Object(ref mut map) = payload {
                    if !map.contains_key("project_id") && !project_id.is_empty() {
                        map.insert("project_id".to_string(), Value::String(project_id.to_string()));
                    }
                }
                tools.manage_entity(action, payload).await
            }
            "manuscript_read" | "read_manuscript" | "get_chapters_list" => {
                let chapter_id = input
                    .get("chapter_id")
                    .or_else(|| input.get("id"))
                    .or_else(|| input.get("query"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                tools.read_manuscript(project_id, chapter_id).await
            }
            "manuscript_edit" | "edit_manuscript" => match serde_json::from_value::<
                crate::workflows::EditManuscriptRequest,
            >(input.clone())
            {
                Ok(req) => tools.edit_manuscript(req).await.map(|v| json!(v)),
                Err(e) => Err(ApplicationError::Validation(e.to_string())),
            },
            "timeline_manage" | "chronology" | "timeline_manager" => {
                let action = input.get("action").and_then(|v| v.as_str()).unwrap_or("");
                let mut payload = input.get("payload").cloned().unwrap_or(json!({}));
                if let Value::Object(ref mut map) = payload {
                    if !map.contains_key("project_id") && !project_id.is_empty() {
                        map.insert("project_id".to_string(), Value::String(project_id.to_string()));
                    }
                }
                tools.chronology(action, payload).await
            }
            "consistency_audit" | "audit_consistency" => {
                let target_type = input
                    .get("target_type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("volume");
                let target_id = input
                    .get("target_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                tools.audit_consistency(target_type, target_id).await
            }
            "task_delegate" | "delegate_task" => {
                let task_id = input.get("task_id").and_then(|v| v.as_str()).unwrap_or("");
                let prompt = input.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
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
                let s = format!("Error executing {name}: {e}");
                println!("└─ Error ({duration}ms): {s}");
                (s, true)
            }
        }
    }

    async fn save_assistant_text(
        &self,
        chat_id: &str,
        assistant_msg_id: &str,
        content: &str,
        reasoning: Option<&str>,
        tool_logs: Option<&[String]>,
    ) {
        if let Ok(msgs) = self.chat_repo.get_messages(chat_id).await {
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
                let _ = self.chat_repo.save_message(&m).await;
                println!(
                    "[AGENT] Saved assistant message {} with reasoning len={:?}",
                    m.id,
                    reasoning.map(|r| r.len())
                );
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
                let _ = self.chat_repo.save_message(&m).await;
                println!(
                    "[AGENT] Fallback created assistant message {} with reasoning len={:?}",
                    m.id,
                    reasoning.map(|r| r.len())
                );
            }
        }
    }

    pub async fn fork_chat(
        &self,
        project_id: &str,
        message_id: &str,
        new_title: &str,
    ) -> Result<Chat, ApplicationError> {
        let msg_clean = if message_id.starts_with("chat_messages:") {
            message_id.to_string()
        } else {
            format!("chat_messages:{}", message_id)
        };
        let raw_id = msg_clean.trim_start_matches("chat_messages:").to_string();

        let is_match = |m: &ChatMessage| {
            m.id == msg_clean
                || m.id == raw_id
                || m.id.ends_with(&format!(":{raw_id}"))
                || m.id.trim_start_matches("chat_messages:") == raw_id
        };

        let chats = self
            .chat_repo
            .get_chat_tree(project_id)
            .await
            .unwrap_or_default();
        let mut target_chat_id = None;
        let mut all_msgs = Vec::new();

        for c in &chats {
            let msgs = self.chat_repo.get_messages(&c.id).await.unwrap_or_default();
            if msgs.iter().any(is_match) {
                target_chat_id = Some(c.id.clone());
                all_msgs = msgs;
                break;
            }
        }

        if target_chat_id.is_none() {
            for cid in &[
                "chats:main",
                "chats:original",
                "chats:c_main",
                "main",
                "original",
                "c_main",
            ] {
                let msgs = self.chat_repo.get_messages(cid).await.unwrap_or_default();
                if msgs.iter().any(is_match) {
                    target_chat_id = Some((*cid).to_string());
                    all_msgs = msgs;
                    break;
                }
            }
        }

        let new_chat_id = format!("chats:{}", uuid::Uuid::new_v4());
        let title = if new_title.trim().is_empty() {
            "Новая ветка".to_string()
        } else {
            new_title.to_string()
        };
        let mut chat = Chat::new(new_chat_id.clone(), project_id, title);
        if let Some(ref orig_chat_id) = target_chat_id {
            chat.parent_chat_id = Some(orig_chat_id.clone());
        }

        let saved = self
            .chat_repo
            .save_chat(&chat)
            .await
            .map_err(ApplicationError::from)?;

        if let Some(ref orig_chat_id) = target_chat_id {
            let _ = self
                .chat_repo
                .update_chat_parent(&new_chat_id, Some(orig_chat_id))
                .await;
        }

        if let Some(target_idx) = all_msgs.iter().position(is_match) {
            let mut branch = Vec::new();
            let mut curr = Some(all_msgs[target_idx].clone());
            while let Some(msg) = curr {
                let pid = msg.parent_id.clone();
                branch.push(msg);
                curr = pid.and_then(|p| {
                    let p_raw = p.trim_start_matches("chat_messages:");
                    all_msgs
                        .iter()
                        .find(|m| m.id == p || m.id.trim_start_matches("chat_messages:") == p_raw)
                        .cloned()
                });
            }
            branch.reverse();

            if branch.is_empty() {
                branch = all_msgs[..=target_idx].to_vec();
            }

            use std::collections::HashMap;
            let mut id_map: HashMap<String, String> = HashMap::new();
            for old_msg in branch {
                let new_uuid = uuid::Uuid::new_v4().to_string();
                let new_id = format!("chat_messages:{}", new_uuid);
                id_map.insert(old_msg.id.clone(), new_id.clone());
                id_map.insert(
                    old_msg.id.trim_start_matches("chat_messages:").to_string(),
                    new_id.clone(),
                );

                let mapped_parent = old_msg.parent_id.and_then(|p| id_map.get(&p).cloned());
                let mut new_msg = ChatMessage::new(
                    new_id,
                    project_id,
                    new_chat_id.clone(),
                    old_msg.role,
                    old_msg.content,
                );
                new_msg.parent_id = mapped_parent;
                new_msg.is_active = old_msg.is_active;
                self.chat_repo
                    .save_message(&new_msg)
                    .await
                    .map_err(ApplicationError::from)?;
            }
        }

        Ok(saved)
    }

    pub async fn save_chat(&self, chat: &Chat) -> Result<Chat, ApplicationError> {
        self.chat_repo
            .save_chat(chat)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn update_chat_parent(
        &self,
        chat_id: &str,
        new_parent_id: Option<&str>,
    ) -> Result<(), ApplicationError> {
        self.chat_repo
            .update_chat_parent(chat_id, new_parent_id)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn delete_chat(&self, chat_id: &str) -> Result<(), ApplicationError> {
        self.chat_repo
            .delete_chat(chat_id)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn delete_message(&self, message_id: &str) -> Result<(), ApplicationError> {
        self.chat_repo
            .delete_message(message_id)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn switch_variant(&self, message_id: &str) -> Result<(), ApplicationError> {
        self.chat_repo
            .switch_variant(message_id)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn fetch_models(
        &self,
        provider: &str,
        api_key: Option<&str>,
    ) -> Result<Vec<AiModelInfo>, ApplicationError> {
        self.profile_repo
            .fetch_models(provider, api_key)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn get_profiles(&self, project_id: &str) -> Result<Vec<AiProfile>, ApplicationError> {
        self.profile_repo
            .get_profiles(project_id)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn save_profile(&self, profile: &AiProfile) -> Result<AiProfile, ApplicationError> {
        self.profile_repo
            .save_profile(profile)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn delete_profile(&self, id: &str) -> Result<(), ApplicationError> {
        self.profile_repo
            .delete_profile(id)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn edit_message(
        &self,
        project_id: &str,
        chat_id: &str,
        msg_id: &str,
        new_text: &str,
    ) -> Result<(String, String), ApplicationError> {
        self.chat_repo
            .edit_message_branch(project_id, chat_id, msg_id, new_text)
            .await
            .map_err(ApplicationError::from)
    }

    pub async fn regenerate_message(
        &self,
        project_id: &str,
        chat_id: &str,
        parent_msg_id: &str,
    ) -> Result<(String, String, String), ApplicationError> {
        self.chat_repo
            .regenerate_assistant_variant(project_id, chat_id, parent_msg_id)
            .await
            .map_err(ApplicationError::from)
    }
}

pub fn parse_llm_error_to_human(raw_err: &str) -> String {
    let mut extracted_msg: Option<String> = None;
    let mut extracted_remedy: Option<String> = None;

    if let Some(json_start) = raw_err.find('{') {
        if let Ok(val) = serde_json::from_str::<Value>(&raw_err[json_start..]) {
            if let Some(err_obj) = val.get("error") {
                if let Some(msg) = err_obj.get("message").and_then(|m| m.as_str()) {
                    extracted_msg = Some(msg.to_string());
                }
                if let Some(meta) = err_obj.get("metadata") {
                    if let Some(remedy) = meta.get("remedy_hint").and_then(|r| r.as_str()) {
                        extracted_remedy = Some(remedy.to_string());
                    }
                }
            } else if let Some(msg) = val.get("message").and_then(|m| m.as_str()) {
                extracted_msg = Some(msg.to_string());
            }
        }
    }

    let detail_msg = extracted_msg.unwrap_or_else(|| {
        let clean = raw_err
            .trim_start_matches("Constraint violation: ")
            .trim_start_matches("Execution failed: ");
        clean.to_string()
    });

    let lower = raw_err.to_lowercase();
    if lower.contains("429") || lower.contains("rate limit") {
        let remedy_hint = extracted_remedy
            .map(|r| format!("\n\n> *Подсказка провайдера*: {r}"))
            .unwrap_or_default();
        format!(
            "🚫 **Превышен лимит запросов (Rate Limit / 429)**\n\n> **Причина**: {detail_msg}{remedy_hint}\n\n💡 **Решение**: Переключитесь на другую модель или провайдера в **Настройках ИИ** (шестерёнка в верхнем правом углу), либо пополните баланс."
        )
    } else if lower.contains("401") || lower.contains("invalid api key") || lower.contains("unauthorized") {
        format!(
            "🔑 **Ошибка авторизации (401 Unauthorized)**\n\n> **Причина**: {detail_msg}\n\n💡 **Решение**: Проверьте и обновите ваш API-ключ в **Настройках ИИ** (шестерёнка в верхнем правом углу)."
        )
    } else if lower.contains("402") || lower.contains("payment required") || lower.contains("insufficient balance") {
        format!(
            "💳 **Недостаточно средств (402 Payment Required)**\n\n> **Причина**: {detail_msg}\n\n💡 **Решение**: Пополните баланс на стороне выбранного провайдера или выберите бесплатную модель."
        )
    } else if lower.contains("404") || lower.contains("model not found") || lower.contains("does not exist") {
        format!(
            "🔍 **Модель не найдена (404 Not Found)**\n\n> **Причина**: {detail_msg}\n\n💡 **Решение**: Выберите актуальную модель из выпадающего списка в **Настройках ИИ**."
        )
    } else if lower.contains("500") || lower.contains("502") || lower.contains("503") || lower.contains("504") || lower.contains("bad gateway") || lower.contains("server error") {
        format!(
            "🌐 **Сбой сервера провайдера (5xx Server Error)**\n\n> **Причина**: {detail_msg}\n\n💡 **Решение**: Сервер провайдера временно перегружен или недоступен. Попробуйте повторить запрос через минуту или сменить провайдера."
        )
    } else {
        format!(
            "⚠️ **Сбой обращения к ИИ**\n\n> **Причина**: {detail_msg}\n\n💡 **Решение**: Проверьте настройки модели и интернет-соединение."
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::Mutex;
    use worldwiki_domain::errors::DomainError;
    use worldwiki_ports::ai::StreamEventDto;

    #[derive(Default)]
    struct MockChatRepo {
        chats: Mutex<Vec<Chat>>,
        messages: Mutex<Vec<ChatMessage>>,
    }

    #[async_trait]
    impl ChatRepository for MockChatRepo {
        async fn get_chat_tree(&self, project_id: &str) -> Result<Vec<Chat>, DomainError> {
            let list = self.chats.lock().unwrap();
            Ok(list
                .iter()
                .filter(|c| c.project_id == project_id)
                .cloned()
                .collect())
        }
        async fn get_messages(&self, chat_id: &str) -> Result<Vec<ChatMessage>, DomainError> {
            let list = self.messages.lock().unwrap();
            Ok(list
                .iter()
                .filter(|m| m.chat_id == chat_id)
                .cloned()
                .collect())
        }
        async fn save_chat(&self, chat: &Chat) -> Result<Chat, DomainError> {
            let mut list = self.chats.lock().unwrap();
            list.retain(|c| c.id != chat.id);
            list.push(chat.clone());
            Ok(chat.clone())
        }
        async fn save_message(&self, message: &ChatMessage) -> Result<ChatMessage, DomainError> {
            let mut list = self.messages.lock().unwrap();
            list.retain(|m| m.id != message.id);
            list.push(message.clone());
            Ok(message.clone())
        }
        async fn delete_chat(&self, chat_id: &str) -> Result<(), DomainError> {
            let mut list = self.chats.lock().unwrap();
            list.retain(|c| c.id != chat_id);
            Ok(())
        }
        async fn delete_message(&self, message_id: &str) -> Result<(), DomainError> {
            let mut list = self.messages.lock().unwrap();
            list.retain(|m| m.id != message_id);
            Ok(())
        }
        async fn update_chat_parent(
            &self,
            chat_id: &str,
            new_parent_id: Option<&str>,
        ) -> Result<(), DomainError> {
            let mut list = self.chats.lock().unwrap();
            if let Some(c) = list.iter_mut().find(|c| c.id == chat_id) {
                c.parent_chat_id = new_parent_id.map(|s| s.to_string());
            }
            Ok(())
        }
        async fn switch_variant(&self, message_id: &str) -> Result<(), DomainError> {
            let mut list = self.messages.lock().unwrap();
            for m in list.iter_mut() {
                if m.id == message_id {
                    m.is_active = true;
                }
            }
            Ok(())
        }
        async fn update_token_usage(
            &self,
            chat_id: &str,
            usage: &worldwiki_domain::ai::TokenUsage,
        ) -> Result<(), DomainError> {
            let mut list = self.chats.lock().unwrap();
            if let Some(c) = list.iter_mut().find(|c| c.id == chat_id) {
                let cur = c.token_usage.get_or_insert_with(Default::default);
                cur.input_tokens += usage.input_tokens;
                cur.output_tokens += usage.output_tokens;
                cur.total_tokens += usage.total_tokens;
            }
            Ok(())
        }
        async fn edit_message_branch(
            &self,
            project_id: &str,
            chat_id: &str,
            _msg_id: &str,
            new_text: &str,
        ) -> Result<(String, String), DomainError> {
            let u_id = format!("chat_messages:u_{}", uuid::Uuid::new_v4());
            let a_id = format!("chat_messages:a_{}", uuid::Uuid::new_v4());
            let mut list = self.messages.lock().unwrap();
            list.push(ChatMessage::new(
                u_id,
                project_id,
                chat_id,
                MessageRole::User,
                new_text,
            ));
            list.push(ChatMessage::new(
                a_id.clone(),
                project_id,
                chat_id,
                MessageRole::Assistant,
                "",
            ));
            Ok((chat_id.to_string(), a_id))
        }
        async fn regenerate_assistant_variant(
            &self,
            project_id: &str,
            chat_id: &str,
            parent_msg_id: &str,
        ) -> Result<(String, String, String), DomainError> {
            let a_id = format!("chat_messages:a_{}", uuid::Uuid::new_v4());
            let user_text = {
                let list = self.messages.lock().unwrap();
                list.iter()
                    .find(|m| m.id == parent_msg_id)
                    .map(|m| m.content.clone())
                    .unwrap_or_default()
            };
            let mut list = self.messages.lock().unwrap();
            list.push(ChatMessage::new(
                a_id.clone(),
                project_id,
                chat_id,
                MessageRole::Assistant,
                "",
            ));
            Ok((chat_id.to_string(), a_id, user_text))
        }
    }

    #[derive(Default)]
    struct MockProfileRepo;

    #[async_trait]
    impl AiProfileRepository for MockProfileRepo {
        async fn get_profiles(&self, _project_id: &str) -> Result<Vec<AiProfile>, DomainError> {
            Ok(vec![])
        }
        async fn get_active_profile(
            &self,
            _project_id: &str,
        ) -> Result<Option<AiProfile>, DomainError> {
            Ok(Some(AiProfile {
                id: Some("ai_profiles:p1".to_string()),
                project_id: "projects:p1".to_string(),
                name: "Test Profile".to_string(),
                provider: "openai".to_string(),
                api_key: Some("test-key".to_string()),
                base_url: None,
                is_active: true,
                is_global: true,
                settings: Default::default(),
            }))
        }
        async fn save_profile(&self, profile: &AiProfile) -> Result<AiProfile, DomainError> {
            Ok(profile.clone())
        }
        async fn delete_profile(&self, _id: &str) -> Result<(), DomainError> {
            Ok(())
        }
        async fn fetch_models(
            &self,
            _provider: &str,
            _api_key: Option<&str>,
        ) -> Result<Vec<AiModelInfo>, DomainError> {
            Ok(vec![AiModelInfo {
                value: "claude-3-7-sonnet".into(),
                label: "Claude 3.7 Sonnet".into(),
                description: None,
                context_length: Some(200000),
                max_completion_tokens: Some(8192),
            }])
        }
    }

    struct MockStream;
    #[async_trait]
    impl LlmStreamPort for MockStream {
        async fn stream_chat(
            &self,
            _request: StreamRequest,
            sender: tokio::sync::mpsc::Sender<StreamEventDto>,
        ) -> Result<(), DomainError> {
            let _ = sender
                .send(StreamEventDto {
                    text_delta: Some("Ответ от модели".to_string()),
                    reasoning_delta: None,
                    tool_use: None,
                    usage: None,
                    is_done: true,
                })
                .await;
            Ok(())
        }
    }

    struct MockEventPublisher;
    #[async_trait]
    impl EventPublisherPort for MockEventPublisher {
        async fn publish_raw(&self, _event_name: &str, _payload: Value) -> Result<(), DomainError> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_send_message_and_run_agent_loop() {
        let chat_repo = Arc::new(MockChatRepo::default());
        let profile_repo = Arc::new(MockProfileRepo::default());
        let stream_port = Arc::new(MockStream);
        let event_publisher = Arc::new(MockEventPublisher);

        let services = ChatServices::new(
            chat_repo.clone(),
            profile_repo,
            stream_port,
            event_publisher,
            None,
            None,
            None,
        );

        let res = services
            .send_message("projects:p1", "", "Привет, мир!")
            .await
            .unwrap();

        assert!(res.chat_id.starts_with("chats:"));
        assert!(res.user_msg_id.starts_with("chat_messages:"));
        assert!(res.assistant_msg_id.starts_with("chat_messages:"));

        services
            .run_agent_loop(
                "projects:p1",
                &res.chat_id,
                &res.assistant_msg_id,
                "Привет, мир!",
                None,
            )
            .await;

        let msgs = services.get_messages(&res.chat_id).await.unwrap();
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[1].content, "Ответ от модели");
    }

    #[tokio::test]
    async fn test_fork_chat_creates_new_chat_with_title() {
        let chat_repo = Arc::new(MockChatRepo::default());
        let profile_repo = Arc::new(MockProfileRepo::default());
        let stream_port = Arc::new(MockStream);
        let event_publisher = Arc::new(MockEventPublisher);

        let services = ChatServices::new(
            chat_repo,
            profile_repo,
            stream_port,
            event_publisher,
            None,
            None,
            None,
        );

        let chat = services
            .fork_chat("projects:p1", "chat_messages:m1", "Ветка 1")
            .await
            .unwrap();

        assert!(chat.id.starts_with("chats:"));
        assert_eq!(chat.title, "Ветка 1");
    }

    #[test]
    fn test_parse_llm_error_to_human_429() {
        let raw = r#"Constraint violation: api failed after 9 attempts: api returned 429 Too Many Requests: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429,"metadata":{"remedy_hint":"Wait for the daily reset or purchase credits."}}}"#;
        let human = parse_llm_error_to_human(raw);
        assert!(human.contains("Rate Limit / 429"));
        assert!(human.contains("Rate limit exceeded"));
        assert!(human.contains("Подсказка провайдера"));
    }
}
