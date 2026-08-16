//! Интеграционные тесты хранилища чатов и ветвления диалогов (`ai/chat/`).
//!
//! Тестируют:
//! - Сохранение и выборку сообщений чата (`get_chat_messages_impl`).
//! - Форканье ветки диалога от конкретного сообщения (`fork_chat_impl`).
//! - Иерархическое дерево чатов и родительские связи `contains` (`get_chat_tree_impl`).

use serde_json::Value;
use crate::logic::ai::chat::operations::fork_chat_impl;
use crate::logic::ai::chat::tree::{get_chat_messages_impl, get_chat_tree_impl};
use super::common::{create_test_db, seed_project};

#[tokio::test]
async fn test_chat_create_and_messages_roundtrip() {
    let db = create_test_db().await;
    seed_project(&db, "p_chat", "Chat Project").await;

    // 1. Создаём чат
    let mut chat_res = db
        .query("CREATE chats:main SET project_id = type::record('projects:p_chat'), title = 'Главный чат', created_at = time::now()")
        .await
        .unwrap();
    let _chat: Option<Value> = chat_res.take(0).unwrap();

    // 2. Создаём 2 сообщения
    let mut m1_res = db
        .query("CREATE chat_messages:m1 SET chat_id = type::record('chats:main'), project_id = type::record('projects:p_chat'), role = 'user', content = 'Привет, помоги придумать сюжет', created_at = time::now(), is_active = true")
        .await
        .unwrap();
    let _m1: Option<Value> = m1_res.take(0).unwrap();

    let mut m2_res = db
        .query("CREATE chat_messages:m2 SET chat_id = type::record('chats:main'), project_id = type::record('projects:p_chat'), role = 'assistant', content = 'Конечно! Какая тема?', parent_id = type::record('chat_messages:m1'), created_at = time::now(), is_active = true")
        .await
        .unwrap();
    let _m2: Option<Value> = m2_res.take(0).unwrap();

    // 3. Выборка через get_chat_messages_impl
    let msgs = get_chat_messages_impl(&db, "main").await.expect("get_chat_messages should succeed");
    assert_eq!(msgs.len(), 2);
    assert_eq!(msgs[0]["content"], "Привет, помоги придумать сюжет");
    assert_eq!(msgs[0]["role"], "user");
    assert_eq!(msgs[1]["content"], "Конечно! Какая тема?");
    assert_eq!(msgs[1]["role"], "assistant");
}

#[tokio::test]
async fn test_fork_chat_copies_history_up_to_target_message() {
    let db = create_test_db().await;
    seed_project(&db, "p_fork", "Fork Project").await;

    // 1. Создаём исходный чат
    db.query("CREATE chats:original SET project_id = type::record('projects:p_fork'), title = 'Базовый чат', created_at = time::now()").await.unwrap();

    // 2. Создаём 3 сообщения последовательно с валидным datetime
    db.query("CREATE chat_messages:msg_1 SET chat_id = type::record('chats:original'), project_id = type::record('projects:p_fork'), role = 'user', content = 'Сообщение 1', created_at = type::datetime('2026-08-01T10:00:00Z'), is_active = true").await.unwrap();
    db.query("CREATE chat_messages:msg_2 SET chat_id = type::record('chats:original'), project_id = type::record('projects:p_fork'), role = 'assistant', content = 'Сообщение 2 (точка форка)', parent_id = type::record('chat_messages:msg_1'), created_at = type::datetime('2026-08-01T10:01:00Z'), is_active = true").await.unwrap();
    db.query("CREATE chat_messages:msg_3 SET chat_id = type::record('chats:original'), project_id = type::record('projects:p_fork'), role = 'user', content = 'Сообщение 3 (не должно попасть в форк)', parent_id = type::record('chat_messages:msg_2'), created_at = type::datetime('2026-08-01T10:02:00Z'), is_active = true").await.unwrap();

    // 3. Форкаем чат от msg_2
    let forked_chat = fork_chat_impl(&db, "p_fork", "msg_2", "Альтернативная ветка")
        .await
        .expect("fork_chat should succeed");

    let forked_chat_id = forked_chat["id"].as_str().unwrap();

    // 4. Проверяем сообщения в форкнутом чате
    let forked_msgs = get_chat_messages_impl(&db, forked_chat_id).await.unwrap();
    assert_eq!(forked_msgs.len(), 2, "в форкнутом чате должно быть ровно 2 первых сообщения");
    assert_eq!(forked_msgs[0]["content"], "Сообщение 1");
    assert_eq!(forked_msgs[1]["content"], "Сообщение 2 (точка форка)");
}

#[tokio::test]
async fn test_get_chat_tree_hierarchical_relationships() {
    let db = create_test_db().await;
    seed_project(&db, "p_tree", "Tree Chat Project").await;

    // Создаём родительский и дочерний чат
    db.query("CREATE chats:root_chat SET project_id = type::record('projects:p_tree'), title = 'Корень', created_at = time::now()").await.unwrap();
    db.query("CREATE chats:sub_chat SET project_id = type::record('projects:p_tree'), title = 'Подчат', created_at = time::now()").await.unwrap();

    // Связываем через ребро contains
    db.query("RELATE chats:root_chat -> contains -> chats:sub_chat SET sort_order = 1").await.unwrap();

    let tree = get_chat_tree_impl(&db, "p_tree").await.expect("get_chat_tree should succeed");
    assert_eq!(tree.len(), 2);

    let sub = tree.iter().find(|c| c["title"] == "Подчат").unwrap();
    assert_eq!(sub["parent_chat_id"], "chats:root_chat");
    assert_eq!(sub["sort_order"], 1);
}
