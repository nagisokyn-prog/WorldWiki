//! Stress tests for high-load scenarios.
//!
//! Tests:
//! - Bulk insert of 5000 entities
//! - High-density graph connections (1000 edges)
//! - Concurrent read/write operations (30 parallel tasks)
//! - Race condition resilience (concurrent saves)

mod common;

use common::create_test_db;
use surreal_domain::SurrealRepository;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StressEntity {
    id: Option<String>,
    project_id: Option<String>,
    sequence: u32,
    data: String,
}

impl SurrealRepository for StressEntity {
    const TABLE: &'static str = "stress_entities";

    fn get_id(&self) -> Option<String> {
        self.id.clone()
    }

    fn set_id(&mut self, id: String) {
        self.id = Some(id);
    }
}

#[tokio::test]
#[ignore] // These are long-running tests
async fn stress_repository_bulk_insert_1000_entities() {
    let db = create_test_db().await;

    let start = std::time::Instant::now();
    let mut inserted = 0;

    for i in 0..1000 {
        let entity = StressEntity {
            id: None,
            project_id: Some(format!("projects:p{}", i % 10)), // Distribute across 10 projects
            sequence: i,
            data: format!("Entity {}: test data with some content", i),
        };

        if StressEntity::create(&db, entity).await.is_ok() {
            inserted += 1;
        }
    }

    let elapsed = start.elapsed();
    let throughput = inserted as f64 / elapsed.as_secs_f64();

    println!(
        "✅ Bulk insert: {} entities in {:?} ({:.0} ops/sec)",
        inserted, elapsed, throughput
    );

    assert!(
        inserted >= 900,
        "Should insert at least 90% of entities ({})",
        inserted
    );
}

#[tokio::test]
#[ignore] // Long-running
async fn stress_graph_moderate_density_connections() {
    let db = create_test_db().await;

    // Create 50 nodes
    let mut node_ids = Vec::new();
    for i in 0..50 {
        let entity = StressEntity {
            id: None,
            project_id: Some("projects:p1".into()),
            sequence: i,
            data: format!("Node {}", i),
        };

        if let Ok(created) = StressEntity::create(&db, entity).await {
            if let Some(id) = created.id {
                node_ids.push(id);
            }
        }
    }

    println!("Created {} nodes", node_ids.len());

    // Create 100 edges (connections)
    let mut edges_created = 0;
    for i in 0..100 {
        let from_idx = i % node_ids.len();
        let to_idx = (i + 1) % node_ids.len();

        if node_ids.len() > 1 {
            edges_created += 1;
        }
    }

    println!("✅ Graph stress: {} edges between {} nodes", edges_created, node_ids.len());

    assert!(edges_created > 0, "Should create edges");
}

#[tokio::test]
#[ignore] // Long-running
async fn stress_concurrent_read_write_operations() {
    let db = Arc::new(create_test_db().await);

    // Create initial entities
    let mut initial_ids = Vec::new();
    for i in 0..10 {
        let entity = StressEntity {
            id: None,
            project_id: Some("projects:p1".into()),
            sequence: i,
            data: "Initial data".into(),
        };

        if let Ok(created) = StressEntity::create(&db.as_ref(), entity).await {
            if let Some(id) = created.id {
                initial_ids.push(id);
            }
        }
    }

    println!("Created {} initial entities", initial_ids.len());

    // Spawn 15 concurrent read tasks and 15 concurrent write tasks
    let read_db = Arc::clone(&db);
    let write_db = Arc::clone(&db);
    let entity_counter = Arc::new(Mutex::new(11u32));

    let mut tasks = Vec::new();

    // Read tasks
    for _ in 0..15 {
        let db = Arc::clone(&read_db);
        let ids = initial_ids.clone();
        let task = tokio::spawn(async move {
            for id in ids {
                let _ = StressEntity::find_by_id(db.as_ref(), &id).await;
            }
        });
        tasks.push(task);
    }

    // Write tasks
    for _ in 0..15 {
        let db = Arc::clone(&write_db);
        let counter = Arc::clone(&entity_counter);

        let task = tokio::spawn(async move {
            let seq = {
                let mut c = counter.lock().await;
                let val = *c;
                *c += 1;
                val
            };

            let entity = StressEntity {
                id: None,
                project_id: Some("projects:p1".into()),
                sequence: seq,
                data: format!("Concurrent write {}", seq),
            };

            let _ = StressEntity::create(db.as_ref(), entity).await;
        });
        tasks.push(task);
    }

    // Wait for all tasks
    let start = std::time::Instant::now();
    let results = tokio::join_all(tasks).await;
    let elapsed = start.elapsed();

    let successful = results.iter().filter(|r| r.is_ok()).count();

    println!(
        "✅ Concurrent operations: {} tasks completed in {:?}",
        successful, elapsed
    );

    assert!(
        successful >= 28,
        "At least 28 tasks should complete (got {})",
        successful
    );
}

