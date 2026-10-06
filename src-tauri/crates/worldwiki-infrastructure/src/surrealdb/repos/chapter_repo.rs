//! SurrealDB implementation of ChapterRepository.

use super::helpers::{project_where_clause, take_list, take_one};
use async_trait::async_trait;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
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
        let sql = "SELECT * FROM type::record('chapters', $id);";
        let clean = id.trim_start_matches("chapters:");
        let mut res = self
            .db
            .query(sql)
            .bind(("id", clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_one(&mut res, 0)
    }

    async fn save(&self, chapter: &Chapter) -> Result<(), DomainError> {
        let clean = chapter.id.trim_start_matches("chapters:").to_string();
        let proj_clean = chapter
            .project_id
            .trim_start_matches("projects:")
            .to_string();

        let sql = r#"
            UPSERT type::record('chapters', $c_id) MERGE {
                title: $title,
                content: $content,
                project_id: type::record('projects', $p_id),
                word_count: $word_count,
                updated_at: time::now()
            };
        "#;
        let mut res = self
            .db
            .query(sql)
            .bind(("c_id", clean))
            .bind(("p_id", proj_clean))
            .bind(("title", chapter.title.clone()))
            .bind(("content", chapter.content.clone()))
            .bind(("word_count", chapter.word_count as i64))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let errors = res.take_errors();
        if let Some((_, e)) = errors.into_iter().next() {
            return Err(DomainError::ConstraintViolation(e.to_string()));
        }
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("chapters:").to_string();
        let sql = "DELETE type::record('chapters', $id);";
        self.db
            .query(sql)
            .bind(("id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        Ok(())
    }

    async fn list_by_project(&self, project_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();
        let sql = "SELECT id, project_id, title, content, summary, sort_order, word_count, created_at, updated_at FROM chapters WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw OR project_id = $p_clean OR project_id = type::record('projects', $p_raw)) ORDER BY sort_order ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("p_raw", p_raw))
            .bind(("p_clean", p_clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn list_by_volume(&self, volume_id: &str) -> Result<Vec<Chapter>, DomainError> {
        let sql = "SELECT * FROM chapters WHERE volume_id = $volume_id ORDER BY sort_order ASC;";
        let mut res = self
            .db
            .query(sql)
            .bind(("volume_id", volume_id.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        take_list(&mut res, 0)
    }

    async fn sync_mentions_appearances(
        &self,
        chapter_id: &str,
        entity_names: &[String],
    ) -> Result<(), DomainError> {
        let clean_ch = chapter_id.trim_start_matches("chapters:");

        let mut res = self
            .db
            .query("RETURN fn::sync_chapter_mentions(type::record('chapters', $c_id), $names);")
            .bind(("c_id", clean_ch.to_string()))
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
