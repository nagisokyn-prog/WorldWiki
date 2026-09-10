use serde_json::Value;
use std::collections::HashSet;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;

use worldwiki_domain::errors::DomainError;

use super::chat_mapping::{clean_id_str, clean_record_id};

/// Каскадное рекурсивное удаление чата и всех его дочерних подветок, сообщений и связей.
pub async fn delete_chat_cascade(db: &Surreal<Db>, chat_id: &str) -> Result<(), DomainError> {
    let chat_clean = clean_id_str(chat_id, "chats:");
    let initial_rec = format!("chats:{chat_clean}");

    // 1. Запрашиваем все чаты и рёбра `contains` для нахождения всех потомков
    let mut res = db
        .query("SELECT id, parent_id FROM chats; SELECT in, out FROM contains;")
        .await
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    let all_chats: Vec<Value> = res.take(0).unwrap_or_default();
    let all_edges: Vec<Value> = res.take(1).unwrap_or_default();

    let mut to_delete = HashSet::new();
    to_delete.insert(initial_rec.clone());
    to_delete.insert(chat_clean.to_string());

    let mut changed = true;
    while changed {
        changed = false;
        // Проверяем прямое поле parent_id на записях chats
        for c in &all_chats {
            if let Some(id_str) = c.get("id").and_then(clean_record_id) {
                if !to_delete.contains(&id_str) {
                    if let Some(parent_str) = c.get("parent_id").and_then(clean_record_id) {
                        if to_delete.contains(&parent_str) {
                            to_delete.insert(id_str.clone());
                            to_delete.insert(clean_id_str(&id_str, "chats:").to_string());
                            changed = true;
                        }
                    }
                }
            }
        }
        // Проверяем рёбра contains (in = parent, out = child)
        for edge in &all_edges {
            let parent_opt = edge.get("in").and_then(clean_record_id);
            let child_opt = edge.get("out").and_then(clean_record_id);
            if let (Some(parent_str), Some(child_str)) = (parent_opt, child_opt) {
                if to_delete.contains(&parent_str) && !to_delete.contains(&child_str) {
                    to_delete.insert(child_str.clone());
                    to_delete.insert(clean_id_str(&child_str, "chats:").to_string());
                    changed = true;
                }
            }
        }
    }

    // 2. Удаляем все сообщения, рёбра и записи чата для каждого найденного идентификатора
    for cid in to_delete {
        let clean = clean_id_str(&cid, "chats:");
        let rec = RecordId::new("chats", clean);
        let _ = db
            .query("DELETE chat_messages WHERE chat_id = $chat OR chat_id = $raw_id; DELETE contains WHERE out = $chat OR in = $chat; DELETE $chat;")
            .bind(("chat", rec))
            .bind(("raw_id", format!("chats:{clean}")))
            .await;
    }

    Ok(())
}

/// Переключение активного варианта сообщения в ветке ответов.
pub async fn switch_message_variant(db: &Surreal<Db>, message_id: &str) -> Result<(), DomainError> {
    let msg_clean = clean_id_str(message_id, "chat_messages:");
    let msg_rec = RecordId::new("chat_messages", msg_clean);

    let mut res = db
        .query("SELECT chat_id, parent_id FROM $msg")
        .bind(("msg", msg_rec.clone()))
        .await
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    let orig: Option<Value> = res.take(0).unwrap_or_default();
    if let Some(orig) = orig {
        let chat_id_str = clean_record_id(orig.get("chat_id").unwrap_or(&Value::Null)).unwrap_or_default();
        let chat_clean = clean_id_str(&chat_id_str, "chats:");
        let chat_rec = RecordId::new("chats", chat_clean);

        let parent_id_val = orig.get("parent_id").cloned();
        let parent_clean = parent_id_val.as_ref().and_then(clean_record_id);

        if let Some(p_str) = parent_clean {
            let p_clean = clean_id_str(&p_str, "chat_messages:");
            let p_rec = RecordId::new("chat_messages", p_clean);
            db.query("UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = $parent; UPDATE $msg SET is_active = true;")
                .bind(("chat", chat_rec))
                .bind(("parent", p_rec))
                .bind(("msg", msg_rec))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        } else {
            db.query("UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = NONE; UPDATE $msg SET is_active = true;")
                .bind(("chat", chat_rec))
                .bind(("msg", msg_rec))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        }
    }

    Ok(())
}

