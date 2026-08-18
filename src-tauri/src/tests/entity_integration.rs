//! Интеграционные тесты сущностей, схем и связей.
//!
//! Тестируют бизнес-логику `entities.rs`:
//! - CRUD сущностей (CREATE / UPSERT)
//! - Схемы сущностей + историю версий (снапшоты в `schema_history`)
//! - Рёбра связей `entity_rel` между сущностями
//! - Каскадную очистку при удалении сущностей и схем

use crate::logic::entities::*;
use crate::logic::models::{Entity, EntityRel, EntitySchema};
use serde_json::json;
use super::common::{create_test_db, seed_project};

#[tokio::test]
async fn save_entity_create_and_get() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let new_entity = Entity {
        id: None,
        project_id: Some("projects:p1".into()),
        entity_type: "character".into(),
        name: "Алиса".into(),
        description: Some("Главная героиня".into()),
        attributes: json!({ "age": 20, "role": "протагонист" }),
        tags: vec!["маг".into(), "человек".into()],
        embeddings: None,
        created_at: None,
        updated_at: None,
    };

    let saved = save_entity_inner(&db, "p1", new_entity)
        .await
        .expect("save_entity should create entity");

    assert_eq!(saved.name, "Алиса");
    assert_eq!(saved.entity_type, "character");
    assert!(saved.id.is_some(), "saved entity must have id");

    let entity_id = saved.id.unwrap();
    let fetched = get_entity_inner(&db, &entity_id)
        .await
        .expect("get_entity should succeed")
        .expect("entity should exist");

    assert_eq!(fetched.name, "Алиса");
    assert_eq!(fetched.description, Some("Главная героиня".into()));
    assert_eq!(fetched.attributes["age"], 20);
    assert_eq!(fetched.tags, vec!["маг".to_string(), "человек".to_string()]);
}

#[tokio::test]
async fn save_entity_upsert_existing() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let e = Entity {
        id: None,
        project_id: Some("projects:p1".into()),
        entity_type: "character".into(),
        name: "Боб".into(),
        description: Some("Первое описание".into()),
        attributes: json!({ "level": 1 }),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    };

    let created = save_entity_inner(&db, "p1", e).await.unwrap();
    let id = created.id.unwrap();

    // Обновляем сущность через тот же ID
    let updated_entity = Entity {
        id: Some(id.clone()),
        project_id: Some("projects:p1".into()),
        entity_type: "character".into(),
        name: "Боб Мудрый".into(),
        description: Some("Обновленное описание".into()),
        attributes: json!({ "level": 10 }),
        tags: vec!["ветеран".into()],
        embeddings: None,
        created_at: None,
        updated_at: None,
    };

    let updated = save_entity_inner(&db, "p1", updated_entity)
        .await
        .expect("save_entity should update existing entity");

    assert_eq!(updated.name, "Боб Мудрый");
    assert_eq!(updated.description, Some("Обновленное описание".into()));

    let fetched = get_entity_inner(&db, &id).await.unwrap().unwrap();
    assert_eq!(fetched.name, "Боб Мудрый");
    assert_eq!(fetched.attributes["level"], 10);
    assert_eq!(fetched.tags, vec!["ветеран".to_string()]);
}

#[tokio::test]
async fn get_entities_scoped_and_filtered() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;
    seed_project(&db, "p2", "Project 2").await;

    // Вставляем 2 персонажа и 1 локацию в p1, и 1 персонажа в p2
    let c1 = Entity {
        id: None,
        project_id: Some("projects:p1".into()),
        entity_type: "character".into(),
        name: "Герой 1".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    };
    let c2 = Entity {
        id: None,
        project_id: Some("projects:p1".into()),
        entity_type: "character".into(),
        name: "Герой 2".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    };
    let l1 = Entity {
        id: None,
        project_id: Some("projects:p1".into()),
        entity_type: "location".into(),
        name: "Замок".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    };
    let c_p2 = Entity {
        id: None,
        project_id: Some("projects:p2".into()),
        entity_type: "character".into(),
        name: "Чужой Герой".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    };

    save_entity_inner(&db, "p1", c1).await.unwrap();
    save_entity_inner(&db, "p1", c2).await.unwrap();
    save_entity_inner(&db, "p1", l1).await.unwrap();
    save_entity_inner(&db, "p2", c_p2).await.unwrap();

    // Все сущности p1 (должно быть 3)
    let all_p1 = get_entities_inner(&db, "p1", None).await.unwrap();
    assert_eq!(all_p1.len(), 3);

    // Только персонажи p1 (должно быть 2)
    let chars_p1 = get_entities_inner(&db, "p1", Some("character".into())).await.unwrap();
    assert_eq!(chars_p1.len(), 2);

    // Только локации p1 (должно быть 1)
    let locs_p1 = get_entities_inner(&db, "p1", Some("location".into())).await.unwrap();
    assert_eq!(locs_p1.len(), 1);
    assert_eq!(locs_p1[0].name, "Замок");

    // Сущности p2 (должно быть 1)
    let all_p2 = get_entities_inner(&db, "p2", None).await.unwrap();
    assert_eq!(all_p2.len(), 1);
}

