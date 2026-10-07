pub mod candidate;
pub mod exact_search;
pub mod greetings;
pub mod hybrid_search;

pub use candidate::RetrievalCandidate;

use std::collections::HashSet;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

use super::embedder::EmbedderService;

#[derive(Default)]
pub struct RetrievalRouter {
    pub embedder: EmbedderService,
}

impl RetrievalRouter {
    pub fn new(embedder: EmbedderService) -> Self {
        Self { embedder }
    }

    pub fn should_skip_retrieval(query: &str) -> bool {
        greetings::is_greeting_or_short(query)
    }

    pub async fn retrieve(
        &self,
        db: &Surreal<Db>,
        project_id: &str,
        query: &str,
        enable_semantic: bool,
    ) -> Option<String> {
        self.route_and_retrieve(db, project_id, query, enable_semantic)
            .await
    }

    pub async fn route_and_retrieve(
        &self,
        db: &Surreal<Db>,
        project_id: &str,
        query: &str,
        enable_semantic: bool,
    ) -> Option<String> {
        if Self::should_skip_retrieval(query) {
            println!("[RetrievalRouter] Query is greeting/short, skipping retrieval.");
            return None;
        }

        let intent = super::query_analyzer::analyze_user_query(query);
        if intent.is_chitchat {
            println!(
                "[RetrievalRouter] Intent Classifier: Direct Chat / Chitchat, skipping retrieval."
            );
            return None;
        }

        let p_raw = project_id.to_string();
        let p_clean = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .trim_matches('⟨')
            .trim_matches('⟩')
            .trim()
            .to_string();

        // 0. Exact Document Retrieval (if user specifically asked for Chapter/Volume)
        if let Some(ch_num) = intent.chapter_num
            && let Some(doc_out) =
                exact_search::fetch_exact_chapter(db, &p_raw, &p_clean, ch_num).await
            {
                return Some(doc_out);
            }

        let mut candidates: Vec<RetrievalCandidate> = Vec::new();
        let mut entity_ids: HashSet<String> = HashSet::new();

        // 0.1 Exact & Fuzzy Entity Mention Retrieval (Auto Entity Dossier)
        exact_search::fetch_fuzzy_entities(
            db,
            &p_raw,
            &p_clean,
            query,
            &mut candidates,
            &mut entity_ids,
        )
        .await;

        let search_scope = hybrid_search::SearchScope {
            db,
            p_raw: &p_raw,
            p_clean: &p_clean,
            query,
        };

        // 1. Lexical Search (BM25 / FTS)
        hybrid_search::fetch_bm25_candidates(&search_scope, &mut candidates, &mut entity_ids).await;

        // 2. Semantic Search (Nemotron 2048) if enabled
        if enable_semantic {
            hybrid_search::fetch_semantic_candidates(
                &self.embedder,
                &search_scope,
                &mut candidates,
                &mut entity_ids,
            )
            .await;
        }

        if candidates.is_empty() {
            return None;
        }

        // Deduplicate & sort candidates by score
        candidates.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        candidates.truncate(8);

        // 3. Graph Expansion (Fetch relationships for seed entities)
        let relations_xml = hybrid_search::expand_graph_relations(db, &entity_ids).await;

        // 4. Build Context XML
        Some(candidate::build_context_xml(&candidates, &relations_xml))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skip_empty_and_short_queries() {
        assert!(RetrievalRouter::should_skip_retrieval(""));
        assert!(RetrievalRouter::should_skip_retrieval("   "));
        assert!(RetrievalRouter::should_skip_retrieval("ку"));
        assert!(RetrievalRouter::should_skip_retrieval("ок"));
        assert!(RetrievalRouter::should_skip_retrieval("abc"));
    }

    #[test]
    fn skip_greetings() {
        for g in [
            "привет",
            "Привет!",
            "здравствуй.",
            "добрый день",
            "хай",
            "ку",
            "спасибо",
            "hello",
            "Hi!",
            "thanks.",
            "bye",
        ] {
            assert!(
                RetrievalRouter::should_skip_retrieval(g),
                "должен скипнуть: {g}"
            );
        }
    }

    #[test]
    fn lore_questions_are_not_skipped() {
        assert!(!RetrievalRouter::should_skip_retrieval(
            "расскажи про первого короля королевства"
        ));
        assert!(!RetrievalRouter::should_skip_retrieval(
            "кто такой Артур и почему он предал брата?"
        ));
        assert!(!RetrievalRouter::should_skip_retrieval(
            "привет, расскажи сюжет второй главы"
        ));
    }

    #[test]
    fn greeting_with_trailing_whitespace_is_skipped() {
        assert!(RetrievalRouter::should_skip_retrieval("  привет  "));
    }
}
