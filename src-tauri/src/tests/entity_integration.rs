//! Интеграционные тесты сущностей, схем и связей.
//!
//! Тестируют бизнес-логику `entities.rs`:
//! - CRUD сущностей (CREATE / UPSERT)
//! - Схемы сущностей + историю версий (снапшоты в `schema_history`)
//! - Рёбра связей `entity_rel` между сущностями
//! - Каскадную очистку при удалении сущностей и схем

use super::common::{create_test_db, fixture_entity, seed_project};
use crate::logic::entities::*;
use crate::logic::models::{Entity, EntityRel, EntitySchema};
use serde_json::json;

#[tokio::test]
async fn save_entity_create_and_get() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let new_entity = fixture_entity!(
        "p1",
        "character",
        "Алиса",
        json!({ "age": 20, "role": "протагонист" }),
        vec!["маг".into(), "человек".into()],
        Some("Главная героиня".into())
    );

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
    let mut actual_tags = fetched.tags.clone();
    actual_tags.sort();
    assert_eq!(actual_tags, vec!["маг".to_string(), "человек".to_string()]);
}

#[tokio::test]
async fn save_entity_upsert_existing() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let e = fixture_entity!(
        "p1",
        "character",
        "Боб",
        json!({ "level": 1 }),
        vec![],
        Some("Первое описание".into())
    );

    let created = save_entity_inner(&db, "p1", e).await.unwrap();
    let id = created.id.unwrap();

    // Обновляем сущность через тот же ID
    let updated_entity = fixture_entity!(
        "p1",
        "character",
        "Боб Мудрый",
        json!({ "level": 10 }),
        vec!["ветеран".into()],
        Some("Обновленное описание".into()),
        Some(id.clone())
    );

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
        schema_id: None,
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
        schema_id: None,
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
        schema_id: None,
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
        schema_id: None,
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
    let chars_p1 = get_entities_inner(&db, "p1", Some("character".into()))
        .await
        .unwrap();
    assert_eq!(chars_p1.len(), 2);

    // Только локации p1 (должно быть 1)
    let locs_p1 = get_entities_inner(&db, "p1", Some("location".into()))
        .await
        .unwrap();
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

    let e1 = save_entity_inner(
        &db,
        "p1",
        Entity {
            id: None,
            project_id: Some("projects:p1".into()),
            schema_id: None,
            entity_type: "character".into(),
            name: "Рыцарь".into(),
            description: None,
            attributes: json!({}),
            tags: vec![],
            embeddings: None,
            created_at: None,
            updated_at: None,
        },
    )
    .await
    .unwrap();

    let e2 = save_entity_inner(
        &db,
        "p1",
        Entity {
            id: None,
            project_id: Some("projects:p1".into()),
            schema_id: None,
            entity_type: "character".into(),
            name: "Король".into(),
            description: None,
            attributes: json!({}),
            tags: vec![],
            embeddings: None,
            created_at: None,
            updated_at: None,
        },
    )
    .await
    .unwrap();

    let id1 = e1.id.unwrap();
    let id2 = e2.id.unwrap();

    // Создаём связь Рыцарь -> Король (тип "служит")
    let rel = EntityRel {
        id: None,
        r#in: None,
        out: None,
        rel_type: "serves".into(),
        description: Some("Присягнул на верность".into()),
        strength: Some(5),
        attributes: json!({}),
        start_at: None,
        end_at: None,
        is_auto_extend: false,
        created_at: None,
    };

    let created_rel = create_entity_relation_inner(&db, "p1", &id1, &id2, rel)
        .await
        .expect("create_entity_relation should succeed");

    assert_eq!(created_rel.rel_type, "serves");

    // Запрашиваем связи для id1
    let rels_for_1 = get_entity_relations_inner(&db, "p1", Some(id1.clone()))
        .await
        .unwrap();
    assert_eq!(rels_for_1.len(), 1);
    assert_eq!(rels_for_1[0].rel_type, "serves");

    // Запрашиваем связи для id2
    let rels_for_2 = get_entity_relations_inner(&db, "p1", Some(id2.clone()))
        .await
        .unwrap();
    assert_eq!(rels_for_2.len(), 1);

    // Удаляем связь
    let rel_id = created_rel.id.unwrap();
    delete_entity_relation_inner(&db, &rel_id)
        .await
        .expect("delete rel");

    let rels_after = get_entity_relations_inner(&db, "p1", Some(id1))
        .await
        .unwrap();
    assert!(
        rels_after.is_empty(),
        "после удаления связей не должно быть"
    );
}

