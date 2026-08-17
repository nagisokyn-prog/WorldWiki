//! Stress, concurrency, and load integration tests for surreal_domain.

mod common;

use common::{create_test_db, seed_project};
use serde_json::json;
use std::sync::Arc;
use surreal_domain::{surreal_entity, SurrealRepository};

surreal_entity! {
    #[table = "stress_items"]
    pub struct StressItem {
        pub title: String,
        pub counter: i32,
    }
}

#[tokio::test]
async fn stress_repository_bulk_insert_entities() {
    let db = create_test_db().await;
    seed_project(&db, "p1", "Project 1").await;

    const BATCH_SIZE: usize = 100;

    for i in 0..BATCH_SIZE {
        let item = StressItem {
            id: None,
            project_id: Some(json!("projects:p1")),
            title: format!("Stress Item #{}", i),
            counter: i as i32,
        };
        let created = StressItem::create(&db, item)
            .await
            .expect("Bulk insert should not fail");
        assert!(created.id.is_some());
    }

    let all = StressItem::find_all(&db, "projects:p1")
        .await
        .expect("Find all should return all inserted items");
    assert_eq!(all.len(), BATCH_SIZE);
}

#[tokio::test]
async fn stress_concurrent_read_write_state() {
    let db = Arc::new(create_test_db().await);
    seed_project(&db, "p1", "Project 1").await;

    let mut handles = Vec::new();

    for i in 0..20 {
        let db_clone = Arc::clone(&db);
        let handle = tokio::spawn(async move {
            let item = StressItem {
                id: None,
                project_id: Some(json!("projects:p1")),
                title: format!("Concurrent Task Item {}", i),
                counter: i,
            };
            let created = StressItem::create(&*db_clone, item)
                .await
                .expect("Concurrent create failed");
            let id = created.id.unwrap();

            let found = StressItem::find_by_id(&*db_clone, &id)
                .await
                .expect("Concurrent find failed");
            assert!(found.is_some());
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.expect("Task panicked");
    }
}

#[tokio::test]
async fn stress_concurrent_save_race_condition_resilience() {
    let db = Arc::new(create_test_db().await);
    seed_project(&db, "p1", "Project 1").await;

    let initial = StressItem {
        id: None,
        project_id: Some(json!("projects:p1")),
        title: "Shared Record".to_string(),
        counter: 0,
    };
    let created = StressItem::create(&*db, initial)
        .await
        .expect("Initial record create failed");
    let record_id = created.id.expect("Record ID must exist");

    let mut handles = Vec::new();
    for i in 0..10 {
        let db_clone = Arc::clone(&db);
        let id_clone = record_id.clone();
        let handle = tokio::spawn(async move {
            let item = StressItem {
                id: Some(id_clone),
                project_id: Some(json!("projects:p1")),
                title: format!("Worker #{} Update", i),
                counter: i,
            };
            let _ = StressItem::save(&*db_clone, &item).await;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.expect("Worker panicked");
    }

    // Ensure database record is valid and intact
    let final_record = StressItem::find_by_id(&*db, &record_id)
        .await
        .expect("Query failed")
        .expect("Record must still exist after concurrent writes");
    assert!(final_record.counter >= 0 && final_record.counter < 10);
}
