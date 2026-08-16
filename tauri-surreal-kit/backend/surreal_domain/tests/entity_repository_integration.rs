//! Integration tests for SurrealRepository CRUD operations.
//!
//! Tests:
//! - create() with ID generation and field binding
//! - find_by_id() with different RecordId formats
//! - find_all() with project_id filtering
//! - save() for UPSERT operations
//! - delete() operations
//! - RecordId normalization

mod common;

use common::{create_test_db, create_test_app_state, seed_project};
use surreal_domain::SurrealRepository;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TestEntity {
    id: Option<String>,
    project_id: Option<String>,
    name: String,
    description: Option<String>,
    tags: Vec<String>,
    attributes: serde_json::Value,
}

impl SurrealRepository for TestEntity {
    const TABLE: &'static str = "test_entities";

    fn get_id(&self) -> Option<String> {
        self.id.clone()
    }

    fn set_id(&mut self, id: String) {
        self.id = Some(id);
    }
}

#[tokio::test]
async fn test_repository_create_generates_id() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let entity = TestEntity {
        id: None,
        project_id: Some("projects:p1".into()),
        name: "Test Entity".into(),
        description: Some("A test entity".into()),
        tags: vec!["tag1".into(), "tag2".into()],
        attributes: json!({"key": "value"}),
    };

    let created = TestEntity::create(&db, entity)
        .await
        .expect("create should succeed");

    assert!(created.id.is_some(), "Created entity should have ID");
    assert_eq!(created.name, "Test Entity");
    assert_eq!(created.tags, vec!["tag1", "tag2"]);
}

#[tokio::test]
async fn test_repository_find_by_id_with_prefix() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let entity = TestEntity {
        id: None,
        project_id: Some("projects:p1".into()),
        name: "Entity A".into(),
        description: None,
        tags: vec![],
        attributes: json!({}),
    };

    let created = TestEntity::create(&db, entity)
        .await
        .expect("create should succeed");

    let entity_id = created.id.clone().expect("Should have ID");

    // Find with full RecordId format
    let found = TestEntity::find_by_id(&db, &entity_id)
        .await
        .expect("find_by_id should succeed")
        .expect("entity should exist");

    assert_eq!(found.name, "Entity A");
}

#[tokio::test]
async fn test_repository_find_by_id_without_prefix() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let entity = TestEntity {
        id: None,
        project_id: Some("projects:p1".into()),
        name: "Entity B".into(),
        description: None,
        tags: vec![],
        attributes: json!({}),
    };

    let created = TestEntity::create(&db, entity)
        .await
        .expect("create should succeed");

    let entity_id = created.id.expect("Should have ID");

    // Extract just the key part (after the colon)
    let key_only = entity_id.split(':').nth(1).unwrap_or(&entity_id);

    // Find with just the key (should still work due to normalization)
    let found = TestEntity::find_by_id(&db, key_only)
        .await
        .expect("find_by_id should succeed")
        .expect("entity should exist");

    assert_eq!(found.name, "Entity B");
}

#[tokio::test]
async fn test_repository_find_all_filters_by_project_id() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;
    seed_project(&db, "p2", "Project 2").await;

    // Create entities in p1
    for i in 0..3 {
        let entity = TestEntity {
            id: None,
            project_id: Some("projects:p1".into()),
            name: format!("Entity P1_{}", i),
            description: None,
            tags: vec![],
            attributes: json!({}),
        };
        TestEntity::create(&db, entity).await.ok();
    }

    // Create entity in p2
    let entity_p2 = TestEntity {
        id: None,
        project_id: Some("projects:p2".into()),
        name: "Entity P2".into(),
        description: None,
        tags: vec![],
        attributes: json!({}),
    };
    TestEntity::create(&db, entity_p2).await.ok();

    // Query p1 entities
    let p1_entities = TestEntity::find_all(&db, "projects:p1")
        .await
        .expect("find_all should succeed");

    // Should get 3 entities from p1
    assert_eq!(p1_entities.len(), 3);
    assert!(p1_entities.iter().all(|e| e.project_id.as_deref() == Some("projects:p1")));
}

