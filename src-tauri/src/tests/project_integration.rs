//! Интеграционные тесты жизненного цикла проекта и каскадного DDL-удаления.
//!
//! Тестируют:
//! - CRUD проектов (`create_project`, `get_projects`, `get_project_config`, `save_project_config`)
//! - Каскадную очистку всех связанных таблиц (`volumes`, `chapters`, `entities`, `text_blocks` и т.д.)
//!   через событие БД `delete_project_data` при вызове `delete_project`.

use crate::logic::chapters::save_text_blocks_inner;
use crate::logic::entities::save_entity_inner;
use crate::logic::models::Entity;
use crate::logic::projects::*;
use crate::logic::volumes::create_volume_inner;
use serde_json::json;
use super::common::{create_test_db, seed_chapter, seed_project};

#[tokio::test]
async fn create_and_get_projects() {
    let db = create_test_db().await;

    create_project_inner(&db, json!({
        "name": "project_alpha",
        "type": "book",
        "data": { "title": "Альфа Мир" }
    })).await.expect("create alpha");

    create_project_inner(&db, json!({
        "name": "project_beta",
        "type": "game",
        "data": { "title": "Бета Мир" }
    })).await.expect("create beta");

    let projects = get_projects_inner(&db).await.expect("get projects");
    assert!(projects.len() >= 2);

    let names: Vec<&str> = projects.iter().filter_map(|p| p["name"].as_str()).collect();
    assert!(names.contains(&"project_alpha"));
    assert!(names.contains(&"project_beta"));
}

#[tokio::test]
async fn project_config_get_and_save() {
    let db = create_test_db().await;
    seed_project(&db, "cfg_proj", "Config Test").await;

    // Сохраняем кастомный конфиг внутри data (FLEXIBLE)
    let cfg = json!({
        "data": {
            "theme": "dark",
            "default_font": "Inter",
            "author": "Архитектор Миров"
        }
    });
    save_project_config_inner(&db, "cfg_proj", cfg).await.expect("save config");

    // Получаем конфиг
    let fetched = get_project_config_inner(&db, "cfg_proj").await.expect("get config");
    assert_eq!(fetched["data"]["theme"], "dark");
    assert_eq!(fetched["data"]["default_font"], "Inter");
    assert_eq!(fetched["data"]["author"], "Архитектор Миров");
}

#[tokio::test]
async fn delete_project_cascades_ddl_events() {
    let db = create_test_db().await;
    seed_project(&db, "cascade_proj", "Cascade Test").await;

    // Наполняем проект:
    // 1. Том
    create_volume_inner(&db, "cascade_proj", "Том 1").await.unwrap();

    // 2. Глава + текстовые блоки
    seed_chapter(&db, "cascade_proj", "ch_casc", "Глава каскада", "").await;
    save_text_blocks_inner(&db, "cascade_proj", "ch_casc", "<p data-semantic-tag=\"desc\">Текст для удаления</p>").await.unwrap();

    // 3. Сущность
    save_entity_inner(&db, "cascade_proj", Entity {
        id: None,
        project_id: Some("projects:cascade_proj".into()),
        entity_type: "character".into(),
        name: "Герой Каскада".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    // Удаляем проект
    delete_project_inner(&db, "cascade_proj").await.expect("delete project");

    // Проверяем, что сам проект удалён
    let p_res = get_project_config_inner(&db, "cascade_proj").await.unwrap();
    assert!(p_res.get("title").is_none(), "проект должен быть удален");

    // Проверяем, что DDL event `delete_project_data` удалил тома
    let mut v_res = db.query("SELECT * FROM volumes WHERE project_id = type::record('projects:cascade_proj')").await.unwrap();
    let volumes: Vec<serde_json::Value> = v_res.take(0).unwrap();
    assert!(volumes.is_empty(), "все тома проекта должны удалиться");

    // Проверяем, что главы удалены
    let mut c_res = db.query("SELECT * FROM chapters WHERE project_id = type::record('projects:cascade_proj')").await.unwrap();
    let chapters: Vec<serde_json::Value> = c_res.take(0).unwrap();
    assert!(chapters.is_empty(), "все главы проекта должны удалиться");

    // Проверяем, что сущности удалены
    let mut e_res = db.query("SELECT * FROM entities WHERE project_id = type::record('projects:cascade_proj')").await.unwrap();
    let entities: Vec<serde_json::Value> = e_res.take(0).unwrap();
    assert!(entities.is_empty(), "все сущности проекта должны удалиться");

    // Проверяем, что текстовые блоки удалены
    let mut tb_res = db.query("SELECT * FROM text_blocks WHERE project_id = type::record('projects:cascade_proj')").await.unwrap();
    let t_blocks: Vec<serde_json::Value> = tb_res.take(0).unwrap();
    assert!(t_blocks.is_empty(), "все текстовые блоки проекта должны удалиться");
}
