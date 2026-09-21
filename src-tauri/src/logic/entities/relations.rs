use super::errors::EntityError;
use super::types::*;
use crate::logic::models::EntityRel;
use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// =====================================================
// ENTITY REL CRUD
// =====================================================

pub async fn get_entity_relations_inner(
    db: &Surreal<Db>,
    project: &str,
    entity_id: Option<String>,
) -> Result<Vec<EntityRel>, EntityError> {
    let pid_val = safe_pid(project);
    let id_val = match &entity_id {
        Some(e) => safe_id("entities", e),
        None => "".to_string(),
    };
    let sql = match &entity_id {
        Some(_) => "SELECT * FROM entity_rel WHERE (project_id = type::record($pid) OR project_id = $pid) AND (in = type::record($eid) OR out = type::record($eid))",
        None => "SELECT * FROM entity_rel WHERE project_id = type::record($pid) OR project_id = $pid",
    };

    let mut q = db.query(sql).bind(("pid", pid_val));

    if entity_id.is_some() {
        q = q.bind(("eid", id_val));
    }

    let mut res = q.await?;
    let values: Vec<Value> = res.take(0)?;
    Ok(deserialize_list(values))
}

pub async fn create_entity_relation_inner(
    db: &Surreal<Db>,
    project: &str,
    from_id: &str,
    to_id: &str,
    rel: EntityRel,
) -> Result<EntityRel, EntityError> {
    let proj_id = format!("projects:{}", project);

    fn make_record(table: &str, full_id: &str) -> surrealdb::types::RecordId {
        let raw = full_id.split(':').nth(1).unwrap_or(full_id);
        surrealdb::types::RecordId::new(table, raw)
    }

    let from_rec = make_record("entities", from_id);
    let to_rec = make_record("entities", to_id);

    let EntityRel {
        rel_type,
        description,
        strength,
        attributes,
        start_chapter,
        end_chapter,
        ..
    } = rel;

    let has_desc = description.is_some();
    let has_strength = strength.is_some();
    let has_attrs = !attributes.is_null();
    let has_start = start_chapter.as_ref().map(|s| !s.is_empty()).unwrap_or(false);
    let has_end = end_chapter.as_ref().map(|s| !s.is_empty()).unwrap_or(false);

    let mut query = "
        RELATE $from -> entity_rel -> $to SET
            project_id = type::record($pid),
            rel_type = $rel_type
    "
    .to_string();

    if has_desc {
        query.push_str(", description = $desc");
    }
    if has_strength {
        query.push_str(", strength = $strength");
    }
    if has_attrs {
        query.push_str(", attributes = $attrs");
    }
    if has_start {
        query.push_str(", start_chapter = type::record($start_chapter)");
    }
    if has_end {
        query.push_str(", end_chapter = type::record($end_chapter)");
    }
    query.push_str(" RETURN AFTER");

    let mut q = db
        .query(query)
        .bind(("from", from_rec))
        .bind(("to", to_rec))
        .bind(("pid", proj_id))
        .bind(("rel_type", rel_type));

    if let Some(d) = description {
        q = q.bind(("desc", d));
    }
    if let Some(s) = strength {
        q = q.bind(("strength", s));
    }
    if has_attrs {
        q = q.bind(("attrs", attributes));
    }
    if let Some(sc) = start_chapter {
        if !sc.is_empty() {
            q = q.bind(("start_chapter", sc));
        }
    }
    if let Some(ec) = end_chapter {
        if !ec.is_empty() {
            q = q.bind(("end_chapter", ec));
        }
    }

    let mut res = q.await?;
    let created: Option<Value> = res.take(0)?;
    match created {
        Some(v) => Ok(serde_json::from_value(v)?),
        None => Err(EntityError::OperationFailed("EntityRel not created".to_string())),
    }
}

pub async fn delete_entity_relation_inner(
    db: &Surreal<Db>,
    id: &str,
) -> Result<(), EntityError> {
    let parts: Vec<&str> = id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 { parts[1] } else { id };
    let _: Option<Value> = db.delete(("entity_rel", actual_id)).await?;
    Ok(())
}