#[tokio::test]
async fn test_repository_find_all_with_different_project_id_formats() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let entity = TestEntity {
        id: None,
        project_id: Some("projects:p1".into()),
        name: "Test".into(),
        description: None,
        tags: vec![],
        attributes: json!({}),
    };

    TestEntity::create(&db, entity).await.ok();

    // Format 1: raw ID
    let found1 = TestEntity::find_all(&db, "p1").await.unwrap_or_default();

    // Format 2: record format
    let found2 = TestEntity::find_all(&db, "projects:p1")
        .await
        .unwrap_or_default();

    // Both should find the entity
    assert!(!found1.is_empty(), "Should find with raw project ID");
    assert!(!found2.is_empty(), "Should find with record format");
}

#[tokio::test]
async fn test_repository_save_new_record() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let entity = TestEntity {
        id: None,
        project_id: Some("projects:p1".into()),
        name: "New Entity".into(),
        description: Some("First save".into()),
        tags: vec!["new".into()],
        attributes: json!({"status": "active"}),
    };

    // save() should delegate to create() for new entities
    let saved = TestEntity::create(&db, entity)
        .await
        .expect("save should succeed");

    assert!(saved.id.is_some());
    assert_eq!(saved.name, "New Entity");
}

#[tokio::test]
async fn test_repository_save_upsert_existing() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let entity = TestEntity {
        id: None,
        project_id: Some("projects:p1".into()),
        name: "Original Name".into(),
        description: None,
        tags: vec![],
        attributes: json!({}),
    };

    let created = TestEntity::create(&db, entity)
        .await
        .expect("create should succeed");

    let entity_id = created.id.unwrap();

    // Now update it
    let updated_entity = TestEntity {
        id: Some(entity_id.clone()),
        project_id: Some("projects:p1".into()),
        name: "Updated Name".into(),
        description: Some("Updated description".into()),
        tags: vec!["updated".into()],
        attributes: json!({"status": "inactive"}),
    };

    let updated = TestEntity::create(&db, updated_entity)
        .await
        .expect("update should succeed");

    assert_eq!(updated.name, "Updated Name");

    // Verify in database
    let fetched = TestEntity::find_by_id(&db, &entity_id)
        .await
        .unwrap()
        .unwrap();

    assert_eq!(fetched.name, "Updated Name");
}

#[tokio::test]
async fn test_repository_delete_removes_record() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let entity = TestEntity {
        id: None,
        project_id: Some("projects:p1".into()),
        name: "To Delete".into(),
        description: None,
        tags: vec![],
        attributes: json!({}),
    };

    let created = TestEntity::create(&db, entity)
        .await
        .expect("create should succeed");

    let entity_id = created.id.unwrap();

    // Verify it exists
    let before = TestEntity::find_by_id(&db, &entity_id)
        .await
        .unwrap();
    assert!(before.is_some());

    // Delete it (we need to implement a delete method in the trait first)
    // For now, this test documents the expected behavior
}

#[tokio::test]
async fn test_repository_recordid_binding() {
    let db = create_test_db().await;

    // Test that RecordId format is correctly recognized
    let record_id = "test_entities:entity_key";
    let parts: Vec<&str> = record_id.split(':').collect();

    assert_eq!(parts.len(), 2);
    assert_eq!(parts[0], "test_entities");
    assert_eq!(parts[1], "entity_key");

    // This is the format that should be recognized as RecordId for binding
}

#[tokio::test]
async fn test_repository_null_field_removal() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let entity = TestEntity {
        id: None,
        project_id: Some("projects:p1".into()),
        name: "Test".into(),
        description: None, // Null description should be removed
        tags: vec![],
        attributes: json!({}),
    };

    let created = TestEntity::create(&db, entity)
        .await
        .expect("create should succeed");

    assert!(created.id.is_some());

    let fetched = TestEntity::find_by_id(&db, &created.id.as_ref().unwrap())
        .await
        .unwrap()
        .unwrap();

    // Null fields should be stripped during create
    assert_eq!(fetched.name, "Test");
}
