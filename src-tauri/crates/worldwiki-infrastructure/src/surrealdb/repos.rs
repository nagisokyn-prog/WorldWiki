use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::IndexedResults;
use surrealdb::Surreal;

use worldwiki_domain::errors::DomainError;
use worldwiki_domain::knowledge::{Entity, EntityRelation};
use worldwiki_domain::manuscript::{Arc as ArcNode, Chapter, Volume};
use worldwiki_domain::plot::{Plan, PlotPromise};
use worldwiki_ports::ai::RAGContextPort;
use worldwiki_ports::repositories::*;

/// Helper to sanitize record IDs (ensures table prefix handling)
fn clean_id(table: &str, raw_id: &str) -> String {
    if raw_id.contains(':') {
        raw_id.to_string()
    } else {
        format!("{table}:{raw_id}")
    }
}

fn take_one<T: serde::de::DeserializeOwned>(
    res: &mut IndexedResults,
    idx: usize,
) -> Result<Option<T>, DomainError> {
    let raw: Option<Value> = res
        .take(idx)
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
    match raw {
        Some(val) => {
            let item: T =
                serde_json::from_value(val).map_err(|e| DomainError::Validation(e.to_string()))?;
            Ok(Some(item))
        }
        None => Ok(None),
    }
}

fn take_list<T: serde::de::DeserializeOwned>(
    res: &mut IndexedResults,
    idx: usize,
) -> Result<Vec<T>, DomainError> {
    let raw: Vec<Value> = res
        .take(idx)
        .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
    let mut list = Vec::with_capacity(raw.len());
    for val in raw {
        let item: T =
            serde_json::from_value(val).map_err(|e| DomainError::Validation(e.to_string()))?;
        list.push(item);
    }
    Ok(list)
}

