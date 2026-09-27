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

        let clean_pid = project.trim().replace("projects:", "");
        let mut clean_items: Vec<Value> = Vec::new();

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
            let clean_cid = cid.trim().replace("chapters:", "");

            let events = item.get("events").cloned().unwrap_or(Value::Array(vec![]));
            let participants = item
                .get("participants")
                .cloned()
                .unwrap_or(Value::Array(vec![]));

            clean_items.push(json!({
                "chapter_id": clean_cid,
                "title": title,
                "events": events,
                "participants": participants,
            }));
        }

        let mut res = db
            .query("fn::save_global_timeline(type::record('projects', $p), $items);")
            .bind(("p", clean_pid))
            .bind(("items", clean_items))
            .await?;

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
