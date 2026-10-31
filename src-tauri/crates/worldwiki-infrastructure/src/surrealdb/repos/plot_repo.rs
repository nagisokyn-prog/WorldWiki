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
        let sql = r#"
            SELECT 
                id,
                project_id,
                chapter_id,
                paragraph_index,
                block_id,
                kind,
                title,
                note,
                status,
                location_id,
                timeline_event_id,
                created_at,
                updated_at,
                ->promise_milestones.{
                    milestone_id: id,
                    stage: stage,
                    quote: quote,
                    note: note,
                    block_id: out.id,
                    chapter_id: out.chapter_id,
                    order_index: out.order_index
                } AS milestones,
                <-participant_of.in.id AS participant_ids,
                ->advances_arc.{
                    arc_id: out.id,
                    arc_phase: phase
                } AS arcs
            FROM type::record($id)
            LIMIT 1;
        "#;
        let clean = clean_id("plot_promises", id);
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean))
            .await
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
        let sql = r#"
            LET $c_rec = IF $c_id != "" { type::record('chapters', $c_id) } ELSE { NONE };
            RETURN fn::upsert_plot_promise($id, type::record($p_id), $c_rec, $data);
        "#;
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
        let sql = "DELETE type::record($id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_chapter(&self, chapter_id: &str) -> Result<Vec<PlotPromise>, DomainError> {
        let clean = clean_id("chapters", chapter_id);
        let sql = r#"
            LET $ch_rec = type::record($chapter_id);
            SELECT 
                id,
                project_id,
                chapter_id,
                paragraph_index,
                block_id,
                kind,
                title,
                note,
                status,
                location_id,
                timeline_event_id,
                created_at,
                updated_at,
                ->promise_milestones.{
                    milestone_id: id,
                    stage: stage,
                    quote: quote,
                    note: note,
                    block_id: out.id,
                    chapter_id: out.chapter_id,
                    order_index: out.order_index
                } AS milestones,
                <-participant_of.in.id AS participant_ids,
                ->advances_arc.{
                    arc_id: out.id,
                    arc_phase: phase
                } AS arcs
            FROM plot_promises 
            WHERE chapter_id = $ch_rec OR ->promise_milestones.out.chapter_id CONTAINS $ch_rec;
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("chapter_id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn list_unresolved_by_volume(
        &self,
        volume_id: &str,
    ) -> Result<Vec<PlotPromise>, DomainError> {
        let clean_vol = clean_id("volumes", volume_id);
        let sql = r#"
            LET $vol_rec = type::record($volume);
            LET $chapters = (SELECT VALUE out FROM contains WHERE in = $vol_rec);
            SELECT 
                id,
                project_id,
                chapter_id,
                paragraph_index,
                block_id,
                kind,
                title,
                note,
                status,
                location_id,
                timeline_event_id,
                created_at,
                updated_at,
                ->promise_milestones.{
                    milestone_id: id,
                    stage: stage,
                    quote: quote,
                    note: note,
                    block_id: out.id,
                    chapter_id: out.chapter_id,
                    order_index: out.order_index
                } AS milestones,
                <-participant_of.in.id AS participant_ids,
                ->advances_arc.{
                    arc_id: out.id,
                    arc_phase: phase
                } AS arcs
            FROM plot_promises 
            WHERE status != 'resolved' AND (chapter_id CONTAINSANY $chapters OR ->promise_milestones.out.chapter_id CONTAINSANY $chapters);
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("volume", clean_vol))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 2)
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
        let sql = "SELECT * FROM type::record($id);";
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, todo: &Todo) -> Result<String, DomainError> {
        let clean = if todo.id.is_empty() {
            uuid::Uuid::new_v4().to_string()
        } else {
            clean_id("todos", &todo.id)
        };
        let owner_record = if todo.owner_id.contains(':') {
            todo.owner_id.clone()
        } else {
            format!("chapters:{}", todo.owner_id)
        };
        let sql = r#"
            UPSERT type::record($id) SET
                owner_id = type::record($owner),
                text = $text,
                is_done = $is_done,
                sort_order = $sort_order,
                created_at = $created_at,
                updated_at = time::now();
        "#;
        self.db
            .query(sql)
            .bind(("id", clean.clone()))
            .bind(("owner", owner_record))
            .bind(("text", todo.text.clone()))
            .bind(("is_done", todo.is_done))
            .bind(("sort_order", todo.sort_order))
            .bind(("created_at", todo.created_at))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(format!("todos:{}", clean))
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("todos", id);
        let sql = "DELETE type::record($id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, DomainError> {
        let sql = "SELECT * FROM todos WHERE owner_id = type::record($owner) ORDER BY sort_order ASC, created_at ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("owner", owner_id.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn list_by_owners(&self, owner_ids: &[&str]) -> Result<Vec<Todo>, DomainError> {
        let sql = "SELECT * FROM todos WHERE owner_id IN $owners ORDER BY sort_order ASC, created_at ASC;";
        let owners: Vec<String> = owner_ids.iter().map(|s| s.to_string()).collect();
        let mut res = self
            .db
            .query(sql)
            .bind(("owners", owners))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}
