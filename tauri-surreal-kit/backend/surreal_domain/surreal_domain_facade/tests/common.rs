//! Common test harness for surreal_domain tests.
//!
//! Provides:
//! - Isolated SurrealDB instance with temporary directory cleanup via TempDir
//! - MockAppState implementing SurrealDb trait
//! - Helper functions for project seeding and record validation

#![allow(dead_code)]

use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;
use surreal_domain::SurrealDb;
use tempfile::TempDir;

/// Test database wrapper keeping TempDir alive for the lifetime of the test.
pub struct TestDb {
    pub db: Surreal<Db>,
    _dir: TempDir,
}

impl std::ops::Deref for TestDb {
    type Target = Surreal<Db>;
    fn deref(&self) -> &Self::Target {
        &self.db
    }
}

/// MockAppState implementing SurrealDb trait for testing.
pub struct MockAppState {
    pub db: Surreal<Db>,
    _dir: Option<TempDir>,
}

impl SurrealDb for MockAppState {
    type Connection = Db;

    fn surreal_db(&self) -> &Surreal<Db> {
        &self.db
    }
}

/// Creates an isolated temporary directory test database using SurrealKV.
pub async fn create_test_db() -> TestDb {
    let dir = TempDir::new().expect("Failed to create temporary directory for test db");
    let db = Surreal::new::<SurrealKv>(dir.path())
        .await
        .expect("Failed to create test database");

    db.use_ns("test")
        .use_db("test")
        .await
        .expect("Failed to set namespace/database");

    TestDb { db, _dir: dir }
}

/// Creates a MockAppState with an isolated test database.
pub async fn create_test_app_state() -> MockAppState {
    let dir = TempDir::new().expect("Failed to create tempdir for AppState");
    let db = Surreal::new::<SurrealKv>(dir.path())
        .await
        .expect("Failed to create test database");

    db.use_ns("test")
        .use_db("test")
        .await
        .expect("Failed to set namespace/database");

    MockAppState {
        db,
        _dir: Some(dir),
    }
}

/// Helper: Seed test database with a project record.
pub async fn seed_project(db: &Surreal<Db>, project_id: &str, project_name: &str) {
    db.upsert::<Option<serde_json::Value>>(("projects", project_id))
        .content(serde_json::json!({
            "name": project_name,
            "created_at": chrono::Utc::now().to_rfc3339()
        }))
        .await
        .expect("Failed to seed project");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_db_creates_isolated_instance() {
        let db1 = create_test_db().await;
        let db2 = create_test_db().await;

        seed_project(&db1, "p1", "Project 1").await;
        seed_project(&db2, "p2", "Project 2").await;

        let in_db1_p1: Option<serde_json::Value> = db1
            .select(("projects", "p1"))
            .await
            .expect("select db1 p1 failed");
        let in_db1_p2: Option<serde_json::Value> = db1
            .select(("projects", "p2"))
            .await
            .expect("select db1 p2 failed");

        let in_db2_p1: Option<serde_json::Value> = db2
            .select(("projects", "p1"))
            .await
            .expect("select db2 p1 failed");
        let in_db2_p2: Option<serde_json::Value> = db2
            .select(("projects", "p2"))
            .await
            .expect("select db2 p2 failed");

        assert!(in_db1_p1.is_some(), "db1 should have project p1");
        assert!(in_db1_p2.is_none(), "db1 should NOT have project p2");

        assert!(in_db2_p1.is_none(), "db2 should NOT have project p1");
        assert!(in_db2_p2.is_some(), "db2 should have project p2");
    }

    #[tokio::test]
    async fn test_mock_app_state_implements_surreal_db() {
        let state = create_test_app_state().await;
        let _db = state.surreal_db();
    }

    #[tokio::test]
    async fn test_seed_project_creates_record() {
        let db = create_test_db().await;
        seed_project(&db, "test_proj", "Test Project").await;

        let result: Option<serde_json::Value> = db
            .select(("projects", "test_proj"))
            .await
            .expect("select project failed");

        assert!(result.is_some(), "Project should be created");
        if let Some(proj) = result {
            assert_eq!(proj.get("name").and_then(|v| v.as_str()), Some("Test Project"));
        }
    }
}
