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

    // Auto-sync entity mentions ((Entity)) into appears_in (source = 'mention')
    let content_str = &saved.content;
    let mut mentions = Vec::new();
    let mut remaining = content_str.as_str();
    while let Some((_, after_open)) = remaining.split_once("((") {
        if let Some((entity_name_raw, after_close)) = after_open.split_once("))") {
            let entity_name = entity_name_raw.trim();
            if !entity_name.is_empty() && !mentions.contains(&entity_name.to_string()) {
                mentions.push(entity_name.to_string());
            }
            remaining = after_close;
        } else {
            break;
        }
    }

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
            let _ = db
                .query(
                    r#"
                    LET $ch_rec = type::record('chapters', $c_id);
                    LET $proj = (SELECT VALUE project_id FROM ONLY $ch_rec);
                    LET $target_entities = (
                        SELECT id FROM entities 
                        WHERE project_id = $proj 
                          AND name IN $names
                    );
                    FOR $ent IN $target_entities {
                        RELATE ($ent.id)->appears_in->($ch_rec) CONTENT {
                            source: 'mention',
                            created_at: time::now()
                        };
                    };
                    "#,
                )
                .bind(("c_id", clean_ch.to_string()))
                .bind(("names", mentions))
                .await;
        }
    }

    Ok(saved)
}

pub async fn delete_chapter_inner(db: &Surreal<Db>, id: &str) -> Result<(), ChapterError> {
    Chapter::delete(db, id).await?;
    Ok(())
}
