//! SurrealDB RAG context adapter, atomic bundle aggregation, and multi-hop traversal.

pub(crate) mod exact_chapter;
pub(crate) mod fallback_search;
pub(crate) mod formatters;
pub(crate) mod types;

pub use formatters::{format_entity_dossier_value, format_entity_search_dto};
pub use types::{
    ChapterSearchDto, EntityRelationSearchDto, EntitySearchDto, LoreChunkSearchDto, RagBundleDto,
};

use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashSet;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

use crate::surrealdb::chat_repo::clean_record_id;
use crate::surrealdb::repos::helpers::{canonicalize_name, clean_id, project_where_clause};
use exact_chapter::fetch_exact_chapter;
use fallback_search::run_fallback_search;
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::RAGContextPort;

pub struct SurrealRAGAdapter {
    db: Arc<Surreal<Db>>,
}

impl SurrealRAGAdapter {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl RAGContextPort for SurrealRAGAdapter {
    async fn retrieve_context(
        &self,
        project_id: &str,
        query: &str,
        _scope: &str,
        top_k: usize,
    ) -> Result<Vec<Value>, DomainError> {
        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();
        let where_proj = project_where_clause("project_id");

        let q_trimmed = query.trim();
        let q_canon = canonicalize_name(q_trimmed);
        let q_lower = q_trimmed.to_lowercase();

        let mut list: Vec<Value> = Vec::new();
        let mut entity_ids: HashSet<String> = HashSet::new();

        // 0. Exact Document Retrieval
        let exact_rows =
            fetch_exact_chapter(&self.db, &where_proj, &p_raw, &p_clean, &q_canon, &q_lower).await;
        list.extend(exact_rows);

        // 1. Атомарный вызов fn::gather_rag_bundle (1 раундтрип, типизированный DTO)
        let rel_limit = (top_k * 2).clamp(10, 30) as i64;
        let sub_limit = (top_k as i64).clamp(4, 15);
        let bundle_sql = "RETURN fn::gather_rag_bundle(type::record('projects', $p_clean), $q, $limit, $rel_limit);";

        let bundle_opt: Option<RagBundleDto> = match self
            .db
            .query(bundle_sql)
            .bind(("p_clean", p_clean.clone()))
            .bind(("q", q_trimmed))
            .bind(("limit", sub_limit))
            .bind(("rel_limit", rel_limit))
            .await
        {
            Ok(mut resp) => {
                let raw_val: Option<Value> = resp.take(0).ok().flatten();
                raw_val.and_then(|v| serde_json::from_value::<RagBundleDto>(v).ok())
            }
            Err(_) => None,
        };

        if let Some(bundle) = bundle_opt {
            for ent in bundle.entities {
                if let Some(id) = ent.id.as_ref().and_then(clean_record_id) {
                    entity_ids.insert(id);
                }
                list.push(format_entity_search_dto(&ent));
            }

            for chunk in bundle.chunks {
                if let Some(eid) = chunk.entity_id.as_ref().and_then(clean_record_id) {
                    entity_ids.insert(eid);
                }
                list.push(serde_json::json!({
                    "id": chunk.id,
                    "entity_id": chunk.entity_id,
                    "content": chunk.content.unwrap_or_default(),
                    "source_type": "lore_chunk",
                }));
            }

            for chap in bundle.chapters {
                list.push(serde_json::json!({
                    "id": chap.id,
                    "title": chap.title.unwrap_or_default(),
                    "content": chap.content.unwrap_or_default(),
                    "source_type": "chapter",
                }));
            }

            for rel in bundle.relations {
                list.push(serde_json::json!({
                    "source_type": "relation",
                    "from": rel.from,
                    "to": rel.out,
                    "rel_type": rel.rel_type,
                    "description": rel.description,
                    "strength": rel.strength,
                }));
            }
        }

        // 2. Fallback search & relation expansion
        run_fallback_search(
            &self.db,
            fallback_search::FallbackSearchParams {
                where_proj: &where_proj,
                p_raw: &p_raw,
                p_clean: &p_clean,
                q_trimmed,
                top_k,
            },
            &mut list,
            &mut entity_ids,
        )
        .await?;

        list.truncate(top_k);
        Ok(list)
    }

    async fn retrieve_chapter_multi_hop_context(
        &self,
        _project_id: &str,
        chapter_id: &str,
    ) -> Result<Value, DomainError> {
        let clean_ch = clean_id("chapters", chapter_id);
        let sql =
            "RETURN fn::get_chapter_multi_hop_context(type::record('chapters', $chapter_id));";
        let clean = clean_ch.trim_start_matches("chapters:").to_string();
        let mut res = self
            .db
            .query(sql)
            .bind(("chapter_id", clean))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let ctx: Option<Value> = res.take(0).unwrap_or_default();
        Ok(ctx.unwrap_or(serde_json::json!({})))
    }
}
