#[cfg(feature = "ai-cloud")]
use super::types::ToolAssembler;
use claw_api::{
    ContentBlockDelta, ContentBlockDeltaEvent, ContentBlockStartEvent, OutputContentBlock,
    StreamEvent,
};
use serde_json::{json, Value};
use tokio::sync::mpsc::Sender;
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::{StreamEventDto, ToolUseCall};

#[cfg(feature = "ai-cloud")]
pub(crate) struct ClawStreamConsumer;

#[cfg(feature = "ai-cloud")]
impl ClawStreamConsumer {
    pub async fn consume_stream(
        mut stream: claw_api::MessageStream,
        sender: &Sender<StreamEventDto>,
    ) -> Result<(), DomainError> {
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
                        let _res = sender
                            .send(StreamEventDto {
                                text_delta: None,
                                reasoning_delta: Some(thinking),
                                tool_use: None,
                                usage: None,
                                is_done: false,
                            })
                            .await;
                        if _res.is_err() {
                            break;
                        }
                    }
                }
                StreamEvent::ContentBlockDelta(ContentBlockDeltaEvent { delta, .. }) => match delta
                {
                    ContentBlockDelta::TextDelta { text } => {
                        let _res = sender
                            .send(StreamEventDto {
                                text_delta: Some(text),
                                reasoning_delta: None,
                                tool_use: None,
                                usage: None,
                                is_done: false,
                            })
                            .await;
                        if _res.is_err() {
                            break;
                        }
                    }
                    ContentBlockDelta::ThinkingDelta { thinking } => {
                        let _res = sender
                            .send(StreamEventDto {
                                text_delta: None,
                                reasoning_delta: Some(thinking),
                                tool_use: None,
                                usage: None,
                                is_done: false,
                            })
                            .await;
                        if _res.is_err() {
                            break;
                        }
                    }
                    ContentBlockDelta::InputJsonDelta { partial_json } => {
                        if let Some(a) = assembler.as_mut() {
                            a.input_buf.push_str(&partial_json);
                        }
                    }
                    _ => {}
                },
                StreamEvent::ContentBlockStop(_) => {
                    if let Some(a) = assembler.take() {
                        let input = serde_json::from_str(&a.input_buf)
                            .unwrap_or_else(|_| json!({ "raw": a.input_buf }));
                        let _res = sender
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
                        if _res.is_err() {
                            break;
                        }
                    }
                }
                StreamEvent::MessageStart(start) => {
                    let u = start.message.usage;
                    let u_json = json!({
                        "input_tokens": u.input_tokens,
                        "output_tokens": u.output_tokens,
                        "total_tokens": u.total_tokens()
                    });
                    let _res = sender
                        .send(StreamEventDto {
                            text_delta: None,
                            reasoning_delta: None,
                            tool_use: None,
                            usage: Some(u_json),
                            is_done: false,
                        })
                        .await;
                    if _res.is_err() {
                        break;
                    }
                }
                StreamEvent::MessageDelta(delta) => {
                    let u = delta.usage;
                    if u.total_tokens() > 0 {
                        let u_json = json!({
                            "input_tokens": u.input_tokens,
                            "output_tokens": u.output_tokens,
                            "total_tokens": u.total_tokens()
                        });
                        let _res = sender
                            .send(StreamEventDto {
                                text_delta: None,
                                reasoning_delta: None,
                                tool_use: None,
                                usage: Some(u_json),
                                is_done: false,
                            })
                            .await;
                        if _res.is_err() {
                            break;
                        }
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
