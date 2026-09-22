use super::errors::ChapterError;
use crate::logic::models::Chapter;
use serde_json::{json, Value};
use surreal_domain::SurrealRepository;
use surrealdb::{engine::local::Db, Surreal};

pub async fn get_global_timeline_inner(
    db: &Surreal<Db>,
    project: &str,
) -> Result<Value, ChapterError> {
    let proj_id = format!("projects:{}", project);
    let chapters = Chapter::find_all(db, &proj_id).await?;
    Ok(json!(chapters))
}

pub async fn save_global_timeline_inner(
    db: &Surreal<Db>,
    project: &str,
    data: Value,
) -> Result<Value, ChapterError> {
    Chapter::save_global_timeline_inner(db, project, data).await
}

impl Chapter {
    pub async fn save_global_timeline_inner(
        db: &Surreal<Db>,
        project: &str,
        data: Value,
    ) -> Result<Value, ChapterError> {
        let arr = data.as_array().ok_or_else(|| {
            ChapterError::InvalidData(
                "save_global_timeline: expected a JSON array of chapter timelines".to_string(),
            )
        })?;

        if arr.is_empty() {
            return Ok(json!({ "success": true, "updated": 0 }));
        }

        let mut sql = String::from("BEGIN TRANSACTION;\n");
        let mut bindings: Vec<(String, Value)> = Vec::new();

        for (i, item) in arr.iter().enumerate() {
            let cid = item
                .get("chapter_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    ChapterError::InvalidData(
                        "save_global_timeline: each item must have chapter_id".to_string(),
                    )
                })?;
            let title = item
                .get("chapter_title")
                .and_then(|v| v.as_str())
                .map(|t| t.to_string())
                .unwrap_or_else(|| format!("chapter-{i}"));
            let cid_safe = if cid.contains(':') {
                cid.to_string()
            } else {
                format!("chapters:{}", cid)
            };
            let pid_safe = if project.contains(':') {
                project.to_string()
            } else {
                format!("projects:{}", project)
            };

            let events = item.get("events").cloned().unwrap_or(Value::Array(vec![]));
            let participants = item
                .get("participants")
                .cloned()
                .unwrap_or(Value::Array(vec![]));

            sql.push_str(&format!(
                "UPDATE type::record($cid_{i}) SET project_id = type::record($pid_{i}), \
                     title = $title_{i}, \
                     timeline_events = $events_{i}, \
                     participants = $participants_{i};\n",
                i = i
            ));
            bindings.push((format!("cid_{i}"), json!(cid_safe)));
            bindings.push((format!("pid_{i}"), json!(pid_safe)));
            bindings.push((format!("title_{i}"), json!(title)));
            bindings.push((format!("events_{i}"), events));
            bindings.push((format!("participants_{i}"), participants));
        }
        sql.push_str("COMMIT TRANSACTION;\n");

        let mut q = db.query(sql);
        for (k, v) in &bindings {
            q = q.bind((k.as_str(), v.clone()));
        }
        let mut res = q.await?;
        let errs = res.take_errors();
        if !errs.is_empty() {
            return Err(ChapterError::Transaction(
                errs.into_values()
                    .next()
                    .map(|e| e.to_string())
                    .unwrap_or_else(|| "save_global_timeline: unknown error".to_string()),
            ));
        }

        Ok(json!({ "success": true, "updated": arr.len() }))
    }
}
