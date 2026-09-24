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

    // Auto-sync entity mentions ((Entity)) and HTML links into appears_in (source = 'mention')
    let mentions = worldwiki_domain::manuscript::TextBlock::extract_entity_mentions(&saved.content);

    if let Some(ch_id) = &saved.id {
        let clean_ch = ch_id.trim_start_matches("chapters:");
        let _ = db
            .query(
                r#"
                DELETE appears_in 
                WHERE out = type::record('chapters', $c_id) 
                  AND source = 'mention';
                "#,
            )
            .bind(("c_id", clean_ch.to_string()))
            .await;

        if !mentions.is_empty() {
            let lower_names: Vec<String> = mentions.iter().map(|n| n.to_lowercase()).collect();
            let _ = db
                .query(
                    r#"
                    LET $ch_rec = type::record('chapters', $c_id);
                    LET $proj = $ch_rec.project_id;
                    LET $target_entities = (
                        SELECT id FROM entities 
                        WHERE (project_id = $proj OR project_id = type::record('projects', $proj) OR project_id.id = $proj.id)
                          AND (name IN $names OR string::lowercase(name) IN $lower_names OR id IN $names)
                    );
                    FOR $ent IN $target_entities {
                        RELATE $ent.id->appears_in->$ch_rec CONTENT {
                            source: 'mention',
                            created_at: time::now()
                        };
                    };
                    "#,
                )
                .bind(("c_id", clean_ch.to_string()))
                .bind(("names", mentions))
                .bind(("lower_names", lower_names))
                .await;
        }
    }

    Ok(saved)
}

pub async fn delete_chapter_inner(db: &Surreal<Db>, id: &str) -> Result<(), ChapterError> {
    Chapter::delete(db, id).await?;
    Ok(())
}
