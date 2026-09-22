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
    let saved = Chapter::save(db, &chapter).await?;
    Ok(saved)
}

pub async fn delete_chapter_inner(db: &Surreal<Db>, id: &str) -> Result<(), ChapterError> {
    Chapter::delete(db, id).await?;
    Ok(())
}
