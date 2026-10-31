//! SurrealDB implementation of ChapterRepository.

use super::helpers::{clean_id, take_list, take_one};
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
        let sql = "RETURN fn::get_chapter($id);";
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, chapter: &Chapter) -> Result<(), DomainError> {
        let clean = clean_id("chapters", &chapter.id);
        let vol_clean = clean_id("volumes", &chapter.volume_id);

        let sql = "RETURN fn::save_chapter($c_id, $v_id, $title, $content, $sort_order, $word_count);";
        let mut res = self
            .db
            .query(sql)
            .bind(("c_id", clean))
            .bind(("v_id", vol_clean))
            .bind(("title", chapter.title.clone()))
            .bind(("content", chapter.content.clone()))
            .bind(("sort_order", chapter.sort_order))
            .bind(("word_count", chapter.word_count as i64))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = clean_id("chapters", id);
        let sql = "RETURN fn::delete_chapter($id);";
        let mut res = self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let p_clean = clean_id("projects", project_id);
        let sql = "RETURN fn::list_chapters_by_project($p_clean);";
        let mut res = self
            .db
            .query(sql)
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let v_clean = clean_id("volumes", volume_id);
        let sql = "RETURN fn::list_chapters_by_volume($v_id);";
        let mut res = self
            .db
            .query(sql)
            .bind(("v_id", v_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        res.check().map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn sync_mentions_appearances(
        &self,
        chapter_id: &str,
        entity_names: &[String],
    ) -> Result<(), DomainError> {
        let clean_ch = clean_id("chapters", chapter_id);

        let mut res = self
            .db
            .query("RETURN fn::sync_chapter_mentions(type::record($c_id), $names);")
            .bind(("c_id", clean_ch))
            .bind(("names", entity_names.to_vec()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let errors = res.take_errors();
        if let Some((_, e)) = errors.into_iter().next() {
            return Err(DomainError::ConstraintViolation(e.to_string()));
        }

        Ok(())
    }
}