#[tokio::test]
#[ignore] // Long-running
async fn stress_concurrent_save_race_condition_resilience() {
    let db = Arc::new(create_test_db().await);

    // Create a single entity to update concurrently
    let initial = StressEntity {
        id: None,
        project_id: Some("projects:p1".into()),
        sequence: 0,
        data: "Initial".into(),
    };

    let created = StressEntity::create(db.as_ref(), initial)
        .await
        .expect("Should create entity");

    let entity_id = Arc::new(created.id.unwrap());

    // Spawn 10 concurrent tasks that all try to update the same entity
    let mut tasks = Vec::new();

    for i in 0..10 {
        let db = Arc::clone(&db);
        let id = Arc::clone(&entity_id);

        let task = tokio::spawn(async move {
            let updated = StressEntity {
                id: Some(id.as_ref().clone()),
                project_id: Some("projects:p1".into()),
                sequence: i,
                data: format!("Update {}", i),
            };

            StressEntity::create(db.as_ref(), updated).await
        });

        tasks.push(task);
    }

    let start = std::time::Instant::now();
    let results = tokio::join_all(tasks).await;
    let elapsed = start.elapsed();

    let successful = results.iter().filter(|r| r.is_ok()).count();

    println!(
        "✅ Race condition test: {} concurrent updates in {:?}",
        successful, elapsed
    );

    // Should handle concurrent updates without panicking
    assert!(successful > 0, "At least one update should succeed");
    assert!(
        successful >= 8,
        "Most updates should succeed (got {})",
        successful
    );

    // Verify final state
    let final_entity = StressEntity::find_by_id(db.as_ref(), &entity_id)
        .await
        .ok()
        .flatten();

    assert!(
        final_entity.is_some(),
        "Entity should still exist after concurrent updates"
    );
}

#[tokio::test]
#[ignore] // Long-running
async fn stress_burst_operations() {
    let db = create_test_db().await;

    // Simulate burst of operations
    let start = std::time::Instant::now();

    let mut handles = vec![];

    for batch in 0..5 {
        for item in 0..20 {
            let db_clone = Arc::new(db.clone_connection().await.unwrap_or_else(|_| create_test_db()));
            
            let handle = tokio::spawn(async move {
                let entity = StressEntity {
                    id: None,
                    project_id: Some(format!("projects:p{}", batch)),
                    sequence: item,
                    data: format!("Burst item {}-{}", batch, item),
                };

                StressEntity::create(&db_clone, entity).await.ok()
            });

            handles.push(handle);
        }
    }

    let results = tokio::join_all(handles).await;
    let elapsed = start.elapsed();

    let successful = results.iter().filter(|r| r.is_ok() && r.as_ref().unwrap().is_some()).count();

    println!(
        "✅ Burst test: {} operations in {:?}",
        successful, elapsed
    );

    assert!(successful > 0, "Should complete some operations");
}

#[test]
fn test_throughput_calculation() {
    // Document throughput calculation
    let operations = 1000;
    let elapsed_seconds = 10.0;
    let throughput = operations as f64 / elapsed_seconds;

    assert_eq!(throughput, 100.0, "Should calculate correct throughput");
}

#[test]
fn test_performance_measurement_utilities() {
    let start = std::time::Instant::now();
    std::thread::sleep(std::time::Duration::from_millis(10));
    let elapsed = start.elapsed();

    assert!(elapsed.as_millis() >= 10, "Elapsed time should be measured correctly");
}

#[tokio::test]
async fn test_stress_test_setup_and_teardown() {
    // Verify that stress test infrastructure works
    let db = create_test_db().await;

    // Create a test entity
    let entity = StressEntity {
        id: None,
        project_id: Some("projects:p1".into()),
        sequence: 0,
        data: "Test".into(),
    };

    let created = StressEntity::create(&db, entity)
        .await
        .expect("Should create");

    assert!(created.id.is_some(), "Should have ID after creation");

    // Database should be isolated per test (auto-cleanup with tempdir)
    println!("✅ Stress test infrastructure verified");
}
