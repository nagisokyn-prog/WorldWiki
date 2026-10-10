use crate::logic::volumes::errors::VolumeError;
use surrealdb::engine::local::Db;
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

    let query = "RETURN fn::get_chapter_hierarchy(type::record('projects', $p));";

    let mut res = db
        .query(query)
        .bind(("p", pid_raw))
        .await?;

    let raw: Option<serde_json::Value> = res.take(0)?;
    let mut volumes: Vec<serde_json::Value> = raw.as_ref().and_then(|r| r.get("volumes")).and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let mut chapters: Vec<serde_json::Value> = raw.as_ref().and_then(|r| r.get("chapters")).and_then(|c| c.as_array()).cloned().unwrap_or_default();
    let edges: Vec<serde_json::Value> = raw.as_ref().and_then(|r| r.get("relations")).and_then(|e| e.as_array()).cloned().unwrap_or_default();

    for vol in &mut volumes {
        if let Some(id) = vol.get("id").and_then(|i| i.as_str())
            && let Some(edge) = edges
                .iter()
                .find(|e| e.get("out").and_then(|o| o.as_str()) == Some(id))
                && let Some(so) = edge.get("sort_order")
                    && let Some(obj) = vol.as_object_mut() {
                        obj.insert("sort_order".to_string(), so.clone());
                    }
    }

    for chap in &mut chapters {
        if let Some(id) = chap.get("id").and_then(|i| i.as_str())
            && let Some(edge) = edges.iter().find(|e| {
                e.get("out")
                    .and_then(|o| o.as_str())
                    .map(|o| compare_record_ids(o, id))
                    .unwrap_or(false)
            })
                && let Some(obj) = chap.as_object_mut() {
                    if let Some(parent) = edge.get("in").and_then(|i| i.as_str())
                        && parent.starts_with("volumes:") {
                            obj.insert("volume_id".to_string(), serde_json::Value::String(parent.to_string()));
                        }
                    if let Some(so) = edge.get("sort_order") {
                        obj.insert("sort_order".to_string(), so.clone());
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