#[tokio::test]
async fn delete_entity_cascades_relations_and_revisions() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let e1 = save_entity_inner(
        &db,
        "p1",
        Entity {
            id: None,
            project_id: Some("projects:p1".into()),
            schema_id: None,
            entity_type: "character".into(),
            name: "Персонаж А".into(),
            description: None,
            attributes: json!({}),
            tags: vec![],
            embeddings: None,
            created_at: None,
            updated_at: None,
        },
    )
    .await
    .unwrap();

    let e2 = save_entity_inner(
        &db,
        "p1",
        Entity {
            id: None,
            project_id: Some("projects:p1".into()),
            schema_id: None,
            entity_type: "character".into(),
            name: "Персонаж Б".into(),
            description: None,
            attributes: json!({}),
            tags: vec![],
            embeddings: None,
            created_at: None,
            updated_at: None,
        },
    )
    .await
    .unwrap();

    let id1 = e1.id.unwrap();
    let id2 = e2.id.unwrap();

    // Создаём связь
    create_entity_relation_inner(
        &db,
        "p1",
        &id1,
        &id2,
        EntityRel {
            id: None,
            r#in: None,
            out: None,
            rel_type: "friends".into(),
            description: None,
            strength: None,
            attributes: json!({}),
            start_at: None,
            end_at: None,
            is_auto_extend: false,
            created_at: None,
        },
    )
    .await
    .unwrap();

    // Удаляем e1
    delete_entity_inner(&db, &id1)
        .await
        .expect("delete_entity should succeed");

    // Проверяем, что e1 удален
    let fetched = get_entity_inner(&db, &id1).await.unwrap();
    assert!(fetched.is_none());

    // Проверяем, что связь e1 <-> e2 удалилась каскадом
    let rels = get_entity_relations_inner(&db, "p1", Some(id2))
        .await
        .unwrap();
    assert!(
        rels.is_empty(),
        "связи удаленного персонажа должны исчезнуть"
    );
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
        fields_schema: vec![],
        full_schema: None,
        created_at: None,
    };
    save_entity_schema_inner(&db, "p1", schema2, Some(30))
        .await
        .expect("update schema");

    // 3. Проверяем историю версий схемы
    let history = get_schema_history_inner(&db, "p1", "hero")
        .await
        .expect("get history");
    assert_eq!(history.len(), 1, "должен появиться 1 снапшот старой версии");
    assert_eq!(history[0].snapshot["type_name"], "Герой");

    // 4. Тестируем закрепление ревизии
    let h_id = history[0].id.as_ref().unwrap();
    toggle_schema_history_pin_inner(&db, h_id, true)
        .await
        .expect("pin toggle");

    let history_after = get_schema_history_inner(&db, "p1", "hero").await.unwrap();
    assert!(history_after[0].is_pinned);
}

