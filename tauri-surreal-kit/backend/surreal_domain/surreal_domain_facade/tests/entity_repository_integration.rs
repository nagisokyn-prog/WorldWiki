//! Integration tests for SurrealRepository CRUD operations using real surreal_entity! macro.

mod common;

use common::{create_test_db, seed_project};
use serde_json::json;
use surreal_domain::{surreal_entity, SurrealRepository};

surreal_entity! {
    #[table = "characters"]
    pub struct Character {
        pub name: String,
        pub biography: Option<String>,
        pub level: i32,
        pub tags: Vec<String>,
        pub meta: serde_json::Value,
    }
}

#[tokio::test]
async fn test_repository_create_generates_id_and_binds_fields() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "World Alpha").await;

    let character = Character {
        id: None,
        project_id: Some(json!("projects:p1")),
        name: "Arthur Pendragon".into(),
        biography: Some("King of the Britons".into()),
        level: 50,
        tags: vec!["hero".into(), "royalty".into()],
        meta: json!({ "kingdom": "Camelot" }),
    };

    let created = Character::create(&db, character)
        .await
        .expect("create should succeed");

    assert!(created.id.is_some(), "Created character must have an ID");
    assert_eq!(created.name, "Arthur Pendragon");
    assert_eq!(created.level, 50);
    assert_eq!(created.tags, vec!["hero", "royalty"]);
    assert_eq!(created.meta["kingdom"], "Camelot");
}

#[tokio::test]
async fn test_repository_find_by_id_with_and_without_prefix() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "World Alpha").await;

    let character = Character {
        id: None,
        project_id: Some(json!("projects:p1")),
        name: "Merlin".into(),
        biography: Some("Great Wizard".into()),
        level: 99,
        tags: vec!["mage".into()],
        meta: json!({}),
    };

    let created = Character::create(&db, character)
        .await
        .expect("create should succeed");
    let full_id = created.id.expect("ID should exist");
    let raw_key = full_id.split(':').last().unwrap();

    // Find by full "characters:id"
    let found_by_full = Character::find_by_id(&db, &full_id)
        .await
        .expect("find_by_id with full ID should succeed");
    assert!(found_by_full.is_some());
    assert_eq!(found_by_full.unwrap().name, "Merlin");

    // Find by raw "id"
    let found_by_raw = Character::find_by_id(&db, raw_key)
        .await
        .expect("find_by_id with raw key should succeed");
    assert!(found_by_raw.is_some());
    assert_eq!(found_by_raw.unwrap().name, "Merlin");
}

#[tokio::test]
async fn test_repository_find_all_matches_all_project_id_formats() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "World Alpha").await;

    let c1 = Character {
        id: None,
        project_id: Some(json!("projects:p1")),
        name: "Lancelot".into(),
        biography: None,
        level: 45,
        tags: vec![],
        meta: json!({}),
    };
    Character::create(&db, c1).await.expect("c1 create failed");

    let c2 = Character {
        id: None,
        project_id: Some(json!("projects:p1")),
        name: "Gawain".into(),
        biography: None,
        level: 40,
        tags: vec![],
        meta: json!({}),
    };
    Character::create(&db, c2).await.expect("c2 create failed");

    // Find with "projects:p1"
    let all_full = Character::find_all(&db, "projects:p1")
        .await
        .expect("find_all with full project ID should succeed");
    assert_eq!(all_full.len(), 2);

    // Find with raw "p1"
    let all_raw = Character::find_all(&db, "p1")
        .await
        .expect("find_all with raw project ID should succeed");
    assert_eq!(all_raw.len(), 2);
}

#[tokio::test]
async fn test_repository_save_upsert_existing_and_new_records() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "World Alpha").await;

    // 1. Save new record (id is None)
    let new_char = Character {
        id: None,
        project_id: Some(json!("projects:p1")),
        name: "Percival".into(),
        biography: None,
        level: 30,
        tags: vec!["knight".into()],
        meta: json!({}),
    };

    let mut saved = Character::save(&db, &new_char)
        .await
        .expect("save of new record should succeed");
    assert!(saved.id.is_some());
    assert_eq!(saved.level, 30);

    // 2. Update existing record
    saved.level = 35;
    saved.biography = Some("Found the grail".into());

    let updated = Character::save(&db, &saved)
        .await
        .expect("save of existing record should update");

    assert_eq!(updated.level, 35);
    assert_eq!(updated.biography, Some("Found the grail".into()));

    // Verify in database
    let fetched = Character::find_by_id(&db, saved.id.as_ref().unwrap())
        .await
        .expect("find should succeed")
        .expect("character must exist");
    assert_eq!(fetched.level, 35);
}

#[tokio::test]
async fn test_repository_delete_removes_record_cleanly() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "World Alpha").await;

    let character = Character {
        id: None,
        project_id: Some(json!("projects:p1")),
        name: "Mordred".into(),
        biography: None,
        level: 48,
        tags: vec!["villain".into()],
        meta: json!({}),
    };

    let created = Character::create(&db, character)
        .await
        .expect("create should succeed");
    let id = created.id.expect("ID should exist");

    // Delete
    Character::delete(&db, &id)
        .await
        .expect("delete should succeed");

    // Verify gone
    let found = Character::find_by_id(&db, &id)
        .await
        .expect("find after delete should succeed");
    assert!(found.is_none(), "Deleted entity should not be found");
}