#[tokio::test]
async fn create_and_query_entity_relations() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let e1 = save_entity_inner(&db, "p1", Entity {
        id: None,
        project_id: Some("projects:p1".into()),
        entity_type: "character".into(),
        name: "Рыцарь".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    let e2 = save_entity_inner(&db, "p1", Entity {
        id: None,
        project_id: Some("projects:p1".into()),
        entity_type: "character".into(),
        name: "Король".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    let id1 = e1.id.unwrap();
    let id2 = e2.id.unwrap();

    // Создаём связь Рыцарь -> Король (тип "служит")
    let rel = EntityRel {
        id: None,
        r#in: None,
        out: None,
        project_id: None,
        rel_type: "serves".into(),
        description: Some("Присягнул на верность".into()),
        strength: Some(5),
        attributes: json!({}),
        start_chapter: None,
        end_chapter: None,
        created_at: None,
    };

    let created_rel = create_entity_relation_inner(&db, "p1", &id1, &id2, rel)
        .await
        .expect("create_entity_relation should succeed");

    assert_eq!(created_rel.rel_type, "serves");

    // Запрашиваем связи для id1
    let rels_for_1 = get_entity_relations_inner(&db, "p1", Some(id1.clone())).await.unwrap();
    assert_eq!(rels_for_1.len(), 1);
    assert_eq!(rels_for_1[0].rel_type, "serves");

    // Запрашиваем связи для id2
    let rels_for_2 = get_entity_relations_inner(&db, "p1", Some(id2.clone())).await.unwrap();
    assert_eq!(rels_for_2.len(), 1);

    // Удаляем связь
    let rel_id = created_rel.id.unwrap();
    delete_entity_relation_inner(&db, &rel_id).await.expect("delete rel");

    let rels_after = get_entity_relations_inner(&db, "p1", Some(id1)).await.unwrap();
    assert!(rels_after.is_empty(), "после удаления связей не должно быть");
}

#[tokio::test]
async fn delete_entity_cascades_relations_and_revisions() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let e1 = save_entity_inner(&db, "p1", Entity {
        id: None,
        project_id: Some("projects:p1".into()),
        entity_type: "character".into(),
        name: "Персонаж А".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    let e2 = save_entity_inner(&db, "p1", Entity {
        id: None,
        project_id: Some("projects:p1".into()),
        entity_type: "character".into(),
        name: "Персонаж Б".into(),
        description: None,
        attributes: json!({}),
        tags: vec![],
        embeddings: None,
        created_at: None,
        updated_at: None,
    }).await.unwrap();

    let id1 = e1.id.unwrap();
    let id2 = e2.id.unwrap();

    // Создаём связь
    create_entity_relation_inner(&db, "p1", &id1, &id2, EntityRel {
        id: None,
        r#in: None,
        out: None,
        project_id: None,
        rel_type: "friends".into(),
        description: None,
        strength: None,
        attributes: json!({}),
        start_chapter: None,
        end_chapter: None,
        created_at: None,
    }).await.unwrap();

    // Удаляем e1
    delete_entity_inner(&db, &id1).await.expect("delete_entity should succeed");

    // Проверяем, что e1 удален
    let fetched = get_entity_inner(&db, &id1).await.unwrap();
    assert!(fetched.is_none());

    // Проверяем, что связь e1 <-> e2 удалилась каскадом
    let rels = get_entity_relations_inner(&db, "p1", Some(id2)).await.unwrap();
    assert!(rels.is_empty(), "связи удаленного персонажа должны исчезнуть");
}

#[tokio::test]
async fn save_entity_schema_and_history_snapshot() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let schema1 = EntitySchema {
        id: None,
        project_id: Some("projects:p1".into()),
        type_key: "hero".into(),
        type_name: "Герой".into(),
        icon: "user".into(),
        color: "#ff0000".into(),
        fields_schema: vec![],
        full_schema: None,
        created_at: None,
    };

    // 1. Создаём схему
    let saved_s1 = save_entity_schema_inner(&db, "p1", schema1, Some(30))
        .await
        .expect("create schema");
    assert_eq!(saved_s1.type_name, "Герой");

    // 2. Обновляем схему (должен создаться снапшот в schema_history)
    let schema2 = EntitySchema {
        id: saved_s1.id.clone(),
        project_id: Some("projects:p1".into()),
        type_key: "hero".into(),
        type_name: "Великий Герой".into(),
        icon: "star".into(),
        color: "#ffff00".into(),
        fields_schema: vec![],
        full_schema: None,
        created_at: None,
    };
    save_entity_schema_inner(&db, "p1", schema2, Some(30))
        .await
        .expect("update schema");

    // 3. Проверяем историю версий схемы
    let history = get_schema_history_inner(&db, "p1", "hero").await.expect("get history");
    assert_eq!(history.len(), 1, "должен появиться 1 снапшот старой версии");
    assert_eq!(history[0].snapshot["type_name"], "Герой");

    // 4. Тестируем закрепление ревизии
    let h_id = history[0].id.as_ref().unwrap();
    toggle_schema_history_pin_inner(&db, h_id, true).await.expect("pin toggle");

    let history_after = get_schema_history_inner(&db, "p1", "hero").await.unwrap();
    assert!(history_after[0].is_pinned);
}

#[tokio::test]
async fn toggle_entity_history_pin_marks_revision_pinned() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    // Создаём ревизию сущности с явным ID и закрепляем её
    db.query(
        "CREATE entity_revisions:my_erev SET target_id = type::record('entities:e1'), project_id = type::record('projects','p1'), content = {}, is_pinned = false",
    )
    .await
    .expect("create entity revision");

    toggle_entity_history_pin_inner(&db, "entity_revisions:my_erev", true)
        .await
        .expect("pin should succeed");

    let mut res = db
        .query("SELECT VALUE is_pinned FROM entity_revisions:my_erev")
        .await
        .expect("query pin");
    let pinned: Option<bool> = res.take(0).expect("take is_pinned");
    assert_eq!(pinned, Some(true), "после toggle ревизия сущности должна быть закреплена");
}
