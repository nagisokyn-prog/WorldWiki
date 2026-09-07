//! Интеграционные тесты 8 консолидированных AI-фасадов (`worldwiki-application/src/ai/tools.rs`).
//!
//! Покрывают методы `AiToolFacades`:
//! - `query_world` — семантический и гибридный поиск по базе знаний;
//! - `inspect_entity` — получение полной карточки сущности с матрицей связей;
//! - `manage_entity` — создание, связывание, обновление и удаление сущностей;
//! - `read_manuscript` — чтение рукописи и контента глав;
//! - `edit_manuscript` — атомарный воркфлоу редактирования текста, планов и ружей;
//! - `timeline_manager` — конвертация абсолютного времени $M_{\text{abs}}$;
//! - `audit_consistency` — проверка согласованности лора.

use std::sync::Arc;
use serde_json::json;
use worldwiki_application::workflows::EditManuscriptRequest;
use super::common::{create_test_db, create_test_services, seed_chapter, seed_project};

#[tokio::test]
async fn test_facade_inspect_and_manage_entity() {
    let db = create_test_db().await;
    seed_project(&db, "p_facade", "Facade Project").await;
    let services = create_test_services(Arc::new(db.clone()));

    // 1. Создание сущности через manage_entity
    let create_res = services
        .ai_tools
        .manage_entity("create", json!({
            "id": "entities:hero_1",
            "project_id": "projects:p_facade",
            "entity_type": "character",
            "name": "Арагорн",
            "description": "Следопыт Севера",
            "attributes": { "level": 50 },
            "tags": ["дунадан"]
        }))
        .await
        .expect("manage_entity create should succeed");

    assert_eq!(create_res["status"], "success");

    // 2. Инспекция карточки сущности
    let card = services
        .ai_tools
        .inspect_entity("projects:p_facade", "entities:hero_1")
        .await
        .expect("inspect_entity should succeed");

    assert_eq!(card["entity"]["name"], "Арагорн");
    assert_eq!(card["entity"]["description"], "Следопыт Севера");

    // 3. Создание связанной сущности и ребра
    services
        .ai_tools
        .manage_entity("create", json!({
            "id": "entities:loc_1",
            "project_id": "projects:p_facade",
            "entity_type": "location",
            "name": "Ривенделл",
            "description": "Убежище Элронда",
            "attributes": {},
            "tags": []
        }))
        .await
        .expect("manage_entity create related should succeed");

    services
        .ai_tools
        .manage_entity("relate", json!({
            "id": "entity_relations:rel_1",
            "project_id": "projects:p_facade",
            "source_id": "entities:hero_1",
            "target_id": "entities:loc_1",
            "relation_type": "located_at",
            "role": "visitor"
        }))
        .await
        .expect("manage_entity relate should succeed");

    // 4. Удаление сущности
    let del_res = services
        .ai_tools
        .manage_entity("delete", json!("entities:hero_1"))
        .await
        .expect("manage_entity delete should succeed");

    assert_eq!(del_res["status"], "success");
}

#[tokio::test]
async fn test_facade_read_and_edit_manuscript() {
    let db = create_test_db().await;
    seed_project(&db, "p_ms", "Manuscript Project").await;
    let chap_id = seed_chapter(&db, "p_ms", "ch_1", "Глава 1: Начало", "Текст первой главы.").await;
    let services = create_test_services(Arc::new(db.clone()));

    // Чтение через read_manuscript
    let read_res = services
        .ai_tools
        .read_manuscript("p_ms", &chap_id)
        .await
        .expect("read_manuscript should succeed");

    assert_eq!(read_res["title"], "Глава 1: Начало");

    // Атомарное редактирование через edit_manuscript
    let edit_req = EditManuscriptRequest {
        chapter_id: chap_id.clone(),
        content_patch: "Обновленный текст главы соавтором.".to_string(),
        planted_promises: vec![],
        resolved_promise_ids: vec![],
        completed_plan_ids: vec![],
    };

    let edit_res = services
        .ai_tools
        .edit_manuscript(edit_req)
        .await
        .expect("edit_manuscript should succeed");

    assert_eq!(edit_res.chapter_id, chap_id);

    // Проверяем обновленный контент
    let verify_read = services.ai_tools.read_manuscript("p_ms", &chap_id).await.unwrap();
    assert_eq!(verify_read["content"], "Обновленный текст главы соавтором.");
}

#[tokio::test]
async fn test_facade_query_world_and_timeline() {
    let db = create_test_db().await;
    seed_project(&db, "p_qw", "Query World Project").await;
    seed_chapter(&db, "p_qw", "ch_lore", "Тайны древних", "Древний артефакт был скрыт в пещере.").await;
    let services = create_test_services(Arc::new(db.clone()));

    // 1. Поиск по миру
    let query_res = services
        .ai_tools
        .query_world("p_qw", "артефакт", "all", 5)
        .await
        .expect("query_world should succeed");

    assert!(!query_res.is_empty());

    // 2. Timeline manager
    let cal_payload = json!({
        "id": "calendars:main",
        "name": "Основной календарь",
        "hours_per_day": 24,
        "minutes_per_hour": 60,
        "seconds_per_minute": 60,
        "days_per_year": 365,
        "months": [
            { "name": "Январь", "days": 31, "leap_days": 31 },
            { "name": "Февраль", "days": 28, "leap_days": 29 }
        ],
        "weekdays": [{ "name": "Понедельник" }],
        "eras": [{ "name": "Эпоха Солнца", "start_year": 1, "is_count_down": false }]
    });

    let timeline_res = services
        .ai_tools
        .timeline_manager("convert_absolute", json!({
            "minute": 1440,
            "calendar": cal_payload,
            "era_index": 0
        }))
        .await
        .expect("timeline_manager convert_absolute should succeed");

    assert!(timeline_res.get("formatted").is_some());
}

#[tokio::test]
async fn test_facade_unsupported_action_returns_error() {
    let db = create_test_db().await;
    seed_project(&db, "p_err", "Error Project").await;
    let services = create_test_services(Arc::new(db.clone()));

    let res = services
        .ai_tools
        .manage_entity("invalid_action", json!({}))
        .await;

    assert!(res.is_err());
}