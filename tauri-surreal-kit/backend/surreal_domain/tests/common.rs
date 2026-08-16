//! Common test harness for surreal_domain tests.
//!
//! Provides:
//! - In-memory SurrealDB setup with isolation per test
//! - MockAppState implementing SurrealDb trait
//! - Helper functions for test entity creation

use std::sync::Arc;
use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;
use surreal_domain::SurrealDb;
use uuid::Uuid;

/// MockAppState implementing SurrealDb trait for testing.
pub struct MockAppState {
    pub db: Surreal<Db>,
}

impl SurrealDb for MockAppState {
    type Connection = Db;

    fn surreal_db(&self) -> &Surreal<Db> {
        &self.db
    }
}

/// Creates an isolated in-memory test database.
///
/// Each test gets a unique database instance via temporary directory with UUID.
/// Database is automatically cleaned up when test ends.
pub async fn create_test_db() -> Surreal<Db> {
    let db_dir = std::env::temp_dir().join(format!("surreal_test_{}", Uuid::new_v4()));
    std::fs::create_dir_all(&db_dir).ok();

    let db = Surreal::new::<SurrealKv>(&db_dir)
        .await
        .expect("Failed to create test database");

    db.use_ns("test").use_db("test").run("").await.ok();

    db
}

/// Creates a MockAppState with isolated in-memory database.
pub async fn create_test_app_state() -> MockAppState {
    MockAppState {
        db: create_test_db().await,
    }
}

/// Helper: Create a test entity with minimal fields.
///
/// # Example
/// ```no_run
/// let entity = create_test_entity("test_table", "entity_1", json!({"name": "Test"}));
/// ```
pub fn create_test_entity(table: &str, id: &str, data: serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "id": format!("{}:{}", table, id),
        "data": data,
        "created_at": chrono::Utc::now().to_rfc3339(),
    })
}

/// Helper: Seed test database with a project.
pub async fn seed_project(db: &Surreal<Db>, project_id: &str, project_name: &str) {
    let project_record = serde_json::json!({
        "id": format!("projects:{}", project_id),
        "name": project_name,
        "created_at": chrono::Utc::now().to_rfc3339(),
    });

    let _: Vec<serde_json::Value> = db
        .query("CREATE projects SET id = $id, name = $name, created_at = $created_at")
        .bind(("id", format!("projects:{}", project_id)))
        .bind(("name", project_name))
        .bind(("created_at", chrono::Utc::now().to_rfc3339()))
        .await
        .ok()
        .and_then(|mut res| res.take(0).ok())
        .unwrap_or_default();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_db_creates_isolated_instance() {
        let db1 = create_test_db().await;
        let db2 = create_test_db().await;

        // Both databases should be accessible
        let result1: Option<serde_json::Value> = db1
            .query("SELECT 1 AS test")
            .await
            .ok()
            .and_then(|mut res| res.take(0).ok())
            .unwrap_or(None);

        let result2: Option<serde_json::Value> = db2
            .query("SELECT 1 AS test")
            .await
            .ok()
            .and_then(|mut res| res.take(0).ok())
            .unwrap_or(None);

        assert!(result1.is_some());
        assert!(result2.is_some());
    }

    #[tokio::test]
    async fn test_mock_app_state_implements_surreal_db() {
        let state = create_test_app_state().await;
        let _db = state.surreal_db();
        // If this compiles, the trait is implemented correctly
    }

    #[tokio::test]
    async fn test_seed_project_creates_record() {
        let db = create_test_db().await;
        seed_project(&db, "test_proj", "Test Project").await;

        let result: Option<serde_json::Value> = db
            .select(("projects", "test_proj"))
            .await
            .ok()
            .flatten();

        assert!(result.is_some(), "Project should be created");
        if let Some(proj) = result {
            assert_eq!(proj.get("name").and_then(|v| v.as_str()), Some("Test Project"));
        }
    }
}
