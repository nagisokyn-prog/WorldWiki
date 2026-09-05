use crate::errors::ApplicationError;
use std::sync::Arc;
use worldwiki_domain::ai::{AiModelInfo, AiProfile, Chat, ChatMessage, MessageRole};
use worldwiki_ports::ai::{AiProfileRepository, ChatRepository};

pub struct ChatServices {
    pub chat_repo: Arc<dyn ChatRepository>,
    pub profile_repo: Arc<dyn AiProfileRepository>,
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
    ) -> Self {
        Self {
            chat_repo,
            profile_repo,
        }
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

    pub async fn fork_chat(
        &self,
        project_id: &str,
        _message_id: &str,
        new_title: &str,
    ) -> Result<Chat, ApplicationError> {
        let new_chat_id = format!("chats:{}", uuid::Uuid::new_v4());
        let title = if new_title.trim().is_empty() {
            "Новая ветка".to_string()
        } else {
            new_title.to_string()
        };
        let chat = Chat::new(new_chat_id.clone(), project_id, title);
        let saved = self
            .chat_repo
            .save_chat(&chat)
            .await
            .map_err(ApplicationError::from)?;
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::Mutex;
    use worldwiki_domain::errors::DomainError;

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
            Ok(None)
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

    #[tokio::test]
    async fn test_send_message_autocreates_chat_and_messages() {
        let chat_repo = Arc::new(MockChatRepo::default());
        let profile_repo = Arc::new(MockProfileRepo::default());
        let services = ChatServices::new(chat_repo.clone(), profile_repo);

        let res = services
            .send_message("projects:p1", "", "Привет, мир!")
            .await
            .unwrap();

        assert!(res.chat_id.starts_with("chats:"));
        assert!(res.user_msg_id.starts_with("chat_messages:"));
        assert!(res.assistant_msg_id.starts_with("chat_messages:"));

        let tree = services.get_chat_tree("projects:p1").await.unwrap();
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].title, "Привет, мир!");

        let msgs = services.get_messages(&res.chat_id).await.unwrap();
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0].role, MessageRole::User);
        assert_eq!(msgs[0].content, "Привет, мир!");
        assert_eq!(msgs[1].role, MessageRole::Assistant);
        assert_eq!(msgs[1].parent_id.as_deref(), Some(res.user_msg_id.as_str()));
    }

    #[tokio::test]
    async fn test_fork_chat_creates_new_chat_with_title() {
        let chat_repo = Arc::new(MockChatRepo::default());
        let profile_repo = Arc::new(MockProfileRepo::default());
        let services = ChatServices::new(chat_repo, profile_repo);

        let chat = services
            .fork_chat("projects:p1", "chat_messages:m1", "Ветка 1")
            .await
            .unwrap();

        assert!(chat.id.starts_with("chats:"));
        assert_eq!(chat.title, "Ветка 1");
    }
}
