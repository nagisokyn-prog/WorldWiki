use super::errors::ChapterError;
use serde_json::Value;
use surrealdb::{engine::local::Db, Surreal};

pub async fn get_chapter_revisions_inner(
    db: &Surreal<Db>,
    _project: &str,
    chapter_id: &str,
) -> Result<Vec<Value>, ChapterError> {
    let actual_id = chapter_id.split_once(':').map(|(_, b)| b).unwrap_or(chapter_id);

    let mut result = db
        .query("RETURN fn::get_chapter_revisions(type::record('chapters', $id));")
        .bind(("id", actual_id))
        .await?;

    let revisions: Vec<Value> = result.take(0)?;
    Ok(revisions)
}

pub async fn toggle_chapter_history_pin_inner(
    db: &Surreal<Db>,
    history_id: &str,
    is_pinned: bool,
) -> Result<(), ChapterError> {
    let actual_id = history_id.split_once(':').map(|(_, b)| b).unwrap_or(history_id);

    db.query("fn::toggle_pin(type::record('chapter_revisions', $id), $is_pinned);")
        .bind(("id", actual_id))
        .bind(("is_pinned", is_pinned))
        .await?;

    Ok(())
}
