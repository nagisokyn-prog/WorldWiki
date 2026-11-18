use super::errors::ChapterError;
use crate::logic::models::Chapter;
use surreal_domain::SurrealRepository;
use surrealdb::{Surreal, engine::local::Db};

fn decode_chapter_value(mut v: serde_json::Value) -> Option<Chapter> {
    surreal_domain::normalize_embedded_things(&mut v);
    serde_json::from_value(v).ok()
}

fn parse_chapter_opt(raw: Option<serde_json::Value>) -> Result<Chapter, ChapterError> {
    match raw.and_then(decode_chapter_value) {
        Some(ch) => Ok(ch),
        None => Err(ChapterError::InvalidData(
            "save_chapter returned no records".to_string(),
        )),
    }
}

pub async fn get_chapters_inner(
    db: &Surreal<Db>,
    project: &str,
) -> Result<Vec<Chapter>, ChapterError> {
    let clean = project.trim_start_matches("projects:").to_string();
    let sql = "RETURN fn::list_chapters_by_project($p);";
    let mut res = db
        .query(sql)
        .bind(("p", clean))
        .await
        .map_err(ChapterError::Database)?;
    let raw: Vec<serde_json::Value> = res.take(0).map_err(ChapterError::Database)?;
    let mut chapters = Vec::with_capacity(raw.len());
    for v in raw {
        if let Some(ch) = decode_chapter_value(v) {
            chapters.push(ch);
        }
    }
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
    _project: &str,
    chapter: Chapter,
) -> Result<Chapter, ChapterError> {
    let clean_vol = chapter.volume_id.trim_start_matches("volumes:").to_string();
    let sql = "RETURN fn::save_chapter('', $v_id, $title, $content, $sort_order, $word_count);";
    let mut res = db
        .query(sql)
        .bind(("v_id", clean_vol))
        .bind(("title", chapter.title.clone()))
        .bind(("content", chapter.content.clone()))
        .bind(("sort_order", chapter.sort_order))
        .bind(("word_count", chapter.word_count))
        .await
        .map_err(ChapterError::Database)?;
    let raw: Option<serde_json::Value> = res.take(0).map_err(ChapterError::Database)?;
    let created = parse_chapter_opt(raw)?;

    if let Some(ch_id) = &created.id {
        let clean_ch = ch_id.trim_start_matches("chapters:");
        if !created.content.trim().is_empty()
            && let Err(e) =
                super::text_blocks::save_text_blocks_inner(db, "", clean_ch, &created.content).await
        {
            eprintln!(
                "[CREATE_CHAPTER ERROR] fn::save_text_blocks execution failed: {:?}",
                e
            );
            return Err(e);
        }
    }

    Ok(created)
}

pub async fn save_chapter_inner(
    db: &Surreal<Db>,
    chapter: Chapter,
) -> Result<Chapter, ChapterError> {
    eprintln!(
        "[SAVE_CHAPTER] Saving chapter: id={:?}, title={:?}, volume_id={:?}",
        chapter.id, chapter.title, chapter.volume_id
    );
    let clean_vol = chapter.volume_id.trim_start_matches("volumes:").to_string();

    let saved: Chapter = if let Some(ref ch_id) = chapter.id {
        let clean_ch = ch_id.trim_start_matches("chapters:").to_string();
        let sql = "RETURN fn::save_chapter($c_id, $v_id, $title, $content, $sort_order, $word_count);";
        let mut res = db
            .query(sql)
            .bind(("c_id", clean_ch))
            .bind(("v_id", clean_vol))
            .bind(("title", chapter.title.clone()))
            .bind(("content", chapter.content.clone()))
            .bind(("sort_order", chapter.sort_order))
            .bind(("word_count", chapter.word_count))
            .await
            .map_err(ChapterError::Database)?;
        let raw: Option<serde_json::Value> = res.take(0).map_err(ChapterError::Database)?;
        parse_chapter_opt(raw)?
    } else {
        create_chapter_inner(db, "", chapter.clone()).await?
    };
    eprintln!(
        "[SAVE_CHAPTER] Chapter saved successfully: id={:?}",
        saved.id
    );

    // Auto-sync entity mentions ((Entity)) and HTML links into appears_in (source = 'mention')
    let mentions = worldwiki_domain::manuscript::TextBlock::extract_entity_mentions(&saved.content);
    eprintln!(
        "[SAVE_CHAPTER] Extracted mentions from content (total {}): {:?}",
        mentions.len(),
        mentions
    );

    if let Some(ch_id) = &saved.id {
        let clean_ch = ch_id.trim_start_matches("chapters:");

        // Auto-sync semantic text_blocks for granular scene tracking, RAG, and stylometry
        if let Err(e) =
            super::text_blocks::save_text_blocks_inner(db, "", clean_ch, &saved.content).await
        {
            eprintln!(
                "[SAVE_CHAPTER ERROR] fn::save_text_blocks execution failed: {:?}",
                e
            );
            return Err(e);
        }

        eprintln!(
            "[SAVE_CHAPTER] Calling fn::sync_chapter_mentions for chapter: {}",
            clean_ch
        );
        let mut res = match db
            .query("RETURN fn::sync_chapter_mentions(type::record('chapters', $c_id), $names);")
            .bind(("c_id", clean_ch.to_string()))
            .bind(("names", mentions))
            .await
        {
            Ok(r) => r,
            Err(e) => {
                eprintln!(
                    "[SAVE_CHAPTER ERROR] fn::sync_chapter_mentions execution failed: {}",
                    e
                );
                return Err(ChapterError::Database(e));
            }
        };

        let errors = res.take_errors();
        if !errors.is_empty() {
            eprintln!(
                "[SAVE_CHAPTER ERROR] Errors during fn::sync_chapter_mentions: {:?}",
                errors
            );
        } else {
            let debug_info: Option<serde_json::Value> = res.take(0)?;
            eprintln!(
                "[SAVE_CHAPTER SUCCESS] fn::sync_chapter_mentions executed. Result: {:?}",
                debug_info
            );
        }
    }

    Ok(saved)
}

pub async fn delete_chapter_inner(db: &Surreal<Db>, id: &str) -> Result<(), ChapterError> {
    let clean = id.trim_start_matches("chapters:");
    let sql = "RETURN fn::delete_chapter($id);";
    db.query(sql)
        .bind(("id", clean.to_string()))
        .await
        .map_err(ChapterError::Database)?;
    Ok(())
}
