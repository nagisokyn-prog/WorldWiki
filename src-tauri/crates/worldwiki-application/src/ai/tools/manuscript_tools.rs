//! Manuscript reading and editing tools for AI agent.

use std::sync::Arc;
use serde_json::Value;
use crate::errors::ApplicationError;
use crate::manuscript::ManuscriptServices;
use crate::workflows::{EditManuscriptAtomicWorkflow, EditManuscriptRequest, EditManuscriptResult};
use super::id_cleaner::clean_record_id;

pub struct ManuscriptTools;

impl ManuscriptTools {
    pub async fn read_manuscript(
        manuscript: &Arc<ManuscriptServices>,
        project_id: &str,
        chapter_id_or_query: &str,
    ) -> Result<Value, ApplicationError> {
        let query = chapter_id_or_query.trim();
        let chapters = manuscript
            .repo
            .list_by_project(project_id)
            .await
            .map_err(ApplicationError::Domain)?;

        if query.is_empty() || query.eq_ignore_ascii_case("list") || query.eq_ignore_ascii_case("all") {
            let list: Vec<Value> = chapters
                .into_iter()
                .map(|c| {
                    serde_json::json!({
                        "id": c.id,
                        "title": c.title,
                        "word_count": c.word_count
                    })
                })
                .collect();
            return Ok(serde_json::json!({
                "chapters": list,
                "count": list.len(),
                "hint": "Select a chapter using its id to read its full content."
            }));
        }

        // 1. Try exact raw id first
        if let Ok(ch) = manuscript.get_chapter(query).await {
            return Ok(serde_json::to_value(ch).unwrap_or_default());
        }

        // 2. Try cleaned id with "chapters:" prefix
        let cleaned_id = clean_record_id("chapters", query);
        if cleaned_id != query {
            if let Ok(ch) = manuscript.get_chapter(&cleaned_id).await {
                return Ok(serde_json::to_value(ch).unwrap_or_default());
            }
        }

        // Fallback 1: Integer index / chapter number (e.g. "1", 1)
        if let Ok(order) = query.parse::<usize>() {
            if order >= 1 && order <= chapters.len() {
                if let Some(ch) = chapters.get(order - 1) {
                    return Ok(serde_json::to_value(ch).unwrap_or_default());
                }
            }
        }

        // Fallback 2: Title search (case-insensitive substring or exact match)
        let q_lower = query.to_lowercase();
        if let Some(ch) = chapters.iter().find(|c| {
            c.title.to_lowercase() == q_lower
                || c.title.to_lowercase().contains(&q_lower)
                || c.id.to_lowercase().contains(&q_lower)
        }) {
            return Ok(serde_json::to_value(ch).unwrap_or_default());
        }

        let available: Vec<Value> = chapters
            .into_iter()
            .map(|c| {
                serde_json::json!({
                    "id": c.id,
                    "title": c.title
                })
            })
            .collect();

        Ok(serde_json::json!({
            "error": format!("Chapter '{}' not found in project", query),
            "available_chapters": available,
            "hint": "Please choose a chapter from available_chapters using its exact id."
        }))
    }

    pub async fn edit_manuscript(
        edit_workflow: &Arc<EditManuscriptAtomicWorkflow>,
        req: EditManuscriptRequest,
    ) -> Result<EditManuscriptResult, ApplicationError> {
        edit_workflow.execute(req).await
    }
}
