use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;

use worldwiki_domain::ai::{AiModelInfo, AiProfile, Chat, ChatMessage, MessageRole};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::{AiProfileRepository, ChatRepository};

pub struct SurrealChatRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealChatRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

/// Извлекает нормализованный ID вида `table:key` из любого представления SurrealDB:
/// - строка `"chats:main"` → `Some("chats:main")`
/// - объект `{"tb":"chats","id":{"String":"main"}}` → `Some("chats:main")`
/// - объект `{"tb":"chats","id":"main"}` → `Some("chats:main")`
pub(crate) fn clean_record_id(val: &Value) -> Option<String> {
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
            // SurrealDB record ID: {"tb": "chats", "id": {"String": "main"}} or {"tb": "chats", "id": "main"}
            let tb = obj.get("tb").and_then(|v| v.as_str())?;
            let id_val = obj.get("id")?;
            let id_str = match id_val {
                // {"id": {"String": "main"}} — стандартный формат SurrealKV
                Value::Object(id_obj) => id_obj
                    .get("String")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    // Числовые ID: {"Int": 42}
                    .or_else(|| id_obj.get("Int").and_then(|v| v.as_i64()).map(|n| n.to_string()))
                    // Fallback: первое строковое значение в объекте
                    .or_else(|| {
                        id_obj.values().find_map(|v| v.as_str().map(|s| s.to_string()))
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

#[async_trait]
impl ChatRepository for SurrealChatRepository {
    async fn get_chat_tree(&self, project_id: &str) -> Result<Vec<Chat>, DomainError> {
        let proj_clean = project_id.trim_start_matches("projects:");
        let proj_id = format!("projects:{proj_clean}");

        let mut res = self
            .db
            .query("SELECT * FROM chats WHERE project_id = type::record('projects', $p_clean) OR project_id = $proj_id ORDER BY created_at DESC")
            .bind(("p_clean", proj_clean.to_string()))
            .bind(("proj_id", proj_id.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let raw_chats: Vec<Value> = res.take(0).unwrap_or_default();

        let mut edges_res = self
            .db
            .query(
                r#"
                SELECT in, out, sort_order FROM contains 
                WHERE out IN (SELECT VALUE id FROM chats WHERE project_id = type::record('projects', $p_clean) OR project_id = $proj_id)
            "#,
            )
            .bind(("p_clean", proj_clean.to_string()))
            .bind(("proj_id", proj_id))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let edges: Vec<Value> = edges_res.take(0).unwrap_or_default();

        let mut chats = Vec::with_capacity(raw_chats.len());
        for val in raw_chats {
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

            let token_usage: Option<worldwiki_domain::ai::TokenUsage> = val
                .get("token_usage")
                .and_then(|v| serde_json::from_value(v.clone()).ok());

            let mut parent_chat_id = None;
            if let Some(edge) = edges
                .iter()
                .find(|e| e.get("out").and_then(clean_record_id) == Some(id.clone()))
            {
                if let Some(p) = edge.get("in").and_then(clean_record_id) {
                    if p.starts_with("chats:") {
                        parent_chat_id = Some(p);
                    }
                }
            }

            chats.push(Chat {
                id,
                project_id: project_id.to_string(),
                title,
                tag,
                parent_chat_id,
                session_context: Vec::new(),
                token_usage,
                created_at,
            });
        }

        Ok(chats)
    }

    async fn get_messages(&self, chat_id: &str) -> Result<Vec<ChatMessage>, DomainError> {
        let chat_clean = chat_id.trim_start_matches("chats:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');

        let mut res = self
            .db
            .query("SELECT * FROM chat_messages WHERE chat_id = type::record('chats', $c_clean) ORDER BY created_at ASC")
            .bind(("c_clean", chat_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let raw_msgs: Vec<Value> = res.take(0).unwrap_or_default();
        let mut messages = Vec::with_capacity(raw_msgs.len());

        for val in raw_msgs {
            // С фильтрацией через WHERE в запросе — все записи принадлежат нужному чату
            let matches_chat = true;

            if !matches_chat {
                continue;
            }

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

            messages.push(ChatMessage {
                id,
                project_id: "".to_string(),
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
            });
        }

        Ok(messages)
    }

    async fn save_chat(&self, chat: &Chat) -> Result<Chat, DomainError> {
        let chat_clean = chat.id.trim_start_matches("chats:");
        let c_id = format!("chats:{chat_clean}");
        let proj_clean = chat.project_id.trim_start_matches("projects:");

        let sql = "UPSERT type::record('chats', $c_clean) SET title = $title, project_id = type::record('projects', $p_clean), session_context = [], created_at = IF created_at != NONE AND created_at != NULL { created_at } ELSE { time::now() }";

        let mut res = self.db
            .query(sql)
            .bind(("c_clean", chat_clean.to_string()))
            .bind(("title", chat.title.clone()))
            .bind(("p_clean", proj_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let errors = res.take_errors();
        if let Some((_, e)) = errors.into_iter().next() {
            return Err(DomainError::ConstraintViolation(format!("save_chat schema error: {e}")));
        }

        let mut saved = chat.clone();
        saved.id = c_id;
        Ok(saved)
    }

    async fn save_message(&self, message: &ChatMessage) -> Result<ChatMessage, DomainError> {
        let msg_clean = message.id.trim_start_matches("chat_messages:");
        let m_id = format!("chat_messages:{msg_clean}");
        let chat_clean = message.chat_id.trim_start_matches("chats:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
        let proj_clean = message.project_id.trim_start_matches("projects:");

        let role_str = match message.role {
            MessageRole::Assistant => "assistant",
            MessageRole::System => "system",
            MessageRole::User => "user",
        };

        let parent_clean = message.parent_id.as_ref().map(|p| {
            p.trim_start_matches("chat_messages:").trim_matches('`').trim_matches('⟨').trim_matches('⟩').to_string()
        });

        let mut q = String::from(
            "UPSERT type::record('chat_messages', $m_clean) SET \
             chat_id = type::record('chats', $c_clean), \
             project_id = type::record('projects', $p_clean), \
             role = $role, content = $content, \
             reasoning = $reasoning, tool_logs = $tool_logs, \
             version = $version, \
             quoted_context = $quoted_context, \
             citations = $citations, \
             is_active = $is_active, updated_at = time::now(), \
             created_at = IF created_at != NONE AND created_at != NULL { created_at } ELSE { time::now() }"
        );

        if parent_clean.is_some() {
            q.push_str(", parent_id = type::record('chat_messages', $p_id_clean)");
        } else {
            q.push_str(", parent_id = NONE");
        }

        let mut query = self
            .db
            .query(q)
            .bind(("m_clean", msg_clean.to_string()))
            .bind(("c_clean", chat_clean.to_string()))
            .bind(("p_clean", if proj_clean.is_empty() { "unknown" } else { proj_clean }.to_string()))
            .bind(("role", role_str))
            .bind(("content", message.content.clone()))
            .bind(("reasoning", message.reasoning.clone()))
            .bind(("tool_logs", message.tool_logs.clone().unwrap_or_default()))
            .bind(("version", message.version as i64))
            .bind(("quoted_context", message.quoted_context.clone()))
            .bind(("citations", message.citations.clone().unwrap_or_default()))
            .bind(("is_active", message.is_active));

        if let Some(p) = parent_clean {
            query = query.bind(("p_id_clean", p));
        }

        let mut res = query
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        // Проверяем ошибки схемы внутри результата
        let errors = res.take_errors();
        if let Some((_, e)) = errors.into_iter().next() {
            return Err(DomainError::ConstraintViolation(format!("save_message schema error: {e}")));
        }

        let mut saved = message.clone();
        saved.id = m_id;
        Ok(saved)
    }

    async fn delete_chat(&self, chat_id: &str) -> Result<(), DomainError> {
        let chat_clean = chat_id.trim_start_matches("chats:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
        let initial_rec = format!("chats:{chat_clean}");

        // 1. Fetch all chats and contains edges to find all recursive descendants
        let mut res = self
            .db
            .query("SELECT id, parent_id FROM chats; SELECT in, out FROM contains;")
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let all_chats: Vec<Value> = res.take(0).unwrap_or_default();
        let all_edges: Vec<Value> = res.take(1).unwrap_or_default();

        let mut to_delete = std::collections::HashSet::new();
        to_delete.insert(initial_rec.clone());
        to_delete.insert(chat_clean.to_string());

        let mut changed = true;
        while changed {
            changed = false;
            // Check direct parent_id on chats
            for c in &all_chats {
                if let Some(id_str) = c.get("id").and_then(clean_record_id) {
                    if !to_delete.contains(&id_str) {
                        if let Some(parent_str) = c.get("parent_id").and_then(clean_record_id) {
                            if to_delete.contains(&parent_str) {
                                to_delete.insert(id_str.clone());
                                to_delete.insert(id_str.trim_start_matches("chats:").to_string());
                                changed = true;
                            }
                        }
                    }
                }
            }
            // Check contains edges (in = parent, out = child)
            for edge in &all_edges {
                let parent_opt = edge.get("in").and_then(clean_record_id);
                let child_opt = edge.get("out").and_then(clean_record_id);
                if let (Some(parent_str), Some(child_str)) = (parent_opt, child_opt) {
                    if to_delete.contains(&parent_str) && !to_delete.contains(&child_str) {
                        to_delete.insert(child_str.clone());
                        to_delete.insert(child_str.trim_start_matches("chats:").to_string());
                        changed = true;
                    }
                }
            }
        }

        // 2. Delete all messages, relations, and chat records for every chat in to_delete
        for cid in to_delete {
            let clean = cid.trim_start_matches("chats:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
            let rec = RecordId::new("chats", clean);
            let _ = self.db
                .query("DELETE chat_messages WHERE chat_id = $chat OR chat_id = $raw_id; DELETE contains WHERE out = $chat OR in = $chat; DELETE $chat;")
                .bind(("chat", rec))
                .bind(("raw_id", format!("chats:{clean}")))
                .await;
        }

        Ok(())
    }

    async fn delete_message(&self, message_id: &str) -> Result<(), DomainError> {
        let msg_clean = message_id.trim_start_matches("chat_messages:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
        let msg_rec = RecordId::new("chat_messages", msg_clean);

        self.db
            .query("DELETE $msg;")
            .bind(("msg", msg_rec))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        Ok(())
    }

    async fn update_chat_parent(
        &self,
        chat_id: &str,
        new_parent_id: Option<&str>,
    ) -> Result<(), DomainError> {
        let chat_clean = chat_id.trim_start_matches("chats:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
        let c_rec = RecordId::new("chats", chat_clean);

        self.db
            .query("DELETE contains WHERE out = $chat")
            .bind(("chat", c_rec.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        if let Some(parent) = new_parent_id {
            let p_clean = parent.trim_start_matches("chats:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
            let p_rec = RecordId::new("chats", p_clean);

            self.db
                .query("RELATE $parent -> contains -> $chat SET sort_order = 0")
                .bind(("parent", p_rec))
                .bind(("chat", c_rec))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        }

        Ok(())
    }

    async fn switch_variant(&self, message_id: &str) -> Result<(), DomainError> {
        let msg_clean = message_id.trim_start_matches("chat_messages:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
        let msg_rec = RecordId::new("chat_messages", msg_clean);

        let mut res = self
            .db
            .query("SELECT chat_id, parent_id FROM $msg")
            .bind(("msg", msg_rec.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let orig: Option<Value> = res.take(0).unwrap_or_default();
        if let Some(orig) = orig {
            let chat_id_str = clean_record_id(orig.get("chat_id").unwrap_or(&Value::Null)).unwrap_or_default();
            let chat_clean = chat_id_str.trim_start_matches("chats:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
            let chat_rec = RecordId::new("chats", chat_clean);

            let parent_id_val = orig.get("parent_id").cloned();
            let parent_clean = parent_id_val.as_ref().and_then(clean_record_id);

            if let Some(p_str) = parent_clean {
                let p_clean = p_str.trim_start_matches("chat_messages:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
                let p_rec = RecordId::new("chat_messages", p_clean);
                self.db
                    .query("UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = $parent; UPDATE $msg SET is_active = true;")
                    .bind(("chat", chat_rec))
                    .bind(("parent", p_rec))
                    .bind(("msg", msg_rec))
                    .await
                    .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
            } else {
                self.db
                    .query("UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = NONE; UPDATE $msg SET is_active = true;")
                    .bind(("chat", chat_rec))
                    .bind(("msg", msg_rec))
                    .await
                    .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
            }
        }

        Ok(())
    }

    async fn update_token_usage(&self, chat_id: &str, usage: &worldwiki_domain::ai::TokenUsage) -> Result<(), DomainError> {
        if usage.total_tokens == 0 && usage.input_tokens == 0 && usage.output_tokens == 0 {
            return Ok(());
        }
        let chat_clean = chat_id.trim_start_matches("chats:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
        let chat_rec = RecordId::new("chats", chat_clean);

        let sql = "UPDATE $chat SET \
                   token_usage = { \
                       input_tokens: $in_tokens, \
                       output_tokens: $out_tokens, \
                       total_tokens: $tot_tokens \
                   };";

        self.db
            .query(sql)
            .bind(("chat", chat_rec))
            .bind(("in_tokens", usage.input_tokens as i64))
            .bind(("out_tokens", usage.output_tokens as i64))
            .bind(("tot_tokens", usage.total_tokens as i64))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        Ok(())
    }

    async fn edit_message_branch(
        &self,
        project_id: &str,
        chat_id: &str,
        msg_id: &str,
        new_text: &str,
    ) -> Result<(String, String), DomainError> {
        let chat_clean = chat_id.trim_start_matches("chats:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
        let chat_rec = RecordId::new("chats", chat_clean);
        let proj_clean = project_id.trim_start_matches("projects:");
        let proj_rec = RecordId::new("projects", if proj_clean.is_empty() { "default" } else { proj_clean });

        let msg_clean = msg_id.trim_start_matches("chat_messages:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
        let msg_rec = RecordId::new("chat_messages", msg_clean);

        let mut check = self.db
            .query("SELECT parent_id FROM $msg")
            .bind(("msg", msg_rec))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let orig: Option<Value> = check.take(0).unwrap_or_default();
        let parent_id_val = orig.as_ref().and_then(|v| v.get("parent_id").cloned());
        let parent_clean = parent_id_val.as_ref().and_then(clean_record_id);

        if let Some(ref p_str) = parent_clean {
            let p_clean = p_str.trim_start_matches("chat_messages:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
            let p_rec = RecordId::new("chat_messages", p_clean);
            self.db
                .query("UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = $parent")
                .bind(("chat", chat_rec.clone()))
                .bind(("parent", p_rec))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        } else {
            self.db
                .query("UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = NONE")
                .bind(("chat", chat_rec.clone()))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        }

        let new_user_uuid = uuid::Uuid::new_v4().to_string();
        let new_user_rec = RecordId::new("chat_messages", new_user_uuid.as_str());
        let new_assistant_uuid = uuid::Uuid::new_v4().to_string();
        let new_assistant_rec = RecordId::new("chat_messages", new_assistant_uuid.as_str());

        if let Some(ref p_str) = parent_clean {
            let p_clean = p_str.trim_start_matches("chat_messages:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
            let p_rec = RecordId::new("chat_messages", p_clean);
            self.db
                .query(r#"
                    CREATE $uid SET chat_id = $chat, project_id = $proj, role = 'user', content = $content, version = 1, parent_id = $parent, is_active = true, created_at = time::now();
                    CREATE $aid SET chat_id = $chat, project_id = $proj, role = 'assistant', content = '', version = 1, parent_id = $uid, is_active = true, created_at = time::now();
                "#)
                .bind(("uid", new_user_rec))
                .bind(("aid", new_assistant_rec))
                .bind(("chat", chat_rec))
                .bind(("proj", proj_rec))
                .bind(("parent", p_rec))
                .bind(("content", new_text.to_string()))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        } else {
            self.db
                .query(r#"
                    CREATE $uid SET chat_id = $chat, project_id = $proj, role = 'user', content = $content, version = 1, parent_id = NONE, is_active = true, created_at = time::now();
                    CREATE $aid SET chat_id = $chat, project_id = $proj, role = 'assistant', content = '', version = 1, parent_id = $uid, is_active = true, created_at = time::now();
                "#)
                .bind(("uid", new_user_rec))
                .bind(("aid", new_assistant_rec))
                .bind(("chat", chat_rec))
                .bind(("proj", proj_rec))
                .bind(("content", new_text.to_string()))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        }

        Ok((format!("chats:{chat_clean}"), format!("chat_messages:{new_assistant_uuid}")))
    }

    async fn regenerate_assistant_variant(
        &self,
        project_id: &str,
        chat_id: &str,
        parent_msg_id: &str,
    ) -> Result<(String, String, String), DomainError> {
        let chat_clean = chat_id.trim_start_matches("chats:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
        let chat_rec = RecordId::new("chats", chat_clean);
        let proj_clean = project_id.trim_start_matches("projects:");
        let proj_rec = RecordId::new("projects", if proj_clean.is_empty() { "default" } else { proj_clean });

        let parent_clean = parent_msg_id.trim_start_matches("chat_messages:").trim_matches('`').trim_matches('⟨').trim_matches('⟩');
        let user_msg_rec = RecordId::new("chat_messages", parent_clean);

        let mut check_user = self.db
            .query("SELECT content FROM $parent")
            .bind(("parent", user_msg_rec.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let user_msg: Option<Value> = check_user.take(0).unwrap_or_default();
        let user_text = user_msg
            .and_then(|v| v.get("content").and_then(|c| c.as_str()).map(|s| s.to_string()))
            .unwrap_or_default();

        self.db
            .query("UPDATE chat_messages SET is_active = false WHERE parent_id = $parent AND role = 'assistant'")
            .bind(("parent", user_msg_rec.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let new_assistant_uuid = uuid::Uuid::new_v4().to_string();
        let new_assistant_rec = RecordId::new("chat_messages", new_assistant_uuid.as_str());

        self.db
            .query(r#"
                CREATE $aid SET chat_id = $chat, project_id = $proj, role = 'assistant', content = '', version = 1, parent_id = $parent, is_active = true, created_at = time::now();
            "#)
            .bind(("aid", new_assistant_rec))
            .bind(("chat", chat_rec))
            .bind(("proj", proj_rec))
            .bind(("parent", user_msg_rec))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        Ok((format!("chats:{chat_clean}"), format!("chat_messages:{new_assistant_uuid}"), user_text))
    }
}

pub struct SurrealAiProfileRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealAiProfileRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl AiProfileRepository for SurrealAiProfileRepository {
    async fn get_profiles(&self, project_id: &str) -> Result<Vec<AiProfile>, DomainError> {
        let proj_clean = project_id.trim_start_matches("projects:");
        let proj_id = format!("projects:{proj_clean}");

        let mut res = self
            .db
            .query("SELECT * FROM ai_profiles WHERE project_id = type::record($proj) OR is_global = true")
            .bind(("proj", proj_id))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let rows: Vec<Value> = res.take(0).unwrap_or_default();
        let mut profiles = Vec::with_capacity(rows.len());

        for v in rows {
            let id = clean_record_id(v.get("id").unwrap_or(&Value::Null));
            let name = v
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("Default")
                .to_string();
            let provider = v
                .get("provider")
                .and_then(|x| x.as_str())
                .unwrap_or("anthropic")
                .to_string();
            let base_url = v
                .get("base_url")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string());
            let api_key = v
                .get("api_key")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string());
            let settings = v.get("settings").cloned().unwrap_or(serde_json::json!({}));
            let is_active = v
                .get("is_active")
                .and_then(|x| x.as_bool())
                .unwrap_or(false);
            let is_global = v
                .get("is_global")
                .and_then(|x| x.as_bool())
                .unwrap_or(false);

            profiles.push(AiProfile {
                id,
                project_id: project_id.to_string(),
                name,
                provider,
                base_url,
                api_key,
                settings,
                is_active,
                is_global,
            });
        }

        Ok(profiles)
    }

    async fn get_active_profile(&self, project_id: &str) -> Result<Option<AiProfile>, DomainError> {
        let profiles = self.get_profiles(project_id).await?;
        Ok(profiles.into_iter().find(|p| p.is_active))
    }

    async fn save_profile(&self, profile: &AiProfile) -> Result<AiProfile, DomainError> {
        let proj_clean = profile.project_id.trim_start_matches("projects:");
        let proj_id = format!("projects:{proj_clean}");

        let id_val = if let Some(ref id) = profile.id {
            let clean = id.trim_start_matches("ai_profiles:");
            format!("ai_profiles:{clean}")
        } else {
            let uid = uuid::Uuid::new_v4().to_string();
            format!("ai_profiles:{uid}")
        };

        self.db
            .query(
                "UPSERT type::record($id) SET name = $name, provider = $provider, base_url = $base_url, api_key = $api_key, settings = $settings, is_active = $is_active, is_global = $is_global, project_id = type::record($proj)"
            )
            .bind(("id", id_val.clone()))
            .bind(("name", profile.name.clone()))
            .bind(("provider", profile.provider.clone()))
            .bind(("base_url", profile.base_url.clone()))
            .bind(("api_key", profile.api_key.clone()))
            .bind(("settings", profile.settings.clone()))
            .bind(("is_active", profile.is_active))
            .bind(("is_global", profile.is_global))
            .bind(("proj", proj_id))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let mut saved = profile.clone();
        saved.id = Some(id_val);
        Ok(saved)
    }

    async fn delete_profile(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("ai_profiles:");
        let p_id = format!("ai_profiles:{clean}");

        self.db
            .query("DELETE type::record($id)")
            .bind(("id", p_id))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        Ok(())
    }

    async fn fetch_models(
        &self,
        provider: &str,
        _api_key: Option<&str>,
    ) -> Result<Vec<AiModelInfo>, DomainError> {
        let default_models = match provider {
            "anthropic" => vec![
                AiModelInfo {
                    value: "claude-3-7-sonnet-20250219".into(),
                    label: "Claude 3.7 Sonnet".into(),
                    description: Some("Anthropic Hybrid Reasoning".into()),
                    context_length: Some(200000),
                    max_completion_tokens: Some(8192),
                },
                AiModelInfo {
                    value: "claude-3-5-sonnet-20241022".into(),
                    label: "Claude 3.5 Sonnet".into(),
                    description: Some("Anthropic Smart Model".into()),
                    context_length: Some(200000),
                    max_completion_tokens: Some(8192),
                },
                AiModelInfo {
                    value: "claude-3-5-haiku-20241022".into(),
                    label: "Claude 3.5 Haiku".into(),
                    description: Some("Fast & Cheap".into()),
                    context_length: Some(200000),
                    max_completion_tokens: Some(8192),
                },
            ],
            "openai" => vec![
                AiModelInfo {
                    value: "gpt-4o".into(),
                    label: "GPT-4o".into(),
                    description: Some("Omni Model".into()),
                    context_length: Some(128000),
                    max_completion_tokens: Some(4096),
                },
                AiModelInfo {
                    value: "gpt-4o-mini".into(),
                    label: "GPT-4o Mini".into(),
                    description: Some("Fast Model".into()),
                    context_length: Some(128000),
                    max_completion_tokens: Some(4096),
                },
                AiModelInfo {
                    value: "o1".into(),
                    label: "o1 Reasoning".into(),
                    description: Some("Deep Reasoning".into()),
                    context_length: Some(200000),
                    max_completion_tokens: Some(100000),
                },
                AiModelInfo {
                    value: "o3-mini".into(),
                    label: "o3-mini".into(),
                    description: Some("Fast Reasoning".into()),
                    context_length: Some(200000),
                    max_completion_tokens: Some(100000),
                },
            ],
            "openrouter" => vec![
                AiModelInfo {
                    value: "anthropic/claude-3.7-sonnet".into(),
                    label: "Claude 3.7 Sonnet (OpenRouter)".into(),
                    description: None,
                    context_length: Some(200000),
                    max_completion_tokens: Some(8192),
                },
                AiModelInfo {
                    value: "deepseek/deepseek-r1".into(),
                    label: "DeepSeek R1 (OpenRouter)".into(),
                    description: None,
                    context_length: Some(64000),
                    max_completion_tokens: Some(8192),
                },
                AiModelInfo {
                    value: "google/gemini-2.0-flash-001".into(),
                    label: "Gemini 2.0 Flash (OpenRouter)".into(),
                    description: None,
                    context_length: Some(1000000),
                    max_completion_tokens: Some(8192),
                },
            ],
            _ => vec![AiModelInfo {
                value: "default".into(),
                label: "Default Model".into(),
                description: None,
                context_length: Some(8192),
                max_completion_tokens: Some(4096),
            }],
        };
        Ok(default_models)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use surrealdb::engine::local::Mem;

    async fn setup_test_db() -> Arc<Surreal<Db>> {
        let db = Surreal::new::<Mem>(()).await.unwrap();
        db.use_ns("test").use_db("test").await.unwrap();
        Arc::new(db)
    }

    #[tokio::test]
    async fn test_chat_repo_crud_and_hierarchy() {
        let db = setup_test_db().await;
        let repo = SurrealChatRepository::new(db.clone());

        // 1. Save chat
        let chat = Chat::new("chats:c1", "projects:p1", "Первый чат");
        let saved = repo.save_chat(&chat).await.unwrap();
        assert_eq!(saved.id, "chats:c1");
        assert_eq!(saved.title, "Первый чат");

        // 2. Get tree
        let tree = repo.get_chat_tree("projects:p1").await.unwrap();
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].id, "chats:c1");

        // 3. Save message
        let user_msg = ChatMessage::new(
            "chat_messages:m1",
            "projects:p1",
            "chats:c1",
            MessageRole::User,
            "Привет!",
        );
        repo.save_message(&user_msg).await.unwrap();

        let msgs = repo.get_messages("chats:c1").await.unwrap();
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].content, "Привет!");

        // 4. Delete chat
        repo.delete_chat("chats:c1").await.unwrap();
        let empty_tree = repo.get_chat_tree("projects:p1").await.unwrap();
        assert_eq!(empty_tree.len(), 0);
    }

    #[tokio::test]
    async fn test_profile_repo_crud() {
        let db = setup_test_db().await;
        let repo = SurrealAiProfileRepository::new(db);

        let profile = AiProfile {
            id: Some("ai_profiles:prof1".to_string()),
            project_id: "projects:p1".to_string(),
            name: "Anthropic Profile".to_string(),
            provider: "anthropic".to_string(),
            base_url: None,
            api_key: Some("sk-ant-test".to_string()),
            settings: serde_json::json!({ "model": "claude-3-7-sonnet" }),
            is_active: true,
            is_global: false,
        };

        let saved = repo.save_profile(&profile).await.unwrap();
        assert_eq!(saved.id.as_deref(), Some("ai_profiles:prof1"));

        let active = repo.get_active_profile("projects:p1").await.unwrap();
        assert!(active.is_some());
        assert_eq!(active.unwrap().name, "Anthropic Profile");

        let models = repo.fetch_models("anthropic", None).await.unwrap();
        assert!(!models.is_empty());
    }
}
