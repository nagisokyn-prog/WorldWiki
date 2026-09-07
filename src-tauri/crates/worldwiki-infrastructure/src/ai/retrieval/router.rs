use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;
use std::collections::HashSet;

use super::embedder::EmbedderService;
use crate::surrealdb::repos::project_where_clause;

pub struct RetrievalCandidate {
    pub source_type: String,
    pub title: String,
    pub snippet: String,
    pub score: f32,
    pub entity_id: Option<String>,
}

#[derive(Default)]
pub struct RetrievalRouter {
    pub embedder: EmbedderService,
}

impl RetrievalRouter {
    pub fn new(embedder: EmbedderService) -> Self {
        Self { embedder }
    }

    pub fn should_skip_retrieval(query: &str) -> bool {
        let q = query.trim().to_lowercase();
        if q.chars().count() < 4 {
            return true;
        }

        let greetings = [
            "привет", "здравствуй", "добрый день", "добрый вечер", "доброе утро",
            "хай", "хей", "салют", "ку", "спасибо", "благодарю", "пока", "до свидания",
            "hello", "hi", "hey", "thanks", "thank you", "bye"
        ];

        if greetings.iter().any(|&g| q == g || q == format!("{}!", g) || q == format!("{}.", g)) {
            return true;
        }

        false
    }

    pub async fn retrieve(
        &self,
        db: &Surreal<Db>,
        project_id: &str,
        query: &str,
        enable_semantic: bool,
    ) -> Option<String> {
        self.route_and_retrieve(db, project_id, query, enable_semantic).await
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
            println!("[RetrievalRouter] Intent Classifier: Direct Chat / Chitchat, skipping retrieval.");
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
        let where_proj = project_where_clause("project_id");

        // 0. Exact Document Retrieval (if user specifically asked for Chapter/Volume)
        if let Some(ch_num) = intent.chapter_num {
            println!("[RetrievalRouter] Intent: Exact Document Retrieval for Chapter {}", ch_num);
            let num_str = ch_num.to_string();
            let exact_q = format!(
                "SELECT title, content, chunk_index FROM entity_chunks WHERE {where_proj} AND (title CONTAINS $num_str OR title CONTAINS 'Глава' OR title CONTAINS 'Chapter' OR title CONTAINS 'глава') ORDER BY chunk_index ASC LIMIT 8"
            );
            if let Ok(mut resp) = db.query(&exact_q).bind(("p_raw", p_raw.clone())).bind(("p_clean", p_clean.clone())).bind(("num_str", num_str)).await {
                if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                    if !rows.is_empty() {
                        let mut doc_out = format!("### Документ: Глава {}\n", ch_num);
                        for r in rows {
                            let title = r.get("title").and_then(|v| v.as_str()).unwrap_or("Фрагмент");
                            let content = r.get("content").and_then(|v| v.as_str()).unwrap_or("");
                            doc_out.push_str(&format!("#### {}\n{}\n\n", title, content));
                        }
                        println!("[RetrievalRouter] Exact document fetch assembled {} characters", doc_out.len());
                        return Some(doc_out);
                    }
                }
            }
        }