/// Создание новой ветки при редактировании сообщения пользователя.
pub async fn edit_message_branch(
    db: &Surreal<Db>,
    project_id: &str,
    chat_id: &str,
    msg_id: &str,
    new_text: &str,
) -> Result<(String, String), DomainError> {
    let chat_clean = clean_id_str(chat_id, "chats:");
    let chat_rec = RecordId::new("chats", chat_clean);
    let proj_clean = clean_id_str(project_id, "projects:");
    let proj_rec = RecordId::new("projects", if proj_clean.is_empty() { "default" } else { proj_clean });

    let msg_clean = clean_id_str(msg_id, "chat_messages:");
    let msg_rec = RecordId::new("chat_messages", msg_clean);

    let mut check = db
        .query("SELECT parent_id FROM $msg")
        .bind(("msg", msg_rec))
        .await
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    let orig: Option<Value> = check.take(0).unwrap_or_default();
    let parent_id_val = orig.as_ref().and_then(|v| v.get("parent_id").cloned());
    let parent_clean = parent_id_val.as_ref().and_then(clean_record_id);

    if let Some(ref p_str) = parent_clean {
        let p_clean = clean_id_str(p_str, "chat_messages:");
        let p_rec = RecordId::new("chat_messages", p_clean);
        db.query("UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = $parent")
            .bind(("chat", chat_rec.clone()))
            .bind(("parent", p_rec))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
    } else {
        db.query("UPDATE chat_messages SET is_active = false WHERE chat_id = $chat AND parent_id = NONE")
            .bind(("chat", chat_rec.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
    }

    let new_user_uuid = uuid::Uuid::new_v4().to_string();
    let new_user_rec = RecordId::new("chat_messages", new_user_uuid.as_str());
    let new_assistant_uuid = uuid::Uuid::new_v4().to_string();
    let new_assistant_rec = RecordId::new("chat_messages", new_assistant_uuid.as_str());

    if let Some(ref p_str) = parent_clean {
        let p_clean = clean_id_str(p_str, "chat_messages:");
        let p_rec = RecordId::new("chat_messages", p_clean);
        db.query(r#"
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
        db.query(r#"
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

    Ok((
        format!("chats:{chat_clean}"),
        format!("chat_messages:{new_assistant_uuid}"),
    ))
}

/// Перегенерация ответа ассистента с созданием нового варианта сообщения.
pub async fn regenerate_assistant_variant(
    db: &Surreal<Db>,
    project_id: &str,
    chat_id: &str,
    parent_msg_id: &str,
) -> Result<(String, String, String), DomainError> {
    let chat_clean = clean_id_str(chat_id, "chats:");
    let chat_rec = RecordId::new("chats", chat_clean);
    let proj_clean = clean_id_str(project_id, "projects:");
    let proj_rec = RecordId::new("projects", if proj_clean.is_empty() { "default" } else { proj_clean });

    let parent_clean = clean_id_str(parent_msg_id, "chat_messages:");
    let user_msg_rec = RecordId::new("chat_messages", parent_clean);

    let mut check_user = db
        .query("SELECT content FROM $parent")
        .bind(("parent", user_msg_rec.clone()))
        .await
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    let user_msg: Option<Value> = check_user.take(0).unwrap_or_default();
    let user_text = user_msg
        .and_then(|v| {
            v.get("content")
                .and_then(|c| c.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_default();

    db.query("UPDATE chat_messages SET is_active = false WHERE parent_id = $parent AND role = 'assistant'")
        .bind(("parent", user_msg_rec.clone()))
        .await
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    let new_assistant_uuid = uuid::Uuid::new_v4().to_string();
    let new_assistant_rec = RecordId::new("chat_messages", new_assistant_uuid.as_str());

    db.query(r#"
        CREATE $aid SET chat_id = $chat, project_id = $proj, role = 'assistant', content = '', version = 1, parent_id = $parent, is_active = true, created_at = time::now();
    "#)
    .bind(("aid", new_assistant_rec))
    .bind(("chat", chat_rec))
    .bind(("proj", proj_rec))
    .bind(("parent", user_msg_rec))
    .await
    .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

    Ok((
        format!("chats:{chat_clean}"),
        format!("chat_messages:{new_assistant_uuid}"),
        user_text,
    ))
}
