use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::IndexedResults;
use surrealdb::Surreal;

use super::chat_repo::clean_record_id;
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

/// Canonicalizes entity/character names for robust multi-variant matching:
/// - lowercases and trims
/// - strips quotes («», "", ''), brackets, punctuation
/// - normalizes 'ё' -> 'е', 'й' -> 'и'
/// - unifies all dash variations ('–', '—', '―') into '-'
/// - collapses multiple spaces
pub fn canonicalize_name(input: &str) -> String {
    let mut s = input.trim().to_lowercase();
    // Strip quotes and punctuation
    s = s
        .chars()
        .filter(|c| !"'\"«»`()[]{}<>.,!?;:".contains(*c))
        .collect();
    // Normalize Cyrillic variants
    s = s.replace('ё', "е").replace('й', "и");
    // Unify dashes
    s = s.replace(['–', '—', '―'], "-");
    // Collapse whitespace
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Computes Levenshtein distance between two strings
pub fn levenshtein_distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let m = a_chars.len();
    let n = b_chars.len();
    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }
    let mut d = vec![vec![0; n + 1]; m + 1];
    for (i, row) in d.iter_mut().enumerate().take(m + 1) {
        row[0] = i;
    }
    for (j, item) in d[0].iter_mut().enumerate().take(n + 1) {
        *item = j;
    }
    for i in 1..=m {
        for j in 1..=n {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            d[i][j] = std::cmp::min(
                std::cmp::min(d[i - 1][j] + 1, d[i][j - 1] + 1),
                d[i - 1][j - 1] + cost,
            );
        }
    }
    d[m][n]
}

/// Checks if query fuzzy-matches target name or any aliases:
/// 1. Canonical equality
/// 2. Snowball stemming match (all grammatical declensions like "Лёхе", "Лёхой", "Лёху" -> "лех")
/// 3. Substring / Root match
/// 4. Levenshtein distance <= 2 (for typos in long names)
pub fn fuzzy_match_name(query: &str, target_name: &str, aliases: &[String]) -> bool {
    let q_canon = canonicalize_name(query);
    if q_canon.is_empty() {
        return false;
    }
    let q_stem = super::stemmer::SnowballStemmer::stem_phrase(&q_canon);
    let q_tokens: Vec<String> = q_canon
        .split_whitespace()
        .map(super::stemmer::SnowballStemmer::stem_word)
        .filter(|s| !s.is_empty())
        .collect();

    let check_candidate = |candidate: &str| -> bool {
        let c_canon = canonicalize_name(candidate);
        if c_canon.is_empty() {
            return false;
        }
        // 1. Exact canonical match
        if q_canon == c_canon {
            return true;
        }
        // 2. Snowball stem equality or containment
        let c_stem = super::stemmer::SnowballStemmer::stem_phrase(&c_canon);
        if !q_stem.is_empty()
            && !c_stem.is_empty()
            && (q_stem == c_stem || q_stem.contains(&c_stem) || c_stem.contains(&q_stem))
        {
            return true;
        }

        // 3. Word token stem overlap
        let c_tokens: Vec<String> = c_canon
            .split_whitespace()
            .map(super::stemmer::SnowballStemmer::stem_word)
            .filter(|s| !s.is_empty())
            .collect();
        for q_tok in &q_tokens {
            if c_tokens.contains(q_tok) {
                return true;
            }
        }
        // 4. Substring contains (query inside candidate or candidate inside query)
        if q_canon.contains(&c_canon) || c_canon.contains(&q_canon) {
            return true;
        }
        // 5. Root match (strip 1-3 chars declension endings if length >= 4)
        let q_root = if q_canon.chars().count() >= 4 {
            q_canon
                .chars()
                .take(q_canon.chars().count() - 2)
                .collect::<String>()
        } else {
            q_canon.clone()
        };
        let c_root = if c_canon.chars().count() >= 4 {
            c_canon
                .chars()
                .take(c_canon.chars().count() - 2)
                .collect::<String>()
        } else {
            c_canon.clone()
        };
        if c_canon.starts_with(&q_root) || q_canon.starts_with(&c_root) {
            return true;
        }
        // 6. Fuzzy Levenshtein for typos (<= 2 edits if length >= 4)
        if q_canon.chars().count() >= 4
            && c_canon.chars().count() >= 4
            && levenshtein_distance(&q_canon, &c_canon) <= 2
        {
            return true;
        }
        false
    };

    if check_candidate(target_name) {
        return true;
    }
    for alias in aliases {
        if check_candidate(alias) {
            return true;
        }
    }
    false
}


