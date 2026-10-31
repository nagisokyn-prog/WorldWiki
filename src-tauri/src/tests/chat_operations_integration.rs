//! Интеграционные тесты операций чата (`worldwiki-application/src/ai/chat_services.rs`).
//!
//! Покрывают операции поверх реальной in-memory SurrealDB через `ChatServices`:
//! - `fork_chat`: копия ветки от корня / обработка ошибок;
//! - `update_chat_parent`: переприкрепление чата в дереве;
//! - `delete_message`, `switch_variant`, `delete_chat`, `edit_message`, `send_message`.

use std::sync::Arc;
use serde_json::Value;
use super::common::{create_test_db, create_test_services};

type Db = surrealdb::Surreal<surrealdb::engine::local::Db>;

/// Хелпер: проект + чат с сообщениями (корень и потомок).
async fn seed_chat(db: &Db) {
    db.query("CREATE projects:p_chop SET name = 'ChatOps'")
        .await
        .unwrap();
    db.query(
        "CREATE chats:c_main SET project_id = type::record('projects','p_chop'), \
         title = 'Основной чат', session_context = []",
    )
    .await
    .unwrap();

    db.query(
        "CREATE chat_messages:m_root SET chat_id = chats:c_main, \
         project_id = type::record('projects','p_chop'), role = 'user', \
         content = 'Вопрос из корня', version = 1, parent_id = NONE, is_active = true, \
         created_at = time::now() - 2m",
    )
    .await
    .unwrap();
    db.query(
        "CREATE chat_messages:m_child SET chat_id = chats:c_main, \
         project_id = type::record('projects','p_chop'), role = 'assistant', \
         content = 'Ответ ассистента', version = 1, parent_id = chat_messages:m_root, \
         is_active = true, created_at = time::now() - 1m",
    )
    .await
    .unwrap();
}

async fn count_msgs(db: &Db, chat_ref: &str) -> usize {
    let mut res = db
        .query(format!(
            "SELECT count() FROM chat_messages WHERE chat_id = {chat_ref} GROUP ALL"
        ))
        .await
        .unwrap();
    let v: Option<Value> = res.take(0).unwrap();
    v.and_then(|x| x.get("count").and_then(|c| c.as_u64()))
        .unwrap_or(0) as usize
}

// ---------- fork_chat ----------

#[tokio::test]
async fn fork_from_root_copies_whole_branch_to_new_chat() {
    let db = create_test_db().await;
    seed_chat(&db).await;
    let services = create_test_services(Arc::new(db.clone()));

    let new_chat = services.chat.fork_chat("p_chop", "chat_messages:m_child", "Ветка от потомка")
        .await
        .expect("fork should succeed");

    assert_eq!(new_chat.title, "Ветка от потомка");
    let new_id = new_chat.id;
    assert!(new_id.starts_with("chats:"), "id нового чата нормализован");

    let new_key = new_id.trim_start_matches("chats:");
    assert_eq!(
        count_msgs(&db, &format!("chats:`{new_key}`")).await,
        2,
        "форк от ПОСЛЕДНЕГО сообщения копирует всю ветку"
    );
}

#[tokio::test]
async fn fork_from_earliest_message_copies_only_up_to_target() {
    let db = create_test_db().await;
    seed_chat(&db).await;
    let services = create_test_services(Arc::new(db.clone()));

    let new_chat = services.chat.fork_chat("p_chop", "chat_messages:m_root", "Ветка от корня")
        .await
        .expect("fork from root should succeed");

    let new_id = new_chat.id;
    let new_key = new_id.trim_start_matches("chats:");
    assert_eq!(
        count_msgs(&db, &format!("chats:`{new_key}`")).await,
        1,
        "форк от корня копирует только корень"
    );
}

// ---------- update_chat_parent ----------

#[tokio::test]
async fn update_chat_parent_creates_contains_edge() {
    let db = create_test_db().await;
    seed_chat(&db).await;
    let services = create_test_services(Arc::new(db.clone()));

    db.query("CREATE chats:c_parent SET project_id = type::record('projects','p_chop'), title = 'Родитель'")
        .await
        .unwrap();

    services.chat.update_chat_parent("chats:c_main", Some("chats:c_parent"))
        .await
        .expect("update_chat_parent should succeed");

    let tree = services.chat.get_chat_tree("p_chop").await.unwrap();
    let main_chat = tree.iter().find(|c| c.id == "chats:c_main").unwrap();
    assert_eq!(main_chat.parent_chat_id.as_deref(), Some("chats:c_parent"));
}

