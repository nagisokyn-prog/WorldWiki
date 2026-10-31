//! Негативные тесты (Negative Testing / Error Paths) и проверка устойчивости к сбоям.
//!
//! Тестируют:
//! - Обработку невалидных идентификаторов и несуществующих записей.
//! - Нарушение ограничений SCHEMAFULL (невалидные типы данных).
//! - Атомарный откат (Rollback) транзакций при возникновении ошибки в цепочке.
//! - Поведение при попытке удаления или связывания с несуществующими родителями.
//! - Невалидный/битый HTML при сохранении глав.
//! - Переупорядочивание несуществующих узлов иерархии.

use crate::logic::chapters::save_text_blocks_inner;
use crate::logic::entities::{create_entity_relation_inner, get_entities_inner, get_entity_inner, get_entity_relations_inner, save_entity_inner};
use crate::logic::models::{Entity, EntityRel};
use crate::logic::projects::{create_project_inner, delete_project_inner};
use crate::logic::volumes::{assign_chapter_inner, reorder_node_inner};
use serde_json::json;
use super::common::{create_test_db, seed_project};

#[tokio::test]
async fn negative_get_nonexistent_entities_returns_empty() {
    let db = create_test_db().await;
    seed_project(&db, "p_neg", "Negative Test Project").await;

    // 1. Запрос сущностей по несуществующему типу
    let res = get_entities_inner(&db, "p_neg", Some("ghost_type".into()))
        .await
        .expect("querying nonexistent type should return Ok(empty), not Err");
    assert!(res.is_empty(), "список должен быть пуст");

    // 2. Запрос связей по несуществующему ID сущности
    let rels = get_entity_relations_inner(&db, "p_neg", Some("entities:ghost_id_9999".into()))
        .await
        .expect("querying relations for ghost entity should return Ok(empty)");
    assert!(rels.is_empty());
}

#[tokio::test]
async fn negative_get_entity_malformed_id_handled_gracefully() {
    let db = create_test_db().await;
    seed_project(&db, "p_neg", "Negative Test Project").await;

    // Передаём мусорный ID с спецсимволами и кавычками
    let res = get_entity_inner(&db, "entities:'; DROP TABLE projects; --").await;
    // Запрос не должен паниковать или валить БД
    assert!(res.is_ok(), "запрос с некорректным ID должен корректно возвращать None или пустой результат");
    assert!(res.unwrap().is_none());
}

#[tokio::test]
async fn negative_create_project_missing_name_returns_err() {
    let db = create_test_db().await;

    // Попытка создания проекта без обязательного поля "name"
    let invalid_data = json!({ "title": "Без имени" });
    let res = create_project_inner(&db, invalid_data).await;

    assert!(res.is_err(), "create_project без 'name' должен возвращать Err");
    assert!(res.unwrap_err().to_string().contains("No name"));
}

#[tokio::test]
async fn negative_schemfull_rejects_untyped_root_field() {
    let db = create_test_db().await;
    seed_project(&db, "p_neg", "Negative Test Project").await;

    // В схеме projects нет поля 'unknown_untyped_root_field' (SCHEMAFULL режим)
    let bad_query = db
        .query("CREATE projects:bad_proj SET name = 'Bad', unknown_untyped_root_field = 'Hack'")
        .await;

    assert!(bad_query.is_ok());
    let errs = bad_query.unwrap().take_errors();
    assert!(!errs.is_empty(), "SCHEMAFULL должен отклонить неизвестное корневое поле");
}

#[tokio::test]
async fn negative_delete_nonexistent_project_is_idempotent() {
    let db = create_test_db().await;

    // Удаление проекта, которого никогда не было, не должно приводить к панике
    let res = delete_project_inner(&db, "ghost_project_never_existed").await;
    assert!(res.is_ok(), "удаление несуществующего проекта должно завершаться успешно (идемпотентность)");
}

