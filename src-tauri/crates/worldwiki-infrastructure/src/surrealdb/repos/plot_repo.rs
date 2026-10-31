//! SurrealDB implementation of plot promise and task repositories.

use super::helpers::{clean_id, prepare_data_for_upsert, take_list, take_one};
use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::Surreal;
use surrealdb::engine::local::Db;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::{PlotPromise, Todo};
use worldwiki_ports::repositories::{PlotPromiseRepository, TodoRepository};

pub struct SurrealPlotPromiseRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealPlotPromiseRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl PlotPromiseRepository for SurrealPlotPromiseRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<PlotPromise>, DomainError> {
        let clean = clean_id("plot_promises", id);
        let sql = "RETURN fn::get_plot_promise($id);";
        let res = self
            .db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let mut res = res
            .check()
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, promise: &PlotPromise) -> Result<(), DomainError> {
        let clean = clean_id("plot_promises", &promise.id);
        let proj_clean = clean_id("projects", &promise.project_id);
        let ch_clean = promise
            .chapter_id
            .as_deref()
            .or_else(|| {
                promise
                    .milestones
                    .first()
                    .and_then(|m| m.chapter_id.as_deref())
            })
            .unwrap_or("")
            .trim_start_matches("chapters:")
            .to_string();
        let data = prepare_data_for_upsert(
            serde_json::to_value(promise).map_err(|e| DomainError::Validation(e.to_string()))?,
        );
        let sql = "RETURN fn::upsert_plot_promise($id, $p_id, $c_id, $data);";
        let res = self
            .db
            .query(sql)
            .bind(("id", clean))
            .bind(("p_id", proj_clean))
            .bind(("c_id", ch_clean))
            .bind(("data", data))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check()
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("plot_promises", id);
        let sql = "RETURN fn::delete_plot_promise($id);";
        let res = self
            .db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check()
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_chapter(&self, chapter_id: &str) -> Result<Vec<PlotPromise>, DomainError> {
        let clean = clean_id("chapters", chapter_id);
        let sql = "RETURN fn::list_plot_promises_by_chapter($chapter_id);";
        let res = self
            .db
            .query(sql)
            .bind(("chapter_id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let mut res = res
            .check()
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn list_unresolved_by_volume(
        &self,
        volume_id: &str,
    ) -> Result<Vec<PlotPromise>, DomainError> {
        let clean_vol = clean_id("volumes", volume_id);
        let sql = "RETURN fn::list_unresolved_promises_by_volume($volume);";
        let res = self
            .db
            .query(sql)
            .bind(("volume", clean_vol))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let mut res = res
            .check()
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}

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
        let raw_id = clean
            .trim_start_matches("todos:")
            .trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'')
            .to_string();
        let sql = "RETURN fn::get_todo($raw_id);";
        let res = self
            .db
            .query(sql)
            .bind(("raw_id", raw_id))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let mut res = res
            .check()
            .map_err(|e| DomainError::ConstraintViolation(format!("Todo get error: {e}")))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, todo: &Todo) -> Result<String, DomainError> {
        let clean = if todo.id.is_empty() {
            clean_id("todos", &uuid::Uuid::new_v4().to_string())
        } else {
            clean_id("todos", &todo.id)
        };
        let raw_id = clean
            .trim_start_matches("todos:")
            .trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'')
            .to_string();

        let (owner_table, owner_raw) = if let Some((tbl, id)) = todo.owner_id.split_once(':') {
            (
                tbl.trim().to_string(),
                id.trim()
                    .trim_matches(|c: char| {
                        c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\''
                    })
                    .to_string(),
            )
        } else {
            (
                "chapters".to_string(),
                todo.owner_id
                    .trim()
                    .trim_matches(|c: char| {
                        c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\''
                    })
                    .to_string(),
            )
        };

        let sql = "RETURN fn::save_todo($raw_id, $owner_table, $owner_raw, $text, $is_done, $sort_order);";
        let res = self
            .db
            .query(sql)
            .bind(("raw_id", raw_id))
            .bind(("owner_table", owner_table))
            .bind(("owner_raw", owner_raw))
            .bind(("text", todo.text.clone()))
            .bind(("is_done", todo.is_done))
            .bind(("sort_order", todo.sort_order))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check()
            .map_err(|e| DomainError::ConstraintViolation(format!("Todo save error: {e}")))?;
        Ok(clean)
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("todos", id);
        let raw_id = clean
            .trim_start_matches("todos:")
            .trim_matches(|c: char| c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\'')
            .to_string();
        let sql = "RETURN fn::delete_todo($raw_id);";
        let res = self
            .db
            .query(sql)
            .bind(("raw_id", raw_id))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check()
            .map_err(|e| DomainError::ConstraintViolation(format!("Todo delete error: {e}")))?;
        Ok(())
    }

    async fn list_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, DomainError> {
        let (owner_table, owner_raw) = if let Some((tbl, id)) = owner_id.split_once(':') {
            (
                tbl.trim().to_string(),
                id.trim()
                    .trim_matches(|c: char| {
                        c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\''
                    })
                    .to_string(),
            )
        } else {
            (
                "chapters".to_string(),
                owner_id
                    .trim()
                    .trim_matches(|c: char| {
                        c == '`' || c == '⟨' || c == '⟩' || c == '"' || c == '\''
                    })
                    .to_string(),
            )
        };
        let sql = "RETURN fn::list_todos_by_owner($owner_table, $owner_raw);";
        let res = self
            .db
            .query(sql)
            .bind(("owner_table", owner_table))
            .bind(("owner_raw", owner_raw))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let mut res = res
            .check()
            .map_err(|e| DomainError::ConstraintViolation(format!("Todo list error: {e}")))?;
        take_list(&mut res, 0)
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
        let sql = "RETURN fn::list_todos_by_owners($owners);";
        let res = self
            .db
            .query(sql)
            .bind(("owners", owners))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let mut res = res.check().map_err(|e| {
            DomainError::ConstraintViolation(format!("Todo list_by_owners error: {e}"))
        })?;
        take_list(&mut res, 0)
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

        // Set up minimal schema and functions for todos
        db.query("DEFINE TABLE todos SCHEMALESS;")
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

        let list = repo
            .list_by_owner("chapters:ch_1")
            .await
            .expect("list_by_owner");
        assert_eq!(list.len(), 1);

        repo.delete(&id).await.expect("delete");
        let after_delete = repo.get_by_id(&id).await.expect("get after delete");
        assert!(after_delete.is_none());
    }
}