#[tokio::test]
async fn toggle_entity_history_pin_marks_revision_pinned() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;
    let ent = seed_entity(&db, "p1", "character", "Hero", None).await;
    let ent_id = ent.id.unwrap();

    // Создаём ревизию сущности с явным ID и закрепляем её
    let create_res = db.query(
        "CREATE entity_revisions:my_erev SET target_id = type::record($eid), content = {}, is_pinned = false",
    )
    .bind(("eid", ent_id))
    .await
    .expect("create entity revision");
    create_res.check().expect("create entity revision check");

    toggle_entity_history_pin_inner(&db, "entity_revisions:my_erev", true)
        .await
        .expect("pin should succeed");

    let mut res = db
        .query("SELECT VALUE is_pinned FROM entity_revisions:my_erev")
        .await
        .expect("query pin");
    let pinned: Option<bool> = res.take(0).expect("take is_pinned");
    assert_eq!(
        pinned,
        Some(true),
        "после toggle ревизия сущности должна быть закреплена"
    );
}

// =====================================================
// Волна 2: поиск, связи, схемы связей, каскад схем
// =====================================================

async fn seed_entity(
    db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    project: &str,
    entity_type: &str,
    name: &str,
    description: Option<&str>,
) -> Entity {
    save_entity_inner(
        db,
        project,
        Entity {
            id: None,
            project_id: Some(format!("projects:{project}")),
            schema_id: None,
            entity_type: entity_type.into(),
            name: name.into(),
            description: description.map(|d| d.into()),
            attributes: json!({}),
            tags: vec![],
            embeddings: None,
            created_at: None,
            updated_at: None,
        },
    )
    .await
    .expect("seed entity should succeed")
}

#[tokio::test]
async fn search_entities_finds_by_name_token() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    seed_entity(
        &db,
        "p1",
        "character",
        "Гарри Поттер",
        Some("Мальчик, который выжил"),
    )
    .await;
    seed_entity(&db, "p1", "character", "Поттер Вилли", None).await;
    seed_entity(&db, "p1", "location", "Хогвартс", None).await;

    let found = search_entities_inner(&db, "p1", "поттер", None)
        .await
        .expect("search should succeed");

    assert_eq!(found.len(), 2, "должны найтись оба «Поттера»");
    let names: Vec<&str> = found.iter().map(|e| e.name.as_str()).collect();
    assert!(names.contains(&"Гарри Поттер"));
    assert!(names.contains(&"Поттер Вилли"));
}

#[tokio::test]
async fn search_entities_type_filter_restricts_results() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    seed_entity(&db, "p1", "character", "Драконий Всадник", None).await;
    seed_entity(&db, "p1", "location", "Драконий Хребет", None).await;

    let only_chars = search_entities_inner(&db, "p1", "драконий", Some("character".into()))
        .await
        .expect("search with type filter");
    assert_eq!(only_chars.len(), 1);
    assert_eq!(only_chars[0].entity_type, "character");
}

#[tokio::test]
async fn search_entities_no_match_returns_empty() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    seed_entity(&db, "p1", "character", "Алиса", None).await;

    let found = search_entities_inner(&db, "p1", "крокодил", None)
        .await
        .expect("search no match");
    assert!(found.is_empty(), "несовпадающий запрос → пустой список");
}

#[tokio::test]
async fn search_entities_scoped_to_project() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "P1").await;
    seed_project(&db, "p2", "P2").await;

    seed_entity(&db, "p1", "character", "Борис Общий", None).await;
    seed_entity(&db, "p2", "character", "Борис Чужой", None).await;

    let p1_only = search_entities_inner(&db, "p1", "борис", None)
        .await
        .unwrap();
    assert_eq!(p1_only.len(), 1, "поиск не должен пересекать проекты");
    assert_eq!(p1_only[0].name, "Борис Общий");
}

