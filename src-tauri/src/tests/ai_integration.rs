//! Интеграционные тесты AI-агента и инструментов соавтора (`WorldWikiTools`).
//!
//! Тестируют:
//! - Формирование системного промпта (`build_system_prompt`)
//! - Реконструкцию истории диалога по дереву `parent_id` (`history_to_input_messages`)
//! - Выполнение инструментов агента (`WorldWikiTools`): `search_entities`, `get_entity`,
//!   `get_chapters_list`, `get_chapter`, `create_entity`, `create_relation`, `rag_search`

use crate::logic::ai::agent::prompt::{build_system_prompt, history_to_input_messages};
use crate::logic::ai::tools::WorldWikiTools;
use crate::logic::entities::save_entity_inner;
use crate::logic::models::Entity;
use serde_json::json;
use super::common::{create_test_db, seed_chapter, seed_project};

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

    let tools = WorldWikiTools {
        db: db.clone(),
        project_id: "projects:p_ai".into(),
    };

    // 1. Поиск сущности через search_entities
    let search_res_str = tools
        .run("search_entities", &json!({ "query": "Мерлин" }))
        .await
        .expect("search_entities tool should execute");
    let search_res: serde_json::Value = serde_json::from_str(&search_res_str).unwrap();
    let arr = search_res["entities"].as_array().expect("must return entities array");
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["name"], "Мерлин");

    // 2. Получение сущности по ID через get_entity
    let entity_id = saved.id.unwrap();
    let get_res_str = tools
        .run("get_entity", &json!({ "id": entity_id }))
        .await
        .expect("get_entity tool should execute");
    let get_res: serde_json::Value = serde_json::from_str(&get_res_str).unwrap();
    assert_eq!(get_res["entity"]["name"], "Мерлин");
    assert_eq!(get_res["entity"]["description"], "Великий волшебник");
}

#[tokio::test]
async fn test_ai_tools_chapters_list_and_get_chapter() {
    let db = create_test_db().await;
    seed_project(&db, "p_ai", "AI World").await;
    let chap_id = seed_chapter(&db, "p_ai", "ch_intro", "Введение в историю", "В начале была пустота.").await;

    let tools = WorldWikiTools {
        db: db.clone(),
        project_id: "projects:p_ai".into(),
    };

    // 1. Получение списка глав через get_chapters_list (возвращает текстовое оглавление)
    let list_str = tools
        .run("get_chapters_list", &json!({}))
        .await
        .expect("get_chapters_list tool should execute");
    assert!(list_str.contains("Введение в историю"));

    // 2. Наполнение текстовыми блоками и чтение через get_chapter
    use crate::logic::chapters::save_text_blocks_inner;
    save_text_blocks_inner(&db, "p_ai", &chap_id, "<p data-semantic-tag=\"desc\">В начале была пустота.</p>").await.unwrap();

    let chap_str = tools
        .run("get_chapter", &json!({ "id": chap_id }))
        .await
        .expect("get_chapter tool should execute");
    let chap_val: serde_json::Value = serde_json::from_str(&chap_str).unwrap();
    assert_eq!(chap_val["chapter"]["title"], "Введение в историю");
    assert!(chap_val["chapter"]["compiled_text"].as_str().unwrap().contains("В начале была пустота."));
}

#[tokio::test]
async fn test_ai_tools_create_entity_and_relation() {
    let db = create_test_db().await;
    seed_project(&db, "p_ai", "AI World").await;

    let tools = WorldWikiTools {
        db: db.clone(),
        project_id: "projects:p_ai".into(),
    };

    // 1. Создание персонажа через create_entity
    let create_str = tools
        .run("create_entity", &json!({
            "type_key": "character",
            "data": {
                "name": "Артур",
                "description": "Будущий король"
            }
        }))
        .await
        .expect("create_entity tool should execute");
    let created_val: serde_json::Value = serde_json::from_str(&create_str).unwrap();
    assert_eq!(created_val["status"], "success");
    let arthur_id = created_val["entity"]["id"].as_str().unwrap().to_string();

    // Создаём второго персонажа
    let create2_str = tools
        .run("create_entity", &json!({
            "type_key": "character",
            "data": {
                "name": "Гвиневра",
                "description": "Королева"
            }
        }))
        .await
        .unwrap();
    let guin_id = serde_json::from_str::<serde_json::Value>(&create2_str).unwrap()["entity"]["id"].as_str().unwrap().to_string();

    // 2. Создание связи между ними через create_relation
    let rel_str = tools
        .run("create_relation", &json!({
            "from": arthur_id,
            "to": guin_id,
            "rel_type": "loves"
        }))
        .await
        .expect("create_relation tool should execute");
    let rel_val: serde_json::Value = serde_json::from_str(&rel_str).unwrap();
    assert_eq!(rel_val["status"], "success");
}

#[tokio::test]
async fn test_ai_tools_rag_search() {
    let db = create_test_db().await;
    seed_project(&db, "p_ai", "AI World").await;
    seed_chapter(&db, "p_ai", "ch_rag", "Поход за Граалем", "").await;

    save_entity_inner(&db, "p_ai", Entity {
        id: None,
        project_id: Some("projects:p_ai".into()),
        entity_type: "artifact".into(),
        name: "Священный Грааль".into(),
        description: Some("Реликвия невероятной силы".into()),
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    let tools = WorldWikiTools {
        db: db.clone(),
        project_id: "projects:p_ai".into(),
    };

    let search_res_str = tools
        .run("rag_search", &json!({ "query": "грааль", "top_k": 5 }))
        .await
        .expect("rag_search tool should execute");

    let search_val: serde_json::Value = serde_json::from_str(&search_res_str).unwrap();
    let results = search_val["matches"].as_array().expect("must return matches array");
    assert!(!results.is_empty(), "должен найти Грааль");
}

#[tokio::test]
async fn test_ai_tools_unknown_tool_error() {
    let db = create_test_db().await;
    seed_project(&db, "p_ai", "AI World").await;

    let tools = WorldWikiTools {
        db: db.clone(),
        project_id: "projects:p_ai".into(),
    };

    let res = tools.run("non_existent_tool", &json!({})).await;
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("unknown tool"));
}
