//! Integration tests for `#[flexible]` field serialization and roundtrip with SurrealDB.

mod common;

use common::{create_test_db, seed_project};
use serde_json::json;
use surreal_domain::{surreal_entity, SurrealRepository};

surreal_entity! {
    #[table = "flex_test"]
    #[project_scoped]
    pub struct FlexEntity {
        pub title: String,
        #[flexible] pub optional_field: Option<String>,
        #[flexible] pub flexible_map: serde_json::Value,
        #[flexible] pub flexible_vec: Option<Vec<String>>,
    }
}

#[test]
fn test_flexible_skip_null_on_serialize() {
    let entity = FlexEntity {
        id: None,
        project_id: None,
        title: "Test".into(),
        optional_field: None,
        flexible_map: json!(null),
        flexible_vec: None,
    };

    let json = serde_json::to_value(&entity).unwrap();
    let obj = json.as_object().unwrap();

    // Null flexible поля должны отсутствовать в JSON (не "null", а именно нет ключа)
    assert!(!obj.contains_key("optional_field"), "None flexible field should be skipped, got: {:?}", obj.get("optional_field"));
    assert!(!obj.contains_key("flexible_map"), "null flexible field should be skipped, got: {:?}", obj.get("flexible_map"));
    assert!(!obj.contains_key("flexible_vec"), "None flexible field should be skipped, got: {:?}", obj.get("flexible_vec"));
    
    // Обычные поля должны быть
    assert!(obj.contains_key("title"));
    assert_eq!(obj["title"], "Test");
}

#[test]
fn test_flexible_preserve_non_null_values() {
    let entity = FlexEntity {
        id: None,
        project_id: Some(json!("projects:p1")),
        title: "Test".into(),
        optional_field: Some("present".into()),
        flexible_map: json!({ "key": "value", "nested": { "num": 42 } }),
        flexible_vec: Some(vec!["a".into(), "b".into()]),
    };

    let json = serde_json::to_value(&entity).unwrap();

    assert_eq!(json["optional_field"], "present");
    assert_eq!(json["flexible_map"], json!({ "key": "value", "nested": { "num": 42 } }));
    assert_eq!(json["flexible_vec"], json!(["a", "b"]));
}

#[tokio::test]
async fn test_flexible_roundtrip_create_load() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Test Project").await;

    // Setup table with flexible fields
    let schema = r#"
    DEFINE TABLE flex_test SCHEMAFULL;
    DEFINE FIELD title ON flex_test TYPE string;
    DEFINE FIELD project_id ON flex_test TYPE option<record<projects>>;
    DEFINE FIELD optional_field ON flex_test TYPE option<string>;
    DEFINE FIELD flexible_map ON flex_test TYPE any;
    DEFINE FIELD flexible_vec ON flex_test TYPE option<array<string>>;
    "#;
    db.query(schema).await.expect("Schema apply");

    let entity = FlexEntity {
        id: None,
        project_id: Some(json!("projects:p1")),
        title: "Roundtrip Test".into(),
        optional_field: Some("value".into()),
        flexible_map: json!({ "nested": 123, "bool": true }),
        flexible_vec: Some(vec!["item1".into(), "item2".into()]),
    };

    let saved = FlexEntity::create(&db, entity).await.expect("Create failed");
    let loaded = FlexEntity::find_by_id(&db, &saved.id.unwrap()).await.expect("Find failed").expect("Entity should exist");

    assert_eq!(loaded.optional_field, Some("value".into()));
    assert_eq!(loaded.flexible_map, json!({ "nested": 123, "bool": true }));
    assert_eq!(loaded.flexible_vec, Some(vec!["item1".into(), "item2".into()]));
}

#[tokio::test]
async fn test_flexible_partial_update_preserves_other_fields() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Test Project").await;

    let schema = r#"
    DEFINE TABLE flex_test SCHEMAFULL;
    DEFINE FIELD title ON flex_test TYPE string;
    DEFINE FIELD project_id ON flex_test TYPE option<record<projects>>;
    DEFINE FIELD optional_field ON flex_test TYPE option<string>;
    DEFINE FIELD flexible_map ON flex_test TYPE any;
    "#;
    db.query(schema).await.expect("Schema apply");

    // Create with all fields
    let entity = FlexEntity {
        id: None,
        project_id: Some(json!("projects:p1")),
        title: "Partial Update".into(),
        optional_field: Some("original".into()),
        flexible_map: json!({ "keep": "this" }),
        flexible_vec: None,
    };
    let saved = FlexEntity::create(&db, entity).await.expect("Create failed");

    // Update only title (flexible fields should stay)
    let mut updated = saved.clone();
    updated.title = "Updated Title".into();
    updated.optional_field = None; // Explicitly set to None
    updated.flexible_map = json!(null); // Explicitly set to null
    
    let saved_updated = FlexEntity::save(&db, &updated).await.expect("Save failed");

    // Load and verify
    let loaded = FlexEntity::find_by_id(&db, &saved_updated.id.unwrap()).await.expect("Find failed").expect("Entity should exist");
    
    assert_eq!(loaded.title, "Updated Title");
    assert_eq!(loaded.optional_field, None, "Explicit None should be saved as null/missing");
    assert_eq!(loaded.flexible_map, json!(null), "Explicit null should be saved as null");
}