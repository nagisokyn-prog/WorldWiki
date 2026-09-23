use super::errors::ChapterError;
use serde_json::Value;
use surrealdb::{engine::local::Db, Surreal};

pub async fn get_chapter_revisions_inner(
    db: &Surreal<Db>,
    _project: &str,
    chapter_id: &str,
) -> Result<Vec<Value>, ChapterError> {
    let actual_id = chapter_id.split_once(':').map(|(_, b)| b).unwrap_or(chapter_id);
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
    let actual_id = history_id.split_once(':').map(|(_, b)| b).unwrap_or(history_id);

    db.query("UPDATE type::record($id) SET is_pinned = $is_pinned")
        .bind(("id", format!("chapter_revisions:{}", actual_id)))
        .bind(("is_pinned", is_pinned))
        .await?;

    Ok(())
}