#[tokio::test]
async fn create_relation_with_attributes_roundtrip() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let e1 = seed_entity(&db, "p1", "character", "Анна", None).await;
    let e2 = seed_entity(&db, "p1", "character", "Марк", None).await;

    let rel = create_entity_relation_inner(
        &db,
        "p1",
        e1.id.as_ref().unwrap(),
        e2.id.as_ref().unwrap(),
        EntityRel {
            id: None,
            r#in: None,
            out: None,
            rel_type: "rival".into(),
            description: Some("Соперники за трон".into()),
            strength: Some(7),
            attributes: json!({ "since": "битва при Аргенте" }),
            start_at: None,
            end_at: None,
            is_auto_extend: false,
            created_at: None,
        },
    )
    .await
    .expect("create relation");

    assert_eq!(rel.rel_type, "rival");
    assert_eq!(rel.strength, Some(7));
    assert_eq!(rel.attributes["since"], "битва при Аргенте");
    assert!(
        rel.id.is_some(),
        "RELATE RETURN AFTER должен вернуть id ребра"
    );

    // Roundtrip через get
    let rels = get_entity_relations_inner(&db, "p1", Some(e1.id.clone().unwrap()))
        .await
        .expect("get relations");
    assert_eq!(rels.len(), 1);
    assert_eq!(rels[0].description, Some("Соперники за трон".into()));
}

#[tokio::test]
async fn self_relation_is_currently_allowed_documented() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let e1 = seed_entity(&db, "p1", "character", "Нарцисс", None).await;
    let id = e1.id.unwrap();

    // Документируем текущее поведение: валидации self-relation НЕТ,
    // RELATE с from == to проходит успешно (известное ограничение).
    let res = create_entity_relation_inner(
        &db,
        "p1",
        &id,
        &id,
        EntityRel {
            id: None,
            r#in: None,
            out: None,
            rel_type: "mirror".into(),
            description: None,
            strength: None,
            attributes: json!({}),
            start_at: None,
            end_at: None,
            is_auto_extend: false,
            created_at: None,
        },
    )
    .await;

    assert!(
        res.is_ok(),
        "self-relation сейчас разрешена (задокументировано)"
    );
}

#[tokio::test]
async fn delete_relation_is_idempotent_on_missing() {
    let db = create_test_db().await;

    // Удаление несуществующей связи → Ok без ошибки
    delete_entity_relation_inner(&db, "entity_rel:no_such_rel")
        .await
        .expect("delete missing relation should be Ok");
}

#[tokio::test]
async fn relations_are_scoped_by_entity_and_project() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "P1").await;
    seed_project(&db, "p2", "P2").await;

    let a1 = seed_entity(&db, "p1", "character", "A1", None).await;
    let a2 = seed_entity(&db, "p1", "character", "A2", None).await;
    let b1 = seed_entity(&db, "p2", "character", "B1", None).await;
    let b2 = seed_entity(&db, "p2", "character", "B2", None).await;

    let mk = |rt: &str| EntityRel {
        id: None,
        r#in: None,
        out: None,
        rel_type: rt.into(),
        description: None,
        strength: None,
        attributes: json!({}),
        start_at: None,
        end_at: None,
        is_auto_extend: false,
        created_at: None,
    };

    create_entity_relation_inner(
        &db,
        "p1",
        a1.id.as_ref().unwrap(),
        a2.id.as_ref().unwrap(),
        mk("ally"),
    )
    .await
    .expect("rel p1");
    create_entity_relation_inner(
        &db,
        "p2",
        b1.id.as_ref().unwrap(),
        b2.id.as_ref().unwrap(),
        mk("enemy"),
    )
    .await
    .expect("rel p2");

    // Фильтр по сущности
    let for_a1 = get_entity_relations_inner(&db, "p1", Some(a1.id.clone().unwrap()))
        .await
        .unwrap();
    assert_eq!(for_a1.len(), 1);
    assert_eq!(for_a1[0].rel_type, "ally");

    // Без фильтра — все связи проекта
    let all_p1 = get_entity_relations_inner(&db, "p1", None).await.unwrap();
    assert_eq!(all_p1.len(), 1, "связи p2 не должны попадать в p1");
    assert_eq!(all_p1[0].rel_type, "ally");
}

