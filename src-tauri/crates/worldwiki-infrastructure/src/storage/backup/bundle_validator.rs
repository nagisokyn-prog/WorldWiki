//! Validation and pre-flight checks for project bundle restoration.

use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;

use super::sanitize::*;

/// Pre-flight validation: check for orphan edges pointing to non-existent nodes.
pub(crate) async fn validate_orphan_edges(
    db: &Surreal<Db>,
    bundle: &serde_json::Value,
    proj_id: &str,
    node_tables: &[&str],
    edge_tables: &[&str],
) -> Result<(), DomainError> {
    let mut known_node_ids = std::collections::HashSet::new();
    let proj_clean = clean_bundle_id_to_record_str(proj_id);
    known_node_ids.insert(proj_id.to_string());
    if proj_clean != proj_id {
        known_node_ids.insert(proj_clean);
    }
    if let Some((_, raw_key)) = proj_id.split_once(':') {
        let bare = raw_key.trim_matches(['⟨', '⟩', '`', '"', '\'']);
        known_node_ids.insert(format!("projects:{bare}"));
        known_node_ids.insert(format!("projects:⟨{bare}⟩"));
    }

    for table in node_tables {
        if let Some(items) = bundle.get(*table).and_then(|v| v.as_array()) {
            for item in items {
                if let Some(id_str) = item.get("id").and_then(flatten_record_id) {
                    let cleaned = clean_bundle_id_to_record_str(&id_str);
                    if let Some((tb, key)) = id_str.split_once(':') {
                        let bare = key.trim_matches(['⟨', '⟩', '`', '"', '\'']);
                        known_node_ids.insert(format!("{tb}:{bare}"));
                        known_node_ids.insert(format!("{tb}:⟨{bare}⟩"));
                    }
                    known_node_ids.insert(id_str);
                    known_node_ids.insert(cleaned);
                }
            }
        }
    }

    for table in edge_tables {
        if let Some(items) = bundle.get(*table).and_then(|v| v.as_array()) {
            for item in items {
                let in_val = item.get("in").and_then(flatten_record_id);
                let out_val = item.get("out").and_then(flatten_record_id);
                let id_val = item.get("id").and_then(flatten_record_id);

                if let (Some(in_id), Some(out_id), Some(orig_id)) = (in_val.as_deref(), out_val.as_deref(), id_val.as_deref()) {
                    let in_rec = clean_bundle_id_to_record_str(in_id);
                    let out_rec = clean_bundle_id_to_record_str(out_id);

                    let in_exists = known_node_ids.contains(&in_rec)
                        || known_node_ids.contains(in_id)
                        || node_exists_in_db(db, &in_rec).await;
                    let out_exists = known_node_ids.contains(&out_rec)
                        || known_node_ids.contains(out_id)
                        || node_exists_in_db(db, &out_rec).await;

                    if !in_exists || !out_exists {
                        return Err(DomainError::Validation(format!(
                            "Orphan relation edge detected in {table}: edge {orig_id} references non-existent node (in={in_rec}, out={out_rec})"
                        )));
                    }
                }
            }
        }
    }

    Ok(())
}

/// Safely purge existing project prior to atomic insertion.
pub(crate) async fn purge_existing_project(db: &Surreal<Db>, p_rec: &str) -> Result<(), DomainError> {
    let purge_sql = r#"
        LET $p_rec = type::record($pid);
        LET $p_norm = fn::normalize_project_id($pid);
        DELETE contains WHERE in = $p_rec OR in = $p_norm OR out = $p_rec OR out = $p_norm;
        DELETE chapter_revisions WHERE target_id.volume_id.project_id = $p_rec OR target_id.volume_id.project_id = $p_norm;
        DELETE text_blocks WHERE chapter_id.volume_id.project_id = $p_rec OR chapter_id.volume_id.project_id = $p_norm;
        DELETE chapters WHERE volume_id.project_id = $p_rec OR volume_id.project_id = $p_norm OR project_id = $p_rec OR project_id = $p_norm;
        DELETE volumes WHERE project_id = $p_rec OR project_id = $p_norm;
        DELETE entities WHERE schema_id.project_id = $p_rec OR schema_id.project_id = $p_norm;
        DELETE entity_schemas WHERE project_id = $p_rec OR project_id = $p_norm;
        DELETE relation_schemas WHERE project_id = $p_rec OR project_id = $p_norm;
        DELETE timeline_events WHERE project_id = $p_rec OR project_id = $p_norm;
        DELETE calendars WHERE project_id = $p_rec OR project_id = $p_norm OR planet_id.project_id = $p_rec OR planet_id.project_id = $p_norm;
        DELETE planets WHERE project_id = $p_rec OR project_id = $p_norm;
        DELETE projects WHERE id = $p_rec OR id = $p_norm;
    "#;
    let _ = db.query(purge_sql).bind(("pid", p_rec)).await;
    Ok(())
}