/// Universal helper to construct a project_id WHERE clause that matches
/// RecordId, raw string, and cleaned string representations in SurrealDB.
#[inline]
pub fn project_where_clause(field: &str) -> String {
    format!(
        "({field} = type::record('projects', $p_clean) OR {field} = $p_raw OR {field} = $p_clean OR {field} = type::record('projects', $p_raw))"
    )
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
                if let (Some(Value::String(tb)), Some(id_val)) = (inner.get("tb"), inner.get("id"))
                {
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
        let proj_clean = chapter
            .project_id
            .trim_start_matches("projects:")
            .to_string();

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
        let mut res = self
            .db
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
        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();
        let where_clause = project_where_clause("project_id");
        let sql = format!("SELECT * FROM chapters WHERE {where_clause} ORDER BY sort_order ASC;");
        let mut res = self
            .db
            .query(&sql)
            .bind(("p_raw", p_raw))
            .bind(("p_clean", p_clean))
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
        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();
        let where_clause = project_where_clause("project_id");
        let sql = format!("SELECT * FROM volumes WHERE {where_clause} ORDER BY sort_order ASC;");
        let mut res = self
            .db
            .query(&sql)
            .bind(("p_raw", p_raw))
            .bind(("p_clean", p_clean))
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
        let proj_clean = entity
            .project_id
            .trim_start_matches("projects:")
            .to_string();

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
        let mut res = self
            .db
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
        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();
        let where_clause = project_where_clause("project_id");
        let sql = format!("SELECT * FROM entities WHERE {where_clause};");
        let mut res = self
            .db
            .query(&sql)
            .bind(("p_raw", p_raw))
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let all_entities: Vec<Entity> = take_list(&mut res, 0)?;

        let q_trimmed = query.trim();
        if q_trimmed.is_empty() {
            let mut list = all_entities;
            list.truncate(top_k);
            return Ok(list);
        }

        let mut matched = Vec::new();
        for entity in all_entities {
            if fuzzy_match_name(q_trimmed, &entity.name, &entity.tags)
                || entity.name.to_lowercase().contains(&q_trimmed.to_lowercase())
                || entity
                    .description
                    .as_ref()
                    .map(|d| d.to_lowercase().contains(&q_trimmed.to_lowercase()))
                    .unwrap_or(false)
            {
                matched.push(entity);
            }
            if matched.len() >= top_k {
                break;
            }
        }
        Ok(matched)
    }

    async fn list_by_type(
        &self,
        project_id: &str,
        type_key: &str,
    ) -> Result<Vec<Entity>, DomainError> {
        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();
        let where_clause = project_where_clause("project_id");
        let sql = format!("SELECT * FROM entities WHERE {where_clause} AND (entity_type = $type_key OR type_key = $type_key) ORDER BY name ASC;");
        let mut res = self
            .db
            .query(&sql)
            .bind(("p_raw", p_raw))
            .bind(("p_clean", p_clean))
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

#[derive(Debug, Clone, serde::Deserialize)]
pub struct EntitySearchDto {
    pub id: Option<Value>,
    pub name: Option<String>,
    pub type_key: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub attributes: Option<Value>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct LoreChunkSearchDto {
    pub id: Option<Value>,
    pub entity_id: Option<Value>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ChapterSearchDto {
    pub id: Option<Value>,
    pub title: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct EntityRelationSearchDto {
    #[serde(rename = "in")]
    pub from: Option<Value>,
    pub out: Option<Value>,
    pub rel_type: Option<String>,
    pub description: Option<String>,
    pub strength: Option<i32>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct RagBundleDto {
    #[serde(default)]
    pub entities: Vec<EntitySearchDto>,
    #[serde(default)]
    pub chunks: Vec<LoreChunkSearchDto>,
    #[serde(default)]
    pub chapters: Vec<ChapterSearchDto>,
    #[serde(default)]
    pub relations: Vec<EntityRelationSearchDto>,
}

fn format_entity_search_dto(ent: &EntitySearchDto) -> Value {
    let name = ent.name.as_deref().unwrap_or("Сущность");
    let type_key = ent.type_key.as_deref().unwrap_or("entity");
    let desc = ent.description.as_deref().unwrap_or("");
    let tags = ent.tags.as_ref().map(|arr| arr.join(", ")).unwrap_or_default();

    let mut out = format!("[СУЩНОСТЬ: {name} (тип: {type_key})]\n");
    if !tags.is_empty() {
        out.push_str(&format!("Теги: {tags}\n"));
    }
    if !desc.trim().is_empty() {
        out.push_str(&format!("Описание: {}\n", desc.trim()));
    }
    if let Some(attrs) = ent.attributes.as_ref().and_then(|v| v.as_object()) {
        for (k, v) in attrs {
            if k == "embeddings" || k.starts_with('_') { continue; }
            let val_str = match v {
                Value::String(s) if !s.trim().is_empty() => s.clone(),
                Value::Array(arr) if !arr.is_empty() => {
                    let items: Vec<String> = arr.iter().filter_map(|item| match item {
                        Value::String(s) => {
                            let trimmed = s.trim();
                            if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
                        }
                        Value::Object(o) => {
                            if let Some(n) = o.get("название").and_then(|x| x.as_str()) {
                                let trimmed = n.trim();
                                if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
                            } else {
                                Some(item.to_string())
                            }
                        }
                        Value::Null => None,
                        _ => Some(item.to_string()),
                    }).collect();
                    items.join(", ")
                }
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                _ => String::new(),
            };
            if !val_str.is_empty() {
                out.push_str(&format!("- {k}: {val_str}\n"));
            }
        }
    }
    serde_json::json!({
        "id": ent.id,
        "name": name,
        "type_key": type_key,
        "title": name,
        "content": out,
        "source_type": "entity",
        "tags": ent.tags,
        "attributes": ent.attributes,
    })
}

fn format_entity_dossier_value(row: &Value) -> Value {
    let mut obj = row.as_object().cloned().unwrap_or_default();
    let name = obj.get("name").and_then(|v| v.as_str()).or_else(|| obj.get("title").and_then(|v| v.as_str())).unwrap_or("Сущность");
    let type_key = obj.get("type_key").and_then(|v| v.as_str()).unwrap_or("entity");
    let desc = obj.get("description").and_then(|v| v.as_str()).or_else(|| obj.get("content").and_then(|v| v.as_str())).unwrap_or("");
    let tags = obj.get("tags").and_then(|v| v.as_array()).map(|arr| {
        arr.iter().filter_map(|t| t.as_str()).collect::<Vec<_>>().join(", ")
    }).unwrap_or_default();

    let mut out = format!("[СУЩНОСТЬ: {name} (тип: {type_key})]\n");
    if !tags.is_empty() {
        out.push_str(&format!("Теги: {tags}\n"));
    }
    if !desc.trim().is_empty() {
        out.push_str(&format!("Описание: {}\n", desc.trim()));
    }
    if let Some(attrs) = obj.get("attributes").and_then(|v| v.as_object()) {
        for (k, v) in attrs {
            if k == "embeddings" || k.starts_with('_') { continue; }
            let val_str = match v {
                Value::String(s) if !s.trim().is_empty() => s.clone(),
                Value::Array(arr) if !arr.is_empty() => {
                    let items: Vec<String> = arr.iter().filter_map(|item| match item {
                        Value::String(s) => {
                            let trimmed = s.trim();
                            if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
                        }
                        Value::Object(o) => {
                            if let Some(n) = o.get("название").and_then(|x| x.as_str()) {
                                let trimmed = n.trim();
                                if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
                            } else {
                                Some(item.to_string())
                            }
                        }
                        Value::Null => None,
                        _ => Some(item.to_string()),
                    }).collect();
                    items.join(", ")
                }
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                _ => String::new(),
            };
            if !val_str.is_empty() {
                out.push_str(&format!("- {k}: {val_str}\n"));
            }
        }
    }
    obj.insert("title".to_string(), Value::String(name.to_string()));
    obj.insert("content".to_string(), Value::String(out));
    obj.insert("source_type".to_string(), Value::String("entity".to_string()));
    Value::Object(obj)
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
        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();
        let where_proj = project_where_clause("project_id");

        let q_trimmed = query.trim();
        let q_canon = canonicalize_name(q_trimmed);
        let q_lower = q_trimmed.to_lowercase();

        let mut list: Vec<Value> = Vec::new();
        let mut entity_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

        // 0. Exact Document Retrieval (detect chapter requests like "глава 1", "глава 2", "chapter 1")
        let is_chapter_req = q_canon.contains("глав") || q_canon.contains("chapter");
        if is_chapter_req {
            let num_opt = q_lower.split_whitespace().find_map(|word| {
                word.trim_matches(|c: char| !c.is_numeric())
                    .parse::<u32>()
                    .ok()
            });

            if let Some(num) = num_opt {
                let num_str = num.to_string();
                let exact_sql = format!(
                    "SELECT id, title, content, 'chapter' AS source_type FROM chapters WHERE {where_proj} AND (title CONTAINS $num_str OR title CONTAINS 'Глава ' + $num_str OR title CONTAINS 'Chapter ' + $num_str) LIMIT 1"
                );
                if let Ok(mut resp) = self
                    .db
                    .query(&exact_sql)
                    .bind(("p_raw", p_raw.clone()))
                    .bind(("p_clean", p_clean.clone()))
                    .bind(("num_str", num_str))
                    .await
                {
                    if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                        for r in rows {
                            list.push(r);
                        }
                    }
                }
            }
        }

        // 1. Атомарный вызов fn::gather_rag_bundle (1 раундтрип, типизированный DTO)
        let rel_limit = (top_k * 2).clamp(10, 30) as i64;
        let sub_limit = (top_k as i64).clamp(4, 15);
        let bundle_sql = "RETURN fn::gather_rag_bundle(type::record('projects', $p_clean), $q, $limit, $rel_limit);";

        let bundle_opt: Option<RagBundleDto> = match self
            .db
            .query(bundle_sql)
            .bind(("p_clean", p_clean.clone()))
            .bind(("q", q_trimmed))
            .bind(("limit", sub_limit))
            .bind(("rel_limit", rel_limit))
            .await
        {
            Ok(mut resp) => {
                let raw_val: Option<Value> = resp.take(0).ok().flatten();
                raw_val.and_then(|v| serde_json::from_value::<RagBundleDto>(v).ok())
            }
            Err(_) => None,
        };

        if let Some(bundle) = bundle_opt {
            for ent in bundle.entities {
                if let Some(id) = ent.id.as_ref().and_then(clean_record_id) {
                    entity_ids.insert(id);
                }
                list.push(format_entity_search_dto(&ent));
            }

            for chunk in bundle.chunks {
                if let Some(eid) = chunk.entity_id.as_ref().and_then(clean_record_id) {
                    entity_ids.insert(eid);
                }
                list.push(serde_json::json!({
                    "id": chunk.id,
                    "entity_id": chunk.entity_id,
                    "content": chunk.content.unwrap_or_default(),
                    "source_type": "lore_chunk",
                }));
            }

            for chap in bundle.chapters {
                list.push(serde_json::json!({
                    "id": chap.id,
                    "title": chap.title.unwrap_or_default(),
                    "content": chap.content.unwrap_or_default(),
                    "source_type": "chapter",
                }));
            }

            for rel in bundle.relations {
                list.push(serde_json::json!({
                    "source_type": "relation",
                    "from": rel.from,
                    "to": rel.out,
                    "rel_type": rel.rel_type,
                    "description": rel.description,
                    "strength": rel.strength,
                }));
            }
        }

        // 2. Fallback search (Fuzzy & Snowball stemming) если лексический BM25 вернул мало данных
        if list.len() < top_k {
            let mut res_ch = self
                .db
                .query(format!(
                    "SELECT id, title, content, 'chapter' AS source_type FROM chapters WHERE {where_proj}"
                ))
                .bind(("p_raw", p_raw.clone()))
                .bind(("p_clean", p_clean.clone()))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
            let chaps: Vec<Value> = res_ch.take(0).unwrap_or_default();

            let mut res_en = self
                .db
                .query(format!(
                    "SELECT id, name, type_key, description, tags, attributes, 'entity' AS source_type FROM entities WHERE {where_proj}"
                ))
                .bind(("p_raw", p_raw.clone()))
                .bind(("p_clean", p_clean.clone()))
                .await
                .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
            let ents: Vec<Value> = res_en.take(0).unwrap_or_default();

            for raw_item in chaps.into_iter().chain(ents) {
                let is_entity = raw_item.get("source_type").and_then(|v| v.as_str()) == Some("entity")
                    || raw_item.get("type_key").is_some();
                let item = if is_entity {
                    format_entity_dossier_value(&raw_item)
                } else {
                    raw_item
                };

                let id_str = item.get("id").and_then(clean_record_id).unwrap_or_default();
                if list.iter().any(|existing| {
                    existing
                        .get("id")
                        .and_then(clean_record_id)
                        .unwrap_or_default()
                        == id_str
                }) {
                    continue;
                }
                let t = item
                    .get("title")
                    .or_else(|| item.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let cont = item
                    .get("content")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let tags: Vec<String> = item
                    .get("tags")
                    .and_then(|v| serde_json::from_value(v.clone()).ok())
                    .unwrap_or_default();

                let q_stem = super::stemmer::SnowballStemmer::stem_phrase(&q_canon);
                let cont_canon = canonicalize_name(cont);
                let cont_stem = super::stemmer::SnowballStemmer::stem_phrase(&cont_canon);

                if q_canon.is_empty()
                    || fuzzy_match_name(q_trimmed, t, &tags)
                    || canonicalize_name(t).contains(&q_canon)
                    || cont_canon.contains(&q_canon)
                    || (!q_stem.is_empty() && cont_stem.contains(&q_stem))
                {
                    if let Some(eid) = item.get("id").and_then(clean_record_id) {
                        entity_ids.insert(eid);
                    }
                    list.push(item);
                }
                if list.len() >= top_k {
                    break;
                }
            }
        }

        // 3. Дополнительное графовое расширение (если fallback добавил новые entity_ids)
        let has_relations = list.iter().any(|r| r.get("source_type").and_then(|v| v.as_str()) == Some("relation"));
        if !has_relations && !entity_ids.is_empty() {
            let seed_list: Vec<RecordId> = entity_ids
                .into_iter()
                .filter_map(|s| {
                    let raw = s
                        .strip_prefix("entities:")
                        .unwrap_or(&s)
                        .replace(['⟨', '⟩', '`'], "");
                    if raw.is_empty() {
                        None
                    } else {
                        Some(RecordId::new("entities", raw))
                    }
                })
                .collect();
            let rel_sql = "SELECT in, out, rel_type, description, strength FROM entity_rel WHERE in IN $seeds OR out IN $seeds ORDER BY strength DESC LIMIT 10";
            if let Ok(mut resp) = self.db.query(rel_sql).bind(("seeds", seed_list)).await {
                if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                    for r in rows {
                        list.push(serde_json::json!({
                            "source_type": "relation",
                            "from": r.get("in"),
                            "to": r.get("out"),
                            "rel_type": r.get("rel_type"),
                            "description": r.get("description"),
                            "strength": r.get("strength"),
                        }));
                    }
                }
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
        let sql =
            "RETURN fn::get_chapter_multi_hop_context(type::record('chapters', $chapter_id));";
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
