use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;

use worldwiki_domain::ai::{Chat, ChatMessage, MessageRole, TokenUsage};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::ChatRepository;

use super::chat_branching;
use super::chat_mapping::{self, clean_id_str, parse_chat_message_record, parse_chat_record};

// Re-export clean_record_id for backwards compatibility across surrealdb repos
pub use chat_mapping::clean_record_id;

pub struct SurrealChatRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealChatRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl ChatRepository for SurrealChatRepository {
    async fn get_chat_tree(&self, project_id: &str) -> Result<Vec<Chat>, DomainError> {
        let proj_clean = clean_id_str(project_id, "projects:");
        let proj_id = format!("projects:{proj_clean}");

        let mut res = self
            .db
            .query("SELECT id, title, project_id, tag, session_context, created_at FROM chats WHERE project_id = type::record('projects', $p_clean) OR project_id = $proj_id ORDER BY created_at DESC")
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
        let chats = raw_chats
            .into_iter()
            .map(|val| parse_chat_record(&val, project_id, &edges))
            .collect();

        Ok(chats)
    }

    async fn get_messages(&self, chat_id: &str) -> Result<Vec<ChatMessage>, DomainError> {
        let chat_clean = clean_id_str(chat_id, "chats:");

        let mut res = self
            .db
            .query("SELECT id, project_id, chat_id, role, content, reasoning, tool_logs, version, quoted_context, citations, edited_content, feedback_comment, rag_was_bad, parent_id, is_active, created_at, updated_at FROM chat_messages WHERE chat_id = type::record('chats', $c_clean) ORDER BY created_at ASC")
            .bind(("c_clean", chat_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let raw_msgs: Vec<Value> = res.take(0).unwrap_or_default();
        let messages = raw_msgs
            .into_iter()
            .map(|val| parse_chat_message_record(&val, chat_id))
            .collect();

        Ok(messages)
    }

    async fn save_chat(&self, chat: &Chat) -> Result<Chat, DomainError> {
        let chat_clean = clean_id_str(&chat.id, "chats:");
        let c_id = format!("chats:{chat_clean}");
        let proj_clean = clean_id_str(&chat.project_id, "projects:");

        let sql = "UPSERT type::record('chats', $c_clean) SET title = $title, project_id = type::record('projects', $p_clean), session_context = [], created_at = IF created_at != NONE AND created_at != NULL { created_at } ELSE { time::now() }";

        let mut res = self
            .db
            .query(sql)
            .bind(("c_clean", chat_clean.to_string()))
            .bind(("title", chat.title.clone()))
            .bind(("p_clean", proj_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let errors = res.take_errors();
        if let Some((_, e)) = errors.into_iter().next() {
            return Err(DomainError::ConstraintViolation(format!(
                "save_chat schema error: {e}"
            )));
        }

        let mut saved = chat.clone();
        saved.id = c_id;
        Ok(saved)
    }

    async fn save_message(&self, message: &ChatMessage) -> Result<ChatMessage, DomainError> {
        let msg_clean = clean_id_str(&message.id, "chat_messages:");
        let m_id = format!("chat_messages:{msg_clean}");
        let chat_clean = clean_id_str(&message.chat_id, "chats:");
        let proj_clean = clean_id_str(&message.project_id, "projects:");

        let role_str = match message.role {
            MessageRole::Assistant => "assistant",
            MessageRole::System => "system",
            MessageRole::User => "user",
        };

        let parent_clean = message
            .parent_id
            .as_ref()
            .map(|p| clean_id_str(p, "chat_messages:").to_string());

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
            .bind((
                "p_clean",
                if proj_clean.is_empty() {
                    "unknown"
                } else {
                    proj_clean
                }
                .to_string(),
            ))
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

        let errors = res.take_errors();
        if let Some((_, e)) = errors.into_iter().next() {
            return Err(DomainError::ConstraintViolation(format!(
                "save_message schema error: {e}"
            )));
        }

        let mut saved = message.clone();
        saved.id = m_id;
        Ok(saved)
    }

    async fn delete_chat(&self, chat_id: &str) -> Result<(), DomainError> {
        chat_branching::delete_chat_cascade(&self.db, chat_id).await
    }

    async fn delete_message(&self, message_id: &str) -> Result<(), DomainError> {
        let msg_clean = clean_id_str(message_id, "chat_messages:");
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
        let chat_clean = clean_id_str(chat_id, "chats:");
        let c_rec = RecordId::new("chats", chat_clean);

        self.db
            .query("DELETE contains WHERE out = $chat")
            .bind(("chat", c_rec.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        if let Some(parent) = new_parent_id {
            let p_clean = clean_id_str(parent, "chats:");
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
        chat_branching::switch_message_variant(&self.db, message_id).await
    }

    async fn update_token_usage(
        &self,
        chat_id: &str,
        usage: &TokenUsage,
    ) -> Result<(), DomainError> {
        if usage.total_tokens == 0 && usage.input_tokens == 0 && usage.output_tokens == 0 {
            return Ok(());
        }
        let chat_clean = clean_id_str(chat_id, "chats:");
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
        chat_branching::edit_message_branch(&self.db, project_id, chat_id, msg_id, new_text).await
    }

    async fn regenerate_assistant_variant(
        &self,
        project_id: &str,
        chat_id: &str,
        parent_msg_id: &str,
    ) -> Result<(String, String, String), DomainError> {
        chat_branching::regenerate_assistant_variant(&self.db, project_id, chat_id, parent_msg_id)
            .await
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
}
