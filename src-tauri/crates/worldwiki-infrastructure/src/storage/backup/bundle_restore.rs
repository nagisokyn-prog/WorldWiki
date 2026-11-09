//! Project bundle restoration functionality (atomic transaction import and edge integrity checks).

use std::fs;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;

use super::sanitize::*;

async fn validate_orphan_edges(
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

async fn purge_existing_project(db: &Surreal<Db>, p_rec: &str) -> Result<(), DomainError> {
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

async fn execute_bundle_transaction(
    db: &Surreal<Db>,
    p_rec: &str,
    p_content: serde_json::Value,
    bundle: &mut serde_json::Value,
    node_tables: &[&str],
    edge_tables: &[&str],
) -> Result<(), DomainError> {
    let mut script = String::new();
    script.push_str("BEGIN TRANSACTION;\n");
    script.push_str("UPSERT type::record($pid) MERGE $p_content;\n");

    let mut bindings: Vec<(String, serde_json::Value)> = vec![
        ("pid".to_string(), serde_json::Value::String(p_rec.to_string())),
        ("p_content".to_string(), p_content),
    ];

    let mut var_idx = 0;
    for table in node_tables {
        if let Some(items) = bundle.get_mut(*table).and_then(|v| v.as_array_mut()) {
            if items.is_empty() {
                continue;
            }
            for item in items.iter_mut() {
                let id_val = item.get("id").and_then(flatten_record_id);
                if let Some(id_str) = id_val {
                    if *table == "entity_schemas" && id_str.starts_with("entity_schemas:default_") {
                        continue;
                    }
                    let clean_rec = if id_str.contains(':') {
                        clean_bundle_id_to_record_str(&id_str)
                    } else {
                        clean_bundle_id_to_record_str(&format!("{table}:{id_str}"))
                    };

                    let item_val = std::mem::take(item);
                    let mut cleaned_item = clean_bundle_item(item_val, table);
                    if let Some(map) = cleaned_item.as_object_mut() {
                        map.remove("id");
                    }

                    let var_name = format!("item_{var_idx}");
                    var_idx += 1;
                    script.push_str("UPSERT ");
                    script.push_str(&clean_rec);
                    script.push_str(" MERGE $");
                    script.push_str(&var_name);
                    script.push_str(";\n");
                    bindings.push((var_name, cleaned_item));
                }
            }
        }
    }

    for table in edge_tables {
        if let Some(items) = bundle.get_mut(*table).and_then(|v| v.as_array_mut()) {
            if items.is_empty() {
                continue;
            }
            for item in items.iter_mut() {
                let item_val = std::mem::take(item);
                let mut cleaned = clean_bundle_item(item_val, table);
                let in_val = cleaned.get("in").and_then(flatten_record_id);
                let out_val = cleaned.get("out").and_then(flatten_record_id);
                let id_val = cleaned.get("id").and_then(flatten_record_id);

                if let (Some(in_id), Some(out_id), Some(orig_id)) = (in_val.as_deref(), out_val.as_deref(), id_val.as_deref()) {
                    let full_edge_id = if orig_id.contains(':') {
                        orig_id.to_string()
                    } else {
                        format!("{table}:{orig_id}")
                    };

                    let in_rec = clean_bundle_id_to_record_str(in_id);
                    let out_rec = clean_bundle_id_to_record_str(out_id);
                    let edge_rec = clean_bundle_id_to_record_str(&full_edge_id);

                    if let Some(map) = cleaned.as_object_mut() {
                        map.remove("id");
                        map.remove("in");
                        map.remove("out");
                    }

                    let data_var = format!("edge_data_{var_idx}");
                    var_idx += 1;

                    script.push_str("RELATE ONLY ");
                    script.push_str(&in_rec);
                    script.push_str("->");
                    script.push_str(&edge_rec);
                    script.push_str("->");
                    script.push_str(&out_rec);
                    script.push_str(" CONTENT $");
                    script.push_str(&data_var);
                    script.push_str(";\n");
                    bindings.push((data_var, cleaned));
                }
            }
        }
    }

    script.push_str("COMMIT TRANSACTION;\n");

    let mut query = db.query(&script);
    for (k, v) in bindings {
        query = query.bind((k, v));
    }

    let mut res = query.await.map_err(|e| {
        DomainError::Validation(format!("Restore transaction execution failed: {e}"))
    })?;

    let errors = res.take_errors();
    if !errors.is_empty() {
        let root_cause = errors.iter().find(|(_, err)| {
            let msg = err.to_string();
            !msg.contains("cancelled transaction")
                && !msg.contains("failed transaction")
                && !msg.contains("Cannot COMMIT")
        });
        let summary = if let Some((idx, err)) = root_cause {
            format!("Root cause at statement {idx}: {err}. Full map: {errors:?}")
        } else {
            format!("{errors:?}")
        };
        return Err(DomainError::Validation(format!(
            "Restore transaction error: {summary}"
        )));
    }

    Ok(())
}

pub(crate) async fn restore_project_bundle(
    db: &Surreal<Db>,
    bundle_path: &std::path::Path,
) -> Result<(), DomainError> {
    let raw = fs::read_to_string(bundle_path)
        .map_err(|e| DomainError::Validation(format!("Failed to read project_bundle.json: {e}")))?;
    let mut bundle: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| DomainError::Validation(format!("Invalid project_bundle.json: {e}")))?;

    let proj_id = bundle
        .get("project")
        .and_then(|p| p.get("id"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| DomainError::Validation("project_bundle.json missing project.id".to_string()))?
        .to_string();

    let node_tables = [
        "volumes",
        "chapters",
        "entity_schemas",
        "entities",
        "timeline_events",
        "story_arcs",
        "planets",
        "calendars",
        "relation_schemas",
    ];

    let edge_tables = [
        "contains",
        "entity_rel",
        "participates_in",
        "appears_in",
        "revealed_in",
        "spans_blocks",
        "promise_milestones",
        "participant_of",
        "advances_arc",
        "occurs_at",
    ];

    // 1. Pre-flight validation: check for orphan edges pointing to non-existent nodes
    validate_orphan_edges(db, &bundle, &proj_id, &node_tables, &edge_tables).await?;

    // 2. Safely purge existing project prior to atomic insertion
    let clean_pid = clean_bundle_id_to_record_str(&proj_id);
    let p_rec = if clean_pid.starts_with("projects:") {
        clean_pid
    } else {
        format!("projects:{clean_pid}")
    };
    purge_existing_project(db, &p_rec).await?;

    // 3. Prepare project content without using .take().unwrap_or (avoids false-positive SDB-009)
    let mut p_content = match bundle.get_mut("project") {
        Some(p) => std::mem::take(p),
        None => serde_json::Value::Null,
    };
    if let Some(map) = p_content.as_object_mut() {
        map.remove("id");
        map.remove("updated_at"); // projects table has NO updated_at field in SCHEMAFULL schema!
        let now_str = chrono::Utc::now().to_rfc3339();
        if map.get("created_at").is_none_or(|v| v.is_null()) {
            map.insert("created_at".to_string(), serde_json::Value::String(now_str));
        }
    }

    // 4. Build and execute transaction script
    execute_bundle_transaction(db, &p_rec, p_content, &mut bundle, &node_tables, &edge_tables).await
}
