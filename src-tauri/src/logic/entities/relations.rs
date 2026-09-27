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
    let clean_pid = project.trim().replace("projects:", "");
    let clean_eid = entity_id.filter(|s| !s.trim().is_empty()).map(|s| s.trim().replace("entities:", ""));

    let query = "RETURN fn::get_entity_relations(type::record('projects', $p), IF $eid != NONE { type::record('entities', $eid) } ELSE { NONE });";
    let mut res = db
        .query(query)
        .bind(("p", clean_pid))
        .bind(("eid", clean_eid))
        .await?;

    let values: Vec<Value> = res.take(0).unwrap_or_default();
    Ok(deserialize_list(values))
}

pub async fn create_entity_relation_inner(
    db: &Surreal<Db>,
    project: &str,
    from_id: &str,
    to_id: &str,
    rel: EntityRel,
) -> Result<EntityRel, EntityError> {
    let clean_pid = project.trim().replace("projects:", "");
    let clean_from = from_id.trim().replace("entities:", "");
    let clean_to = to_id.trim().replace("entities:", "");

    let EntityRel {
        rel_type,
        description,
        strength,
        attributes,
        start_chapter,
        end_chapter,
        ..
    } = rel;

    let clean_start = start_chapter.filter(|s| !s.trim().is_empty()).map(|s| s.trim().replace("chapters:", ""));
    let clean_end = end_chapter.filter(|s| !s.trim().is_empty()).map(|s| s.trim().replace("chapters:", ""));

    let query = r#"
        RETURN fn::create_entity_relation(
            type::record('projects', $pid),
            type::record('entities', $from),
            type::record('entities', $to),
            $rel_type,
            $desc,
            $strength,
            $attrs,
            IF $start_chap != NONE { type::record('chapters', $start_chap) } ELSE { NONE },
            IF $end_chap != NONE { type::record('chapters', $end_chap) } ELSE { NONE }
        );
    "#;

    let mut res = db
        .query(query)
        .bind(("pid", clean_pid))
        .bind(("from", clean_from))
        .bind(("to", clean_to))
        .bind(("rel_type", rel_type))
        .bind(("desc", description))
        .bind(("strength", strength))
        .bind(("attrs", attributes))
        .bind(("start_chap", clean_start))
        .bind(("end_chap", clean_end))
        .await?;

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
    let actual_id = id.split_once(':').map(|(_, b)| b).unwrap_or(id);
    let _: Option<Value> = db.delete(("entity_rel", actual_id)).await?;
    Ok(())
}
