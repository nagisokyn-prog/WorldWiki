//! High-level Chat and AI Agent orchestration services.

pub mod agent_emitter;
pub mod agent_loop;
pub mod approval;
pub mod error_parser;
pub mod rag_context;
pub mod session_service;
pub mod tool_dispatcher;

pub use error_parser::parse_llm_error_to_human;
pub use session_service::SendMessageResult;

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, RwLock};
use tokio::sync::oneshot;
use serde_json::Value;

use worldwiki_domain::ai::{AiModelInfo, AiProfile, Chat, ChatMessage};
use worldwiki_ports::ai::{
    AiProfileRepository, ChatRepository, LlmStreamPort, RAGContextPort, SkillRepositoryPort,
};
use worldwiki_ports::events::EventPublisherPort;
use crate::ai::tools::AiToolFacades;
use crate::errors::ApplicationError;

use agent_loop::ChatAgentLoop;
use session_service::ChatSessionService;
use tool_dispatcher::{ChatToolDispatcher, ToolInvocationContext};

pub struct ChatServices {
    pub chat_repo: Arc<dyn ChatRepository>,
    pub profile_repo: Arc<dyn AiProfileRepository>,
    pub stream_port: Arc<dyn LlmStreamPort>,
    pub event_publisher: Arc<dyn EventPublisherPort>,
    pub rag_port: Option<Arc<dyn RAGContextPort>>,
    pub skill_repo: Option<Arc<dyn SkillRepositoryPort>>,
    pub ai_tools: Option<Arc<AiToolFacades>>,
    pub active_cancellations: Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,
    pub pending_approvals: Arc<RwLock<HashMap<String, oneshot::Sender<bool>>>>,
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
            active_cancellations: Arc::new(RwLock::new(HashMap::new())),
            pending_approvals: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn respond_tool_approval(&self, call_id: &str, approved: bool) -> bool {
        if let Ok(mut map) = self.pending_approvals.write()
            && let Some(tx) = map.remove(call_id)
        {
            return tx.send(approved).is_ok();
        }
        false
    }

    pub fn abort_generation(&self, chat_id: &str) -> bool {
        if let Ok(map) = self.active_cancellations.read()
            && let Some(flag) = map.get(chat_id)
        {
            flag.store(true, std::sync::atomic::Ordering::Relaxed);
            return true;
        }
        false
    }

    pub async fn get_chat_tree(&self, project_id: &str) -> Result<Vec<Chat>, ApplicationError> {
        ChatSessionService::get_chat_tree(&self.chat_repo, project_id).await
    }

    pub async fn get_messages(&self, chat_id: &str) -> Result<Vec<ChatMessage>, ApplicationError> {
        ChatSessionService::get_messages(&self.chat_repo, chat_id).await
    }

    pub async fn send_message(
        &self,
        project_id: &str,
        chat_id: &str,
        text: &str,
    ) -> Result<SendMessageResult, ApplicationError> {
        ChatSessionService::send_message(&self.chat_repo, project_id, chat_id, text).await
    }

    pub async fn run_agent_loop(
        &self,
        project_id: &str,
        chat_id: &str,
        assistant_msg_id: &str,
        user_text: &str,
        mode_slug: Option<String>,
    ) {
        ChatAgentLoop::run(agent_loop::AgentLoopParams {
            chat_repo: &self.chat_repo,
            profile_repo: &self.profile_repo,
            stream_port: &self.stream_port,
            event_publisher: &self.event_publisher,
            rag_port: &self.rag_port,
            skill_repo: &self.skill_repo,
            ai_tools: &self.ai_tools,
            active_cancellations: &self.active_cancellations,
            pending_approvals: &self.pending_approvals,
            project_id,
            chat_id,
            assistant_msg_id,
            user_text,
            mode_slug,
        })
        .await
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
        ChatToolDispatcher::execute_tool(ToolInvocationContext {
            ai_tools: &self.ai_tools,
            event_publisher: &self.event_publisher,
            pending_approvals: &self.pending_approvals,
            project_id,
            chat_id,
            assistant_msg_id,
            mode,
            name,
            input,
        })
        .await
    }

    pub async fn fork_chat(
        &self,
        project_id: &str,
        message_id: &str,
        new_title: &str,
    ) -> Result<Chat, ApplicationError> {
        ChatSessionService::fork_chat(&self.chat_repo, project_id, message_id, new_title).await
    }

    pub async fn save_chat(&self, chat: &Chat) -> Result<Chat, ApplicationError> {
        ChatSessionService::save_chat(&self.chat_repo, chat).await
    }

    pub async fn update_chat_parent(
        &self,
        chat_id: &str,
        new_parent_id: Option<&str>,
    ) -> Result<(), ApplicationError> {
        ChatSessionService::update_chat_parent(&self.chat_repo, chat_id, new_parent_id).await
    }

    pub async fn delete_chat(&self, chat_id: &str) -> Result<(), ApplicationError> {
        ChatSessionService::delete_chat(&self.chat_repo, chat_id).await
    }

    pub async fn delete_message(&self, message_id: &str) -> Result<(), ApplicationError> {
        ChatSessionService::delete_message(&self.chat_repo, message_id).await
    }

    pub async fn switch_variant(&self, message_id: &str) -> Result<(), ApplicationError> {
        ChatSessionService::switch_variant(&self.chat_repo, message_id).await
    }

    pub async fn fetch_models(
        &self,
        provider: &str,
        api_key: Option<&str>,
    ) -> Result<Vec<AiModelInfo>, ApplicationError> {
        ChatSessionService::fetch_models(&self.profile_repo, provider, api_key).await
    }

    pub async fn get_profiles(&self, project_id: &str) -> Result<Vec<AiProfile>, ApplicationError> {
        ChatSessionService::get_profiles(&self.profile_repo, project_id).await
    }

    pub async fn save_profile(&self, profile: &AiProfile) -> Result<AiProfile, ApplicationError> {
        ChatSessionService::save_profile(&self.profile_repo, profile).await
    }

    pub async fn delete_profile(&self, id: &str) -> Result<(), ApplicationError> {
        ChatSessionService::delete_profile(&self.profile_repo, id).await
    }

    pub async fn edit_message(
        &self,
        project_id: &str,
        chat_id: &str,
        msg_id: &str,
        new_text: &str,
    ) -> Result<(String, String), ApplicationError> {
        ChatSessionService::edit_message(&self.chat_repo, project_id, chat_id, msg_id, new_text).await
    }

    pub async fn regenerate_message(
        &self,
        project_id: &str,
        chat_id: &str,
        parent_msg_id: &str,
    ) -> Result<(String, String, String), ApplicationError> {
        ChatSessionService::regenerate_message(&self.chat_repo, project_id, chat_id, parent_msg_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::Mutex;
    use worldwiki_domain::ai::{ChatMessage, MessageRole};
    use worldwiki_domain::errors::DomainError;
    use worldwiki_ports::ai::{StreamEventDto, StreamRequest};

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
            if let Err(e) = sender
                .send(StreamEventDto {
                    text_delta: Some("Ответ от модели".to_string()),
                    reasoning_delta: None,
                    tool_use: None,
                    usage: None,
                    is_done: true,
                })
                .await
            {
                eprintln!("[MockStream] send error: {e}");
            }
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
        let profile_repo = Arc::new(MockProfileRepo);
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
        let profile_repo = Arc::new(MockProfileRepo);
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
