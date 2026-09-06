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

fn prepare_data_for_upsert(mut data: Value) -> Value {
    if let Value::Object(ref mut map) = data {
        map.remove("id");
    }
    data
}

fn normalize_surreal_value(val: &mut Value) {
    if let Value::Object(map) = val {
        for (_k, v) in map.iter_mut() {
            if let Value::Object(inner) = v {
                if let (Some(Value::String(tb)), Some(id_val)) = (inner.get("tb"), inner.get("id")) {
                    let id_str = match id_val {
                        Value::String(s) => s.clone(),
                        _ => id_val.to_string().trim_matches('"').to_string(),
                    };
                    *v = Value::String(format!("{tb}:{id_str}"));
                } else {
                    normalize_surreal_value(v);
                }
            } else if let Value::Array(arr) = v {
                for item in arr {
                    normalize_surreal_value(item);
                }
            }
        }
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
        Some(mut val) => {
            normalize_surreal_value(&mut val);
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
    for mut val in raw {
        normalize_surreal_value(&mut val);
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
        let sql = "SELECT * FROM type::record('chapters', $id);";
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
        let proj_clean = chapter.project_id.trim_start_matches("projects:").to_string();

        // Используем MERGE SET с явными type::record() для полей-ссылок,
        // чтобы избежать несовместимости строки с TYPE record<projects> в SCHEMAFULL.
        let sql = r#"
            UPSERT type::record('chapters', $c_id) MERGE {
                title: $title,
                content: $content,
                project_id: type::record('projects', $p_id),
                word_count: $word_count,
                updated_at: time::now()
            };
        "#;
        let mut res = self.db
            .query(sql)
            .bind(("c_id", clean))
            .bind(("p_id", proj_clean))
            .bind(("title", chapter.title.clone()))
            .bind(("content", chapter.content.clone()))
            .bind(("word_count", chapter.word_count as i64))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        // Проверяем ошибки внутри результата (schema violations и т.д.)
        let errors = res.take_errors();
        if let Some((_, e)) = errors.into_iter().next() {
            return Err(DomainError::ConstraintViolation(e.to_string()));
        }
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("chapters:").to_string();
        let sql = "DELETE type::record('chapters', $id);";
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
        let sql = "SELECT * FROM type::record('volumes', $id);";
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
        let data = prepare_data_for_upsert(
            serde_json::to_value(volume).map_err(|e| DomainError::Validation(e.to_string()))?,
        );
        let sql = "UPSERT type::record('volumes', $id) CONTENT $data;";
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
        let sql = "DELETE type::record('volumes', $id);";
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
        let sql = "SELECT * FROM type::record('arcs', $id);";
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
        let data = prepare_data_for_upsert(
            serde_json::to_value(arc).map_err(|e| DomainError::Validation(e.to_string()))?,
        );
        let sql = "UPSERT type::record('arcs', $id) CONTENT $data;";
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
        let sql = "DELETE type::record('arcs', $id);";
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
        let sql = "SELECT * FROM type::record('entities', $id);";
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
        let proj_clean = entity.project_id.trim_start_matches("projects:").to_string();

        let sql = r#"
            UPSERT type::record('entities', $e_id) MERGE {
                project_id: type::record('projects', $p_id),
                entity_type: $entity_type,
                name: $name,
                description: $description,
                attributes: $attributes,
                tags: $tags,
                updated_at: time::now()
            };
        "#;
        let mut res = self.db
            .query(sql)
            .bind(("e_id", clean))
            .bind(("p_id", proj_clean))
            .bind(("entity_type", entity.type_key.clone()))
            .bind(("name", entity.name.clone()))
            .bind(("description", entity.description.clone()))
            .bind(("attributes", entity.attributes.clone()))
            .bind(("tags", entity.tags.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let errors = res.take_errors();
        if let Some((_, e)) = errors.into_iter().next() {
            return Err(DomainError::ConstraintViolation(e.to_string()));
        }
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("entities:").to_string();
        let sql = "DELETE type::record('entities', $id);";
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
        let sql = "SELECT * FROM type::record('entity_rel', $id);";
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
        let data = prepare_data_for_upsert(
            serde_json::to_value(rel).map_err(|e| DomainError::Validation(e.to_string()))?,
        );
        let sql = "UPSERT type::record('entity_rel', $id) CONTENT $data;";
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
        let sql = "DELETE type::record('entity_rel', $id);";
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
        let sql = "SELECT * FROM type::record('plot_promises', $id);";
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
        let data = prepare_data_for_upsert(
            serde_json::to_value(promise).map_err(|e| DomainError::Validation(e.to_string()))?,
        );
        let sql = "UPSERT type::record('plot_promises', $id) CONTENT $data;";
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
        let p_clean = project_id.trim_start_matches("projects:").to_string();
        let q_lower = query.to_lowercase();

        // Пробуем сначала с фильтрацией по project_id через type::record()
        let mut res_ch = self.db
            .query("SELECT id, title, content FROM chapters WHERE project_id = type::record('projects', $p_id)")
            .bind(("p_id", p_clean.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let mut chaps: Vec<Value> = res_ch.take(0).unwrap_or_default();

        // Fallback: если запрос с type::record вернул пусто — берём все главы и фильтруем в Rust
        // (SurrealKV иногда имеет особенности с record type comparison)
        if chaps.is_empty() {
            let mut res_all = self.db
                .query("SELECT id, title, content, project_id FROM chapters")
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
            let all_chaps: Vec<Value> = res_all.take(0).unwrap_or_default();
            let p_clean_ref = &p_clean;
            chaps = all_chaps.into_iter().filter(|v| {
                let Some(p) = v.get("project_id") else { return true; };
                let key = match p {
                    Value::String(s) => s.trim_start_matches("projects:").to_string(),
                    Value::Object(obj) => {
                        let id_val = obj.get("id").unwrap_or(&Value::Null);
                        match id_val {
                            Value::Object(id_obj) => id_obj.get("String").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            Value::String(s) => s.clone(),
                            _ => String::new(),
                        }
                    }
                    _ => String::new(),
                };
                key == *p_clean_ref || p_clean_ref.is_empty()
            }).collect();
        }

        let mut res_tb = self.db
            .query("SELECT id, title, content FROM text_blocks WHERE project_id = type::record('projects', $p_id)")
            .bind(("p_id", p_clean.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let text_blocks: Vec<Value> = res_tb.take(0).unwrap_or_default();

        let mut res_en = self.db
            .query("SELECT id, name AS title, description AS content FROM entities WHERE project_id = type::record('projects', $p_id)")
            .bind(("p_id", p_clean.clone()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let ents: Vec<Value> = res_en.take(0).unwrap_or_default();

        // Ищем во всех таблицах по тексту
        let mut list: Vec<Value> = Vec::new();

        for item in text_blocks.into_iter().chain(chaps).chain(ents) {
            let t = item.get("title").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            let cont = item.get("content").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            if q_lower.is_empty() || t.contains(&q_lower) || cont.contains(&q_lower) {
                list.push(item);
            }
        }

        list.truncate(top_k);
        Ok(list)
    }

    async fn retrieve_chapter_multi_hop_context(
        &self,
        _project_id: &str,
        chapter_id: &str,
    ) -> Result<Value, DomainError> {
        let clean_ch = clean_id("chapters", chapter_id);
        let sql = "RETURN fn::get_chapter_multi_hop_context(type::record('chapters', $chapter_id));";
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
