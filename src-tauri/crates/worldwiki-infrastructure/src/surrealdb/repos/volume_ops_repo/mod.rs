pub mod healing;

pub use healing::{
    AutoExtendResult, assign_chapter, auto_extend_entities, heal_deleted_chapter,
    heal_point_if_matches_chapter, update_point_if_auto_extend,
};

use surrealdb::Surreal;
use surrealdb::engine::local::Db;
use worldwiki_domain::errors::DomainError;

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

pub async fn create_volume(
    db: &Surreal<Db>,
    project: &str,
    title: &str,
) -> Result<serde_json::Value, DomainError> {
    let clean_pid = project.trim().replace("projects:", "");

    let mut max_order_res = db
        .query("RETURN fn::get_max_volume_sort_order(type::record('projects', $p));")
        .bind(("p", clean_pid.clone()))
        .await
        .map_err(DomainError::constraint_violation)?;
    let max_order: i64 = max_order_res
        .take::<Option<i64>>(0)
        .map_err(DomainError::constraint_violation)?
        .unwrap_or(-1);
    let next_order = max_order + 1;

    let query = "RETURN fn::create_volume_node(type::record('projects', $p), $title, $order);";
    let mut create_res = db
        .query(query)
        .bind(("p", clean_pid))
        .bind(("title", title.to_string()))
        .bind(("order", next_order))
        .await
        .map_err(DomainError::constraint_violation)?;

    let vol: Option<serde_json::Value> = create_res
        .take(0)
        .map_err(DomainError::constraint_violation)?;
    Ok(serde_json::json!(vol))
}

pub async fn update_volume(
    db: &Surreal<Db>,
    id: &str,
    title: &str,
) -> Result<(), DomainError> {
    let clean_id = id.trim_start_matches("volumes:").to_string();
    db.query("fn::update_volume_title(type::record('volumes', $id), $title);")
        .bind(("id", clean_id))
        .bind(("title", title.to_string()))
        .await
        .map_err(DomainError::constraint_violation)?;
    Ok(())
}

pub async fn reorder_node(
    db: &Surreal<Db>,
    _project: &str,
    node_type: &str,
    id: &str,
    sort_order: i64,
) -> Result<(), DomainError> {
    let table = if node_type == "volume" || node_type == "volumes" {
        "volumes"
    } else {
        "chapters"
    };
    let raw_id = id.split_once(':').map(|(_, b)| b).unwrap_or(id).to_string();

    db.query("fn::reorder_node(type::record($table, $id), $order);")
        .bind(("table", table.to_string()))
        .bind(("id", raw_id))
        .bind(("order", sort_order))
        .await
        .map_err(DomainError::constraint_violation)?;

    Ok(())
}

pub async fn get_chapter_hierarchy(
    db: &Surreal<Db>,
    project: &str,
) -> Result<serde_json::Value, DomainError> {
    let pid_raw = project.trim().replace("projects:", "");
    let query = "RETURN fn::get_chapter_hierarchy(fn::normalize_project_id($p));";

    let mut res = db
        .query(query)
        .bind(("p", pid_raw))
        .await
        .map_err(DomainError::constraint_violation)?;

    let raw: Option<serde_json::Value> = res.take(0).map_err(DomainError::constraint_violation)?;
    let mut volumes: Vec<serde_json::Value> = raw
        .as_ref()
        .and_then(|r| r.get("volumes"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let mut chapters: Vec<serde_json::Value> = raw
        .as_ref()
        .and_then(|r| r.get("chapters"))
        .and_then(|c| c.as_array())
        .cloned()
        .unwrap_or_default();
    let edges: Vec<serde_json::Value> = raw
        .as_ref()
        .and_then(|r| r.get("relations"))
        .and_then(|e| e.as_array())
        .cloned()
        .unwrap_or_default();

    for vol in &mut volumes {
        if let Some(id) = vol.get("id").and_then(|i| i.as_str())
            && let Some(edge) = edges
                .iter()
                .find(|e| e.get("out").and_then(|o| o.as_str()) == Some(id))
            && let Some(so) = edge.get("sort_order")
            && let Some(obj) = vol.as_object_mut()
        {
            obj.insert("sort_order".to_string(), so.clone());
        }
    }

    for chap in &mut chapters {
        if let Some(id) = chap.get("id").and_then(|i| i.as_str()) {
            let mut matched_edge: Option<&serde_json::Value> = None;
            for e in &edges {
                if let Some(out) = e.get("out").and_then(|o| o.as_str())
                    && compare_record_ids(out, id)
                {
                    matched_edge = Some(e);
                    break;
                }
            }
            if let Some(edge) = matched_edge
                && let Some(obj) = chap.as_object_mut()
            {
                if let Some(parent) = edge.get("in").and_then(|i| i.as_str())
                    && parent.starts_with("volumes:")
                {
                    obj.insert(
                        "volume_id".to_string(),
                        serde_json::Value::String(parent.to_string()),
                    );
                }
                if let Some(so) = edge.get("sort_order") {
                    obj.insert("sort_order".to_string(), so.clone());
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compare_record_ids_handles_table_prefix_and_brackets() {
        assert!(compare_record_ids("chapters:c1", "⟨chapters:c1⟩"));
        assert!(compare_record_ids("c1", "chapters:c1"));
        assert!(!compare_record_ids("chapters:c1", "chapters:c2"));
    }
}
