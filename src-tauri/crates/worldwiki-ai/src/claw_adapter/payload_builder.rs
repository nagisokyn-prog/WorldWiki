use claw_api::{
    InputContentBlock, InputMessage, MessageRequest, ToolDefinition, ToolResultContentBlock,
};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use worldwiki_ports::ai::StreamRequest;

pub(crate) struct ClawPayloadBuilder;

impl ClawPayloadBuilder {
    pub fn build_message_request(request: StreamRequest) -> MessageRequest {
        let profile = request.profile;
        let provider = &profile.provider;
        let settings = &profile.settings;

        let model = settings
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("gpt-4o-mini")
            .to_string();

        let temperature = settings.get("temperature").and_then(|v| v.as_f64());
        let max_tokens = settings
            .get("max_tokens")
            .and_then(|v| v.as_u64())
            .map(|m| m as u32)
            .unwrap_or(4096);

        let raw_effort = settings
            .get("reasoning_effort")
            .and_then(|v| v.as_str())
            .unwrap_or("high");

        let reasoning_effort = if raw_effort == "none" {
            None
        } else {
            Some(raw_effort.to_string())
        };

        let mut extra_body = BTreeMap::new();
        if let Some(ref effort) = reasoning_effort
            && provider == "openrouter" {
                extra_body.insert(
                    "reasoning".to_string(),
                    json!({
                        "effort": effort,
                        "exclude": false
                    }),
                );
            }

        let input_messages = Self::convert_messages(request.messages);
        let tools = Self::convert_tools(request.tools);

        MessageRequest {
            model,
            messages: input_messages,
            system: if request.system_prompt.trim().is_empty() {
                None
            } else {
                Some(request.system_prompt)
            },
            temperature,
            max_tokens,
            tools,
            reasoning_effort,
            extra_body,
            ..Default::default()
        }
    }

    fn convert_messages(messages: Vec<Value>) -> Vec<InputMessage> {
        let mut input_messages = Vec::new();

        for msg_val in messages {
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
                            let tool_use_id = b
                                .get("tool_use_id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let is_error = b.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                            let mut res_blocks = Vec::new();

                            if let Some(txt) = b.get("content").and_then(|v| v.as_str()) {
                                res_blocks.push(ToolResultContentBlock::Text {
                                    text: txt.to_string(),
                                });
                            } else if let Some(res_arr) = b.get("content").and_then(|v| v.as_array()) {
                                for r in res_arr {
                                    let txt = r.get("text").and_then(|v| v.as_str()).unwrap_or("");
                                    res_blocks.push(ToolResultContentBlock::Text {
                                        text: txt.to_string(),
                                    });
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

        input_messages
    }

    fn convert_tools(tools: Option<Vec<Value>>) -> Option<Vec<ToolDefinition>> {
        tools.map(|tool_vals| {
            tool_vals
                .into_iter()
                .filter_map(|v| {
                    let name = v.get("name").and_then(|n| n.as_str())?.to_string();
                    let description = v
                        .get("description")
                        .and_then(|d| d.as_str())
                        .map(|d| d.to_string());
                    let input_schema = v
                        .get("input_schema")
                        .cloned()
                        .unwrap_or_else(|| json!({"type": "object"}));
                    Some(ToolDefinition {
                        name,
                        description,
                        input_schema,
                    })
                })
                .collect::<Vec<_>>()
        })
    }
}
