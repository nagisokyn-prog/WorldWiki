//! SurrealDB implementation of ChapterRepository.

use super::helpers::clean_id;
use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::Surreal;
use surrealdb::engine::local::Db;
use worldwiki_domain::errors::DomainError;
use worldwiki_domain::manuscript::Chapter;
use worldwiki_ports::repositories::ChapterRepository;

pub struct SurrealChapterRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealChapterRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl ChapterRepository for SurrealChapterRepository {
    async fn get_by_id(&self, id: &str) -> Result<Option<Chapter>, DomainError> {
        let clean = clean_id("chapters", id);
        surreal_take_one!(self.db, "RETURN fn::get_chapter($id);", ("id", clean))
    }

    async fn save(&self, chapter: &Chapter) -> Result<(), DomainError> {
        let clean = clean_id("chapters", &chapter.id);
        let vol_clean = clean_id("volumes", &chapter.volume_id);
        surreal_exec!(
            self.db,
            "RETURN fn::save_chapter($c_id, $v_id, $title, $content, $sort_order, $word_count);",
            ("c_id", clean),
            ("v_id", vol_clean),
            ("title", chapter.title.clone()),
            ("content", chapter.content.clone()),
            ("sort_order", chapter.sort_order),
            ("word_count", chapter.word_count as i64),
        )
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("chapters", id);
        surreal_exec!(self.db, "RETURN fn::delete_chapter($id);", ("id", clean))
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        surreal_take_list!(
            self.db,
            "RETURN fn::list_chapters_by_project($p_clean);",
            ("p_clean", p_clean),
        )
    }

    async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let v_clean = clean_id("volumes", volume_id);
        surreal_take_list!(
            self.db,
            "RETURN fn::list_chapters_by_volume($v_id);",
            ("v_id", v_clean),
        )
    }

    async fn sync_mentions_appearances(
        &self,
        chapter_id: &str,
        entity_names: &[String],
    ) -> Result<(), DomainError> {
        let clean_ch = clean_id("chapters", chapter_id);
        surreal_exec!(
            self.db,
            "RETURN fn::sync_chapter_mentions(type::record($c_id), $names);",
            ("c_id", clean_ch),
            ("names", entity_names.to_vec()),
        )
    }
}
