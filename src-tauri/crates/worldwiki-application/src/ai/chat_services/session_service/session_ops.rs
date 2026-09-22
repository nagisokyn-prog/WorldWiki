use std::collections::HashMap;
use std::sync::Arc;
use worldwiki_domain::ai::{Chat, ChatMessage};
use worldwiki_ports::ai::ChatRepository;
use crate::errors::ApplicationError;

pub async fn get_chat_tree(
    chat_repo: &Arc<dyn ChatRepository>,
    project_id: &str,
) -> Result<Vec<Chat>, ApplicationError> {
    chat_repo
        .get_chat_tree(project_id)
        .await
        .map_err(ApplicationError::from)
}

pub async fn save_chat(
    chat_repo: &Arc<dyn ChatRepository>,
    chat: &Chat,
) -> Result<Chat, ApplicationError> {
    chat_repo.save_chat(chat).await.map_err(ApplicationError::from)
}

pub async fn update_chat_parent(
    chat_repo: &Arc<dyn ChatRepository>,
    chat_id: &str,
    new_parent_id: Option<&str>,
) -> Result<(), ApplicationError> {
    chat_repo
        .update_chat_parent(chat_id, new_parent_id)
        .await
        .map_err(ApplicationError::from)
}

pub async fn delete_chat(
    chat_repo: &Arc<dyn ChatRepository>,
    chat_id: &str,
) -> Result<(), ApplicationError> {
    chat_repo.delete_chat(chat_id).await.map_err(ApplicationError::from)
}

pub async fn fork_chat(
    chat_repo: &Arc<dyn ChatRepository>,
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

    let chats = chat_repo
        .get_chat_tree(project_id)
        .await
        .unwrap_or_default();
    let mut target_chat_id = None;
    let mut all_msgs = Vec::new();

    for c in &chats {
        let msgs = chat_repo.get_messages(&c.id).await.unwrap_or_default();
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
            let msgs = chat_repo.get_messages(cid).await.unwrap_or_default();
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

    let saved = chat_repo
        .save_chat(&chat)
        .await
        .map_err(ApplicationError::from)?;

    if let Some(ref orig_chat_id) = target_chat_id {
        let _ = chat_repo
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
            if let Some(slice) = all_msgs.get(..=target_idx) {
                branch = slice.to_vec();
            }
        }

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
            chat_repo
                .save_message(&new_msg)
                .await
                .map_err(ApplicationError::from)?;
        }
    }

    Ok(saved)
}
