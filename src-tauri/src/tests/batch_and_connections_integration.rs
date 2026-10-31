//! Интеграционные тесты пакетных операций (`batch.rs`) и графа связей (`connections.rs`).
//!
//! Тестируют:
//! - Выборку нескольких категорий сущностей за 1 запрос (`get_entities_batch`).
//! - Атомарное сохранение сущности с каскадным обновлением связанных записей (`save_entity_with_relations`).
//! - Пакетное обновление графовых ребер `entity_rel` (`upsert_connections_batch`).
//! - Форматирование графа для UI канваса с фильтрацией по главам (`get_connections`).
//! - Точечное удаление исходящих связей источника (`remove_connections_by_source`).

use serde_json::json;
use crate::logic::batch::{get_entities_batch_inner, save_entity_with_relations_inner, upsert_connections_batch_inner};
use crate::logic::connections::{get_connections_inner, remove_connections_by_source_inner, save_connections_inner};
use crate::logic::entities::save_entity_inner;
use crate::logic::models::EntityRel;
use super::common::{create_test_db, fixture_entity, seed_project};

#[tokio::test]
async fn test_get_entities_batch_by_types() {
    let db = create_test_db().await;
    seed_project(&db, "p_batch", "Batch Project").await;

    // Создаём 2 персонажа и 1 локацию
    save_entity_inner(&db, "p_batch", fixture_entity!("p_batch", "Герой 1")).await.unwrap();
    save_entity_inner(&db, "p_batch", fixture_entity!("p_batch", "Герой 2")).await.unwrap();
    save_entity_inner(&db, "p_batch", fixture_entity!("p_batch", "location", "Замок Ветров")).await.unwrap();

    let res = get_entities_batch_inner(&db, "p_batch", vec!["character".into(), "location".into(), "item".into()])
        .await
        .expect("get_entities_batch should succeed");

    let characters = res.get("character").unwrap().as_array().unwrap();
    let locations = res.get("location").unwrap().as_array().unwrap();
    let items = res.get("item").unwrap().as_array().unwrap();

    assert_eq!(characters.len(), 2);
    assert_eq!(locations.len(), 1);
    assert_eq!(items.len(), 0, "несуществующий тип возвращает пустой массив");
}

#[tokio::test]
async fn test_save_entity_with_relations_transactional() {
    let db = create_test_db().await;
    seed_project(&db, "p_batch2", "Batch Project 2").await;

    // Создаём зависимую сущность
    let foreign = save_entity_inner(
        &db,
        "p_batch2",
        fixture_entity!("p_batch2", "item", "Старый Меч", json!({ "durability": 10 })),
    ).await.unwrap();

    let mut foreign_updated = foreign.clone();
    foreign_updated.name = "Зачарованный Меч".into();
    foreign_updated.attributes = json!({ "durability": 100 });

    let main_entity = fixture_entity!(
        "p_batch2",
        "character",
        "Кузнец Артур",
        json!({}),
        vec!["blacksmith".into()],
        Some("Мастер зачарований".into())
    );

    let saved_main = save_entity_with_relations_inner(
        &db,
        "p_batch2",
        main_entity,
        vec![foreign_updated],
    ).await.expect("save_entity_with_relations should succeed");

    assert_eq!(saved_main.name, "Кузнец Артур");

    // Проверяем, что зависимая сущность обновилась атомарно
    let mut check_f = db.query("SELECT * FROM type::record($id)")
        .bind(("id", foreign.id.unwrap()))
        .await
        .unwrap();
    let f_rows: Vec<serde_json::Value> = check_f.take(0).unwrap();
    assert_eq!(f_rows[0]["name"], "Зачарованный Меч");
    assert_eq!(f_rows[0]["attributes"]["durability"], 100);
}