// ----------------------------------------------------------------------------
// SurrealChapterRepository
// ----------------------------------------------------------------------------
pub struct SurrealChapterRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealChapterRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl ChapterRepository for SurrealChapterRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Chapter>, DomainError> {
        let sql = "SELECT * FROM type::thing('chapters', $id);";
        let clean = id.trim_start_matches("chapters:");
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, chapter: &Chapter) -> Result<(), DomainError> {
        let clean = chapter.id.trim_start_matches("chapters:").to_string();
        let data =
            serde_json::to_value(chapter).map_err(|e| DomainError::Validation(e.to_string()))?;
        let sql = "UPSERT type::thing('chapters', $id) CONTENT $data;";
        self.db
            .query(sql)
            .bind(("id", clean))
            .bind(("data", data))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("chapters:").to_string();
        let sql = "DELETE type::thing('chapters', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let sql = "SELECT * FROM chapters WHERE project_id = $project_id ORDER BY sort_order ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("project_id", project_id.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let sql = "SELECT * FROM chapters WHERE volume_id = $volume_id ORDER BY sort_order ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("volume_id", volume_id.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}

// ----------------------------------------------------------------------------
// SurrealVolumeRepository
// ----------------------------------------------------------------------------
pub struct SurrealVolumeRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealVolumeRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl VolumeRepository for SurrealVolumeRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Volume>, DomainError> {
        let sql = "SELECT * FROM type::thing('volumes', $id);";
        let clean = id.trim_start_matches("volumes:");
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, volume: &Volume) -> Result<(), DomainError> {
        let clean = volume.id.trim_start_matches("volumes:").to_string();
        let data =
            serde_json::to_value(volume).map_err(|e| DomainError::Validation(e.to_string()))?;
        let sql = "UPSERT type::thing('volumes', $id) CONTENT $data;";
        self.db
            .query(sql)
            .bind(("id", clean))
            .bind(("data", data))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("volumes:").to_string();
        let sql = "DELETE type::thing('volumes', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Volume>, DomainError> {
        let sql = "SELECT * FROM volumes WHERE project_id = $project_id ORDER BY sort_order ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("project_id", project_id.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}

// ----------------------------------------------------------------------------
// SurrealArcRepository
// ----------------------------------------------------------------------------
pub struct SurrealArcRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealArcRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl ArcRepository for SurrealArcRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<ArcNode>, DomainError> {
        let sql = "SELECT * FROM type::thing('arcs', $id);";
        let clean = id.trim_start_matches("arcs:");
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, arc: &ArcNode) -> Result<(), DomainError> {
        let clean = arc.id.trim_start_matches("arcs:").to_string();
        let data = serde_json::to_value(arc).map_err(|e| DomainError::Validation(e.to_string()))?;
        let sql = "UPSERT type::thing('arcs', $id) CONTENT $data;";
        self.db
            .query(sql)
            .bind(("id", clean))
            .bind(("data", data))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("arcs:").to_string();
        let sql = "DELETE type::thing('arcs', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<ArcNode>, DomainError> {
        let sql = "SELECT * FROM arcs WHERE volume_id = $volume_id ORDER BY sort_order ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("volume_id", volume_id.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}

// ----------------------------------------------------------------------------
// SurrealEntityRepository
// ----------------------------------------------------------------------------
pub struct SurrealEntityRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealEntityRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl EntityRepository for SurrealEntityRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Entity>, DomainError> {
        let sql = "SELECT * FROM type::thing('entities', $id);";
        let clean = id.trim_start_matches("entities:");
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, entity: &Entity) -> Result<(), DomainError> {
        let clean = entity.id.trim_start_matches("entities:").to_string();
        let data =
            serde_json::to_value(entity).map_err(|e| DomainError::Validation(e.to_string()))?;
        let sql = "UPSERT type::thing('entities', $id) CONTENT $data;";
        self.db
            .query(sql)
            .bind(("id", clean))
            .bind(("data", data))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("entities:").to_string();
        let sql = "DELETE type::thing('entities', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn search(
        &self,
        project_id: &str,
        query: &str,
        top_k: usize,
    ) -> Result<Vec<Entity>, DomainError> {
        let sql = "SELECT * FROM entities WHERE project_id = $project_id AND (name @@ $query OR description @@ $query) LIMIT $top_k;";
        let mut res = self
            .db
            .query(sql)
            .bind(("project_id", project_id.to_string()))
            .bind(("query", query.to_string()))
            .bind(("top_k", top_k as i64))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn list_by_type(
        &self,
        project_id: &str,
        type_key: &str,
    ) -> Result<Vec<Entity>, DomainError> {
        let sql = "SELECT * FROM entities WHERE project_id = $project_id AND type_key = $type_key ORDER BY name ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("project_id", project_id.to_string()))
            .bind(("type_key", type_key.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}

// ----------------------------------------------------------------------------
// SurrealRelationRepository
// ----------------------------------------------------------------------------
pub struct SurrealRelationRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealRelationRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl RelationRepository for SurrealRelationRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<EntityRelation>, DomainError> {
        let sql = "SELECT * FROM type::thing('entity_rel', $id);";
        let clean = id.trim_start_matches("entity_rel:");
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, rel: &EntityRelation) -> Result<(), DomainError> {
        let clean = rel.id.trim_start_matches("entity_rel:").to_string();
        let data = serde_json::to_value(rel).map_err(|e| DomainError::Validation(e.to_string()))?;
        let sql = "UPSERT type::thing('entity_rel', $id) CONTENT $data;";
        self.db
            .query(sql)
            .bind(("id", clean))
            .bind(("data", data))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("entity_rel:").to_string();
        let sql = "DELETE type::thing('entity_rel', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn get_entity_relations(
        &self,
        entity_id: &str,
    ) -> Result<Vec<EntityRelation>, DomainError> {
        let clean_target = clean_id("entities", entity_id);
        let sql = "SELECT * FROM entity_rel WHERE in = $target OR out = $target;";
        let mut res = self
            .db
            .query(sql)
            .bind(("target", clean_target))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }
}

// ----------------------------------------------------------------------------
// SurrealPlotPromiseRepository
// ----------------------------------------------------------------------------
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
        let sql = "SELECT * FROM type::thing('plot_promises', $id);";
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
        let data =
            serde_json::to_value(promise).map_err(|e| DomainError::Validation(e.to_string()))?;
        let sql = "UPSERT type::thing('plot_promises', $id) CONTENT $data;";
        self.db
            .query(sql)
            .bind(("id", clean))
            .bind(("data", data))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("plot_promises:").to_string();
        let sql = "DELETE type::thing('plot_promises', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_chapter(&self, chapter_id: &str) -> Result<Vec<PlotPromise>, DomainError> {
        let clean = clean_id("chapters", chapter_id);
        let sql = "SELECT * FROM plot_promises WHERE chapter_id = $chapter_id;";
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
            LET $chapters = SELECT VALUE out FROM $volume->contains->contains;
            SELECT * FROM plot_promises WHERE status != 'resolved' AND chapter_id IN $chapters;
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

// ----------------------------------------------------------------------------
// SurrealPlanRepository
// ----------------------------------------------------------------------------
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
        let sql = "SELECT * FROM type::thing('plans', $id);";
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
        let data =
            serde_json::to_value(plan).map_err(|e| DomainError::Validation(e.to_string()))?;
        let sql = "UPSERT type::thing('plans', $id) CONTENT $data;";
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
        let sql = "DELETE type::thing('plans', $id);";
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
            LET $arcs = SELECT VALUE out FROM $volume->contains;
            LET $chapters = SELECT VALUE out FROM $volume->contains->contains;
            SELECT * FROM plans WHERE completed = false AND (parent_ref = $volume OR parent_ref IN $arcs OR parent_ref IN $chapters);
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

// ----------------------------------------------------------------------------
// SurrealRAGAdapter (implements RAGContextPort)
// ----------------------------------------------------------------------------
pub struct SurrealRAGAdapter {
    db: Arc<Surreal<Db>>,
}

impl SurrealRAGAdapter {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl RAGContextPort for SurrealRAGAdapter {
    async fn retrieve_context(
        &self,
        project_id: &str,
        query: &str,
        _scope: &str,
        top_k: usize,
    ) -> Result<Vec<Value>, DomainError> {
        let sql = "SELECT id, title, content FROM text_blocks WHERE project_id = $project_id AND content @@ $query LIMIT $top_k;";
        let mut res = self
            .db
            .query(sql)
            .bind(("project_id", project_id.to_string()))
            .bind(("query", query.to_string()))
            .bind(("top_k", top_k as i64))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let list: Vec<Value> = res.take(0).unwrap_or_default();
        Ok(list)
    }

    async fn retrieve_chapter_multi_hop_context(
        &self,
        _project_id: &str,
        chapter_id: &str,
    ) -> Result<Value, DomainError> {
        let clean_ch = clean_id("chapters", chapter_id);
        let sql = "RETURN fn::get_chapter_multi_hop_context(type::thing('chapters', $chapter_id));";
        let clean = clean_ch.trim_start_matches("chapters:").to_string();
        let mut res = self
            .db
            .query(sql)
            .bind(("chapter_id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let ctx: Option<Value> = res.take(0).unwrap_or_default();
        Ok(ctx.unwrap_or(serde_json::json!({})))
    }
}