        // 0.1 Exact & Fuzzy Entity Mention Retrieval (Auto Entity Dossier)
        let all_ent_query = format!("SELECT id, name, description, tags, custom_fields FROM entities WHERE {where_proj}");
        if let Ok(mut resp) = db.query(&all_ent_query).bind(("p_raw", p_raw.clone())).bind(("p_clean", p_clean.clone())).await {
            if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                let mut matched_dossiers = Vec::new();
                for row in rows {
                    let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    let tags: Vec<String> = row.get("tags").and_then(|v| v.as_array()).map(|arr| {
                        arr.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()
                    }).unwrap_or_default();
                    if !name.is_empty() && crate::surrealdb::repos::fuzzy_match_name(query, name, &tags) {
                        let id = row.get("id").and_then(|v| v.as_str()).unwrap_or("");
                        let desc = row.get("description").and_then(|v| v.as_str()).unwrap_or("");
                        let fields = row.get("custom_fields").cloned().unwrap_or(Value::Null);
                        
                        let mut card = format!("### Досье сущности: {} (ID: {})\n", name, id);
                        if !desc.is_empty() {
                            card.push_str(&format!("- **Описание**: {}\n", desc));
                        }
                        if !tags.is_empty() {
                            card.push_str(&format!("- **Теги**: {}\n", tags.join(", ")));
                        }
                        if let Value::Object(map) = fields {
                            if !map.is_empty() {
                                card.push_str("- **Свойства**:\n");
                                for (k, v) in map {
                                    card.push_str(&format!("  * {}: {}\n", k, v));
                                }
                            }
                        }
                        matched_dossiers.push(card);
                    }
                }
                if !matched_dossiers.is_empty() {
                    let entity_out = matched_dossiers.join("\n\n");
                    println!("[RetrievalRouter] Auto Entity Matcher: found {} entity dossiers ({} chars)", matched_dossiers.len(), entity_out.len());
                    return Some(entity_out);
                }
            }
        }

        let mut candidates: Vec<RetrievalCandidate> = Vec::new();
        let mut entity_ids: HashSet<String> = HashSet::new();

        // 1. Lexical Search (BM25 / FTS)
        // Entities BM25
        let ent_query = format!("SELECT id, name, description FROM entities WHERE {where_proj} AND (name @1@ $q OR description @1@ $q) LIMIT 6");
        if let Ok(mut resp) = db.query(&ent_query).bind(("p_raw", p_raw.clone())).bind(("p_clean", p_clean.clone())).bind(("q", query)).await {
            if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                for row in rows {
                    let id = row.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    let name = row.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    let desc = row.get("description").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    if !id.is_empty() {
                        entity_ids.insert(id.clone());
                    }
                    candidates.push(RetrievalCandidate {
                        source_type: "Entity".to_string(),
                        title: name,
                        snippet: desc,
                        score: 0.85,
                        entity_id: Some(id),
                    });
                }
            }
        }

        // Entity Chunks BM25
        let chunk_query = format!("SELECT id, entity_id, content FROM entity_chunks WHERE {where_proj} AND content @1@ $q LIMIT 6");
        if let Ok(mut resp) = db.query(&chunk_query).bind(("p_raw", p_raw.clone())).bind(("p_clean", p_clean.clone())).bind(("q", query)).await {
            if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                for row in rows {
                    let ent_id = row.get("entity_id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    let content = row.get("content").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    if !ent_id.is_empty() {
                        entity_ids.insert(ent_id.clone());
                    }
                    candidates.push(RetrievalCandidate {
                        source_type: "Lore Chunk".to_string(),
                        title: "Entity Section".to_string(),
                        snippet: content,
                        score: 0.80,
                        entity_id: Some(ent_id),
                    });
                }
            }
        }

        // Chapters BM25
        let chap_query = format!("SELECT id, title, content FROM chapters WHERE {where_proj} AND (title @1@ $q OR content @1@ $q) LIMIT 4");
        if let Ok(mut resp) = db.query(&chap_query).bind(("p_raw", p_raw.clone())).bind(("p_clean", p_clean.clone())).bind(("q", query)).await {
            if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                for row in rows {
                    let title = row.get("title").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    let content = row.get("content").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    let snippet: String = content.chars().take(400).collect();
                    candidates.push(RetrievalCandidate {
                        source_type: "Chapter".to_string(),
                        title,
                        snippet,
                        score: 0.80,
                        entity_id: None,
                    });
                }
            }
        }

        // 2. Semantic Search (Nemotron 2048) if enabled
        if enable_semantic {
            if let Ok(query_vec) = self.embedder.embed_query(query).await {
                // Vector search on entity_chunks
                let vec_chunk_sql = format!(
                    "SELECT entity_id, content, vector::similarity::cosine(embeddings.nemotron, $vec) AS sim \
                     FROM entity_chunks WHERE {where_proj} AND embeddings.nemotron != NONE \
                     ORDER BY sim DESC LIMIT 5"
                );
                if let Ok(mut resp) = db.query(&vec_chunk_sql).bind(("p_raw", p_raw.clone())).bind(("p_clean", p_clean.clone())).bind(("vec", query_vec.clone())).await {
                    if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                        for row in rows {
                            let sim = row.get("sim").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                            if sim >= 0.65 {
                                let ent_id = row.get("entity_id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                                let content = row.get("content").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                                if !ent_id.is_empty() {
                                    entity_ids.insert(ent_id.clone());
                                }
                                candidates.push(RetrievalCandidate {
                                    source_type: "Semantic Chunk".to_string(),
                                    title: "Lore".to_string(),
                                    snippet: content,
                                    score: sim,
                                    entity_id: Some(ent_id),
                                });
                            }
                        }
                    }
                }

                // Vector search on entities
                let vec_ent_sql = format!(
                    "SELECT id, name, description, vector::similarity::cosine(embeddings.nemotron, $vec) AS sim \
                     FROM entities WHERE {where_proj} AND embeddings.nemotron != NONE \
                     ORDER BY sim DESC LIMIT 5"
                );
                if let Ok(mut resp) = db.query(&vec_ent_sql).bind(("p_raw", p_raw.clone())).bind(("p_clean", p_clean.clone())).bind(("vec", query_vec)).await {
                    if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                        for row in rows {
                            let sim = row.get("sim").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                            if sim >= 0.65 {
                                let id = row.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                                let name = row.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                                let desc = row.get("description").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                                if !id.is_empty() {
                                    entity_ids.insert(id.clone());
                                }
                                candidates.push(RetrievalCandidate {
                                    source_type: "Entity".to_string(),
                                    title: name,
                                    snippet: desc,
                                    score: sim,
                                    entity_id: Some(id),
                                });
                            }
                        }
                    }
                }
            }
        };

        if candidates.is_empty() {
            return None;
        }

        // Deduplicate & sort candidates by score
        candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        candidates.truncate(8);

        // 3. Graph Expansion (Fetch relationships for seed entities)
        let mut relations_xml = String::new();
        if !entity_ids.is_empty() {
            let seed_list: Vec<RecordId> = entity_ids
                .into_iter()
                .filter_map(|s| {
                    let raw = s.strip_prefix("entities:").unwrap_or(&s).trim_matches('`');
                    if raw.is_empty() { None } else { Some(RecordId::new("entities", raw)) }
                })
                .collect();
            let rel_sql = "SELECT in, out, rel_type, description, strength FROM entity_rel WHERE in IN $seeds OR out IN $seeds LIMIT 10";
            if let Ok(mut resp) = db.query(rel_sql).bind(("seeds", seed_list)).await {
                if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                    for r in rows {
                        let from = r.get("in").and_then(|v| v.as_str()).unwrap_or_default();
                        let to = r.get("out").and_then(|v| v.as_str()).unwrap_or_default();
                        let rel_type = r.get("rel_type").and_then(|v| v.as_str()).unwrap_or("relation");
                        let desc = r.get("description").and_then(|v| v.as_str()).unwrap_or("");
                        relations_xml.push_str(&format!(
                            "    <Relation from=\"{from}\" to=\"{to}\" type=\"{rel_type}\">{desc}</Relation>\n"
                        ));
                    }
                }
            }
        }

        // 4. Build Context XML
        let mut ctx = String::from("<world_context>\n");
        for c in &candidates {
            if c.snippet.trim().is_empty() {
                continue;
            }
            ctx.push_str(&format!(
                "  <{type_name} title=\"{title}\">\n    {snippet}\n  </{type_name}>\n",
                type_name = c.source_type.replace(' ', "_"),
                title = c.title,
                snippet = c.snippet.trim()
            ));
        }

        if !relations_xml.is_empty() {
            ctx.push_str("  <Relationships>\n");
            ctx.push_str(&relations_xml);
            ctx.push_str("  </Relationships>\n");
        }
        ctx.push_str("</world_context>");

        Some(ctx)
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
        for g in ["привет", "Привет!", "здравствуй.", "добрый день", "хай", "ку", "спасибо",
                  "hello", "Hi!", "thanks.", "bye"] {
            assert!(RetrievalRouter::should_skip_retrieval(g), "должен скипнуть: {g}");
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
