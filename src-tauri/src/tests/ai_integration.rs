//! Интеграционные тесты AI-агента и консолидированных фасадов инструментов (`AiToolFacades`).
//!
//! Тестируют:
//! - Формирование системного промпта (`build_system_prompt`)
//! - Реконструкцию истории диалога по дереву `parent_id` (`history_to_input_messages`)
//! - Выполнение инструментов агента через `AiToolFacades`: `inspect_entity`, `manage_entity`,
//!   `read_manuscript`, `query_world`

use std::sync::Arc;
use serde_json::json;
use worldwiki_application::ai::prompt::{build_system_prompt, history_to_input_messages};
use crate::logic::entities::save_entity_inner;
use crate::logic::models::Entity;
use super::common::{create_test_db, create_test_services, seed_chapter, seed_project};

#[test]
fn test_build_system_prompt_structure() {
    let prompt = build_system_prompt(
        "Ты — летописец древней империи.",
        "Всегда упоминай текущий год от сотворения мира.",
        "projects:empire_1",
    );

    assert!(prompt.contains("Ты — летописец древней империи."));
    assert!(prompt.contains("ГЛОБАЛЬНЫЕ ПРАВИЛА СОАВТОРА WORLDWIKI"));
    assert!(prompt.contains("LORE LOCK"));
    assert!(prompt.contains("Проект: projects:empire_1"));
    assert!(prompt.contains("Всегда упоминай текущий год от сотворения мира."));
}

#[test]
fn test_history_to_input_messages_reconstructs_branch() {
    // Дерево сообщений:
    // msg1 (user) -> msg2 (assistant) -> msg3 (user, ветка А) -> msg4 (assistant, ветка А)
    //                                  -> msg5 (user, ветка Б)
    let history = vec![
        json!({ "id": "msg1", "parent_id": null, "role": "user", "content": "Привет" }),
        json!({ "id": "msg2", "parent_id": "msg1", "role": "assistant", "content": "Привет! Чем помочь?" }),
        json!({ "id": "msg3", "parent_id": "msg2", "role": "user", "content": "Ветка А" }),
        json!({ "id": "msg4", "parent_id": "msg3", "role": "assistant", "content": "Ответ в ветке А" }),
        json!({ "id": "msg5", "parent_id": "msg2", "role": "user", "content": "Ветка Б" }),
    ];

    // Запрашиваем цепочку для msg4 (ветка А)
    let input_msgs = history_to_input_messages(&history, "msg4");
    assert_eq!(input_msgs.len(), 4, "должны быть msg1, msg2, msg3, msg4");

    // Запрашиваем цепочку для msg5 (ветка Б)
    let input_msgs_b = history_to_input_messages(&history, "msg5");
    assert_eq!(input_msgs_b.len(), 3, "должны быть msg1, msg2, msg5");
}

#[tokio::test]
async fn test_ai_tools_search_and_get_entity() {
    let db = create_test_db().await;
    seed_project(&db, "p_ai", "AI World").await;
    let services = create_test_services(Arc::new(db.clone()));

    let saved = save_entity_inner(&db, "p_ai", Entity {
        id: None,
        project_id: Some("projects:p_ai".into()),
        entity_type: "character".into(),
        name: "Мерлин".into(),
        description: Some("Великий волшебник".into()),
        attributes: json!({ "power": 99 }),
        tags: vec!["маг".into()],
        embeddings: None,
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    let entity_id = saved.id.unwrap();

    // 1. Получение сущности по ID через inspect_entity
    let card = services
        .ai_tools
        .inspect_entity("projects:p_ai", &entity_id)
        .await
        .expect("inspect_entity tool should execute");

    assert_eq!(card["entity"]["name"], "Мерлин");
    assert_eq!(card["entity"]["description"], "Великий волшебник");
}

#[tokio::test]
async fn test_ai_tools_chapters_list_and_get_chapter() {
    let db = create_test_db().await;
    seed_project(&db, "p_ai", "AI World").await;
    let chap_id = seed_chapter(&db, "p_ai", "ch_intro", "Введение в историю", "В начале была пустота.").await;
    let services = create_test_services(Arc::new(db.clone()));

    use crate::logic::chapters::save_text_blocks_inner;
    save_text_blocks_inner(&db, "p_ai", &chap_id, "<p data-semantic-tag=\"desc\">В начале была пустота.</p>").await.unwrap();

    // Чтение через read_manuscript
    let chap_val = services
        .ai_tools
        .read_manuscript("p_ai", &chap_id)
        .await
        .expect("read_manuscript tool should execute");

    assert_eq!(chap_val["title"], "Введение в историю");
    assert!(chap_val["content"].as_str().unwrap().contains("В начале была пустота."));
}

#[tokio::test]
async fn test_ai_tools_create_entity_and_relation() {
    let db = create_test_db().await;
    seed_project(&db, "p_ai", "AI World").await;
    let services = create_test_services(Arc::new(db.clone()));

    // 1. Создание персонажа через manage_entity
    let create_res = services
        .ai_tools
        .manage_entity("create", json!({
            "id": "entities:arthur",
            "project_id": "projects:p_ai",
            "entity_type": "character",
            "name": "Артур",
            "description": "Будущий король",
            "attributes": {},
            "tags": []
        }))
        .await
        .expect("manage_entity create should execute");

    assert_eq!(create_res["status"], "created");

    // Создаём второго персонажа
    let create2_res = services
        .ai_tools
        .manage_entity("create", json!({
            "id": "entities:guinevere",
            "project_id": "projects:p_ai",
            "entity_type": "character",
            "name": "Гвиневра",
            "description": "Королева",
            "attributes": {},
            "tags": []
        }))
        .await
        .expect("manage_entity create should execute");

    assert_eq!(create2_res["status"], "created");

    // 2. Создание связи через manage_entity (action relate)
    let rel_res = services
        .ai_tools
        .manage_entity("relate", json!({
            "id": "entity_rel:rel_1",
            "project_id": "projects:p_ai",
            "from_entity": "entities:arthur",
            "to_entity": "entities:guinevere",
            "relation_type": "loves"
        }))
        .await
        .expect("manage_entity relate should execute");

    assert_eq!(rel_res["status"], "success");
}

#[tokio::test]
async fn test_ai_tools_query_world() {
    let db = create_test_db().await;
    seed_project(&db, "p_ai", "AI World").await;
    seed_chapter(&db, "p_ai", "ch_rag", "Поход за Граалем", "Рыцари отправились в путь.").await;
    let services = create_test_services(Arc::new(db.clone()));

    let results_all = services.ai_tools.query_world("p_ai", "", "all", 5).await.unwrap();
    if results_all.is_empty() {
        panic!("query_world returned empty even for empty query string");
    }

    // Ищем корень слова, так как "Граалем" не содержит "Грааль" (разные окончания)
    let results = services.ai_tools.query_world("p_ai", "граал", "all", 5).await.unwrap();
    assert!(!results.is_empty(), "должен найти результаты поиска");
}
