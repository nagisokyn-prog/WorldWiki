use crate::logic::models::Chapter;
use serde_json::{json, Value};
use surreal_domain::SurrealRepository;
use surrealdb::{engine::local::Db, Surreal};

pub mod commands;
pub mod errors;

pub use commands::*;
pub use errors::*;

pub async fn get_chapters_inner(
    db: &Surreal<Db>,
    project: &str,
) -> Result<Vec<Chapter>, ChapterError> {
    let proj_id = if project.contains(':') {
        project.to_string()
    } else {
        format!("projects:{}", project)
    };
    let chapters = Chapter::find_all(db, &proj_id).await?;
    Ok(chapters)
}

pub async fn get_chapter_inner(
    db: &Surreal<Db>,
    id: &str,
) -> Result<Option<Chapter>, ChapterError> {
    let chapter = Chapter::find_by_id(db, id).await?;
    Ok(chapter)
}

pub async fn create_chapter_inner(
    db: &Surreal<Db>,
    project: &str,
    mut chapter: Chapter,
) -> Result<Chapter, ChapterError> {
    let proj_id = if project.contains(':') {
        project.to_string()
    } else {
        format!("projects:{}", project)
    };
    chapter.project_id = Some(serde_json::json!(proj_id));
    let created = Chapter::create(db, chapter).await?;
    Ok(created)
}

pub async fn save_chapter_inner(
    db: &Surreal<Db>,
    chapter: Chapter,
) -> Result<Chapter, ChapterError> {
    let saved = Chapter::save(db, &chapter).await?;
    Ok(saved)
}

pub async fn delete_chapter_inner(db: &Surreal<Db>, id: &str) -> Result<(), ChapterError> {
    Chapter::delete(db, id).await?;
    Ok(())
}

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

pub async fn save_text_blocks_inner(
    db: &Surreal<Db>,
    project: &str,
    chapter_id: &str,
    html: &str,
) -> Result<(), ChapterError> {
    use scraper::{Html, Selector};

    let pid_safe = if project.contains(':') {
        project.to_string()
    } else {
        format!("projects:{}", project)
    };
    let cid_safe = if chapter_id.contains(':') {
        chapter_id.to_string()
    } else {
        format!("chapters:{}", chapter_id)
    };

    let blocks = {
        let document = Html::parse_document(html);
        let selector = Selector::parse("p")
            .map_err(|e| ChapterError::InvalidData(format!("Failed to parse selector: {:?}", e)))?;
        let mut blocks: Vec<(String, String)> = Vec::new();

        for p in document.select(&selector) {
            let tag = p.value().attr("data-semantic-tag").unwrap_or("desc");
            let btype = match tag {
                "desc" => "description",
                "dialog" => "dialogue",
                _ => tag,
            };
            let content = p.text().collect::<Vec<_>>().join("").trim().to_string();
            if !content.is_empty() {
                blocks.push((btype.to_string(), content));
            }
        }
        blocks
    };

    let mut sql = String::new();
    sql.push_str("BEGIN TRANSACTION;\n");
    sql.push_str("DELETE text_blocks WHERE chapter_id = type::record($chapter_id) AND project_id = type::record($project_id);\n");

    let mut bindings: Vec<(String, String)> = Vec::new();

    for (i, (btype, content)) in blocks.into_iter().enumerate() {
        sql.push_str(&format!(
            "CREATE text_blocks SET project_id = type::record($project_id), chapter_id = type::record($chapter_id), block_type = $btype_{}, order_index = {}, content = $content_{};\n",
            i, i, i
        ));

        bindings.push((format!("btype_{}", i), btype));
        bindings.push((format!("content_{}", i), content));
    }

    sql.push_str("COMMIT TRANSACTION;\n");

    let mut q = db
        .query(sql)
        .bind(("project_id", pid_safe))
        .bind(("chapter_id", cid_safe));

    for (k, v) in bindings {
        q = q.bind((k, v));
    }

    let mut res = q.await?;
    let errs = res.take_errors();
    if let Some(e) = errs.values().next() {
        return Err(ChapterError::Transaction(format!(
            "save_text_blocks error: {}",
            e
        )));
    }

    Ok(())
}

pub async fn get_chapter_revisions_inner(
    db: &Surreal<Db>,
    _project: &str,
    chapter_id: &str,
) -> Result<Vec<Value>, ChapterError> {
    let parts: Vec<&str> = chapter_id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 {
        parts[1]
    } else {
        chapter_id
    };
    let full_id = format!("chapters:{}", actual_id);

    let mut result = db
        .query("SELECT * FROM chapter_revisions WHERE target_id = type::record($target_id) ORDER BY created_at DESC")
        .bind(("target_id", full_id))
        .await?;

    let revisions: Vec<Value> = result.take(0)?;
    Ok(revisions)
}

pub async fn toggle_chapter_history_pin_inner(
    db: &Surreal<Db>,
    history_id: &str,
    is_pinned: bool,
) -> Result<(), ChapterError> {
    let parts: Vec<&str> = history_id.splitn(2, ':').collect();
    let actual_id = if parts.len() == 2 {
        parts[1]
    } else {
        history_id
    };

    db.query("UPDATE type::record($id) SET is_pinned = $is_pinned")
        .bind(("id", format!("chapter_revisions:{}", actual_id)))
        .bind(("is_pinned", is_pinned))
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chapter_error_formatting_and_conversion() {
        let not_found = ChapterError::NotFound("c1".to_string());
        assert_eq!(not_found.to_string(), "Chapter not found: c1");

        let err_str: String = not_found.into();
        assert_eq!(err_str, "Chapter not found: c1");

        let inv = ChapterError::InvalidData("bad json".to_string());
        assert_eq!(inv.to_string(), "Invalid chapter data: bad json");
    }
}