#[tokio::test]
async fn relation_schemas_get_roundtrip_from_raw_rows() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    // save_relation_schema — tauri command (без _inner), поэтому вставляем сырую строку
    // и проверяем десериализацию через тестируемое ядро get_relation_schemas_inner.
    db.query(
        "CREATE relation_schemas SET \
         project_id = type::record('projects', 'p1'), rel_key = 'mentor', rel_name = 'Наставник', \
         icon = 'graduation', color = '#00ff00', \
         from_types = ['character'], to_types = ['character']",
    )
    .await
    .expect("insert raw relation schema");

    let schemas = get_relation_schemas_inner(&db, "p1")
        .await
        .expect("get relation schemas");
    assert_eq!(schemas.len(), 1);
    assert_eq!(schemas[0].rel_key, "mentor");
    assert_eq!(schemas[0].rel_name, "Наставник");
    assert_eq!(schemas[0].from_types, vec!["character".to_string()]);
}

#[tokio::test]
async fn delete_entity_schema_cascades_entities_of_type() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    save_entity_schema_inner(
        &db,
        "p1",
        EntitySchema {
            id: None,
            project_id: Some("projects:p1".into()),
            type_key: "creature".into(),
            type_name: "Существо".into(),
            fields_schema: vec![],
            full_schema: None,
            created_at: None,
        },
        None,
    )
    .await
    .expect("save schema");

    let dragon = seed_entity(&db, "p1", "creature", "Дракон", None).await;
    let goblin = seed_entity(&db, "p1", "creature", "Гоблин", None).await;
    let hero = seed_entity(&db, "p1", "character", "Герой", None).await;

    create_entity_relation_inner(
        &db,
        "p1",
        dragon.id.as_ref().unwrap(),
        goblin.id.as_ref().unwrap(),
        EntityRel {
            id: None,
            r#in: None,
            out: None,
            rel_type: "hunts".into(),
            description: None,
            strength: None,
            attributes: json!({}),
            start_at: None,
            end_at: None,
            is_auto_extend: false,
            created_at: None,
        },
    )
    .await
    .expect("relation between creatures");

    delete_entity_schema_inner(&db, "p1", "creature")
        .await
        .expect("delete schema");

    let dragons = get_entity_inner(&db, dragon.id.as_ref().unwrap())
        .await
        .unwrap();
    let goblins = get_entity_inner(&db, goblin.id.as_ref().unwrap())
        .await
        .unwrap();
    assert!(
        dragons.is_none(),
        "сущности удаляемого типа должны удалиться каскадом"
    );
    assert!(goblins.is_none());

    let heroes = get_entity_inner(&db, hero.id.as_ref().unwrap())
        .await
        .unwrap();
    assert!(heroes.is_some(), "сущности других типов не задеты");

    let schemas = get_entity_schemas_inner(&db, "p1").await.unwrap();
    assert!(
        schemas.iter().all(|s| s.type_key != "creature"),
        "схема должна исчезнуть"
    );
}

#[tokio::test]
async fn update_entity_omitted_fields_are_preserved() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let full = seed_entity(
        &db,
        "p1",
        "character",
        "Полное описание",
        Some("Изначальное описание"),
    )
    .await;
    let id = full.id.unwrap();

    // Обновляем ТОЛЬКО имя: description/tags в payload отсутствуют/пусты
    let renamed = save_entity_inner(
        &db,
        "p1",
        Entity {
            id: Some(id.clone()),
            project_id: Some("projects:p1".into()),
            schema_id: None,
            entity_type: "character".into(),
            name: "Переименованный".into(),
            description: None, // опущено → не должно затереть старое
            attributes: json!({}),
            tags: vec![], // пустой → не трогаем
            embeddings: None,
            created_at: None,
            updated_at: None,
        },
    )
    .await
    .expect("update entity");

    assert_eq!(renamed.name, "Переименованный");

    let fetched = get_entity_inner(&db, &id).await.unwrap().unwrap();
    assert_eq!(
        fetched.description,
        Some("Изначальное описание".into()),
        "опущенное поле description должно сохраниться (частичный UPDATE)"
    );
}
