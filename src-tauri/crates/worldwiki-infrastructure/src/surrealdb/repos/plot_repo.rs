//! SurrealDB implementation of PlotPromiseRepository and PlanRepository.

use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::plot::{Plan, PlotPromise};
use worldwiki_ports::repositories::{PlanRepository, PlotPromiseRepository};
use super::helpers::{clean_id, prepare_data_for_upsert, take_list, take_one};

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
                kind,
                title,
                note,
                status,
                location_id,
                timeline_event_id,
                m_abs,
                calendar_id,
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
                } AS arcs,
                ->advances_arc.out.id[0] AS arc_id,
                ->advances_arc.phase[0] AS arc_phase
            FROM type::record('plot_promises', $id)
            LIMIT 1;
        "#;
        let clean = id.trim_start_matches("plot_promises:");
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, promise: &PlotPromise) -> Result<(), DomainError> {
        let clean = promise.id.trim_start_matches("plot_promises:").to_string();
        let proj_clean = promise.project_id.trim_start_matches("projects:").to_string();
        let ch_clean = promise
            .milestones
            .first()
            .and_then(|m| m.chapter_id.as_deref())
            .unwrap_or("")
            .trim_start_matches("chapters:")
            .to_string();
        let data = prepare_data_for_upsert(
            serde_json::to_value(promise).map_err(|e| DomainError::Validation(e.to_string()))?,
        );
        let sql = "RETURN fn::upsert_plot_promise($id, type::record('projects', $p_id), type::record('chapters', $c_id), $data);";
        let res = self
            .db
            .query(sql)
            .bind(("id", clean))
            .bind(("p_id", proj_clean))
            .bind(("c_id", ch_clean))
            .bind(("data", data))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("plot_promises:").to_string();
        let sql = "DELETE type::record('plot_promises', $id);";
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
            SELECT 
                id,
                project_id,
                kind,
                title,
                note,
                status,
                location_id,
                timeline_event_id,
                m_abs,
                calendar_id,
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
                } AS arcs,
                ->advances_arc.out.id[0] AS arc_id,
                ->advances_arc.phase[0] AS arc_phase
            FROM plot_promises 
            WHERE ->promise_milestones.out.chapter_id CONTAINS type::record('chapters', $chapter_id);
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
            LET $vol_rec = type::record('volumes', $volume);
            LET $chapters = (SELECT VALUE out FROM contains WHERE in = $vol_rec);
            SELECT 
                id,
                project_id,
                kind,
                title,
                note,
                status,
                location_id,
                timeline_event_id,
                m_abs,
                calendar_id,
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
                } AS arcs,
                ->advances_arc.out.id[0] AS arc_id,
                ->advances_arc.phase[0] AS arc_phase
            FROM plot_promises 
            WHERE status != 'resolved' AND ->promise_milestones.out.chapter_id CONTAINSANY $chapters;
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

pub struct SurrealPlanRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealPlanRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl PlanRepository for SurrealPlanRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Plan>, DomainError> {
        let sql = "SELECT * FROM type::record('plans', $id);";
        let clean = id.trim_start_matches("plans:");
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, plan: &Plan) -> Result<(), DomainError> {
        let clean = plan.id.trim_start_matches("plans:").to_string();
        let data = prepare_data_for_upsert(
            serde_json::to_value(plan).map_err(|e| DomainError::Validation(e.to_string()))?,
        );
        let sql = "UPSERT type::record('plans', $id) CONTENT $data;";
        self.db
            .query(sql)
            .bind(("id", clean))
            .bind(("data", data))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("plans:").to_string();
        let sql = "DELETE type::record('plans', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_parent(&self, parent_ref: &str) -> Result<Vec<Plan>, DomainError> {
        let sql = "SELECT * FROM plans WHERE parent_ref = $parent_ref ORDER BY sort_order ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("parent_ref", parent_ref.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn list_pending_by_volume(&self, volume_id: &str) -> Result<Vec<Plan>, DomainError> {
        let clean_vol = clean_id("volumes", volume_id);
        let sql = r#"
            LET $chapters = SELECT VALUE out FROM $volume->contains;
            SELECT * FROM plans WHERE completed = false AND (parent_ref = $volume OR parent_ref IN $chapters);
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("volume", clean_vol))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 1)
    }
}
