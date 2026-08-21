use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;
use std::collections::{HashSet, HashMap};

use super::embedder::EmbedderService;

pub struct RetrievalCandidate {
    pub source_type: String,
    pub title: String,
    pub snippet: String,
    pub score: f32,
    pub entity_id: Option<String>,
}

pub struct RetrievalRouter {
    embedder: EmbedderService,
}

impl Default for RetrievalRouter {
    fn default() -> Self {
        Self {
            embedder: EmbedderService::default(),
        }
    }
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
        if Self::should_skip_retrieval(query) {
            return None;
        }

        let clean_proj = project_id
            .strip_prefix("projects:")
            .unwrap_or(project_id)
            .trim_matches('`')
            .to_string();
        let proj_rec = RecordId::new("projects", clean_proj.as_str());

        let mut candidates: Vec<RetrievalCandidate> = Vec::new();
        let mut entity_ids: HashSet<String> = HashSet::new();

        // 1. Lexical Search (BM25 / FTS)
        // Entities BM25
        let ent_query = "SELECT id, name, description FROM entities WHERE project_id = $proj AND (name @1@ $q OR description @2@ $q) LIMIT 6";
        if let Ok(mut resp) = db.query(ent_query).bind(("proj", proj_rec.clone())).bind(("q", query)).await {
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
        let chunk_query = "SELECT id, entity_id, content FROM entity_chunks WHERE project_id = $proj AND content @1@ $q LIMIT 6";
        if let Ok(mut resp) = db.query(chunk_query).bind(("proj", proj_rec.clone())).bind(("q", query)).await {
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
        let chap_query = "SELECT id, title, content FROM chapters WHERE project_id = $proj AND (title @1@ $q OR content @2@ $q) LIMIT 4";
        if let Ok(mut resp) = db.query(chap_query).bind(("proj", proj_rec.clone())).bind(("q", query)).await {
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
                let vec_chunk_sql = "SELECT entity_id, content, vector::similarity::cosine(embeddings.nemotron, $vec) AS sim \
                                     FROM entity_chunks WHERE project_id = $proj AND embeddings.nemotron != NONE \
                                     ORDER BY sim DESC LIMIT 5";
                if let Ok(mut resp) = db.query(vec_chunk_sql).bind(("proj", proj_rec.clone())).bind(("vec", query_vec.clone())).await {
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
                let vec_ent_sql = "SELECT id, name, description, vector::similarity::cosine(embeddings.nemotron, $vec) AS sim \
                                   FROM entities WHERE project_id = $proj AND embeddings.nemotron != NONE \
                                   ORDER BY sim DESC LIMIT 5";
                if let Ok(mut resp) = db.query(vec_ent_sql).bind(("proj", proj_rec.clone())).bind(("vec", query_vec)).await {
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
        }

        if candidates.is_empty() {
            return None;
        }

        // Deduplicate & sort candidates by score
        candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        candidates.truncate(8);

        // 3. Graph Expansion (Fetch relationships for seed entities)
        let mut relations_xml = String::new();
        if !entity_ids.is_empty() {
            let seed_list: Vec<String> = entity_ids.into_iter().collect();
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
