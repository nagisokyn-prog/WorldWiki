use super::errors::ChapterError;
use crate::logic::models::Chapter;
use surreal_domain::SurrealRepository;
use surrealdb::{engine::local::Db, Surreal};

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
    eprintln!("[SAVE_CHAPTER] Saving chapter: id={:?}, title={:?}, project_id={:?}", chapter.id, chapter.title, chapter.project_id);
    let saved = Chapter::save(db, &chapter).await?;
    eprintln!("[SAVE_CHAPTER] Chapter saved successfully: id={:?}", saved.id);

    // Auto-sync entity mentions ((Entity)) and HTML links into appears_in (source = 'mention')
    let mentions = worldwiki_domain::manuscript::TextBlock::extract_entity_mentions(&saved.content);
    eprintln!("[SAVE_CHAPTER] Extracted mentions from content (total {}): {:?}", mentions.len(), mentions);

    if let Some(ch_id) = &saved.id {
        let clean_ch = ch_id.trim_start_matches("chapters:");
        eprintln!("[SAVE_CHAPTER] Calling fn::sync_chapter_mentions for chapter: {}", clean_ch);
        let mut res = db
            .query("RETURN fn::sync_chapter_mentions(type::record('chapters', $c_id), $names);")
            .bind(("c_id", clean_ch.to_string()))
            .bind(("names", mentions))
            .await
            .map_err(|e| {
                eprintln!("[SAVE_CHAPTER ERROR] fn::sync_chapter_mentions execution failed: {}", e);
                ChapterError::Database(e)
            })?;

        let errors = res.take_errors();
        if !errors.is_empty() {
            eprintln!("[SAVE_CHAPTER ERROR] Errors during fn::sync_chapter_mentions: {:?}", errors);
        } else {
            let debug_info: Option<serde_json::Value> = res.take(0).unwrap_or(None);
            eprintln!("[SAVE_CHAPTER SUCCESS] fn::sync_chapter_mentions executed. Result: {:?}", debug_info);
        }
    }

    Ok(saved)
}

pub async fn delete_chapter_inner(db: &Surreal<Db>, id: &str) -> Result<(), ChapterError> {
    Chapter::delete(db, id).await?;
    Ok(())
}
