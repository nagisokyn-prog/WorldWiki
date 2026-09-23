use crate::logic::volumes::errors::VolumeError;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;

fn compare_record_ids(id1: &str, id2: &str) -> bool {
    let clean1 = id1.trim_matches('⟨').trim_matches('⟩').trim_matches('`');
    let clean2 = id2.trim_matches('⟨').trim_matches('⟩').trim_matches('`');
    if clean1 == clean2 {
        return true;
    }
    let raw1 = clean1.split(':').next_back().unwrap_or(clean1);
    let raw2 = clean2.split(':').next_back().unwrap_or(clean2);
    raw1 == raw2
}

pub async fn get_chapter_hierarchy_inner(
    db: &Surreal<Db>,
    project: &str,
) -> Result<serde_json::Value, VolumeError> {
    let pid_raw = project.trim().replace("projects:", "");
    let proj_rec = RecordId::new("projects", pid_raw.as_str());
    let pid_val = format!("projects:{}", pid_raw);
    let pid_literal = format!("projects:`{}`", pid_raw);

    let query_cond = "project_id = $proj OR project_id = $pid_val OR project_id = $pid_literal";

    let query = format!(
        r#"
        SELECT * FROM volumes WHERE {cond};
        SELECT * FROM chapters WHERE {cond};
        SELECT in, out, sort_order FROM contains 
        WHERE out IN (SELECT VALUE id FROM volumes WHERE {cond})
           OR out IN (SELECT VALUE id FROM chapters WHERE {cond});
        "#,
        cond = query_cond
    );

    let mut res = db
        .query(query)
        .bind(("proj", proj_rec))
        .bind(("pid_val", pid_val))
        .bind(("pid_literal", pid_literal))
        .await?;

    let mut volumes: Vec<serde_json::Value> = res.take(0).unwrap_or_default();
    let mut chapters: Vec<serde_json::Value> = res.take(1).unwrap_or_default();
    let edges: Vec<serde_json::Value> = res.take(2).unwrap_or_default();

    for vol in &mut volumes {
        if let Some(id) = vol.get("id").and_then(|i| i.as_str()) {
            if let Some(edge) = edges
                .iter()
                .find(|e| e.get("out").and_then(|o| o.as_str()) == Some(id))
            {
                if let Some(so) = edge.get("sort_order") {
                    if let Some(obj) = vol.as_object_mut() {
                        obj.insert("sort_order".to_string(), so.clone());
                    }
                }
            }
        }
    }

    for chap in &mut chapters {
        if let Some(id) = chap.get("id").and_then(|i| i.as_str()) {
            if let Some(edge) = edges.iter().find(|e| {
                e.get("out")
                    .and_then(|o| o.as_str())
                    .map(|o| compare_record_ids(o, id))
                    .unwrap_or(false)
            }) {
                if let Some(obj) = chap.as_object_mut() {
                    if let Some(parent) = edge.get("in").and_then(|i| i.as_str()) {
                        if parent.starts_with("volumes:") {
                            obj.insert("volume_id".to_string(), serde_json::Value::String(parent.to_string()));
                        }
                    }
                    if let Some(so) = edge.get("sort_order") {
                        obj.insert("sort_order".to_string(), so.clone());
                    }
                }
            }
        }
    }

    volumes.sort_by_key(|v| v.get("sort_order").and_then(|s| s.as_i64()).unwrap_or(0));
    chapters.sort_by_key(|a| a.get("sort_order").and_then(|s| s.as_i64()).unwrap_or(0));

    Ok(serde_json::json!({
        "volumes": volumes,
        "chapters": chapters
    }))
}
