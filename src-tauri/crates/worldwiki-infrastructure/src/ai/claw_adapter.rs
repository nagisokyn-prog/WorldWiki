use async_trait::async_trait;
use serde_json::{json, Value};
use tokio::sync::mpsc::Sender;
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::{LlmStreamPort, StreamEventDto, StreamRequest, ToolUseCall};

#[cfg(feature = "ai-cloud")]
use claw_api::{
    ContentBlockDelta, ContentBlockDeltaEvent, ContentBlockStartEvent, InputContentBlock,
    InputMessage, MessageRequest, OutputContentBlock, StreamEvent, ToolResultContentBlock,
};

#[cfg(feature = "ai-cloud")]
use super::client::build_provider_client;

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

struct ToolAssembler {
    id: String,
    name: String,
    input_buf: String,
}

#[async_trait]
impl LlmStreamPort for ClawStreamAdapter {
    async fn stream_chat(
        &self,
        request: StreamRequest,
        sender: Sender<StreamEventDto>,
    ) -> Result<(), DomainError> {
        #[cfg(not(feature = "ai-cloud"))]
        {
            let _ = request;
            let _ = sender;
            return Err(DomainError::ConstraintViolation(
                "ai-cloud feature is disabled".to_string(),
            ));
        }

        #[cfg(feature = "ai-cloud")]
        {
            let profile = request.profile;
            let provider = &profile.provider;
            let api_key = profile.api_key.as_deref().unwrap_or("");
            let base_url = profile.base_url.clone();

            if api_key.is_empty() && provider != "local" && provider != "ollama" {
                return Err(DomainError::Validation(
                    "API key is not configured for active profile".to_string(),
                ));
            }

            let provider_client = build_provider_client(provider, api_key, base_url)
                .map_err(DomainError::ConstraintViolation)?;

            let settings = &profile.settings;
            let model = settings
                .get("model")
                .and_then(|v| v.as_str())
                .unwrap_or("gpt-4o-mini")
                .to_string();
            let temperature = settings
                .get("temperature")
                .and_then(|v| v.as_f64());
            let max_tokens = settings
                .get("max_tokens")
                .and_then(|v| v.as_u64())
                .map(|m| m as u32)
                .unwrap_or(4096);
            let reasoning_effort = settings
                .get("reasoning_effort")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let mut input_messages = Vec::new();
            for msg_val in request.messages {
                let role = msg_val
                    .get("role")
                    .and_then(|v| v.as_str())
                    .unwrap_or("user")
                    .to_string();

                if let Some(content_arr) = msg_val.get("content").and_then(|v| v.as_array()) {
                    let mut blocks = Vec::new();
                    for b in content_arr {
                        let b_type = b.get("type").and_then(|v| v.as_str()).unwrap_or("text");
                        match b_type {
                            "text" => {
                                let text = b
                                    .get("text")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                blocks.push(InputContentBlock::Text { text });
                            }
                            "tool_use" => {
                                let id = b.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let name = b.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let input = b.get("input").cloned().unwrap_or(json!({}));
                                blocks.push(InputContentBlock::ToolUse { id, name, input });
                            }
                            "tool_result" => {
                                let tool_use_id = b.get("tool_use_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let is_error = b.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                                let mut res_blocks = Vec::new();
                                if let Some(res_arr) = b.get("content").and_then(|v| v.as_array()) {
                                    for r in res_arr {
                                        let txt = r.get("text").and_then(|v| v.as_str()).unwrap_or("");
                                        res_blocks.push(ToolResultContentBlock::Text { text: txt.to_string() });
                                    }
                                }
                                blocks.push(InputContentBlock::ToolResult {
                                    tool_use_id,
                                    content: res_blocks,
                                    is_error,
                                });
                            }
                            _ => {}
                        }
                    }
                    input_messages.push(InputMessage {
                        role,
                        content: blocks,
                    });
                } else if let Some(text) = msg_val.get("content").and_then(|v| v.as_str()) {
                    input_messages.push(InputMessage {
                        role,
                        content: vec![InputContentBlock::Text {
                            text: text.to_string(),
                        }],
                    });
                }
            }

            let message_req = MessageRequest {
                model,
                messages: input_messages,
                system: if request.system_prompt.trim().is_empty() {
                    None
                } else {
                    Some(request.system_prompt)
                },
                temperature,
                max_tokens,
                tools: None,
                reasoning_effort,
                ..Default::default()
            };

            let mut stream = provider_client
                .stream_message(&message_req)
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

            let mut assembler: Option<ToolAssembler> = None;

            loop {
                let next = stream
                    .next_event()
                    .await
                    .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

                let Some(ev) = next else { break };

                match ev {
                    StreamEvent::ContentBlockStart(ContentBlockStartEvent {
                        content_block: OutputContentBlock::ToolUse { id, name, input },
                        ..
                    }) => {
                        let initial = match &input {
                            Value::Object(map) if map.is_empty() => String::new(),
                            Value::Null => String::new(),
                            other => other.to_string(),
                        };
                        assembler = Some(ToolAssembler {
                            id,
                            name,
                            input_buf: initial,
                        });
                    }
                    StreamEvent::ContentBlockStart(ContentBlockStartEvent {
                        content_block: OutputContentBlock::Thinking { thinking, .. },
                        ..
                    }) => {
                        if !thinking.is_empty() {
                            let _ = sender
                                .send(StreamEventDto {
                                    text_delta: None,
                                    reasoning_delta: Some(thinking),
                                    tool_use: None,
                                    usage: None,
                                    is_done: false,
                                })
                                .await;
                        }
                    }
                    StreamEvent::ContentBlockDelta(ContentBlockDeltaEvent { delta, .. }) => {
                        match delta {
                            ContentBlockDelta::TextDelta { text } => {
                                let _ = sender
                                    .send(StreamEventDto {
                                        text_delta: Some(text),
                                        reasoning_delta: None,
                                        tool_use: None,
                                        usage: None,
                                        is_done: false,
                                    })
                                    .await;
                            }
                            ContentBlockDelta::ThinkingDelta { thinking } => {
                                let _ = sender
                                    .send(StreamEventDto {
                                        text_delta: None,
                                        reasoning_delta: Some(thinking),
                                        tool_use: None,
                                        usage: None,
                                        is_done: false,
                                    })
                                    .await;
                            }
                            ContentBlockDelta::InputJsonDelta { partial_json } => {
                                if let Some(a) = assembler.as_mut() {
                                    a.input_buf.push_str(&partial_json);
                                }
                            }
                            _ => {}
                        }
                    }
                    StreamEvent::ContentBlockStop(_) => {
                        if let Some(a) = assembler.take() {
                            let input = serde_json::from_str(&a.input_buf)
                                .unwrap_or_else(|_| json!({ "raw": a.input_buf }));
                            let _ = sender
                                .send(StreamEventDto {
                                    text_delta: None,
                                    reasoning_delta: None,
                                    tool_use: Some(ToolUseCall {
                                        id: a.id,
                                        name: a.name,
                                        input,
                                    }),
                                    usage: None,
                                    is_done: false,
                                })
                                .await;
                        }
                    }
                    StreamEvent::MessageStart(start) => {
                        let u = start.message.usage;
                        let u_json = json!({
                            "input_tokens": u.input_tokens,
                            "output_tokens": u.output_tokens,
                            "total_tokens": u.total_tokens()
                        });
                        let _ = sender
                            .send(StreamEventDto {
                                text_delta: None,
                                reasoning_delta: None,
                                tool_use: None,
                                usage: Some(u_json),
                                is_done: false,
                            })
                            .await;
                    }
                    StreamEvent::MessageDelta(delta) => {
                        let u = delta.usage;
                        if u.total_tokens() > 0 {
                            let u_json = json!({
                                "input_tokens": u.input_tokens,
                                "output_tokens": u.output_tokens,
                                "total_tokens": u.total_tokens()
                            });
                            let _ = sender
                                .send(StreamEventDto {
                                    text_delta: None,
                                    reasoning_delta: None,
                                    tool_use: None,
                                    usage: Some(u_json),
                                    is_done: false,
                                })
                                .await;
                        }
                    }
                    StreamEvent::MessageStop(_) => break,
                    _ => {}
                }
            }

            if let Some(a) = assembler.take() {
                let input = serde_json::from_str(&a.input_buf)
                    .unwrap_or_else(|_| json!({ "raw": a.input_buf }));
                let _ = sender
                    .send(StreamEventDto {
                        text_delta: None,
                        reasoning_delta: None,
                        tool_use: Some(ToolUseCall {
                            id: a.id,
                            name: a.name,
                            input,
                        }),
                        usage: None,
                        is_done: false,
                    })
                    .await;
            }

            let _ = sender
                .send(StreamEventDto {
                    text_delta: None,
                    reasoning_delta: None,
                    tool_use: None,
                    usage: None,
                    is_done: true,
                })
                .await;

            Ok(())
        }
    }
}
