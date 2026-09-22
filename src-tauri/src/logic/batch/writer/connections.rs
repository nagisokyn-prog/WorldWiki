use crate::logic::batch::errors::BatchError;
use crate::logic::models::EntityRel;
use serde_json::{Map, Value};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

pub async fn upsert_connections_batch_inner(
    db: &Surreal<Db>,
    project: &str,
    _source_type: &str,
    source_id: &str,
    connections: Vec<EntityRel>,
) -> Result<(), BatchError> {
    let proj_id = format!("projects:{}", project.trim().replace("projects:", ""));

    let from_full = if source_id.contains(':') {
        source_id.to_string()
    } else {
        format!("entities:{}", source_id)
    };

    let mut query = String::from("BEGIN TRANSACTION;\n");

    query.push_str(&format!(
        "DELETE entity_rel WHERE project_id = type::record($pid) AND (in = type::record('{0}') OR out = type::record('{0}'));\n",
        from_full
    ));

    let mut bind_data = Map::new();
    bind_data.insert("pid".to_string(), Value::String(proj_id));

    for (i, rel) in connections.into_iter().enumerate() {
        let EntityRel {
            out,
            r#in,
            rel_type,
            description,
            strength,
            attributes,
            start_chapter,
            end_chapter,
            ..
        } = rel;

        let target_id = out.unwrap_or_default();
        if target_id.is_empty() {
            continue;
        }

        let to_full = if target_id.contains(':') {
            target_id
        } else {
            format!("entities:{}", target_id)
        };
        let source_for_this_rel = r#in.unwrap_or_else(|| source_id.to_string());
        let from_for_this_rel = if source_for_this_rel.contains(':') {
            source_for_this_rel
        } else {
            format!("entities:{}", source_for_this_rel)
        };

        let mut set_clauses = vec!["project_id = type::record($pid)".to_string()];

        bind_data.insert(format!("rt_{}", i), Value::String(rel_type));
        set_clauses.push(format!("rel_type = $rt_{}", i));

        if let Some(desc) = description {
            bind_data.insert(format!("desc_{}", i), Value::String(desc));
            set_clauses.push(format!("description = $desc_{}", i));
        }

        if let Some(strength_val) = strength {
            bind_data.insert(format!("str_{}", i), serde_json::json!(strength_val));
            set_clauses.push(format!("strength = $str_{}", i));
        }

        if attributes.is_null() {
            set_clauses.push("attributes = {}".to_string());
        } else {
            bind_data.insert(format!("attr_{}", i), attributes);
            set_clauses.push(format!("attributes = $attr_{}", i));
        }

        if let Some(sc) = start_chapter {
            if !sc.is_empty() {
                bind_data.insert(format!("sc_{}", i), Value::String(sc));
                set_clauses.push(format!("start_chapter = type::record($sc_{})", i));
            }
        }

        if let Some(ec) = end_chapter {
            if !ec.is_empty() {
                bind_data.insert(format!("ec_{}", i), Value::String(ec));
                set_clauses.push(format!("end_chapter = type::record($ec_{})", i));
            }
        }

        query.push_str(&format!(
            "RELATE {} -> entity_rel -> {} SET {};\n",
            from_for_this_rel,
            to_full,
            set_clauses.join(", ")
        ));
    }

    query.push_str("COMMIT TRANSACTION;\n");

    let mut q = db.query(query);
    for (k, v) in bind_data {
        q = q.bind((k.as_str(), v));
    }

    let mut res = q.await?;

    let errors = res.take_errors();
    if !errors.is_empty() {
        return Err(BatchError::Transaction(format!("{:?}", errors)));
    }

    Ok(())
}