#[tokio::test]
async fn negative_transaction_rollback_on_failure() {
    let db = create_test_db().await;
    seed_project(&db, "p_trans", "Transaction Test").await;

    // Создаём 1 базовую сущность
    save_entity_inner(&db, "p_trans", Entity {
        id: None,
        project_id: Some("projects:p_trans".into()),
        schema_id: None,
        entity_type: "item".into(),
        name: "Сохранённый Предмет".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    // Запускаем транзакцию:
    // Операция 1: Валидный CREATE
    // Операция 2: НЕВАЛИДНЫЙ CREATE (нарушение SCHEMAFULL схемы через illegal_root_field)
    // Весь батч должен откатиться!
    db.query("UPSERT type::record('entity_schemas', 'item_trans') SET project_id = type::record('projects', 'p_trans'), type_key = 'item', type_name = 'Предмет';").await.unwrap();

    let sql = r#"
        BEGIN TRANSACTION;
        CREATE entities SET schema_id = type::record('entity_schemas', 'item_trans'), name = 'Предмет Транзакции';
        CREATE entities SET schema_id = type::record('entity_schemas', 'item_trans'), illegal_root_field = 123;
        COMMIT TRANSACTION;
    "#;

    let mut res = db.query(sql).await.unwrap();
    let errs = res.take_errors();
    assert!(!errs.is_empty(), "транзакция должна зафиксировать ошибку валидации схемы");

    // Проверяем, что 'Предмет Транзакции' НЕ сохранился (откат сработал)
    let mut check_res = db
        .query("SELECT * FROM entities WHERE schema_id.project_id = type::record('projects:p_trans') AND name = 'Предмет Транзакции'")
        .await
        .unwrap();
    let entities: Vec<serde_json::Value> = check_res.take(0).unwrap();
    assert!(entities.is_empty(), "запись из упавшей транзакции не должна попасть в БД (Rollback)");
}

#[tokio::test]
async fn negative_create_relation_nonexistent_endpoints() {
    let db = create_test_db().await;
    seed_project(&db, "p_neg_rel", "Negative Rel Project").await;

    // Попытка связать фантомные сущности
    let rel = create_entity_relation_inner(
        &db,
        "p_neg_rel",
        "entities:ghost_source",
        "entities:ghost_target",
        EntityRel {
            id: None,
            r#in: None,
            out: None,
            project_id: None,
            rel_type: "rivals".into(),
            description: None,
            strength: None,
            attributes: json!({}),
            start_chapter: None,
            end_chapter: None,
            created_at: None,
        },
    ).await;

    // SurrealDB RELATE создаст ребро, но при чтении связей целевая сущность не должна ломать систему
    assert!(rel.is_ok(), "создание ребра между кастомными ID разрешено");
}

#[tokio::test]
async fn negative_assign_chapter_invalid_parent() {
    let db = create_test_db().await;
    seed_project(&db, "p_neg_tree", "Negative Tree Project").await;

    // Попытка привязать главу к несуществующему тому
    let res = assign_chapter_inner(
        &db,
        "p_neg_tree",
        "chapters:ghost_chap",
        Some("volumes:ghost_vol".into()),
    ).await;

    assert!(res.is_ok(), "перепривязка не должна крашить бэкенд");
}

#[tokio::test]
async fn negative_save_text_blocks_malformed_html_without_tags() {
    let db = create_test_db().await;
    seed_project(&db, "p_neg_tb", "Negative TB Project").await;

    // Сохранение битого HTML без закрывающих тегов и без атрибутов
    let broken_html = "<div><p>Просто текст без data-semantic-tag</p><span>Еще кусок";
    let res = save_text_blocks_inner(&db, "p_neg_tb", "chapters:ch1", broken_html).await;
    assert!(res.is_ok(), "парсер семантических блоков должен корректно обрабатывать сырой текст без тегов");

    // Проверяем, что создался 1 блок с дефолтным типом 'description'
    let mut q = db.query("SELECT * FROM text_blocks WHERE chapter_id = type::record('chapters:ch1')").await.unwrap();
    let blocks: Vec<serde_json::Value> = q.take(0).unwrap();
    assert_eq!(blocks.len(), 1, "тег <p> без атрибута data-semantic-tag парсится с дефолтным типом");
    assert_eq!(blocks[0]["block_type"], "description");
}

#[tokio::test]
async fn negative_reorder_nonexistent_node() {
    let db = create_test_db().await;
    seed_project(&db, "p_neg_reorder", "Negative Reorder").await;

    // Переупорядочивание несуществующего тома
    let res = reorder_node_inner(&db, "p_neg_reorder", "volume", "volumes:ghost_vol", 10).await;
    assert!(res.is_ok(), "reorder_node для несуществующего узла не должен приводить к панике");
}