#[tokio::test]
async fn test_upsert_connections_batch_and_get_connections() {
    let db = create_test_db().await;
    seed_project(&db, "p_conn", "Connections Project").await;

    let e1 = save_entity_inner(&db, "p_conn", fixture_entity!("p_conn", "Алиса")).await.unwrap();
    let e1_id = e1.id.unwrap();

    let e2 = save_entity_inner(&db, "p_conn", fixture_entity!("p_conn", "Боб")).await.unwrap();
    let e2_id = e2.id.unwrap();

    // 1. Создаём связь через upsert_connections_batch
    upsert_connections_batch_inner(
        &db,
        "p_conn",
        "character",
        &e1_id,
        vec![EntityRel {
            id: None,
            r#in: Some(e1_id.clone()),
            out: Some(e2_id.clone()),
            project_id: None,
            rel_type: "friends".into(),
            description: Some("Друзья с детства".into()),
            strength: Some(8),
            attributes: json!({}),
            start_chapter: Some("chapters:ch1".into()),
            end_chapter: Some("chapters:ch5".into()),
            created_at: None,
        }],
    ).await.expect("upsert_connections_batch should succeed");

    // 2. Читаем через get_connections (проверяем UI форматирование source и target)
    let connections_val = get_connections_inner(&db, "p_conn", None).await.unwrap();
    let connections_arr = connections_val.as_array().unwrap();
    assert_eq!(connections_arr.len(), 1);
    assert_eq!(connections_arr[0]["rel_type"], "friends");
    assert_eq!(connections_arr[0]["source"]["entityType"], "entities");
    assert_eq!(connections_arr[0]["target"]["entityType"], "entities");

    // 3. Фильтрация по главе
    let in_ch1 = get_connections_inner(&db, "p_conn", Some("chapters:ch1".into())).await.unwrap();
    assert_eq!(in_ch1.as_array().unwrap().len(), 1);

    let in_ch99 = get_connections_inner(&db, "p_conn", Some("chapters:ch99".into())).await.unwrap();
    assert_eq!(in_ch99.as_array().unwrap().len(), 0);

    // 4. Удаление связей источника
    let deleted_count = remove_connections_by_source_inner(&db, "p_conn", "character", &e1_id).await.unwrap();
    assert_eq!(deleted_count, 1);

    let after_delete = get_connections_inner(&db, "p_conn", None).await.unwrap();
    assert_eq!(after_delete.as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn test_save_connections_creates_and_replaces_edges() {
    let db = create_test_db().await;
    seed_project(&db, "p_saveconn", "SaveConn Project").await;

    let e1 = save_entity_inner(&db, "p_saveconn", fixture_entity!("p_saveconn", "Алиса")).await.unwrap();
    let e1_id = e1.id.unwrap();

    let e2 = save_entity_inner(&db, "p_saveconn", fixture_entity!("p_saveconn", "Боб")).await.unwrap();
    let e2_id = e2.id.unwrap();

    // Фронтовый контракт save_connections: source/target с entityId
    let data = json!([{
        "source": { "entityId": e1_id },
        "target": { "entityId": e2_id },
        "role": "friends",
        "description": "Друзья с детства",
        "period": { "start_chapter": "chapters:ch1", "end_chapter": "chapters:ch2" }
    }]);

    save_connections_inner(&db, "p_saveconn", &e1_id, data)
        .await
        .expect("save_connections should succeed");

    let conns = get_connections_inner(&db, "p_saveconn", None).await.unwrap();
    let arr = conns.as_array().unwrap();
    assert_eq!(arr.len(), 1, "должна появиться 1 связь");
    assert_eq!(arr[0]["rel_type"], "friends");
    assert_eq!(arr[0]["description"], "Друзья с детства");

    // Повторное сохранение с пустым массивом удаляет все связи источника И цели
    save_connections_inner(&db, "p_saveconn", &e1_id, json!([]))
        .await
        .expect("clearing connections should succeed");

    let after = get_connections_inner(&db, "p_saveconn", None).await.unwrap();
    assert_eq!(after.as_array().unwrap().len(), 0, "все связи должны удалиться");
}

#[tokio::test]
async fn test_save_connections_rejects_non_array() {
    let db = create_test_db().await;
    seed_project(&db, "p_saveconn2", "SaveConn Project 2").await;

    // data не массив — функция должна вернуть Err
    let res = save_connections_inner(&db, "p_saveconn2", "entities:e1", json!({ "nope": true })).await;
    assert!(res.is_err(), "не-массив должен вернуть Err");
    assert!(res.unwrap_err().to_string().contains("Connections array expected"));
}

#[tokio::test]
async fn test_get_entities_batch_empty_types_returns_empty_map() {
    let db = create_test_db().await;
    seed_project(&db, "p_batch_empty", "Batch Empty").await;

    // Пустой список типов — ранний возврат пустой map, без запроса к БД
    let res = get_entities_batch_inner(&db, "p_batch_empty", vec![])
        .await
        .expect("empty types should return Ok");
    assert!(res.is_empty(), "пустой список типов → пустая map");
}
