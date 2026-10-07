use serde_json::Value;
use worldwiki_domain::ai::{Chat, ChatMessage, MessageRole, TokenUsage};

/// Извлекает нормализованный ID вида `table:key` из любого представления SurrealDB:
/// - строка `"chats:main"` → `Some("chats:main")`
/// - объект `{"tb":"chats","id":{"String":"main"}}` → `Some("chats:main")`
/// - объект `{"tb":"chats","id":"main"}` → `Some("chats:main")`
pub fn clean_record_id(val: &Value) -> Option<String> {
    match val {
        Value::Null => None,
        Value::String(s) => {
            let cleaned = s.replace(['⟨', '⟩', '`'], "");
            if cleaned == "NONE" || cleaned == "null" || cleaned.is_empty() {
                None
            } else {
                Some(cleaned)
            }
        }
        Value::Object(obj) => {
            let tb = obj.get("tb").and_then(|v| v.as_str())?;
            let id_val = obj.get("id")?;
            let id_str = match id_val {
                Value::Object(id_obj) => id_obj
                    .get("String")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| {
                        id_obj
                            .get("Int")
                            .and_then(|v| v.as_i64())
                            .map(|n| n.to_string())
                    })
                    .or_else(|| {
                        id_obj
                            .values()
                            .find_map(|v| v.as_str().map(|s| s.to_string()))
                    }),
                Value::String(s) => Some(s.replace(['⟨', '⟩', '`'], "")),
                Value::Number(n) => Some(n.to_string()),
                _ => None,
            }?;
            let cleaned_id = id_str.replace(['⟨', '⟩', '`'], "");
            Some(format!("{tb}:{cleaned_id}"))
        }
        _ => None,
    }
}

/// Удаляет префикс таблицы и системные спецсимволы SurrealDB из идентификатора.
pub fn clean_id_str<'a>(raw: &'a str, table_prefix: &str) -> &'a str {
    raw.trim_start_matches(table_prefix)
        .trim_matches('`')
        .trim_matches('⟨')
        .trim_matches('⟩')
}

/// Преобразует JSON-запись таблицы `chats` и связанные рёбра `contains` в доменную структуру `Chat`.
pub fn parse_chat_record(val: &Value, project_id: &str, edges: &[Value]) -> Chat {
    let id = clean_record_id(val.get("id").unwrap_or(&Value::Null)).unwrap_or_default();
    let title = val
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Чат")
        .to_string();
    let tag = val
        .get("tag")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let created_at = val
        .get("created_at")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let token_usage: Option<TokenUsage> = val
        .get("token_usage")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    let mut parent_chat_id = None;
    if let Some(edge) = edges
        .iter()
        .find(|e| e.get("out").and_then(clean_record_id) == Some(id.clone()))
        && let Some(p) = edge.get("in").and_then(clean_record_id)
            && p.starts_with("chats:") {
                parent_chat_id = Some(p);
            }

    Chat {
        id,
        project_id: project_id.to_string(),
        title,
        tag,
        parent_chat_id,
        session_context: Vec::new(),
        token_usage,
        created_at,
    }
}

/// Преобразует JSON-запись таблицы `chat_messages` в доменную структуру `ChatMessage`.
pub fn parse_chat_message_record(val: &Value, chat_id: &str) -> ChatMessage {
    let id = clean_record_id(val.get("id").unwrap_or(&Value::Null)).unwrap_or_default();
    let role_str = val.get("role").and_then(|v| v.as_str()).unwrap_or("user");
    let role = match role_str {
        "assistant" => MessageRole::Assistant,
        "system" => MessageRole::System,
        _ => MessageRole::User,
    };
    let content = val
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let reasoning = val
        .get("reasoning")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let tool_logs = val.get("tool_logs").and_then(|v| v.as_array()).map(|arr| {
        arr.iter()
            .filter_map(|x| x.as_str().map(|s| s.to_string()))
            .collect()
    });
    let quoted_context = val.get("quoted_context").cloned().filter(|v| !v.is_null());
    let citations = val.get("citations").and_then(|v| v.as_array()).cloned();
    let version = val.get("version").and_then(|v| v.as_u64()).unwrap_or(1) as u32;
    let parent_id = val.get("parent_id").and_then(clean_record_id);
    let is_active = val
        .get("is_active")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let created_at = val
        .get("created_at")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let updated_at = val
        .get("updated_at")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    ChatMessage {
        id,
        project_id: String::new(),
        chat_id: chat_id.to_string(),
        role,
        content,
        reasoning,
        tool_logs,
        version,
        quoted_context,
        citations,
        parent_id,
        is_active,
        created_at,
        updated_at,
    }
}