#[tokio::test]
async fn update_chat_parent_to_none_removes_edge() {
    let db = create_test_db().await;
    seed_chat(&db).await;
    let services = create_test_services(Arc::new(db.clone()));

    db.query("CREATE chats:c_parent SET project_id = type::record('projects','p_chop'), title = 'Родитель'")
        .await
        .unwrap();
    services.chat.update_chat_parent("chats:c_main", Some("chats:c_parent")).await.unwrap();

    services.chat.update_chat_parent("chats:c_main", None)
        .await
        .expect("detaching parent should succeed");

    let tree = services.chat.get_chat_tree("p_chop").await.unwrap();
    let main_chat = tree.iter().find(|c| c.id == "chats:c_main").unwrap();
    assert_eq!(main_chat.parent_chat_id, None);
}

// ---------- delete_chat_message ----------

#[tokio::test]
async fn delete_chat_message_removes_single_message() {
    let db = create_test_db().await;
    seed_chat(&db).await;
    let services = create_test_services(Arc::new(db.clone()));

    services.chat.delete_message("chat_messages:m_child")
        .await
        .expect("delete_chat_message should succeed");

    let msgs = services.chat.get_messages("chats:c_main").await.unwrap();
    assert_eq!(msgs.len(), 1);
    assert_eq!(msgs[0].id, "chat_messages:m_root");
}

// ---------- switch_message_variant ----------

#[tokio::test]
async fn switch_message_variant_activates_target() {
    let db = create_test_db().await;
    seed_chat(&db).await;
    let services = create_test_services(Arc::new(db.clone()));

    // Добавляем второй вариант ответа
    db.query(
        "CREATE chat_messages:m_child_v2 SET chat_id = chats:c_main, \
         project_id = type::record('projects','p_chop'), role = 'assistant', \
         content = 'Второй вариант', version = 2, parent_id = chat_messages:m_root, \
         is_active = false, created_at = time::now()",
    )
    .await
    .unwrap();

    services.chat.switch_variant("chat_messages:m_child_v2")
        .await
        .expect("switch_variant should succeed");

    let msgs = services.chat.get_messages("chats:c_main").await.unwrap();
    let v2 = msgs.iter().find(|m| m.id == "chat_messages:m_child_v2").unwrap();
    assert!(v2.is_active);
}

// ---------- delete_ai_chat ----------

#[tokio::test]
async fn delete_ai_chat_cascades_messages_and_chat() {
    let db = create_test_db().await;
    seed_chat(&db).await;
    let services = create_test_services(Arc::new(db.clone()));

    services.chat.delete_chat("chats:c_main")
        .await
        .expect("delete_chat should succeed");

    let tree = services.chat.get_chat_tree("p_chop").await.unwrap();
    assert!(tree.is_empty(), "чат должен быть удалён");

    let msgs = services.chat.get_messages("chats:c_main").await.unwrap();
    assert!(msgs.is_empty(), "сообщения чата должны быть удалены");
}

// ---------- edit_message & send_message ----------

#[tokio::test]
async fn edit_message_updates_content() {
    let db = create_test_db().await;
    seed_chat(&db).await;
    let services = create_test_services(Arc::new(db.clone()));

    let (chat_id, asst_id) = services
        .chat
        .edit_message("p_chop", "chats:c_main", "chat_messages:m_root", "Обновлённый вопрос")
        .await
        .expect("edit_message should succeed");

    assert_eq!(chat_id, "chats:c_main");
    assert!(!asst_id.is_empty());

    let msgs = services.chat.get_messages("chats:c_main").await.unwrap();
    let updated_user_msg = msgs.iter().find(|m| m.content == "Обновлённый вопрос").unwrap();
    assert!(updated_user_msg.is_active);
}

#[tokio::test]
async fn send_message_appends_messages() {
    let db = create_test_db().await;
    seed_chat(&db).await;
    let services = create_test_services(Arc::new(db.clone()));

    let res = services.chat.send_message("p_chop", "chats:c_main", "Новый запрос пользователя")
        .await
        .expect("send_message should succeed");

    assert_eq!(res.chat_id, "chats:c_main");
    assert!(!res.user_msg_id.is_empty());
    assert!(!res.assistant_msg_id.is_empty());

    let msgs = services.chat.get_messages("chats:c_main").await.unwrap();
    assert!(msgs.len() >= 4);
}