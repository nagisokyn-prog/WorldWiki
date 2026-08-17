//! Negative and edge-case integration tests for surreal_domain.

mod common;

use common::{create_test_db, seed_project};
use serde_json::json;
use surreal_domain::{surreal_entity, SurrealRepository};

surreal_entity! {
    #[table = "safe_items"]
    pub struct SafeItem {
        pub payload: String,
    }
}

#[tokio::test]
async fn negative_find_by_id_nonexistent_returns_none() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let result = SafeItem::find_by_id(&db, "safe_items:nonexistent_uuid")
        .await
        .expect("find_by_id query itself should succeed");
    assert!(result.is_none(), "Nonexistent record should return None");
}

#[tokio::test]
async fn negative_find_by_id_with_wrong_table_prefix_handled() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let result = SafeItem::find_by_id(&db, "other_table:12345")
        .await
        .expect("Query should succeed");
    assert!(result.is_none());
}

#[tokio::test]
async fn negative_delete_nonexistent_is_idempotent() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    // Delete nonexistent should not panic or return fatal error
    let result = SafeItem::delete(&db, "safe_items:does_not_exist").await;
    assert!(result.is_ok(), "Deleting a non-existent item is idempotent");
}

#[tokio::test]
async fn negative_special_characters_in_strings_handled_safely() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    let injection_strings = vec![
        "'; DROP TABLE safe_items; --",
        "\" OR 1=1 --",
        "\\\\//??::&&^^%%$$##@@!!",
        "🔥 Unicode emojis & <html> tags <script>alert(1)</script>",
    ];

    for dangerous_str in injection_strings {
        let item = SafeItem {
            id: None,
            project_id: Some(json!("projects:p1")),
            payload: dangerous_str.to_string(),
        };

        let created = SafeItem::create(&db, item)
            .await
            .expect("Special characters must be safely escaped by SurrealDB bindings");
        assert_eq!(created.payload, dangerous_str);

        let fetched = SafeItem::find_by_id(&db, &created.id.unwrap())
            .await
            .expect("Fetch should succeed")
            .expect("Item must exist");
        assert_eq!(fetched.payload, dangerous_str);
    }
}
