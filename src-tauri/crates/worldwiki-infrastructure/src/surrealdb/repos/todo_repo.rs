//! SurrealDB implementation of task (todo) repository.

use super::helpers::clean_id;
use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::Surreal;
use surrealdb::engine::local::Db;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::Todo;
use worldwiki_ports::repositories::TodoRepository;

pub struct SurrealTodoRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealTodoRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl TodoRepository for SurrealTodoRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Todo>, DomainError> {
        let clean = clean_id("todos", id);
        let raw_id = clean_raw_id!(&clean, "todos");
        surreal_take_one!(self.db, "RETURN fn::get_todo($raw_id);", ("raw_id", raw_id))
    }

    async fn save(&self, todo: &Todo) -> Result<String, DomainError> {
        let clean = if todo.id.is_empty() {
            clean_id("todos", &uuid::Uuid::new_v4().to_string())
        } else {
            clean_id("todos", &todo.id)
        };
        let raw_id = clean_raw_id!(&clean, "todos");

        let (owner_table, owner_raw) = if let Some((tbl, id)) = todo.owner_id.split_once(':') {
            (tbl.trim(), clean_raw_id!(id))
        } else {
            ("chapters", clean_raw_id!(&todo.owner_id))
        };

        surreal_exec!(
            self.db,
            "RETURN fn::save_todo($raw_id, $owner_table, $owner_raw, $text, $is_done, $sort_order);",
            ("raw_id", raw_id),
            ("owner_table", owner_table),
            ("owner_raw", owner_raw),
            ("text", todo.text.clone()),
            ("is_done", todo.is_done),
            ("sort_order", todo.sort_order),
        )?;
        Ok(clean)
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("todos", id);
        let raw_id = clean_raw_id!(&clean, "todos");
        surreal_exec!(self.db, "RETURN fn::delete_todo($raw_id);", ("raw_id", raw_id))
    }

    async fn list_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, DomainError> {
        let (owner_table, owner_raw) = if let Some((tbl, id)) = owner_id.split_once(':') {
            (tbl.trim(), clean_raw_id!(id))
        } else {
            ("chapters", clean_raw_id!(owner_id))
        };
        surreal_take_list!(
            self.db,
            "RETURN fn::list_todos_by_owner($owner_table, $owner_raw);",
            ("owner_table", owner_table),
            ("owner_raw", owner_raw),
        )
    }

    async fn list_by_owners(&self, owner_ids: &[&str]) -> Result<Vec<Todo>, DomainError> {
        let owners: Vec<String> = owner_ids
            .iter()
            .map(|s| {
                if s.contains(':') {
                    s.to_string()
                } else {
                    format!("chapters:{}", s)
                }
            })
            .collect();
        surreal_take_list!(
            self.db,
            "RETURN fn::list_todos_by_owners($owners);",
            ("owners", owners),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use surrealdb::engine::local::Mem;

    #[tokio::test]
    async fn test_todo_repo_crud_in_memory() {
        let db = Surreal::new::<Mem>(()).await.expect("mem db");
        db.use_ns("test").use_db("test").await.expect("use ns/db");

        // Schema initialization for test database
        db.query("
            DEFINE TABLE OVERWRITE todos SCHEMAFULL;
            DEFINE FIELD OVERWRITE owner_id    ON todos TYPE record<volumes | chapters | story_arcs>;
            DEFINE FIELD OVERWRITE text        ON todos TYPE string;
            DEFINE FIELD OVERWRITE is_done     ON todos TYPE bool DEFAULT false;
            DEFINE FIELD OVERWRITE sort_order  ON todos TYPE int DEFAULT 0;
            DEFINE FIELD OVERWRITE created_at  ON todos TYPE datetime DEFAULT time::now();
            DEFINE FIELD OVERWRITE updated_at  ON todos TYPE datetime DEFAULT time::now();
            DEFINE INDEX OVERWRITE idx_todos_owner_id ON todos FIELDS owner_id;
        ")
            .await
            .expect("schema")
            .check()
            .expect("check");
        let analyzers_schema = include_str!("../../../../../../apps/spa/src/logic/schema/no_ai/00_analyzers.surql");
        let ddl_funcs = include_str!("../../../../../../apps/spa/src/logic/schema/no_ai/functions/07_narrative_and_journey.surql");
        let _ = db.query(analyzers_schema).await;
        let _ = db.query(ddl_funcs).await;

        let repo = SurrealTodoRepository::new(Arc::new(db));
        let mut todo = Todo::new("chapters:ch_1", "Test todo text", 1);
        let id = repo.save(&todo).await.expect("save todo");
        assert!(id.starts_with("todos:"));

        todo.id = id.clone();
        let fetched = repo.get_by_id(&id).await.expect("get_by_id");
        assert!(fetched.is_some());
        let f = fetched.unwrap();
        assert_eq!(f.text, "Test todo text");
        assert!(!f.is_done);
    }
}

