use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;
use std::collections::HashSet;

use super::candidate::RetrievalCandidate;
use crate::ai::retrieval::embedder::EmbedderService;

pub(crate) struct SearchScope<'a> {
    pub db: &'a Surreal<Db>,
    pub where_proj: &'a str,
    pub p_raw: &'a str,
    pub p_clean: &'a str,
    pub query: &'a str,
}

pub(crate) async fn fetch_bm25_candidates(
    scope: &SearchScope<'_>,
    candidates: &mut Vec<RetrievalCandidate>,
    entity_ids: &mut HashSet<String>,
) {
    // 1. Entities BM25
    let ent_query = format!(
        "SELECT id, name, description, search::score(1) AS bm25_score, search::highlight('<b>', '</b>', 1) AS bm25_snippet \
         FROM entities WHERE {} AND (name @1@ $q OR description @1@ $q) \
         ORDER BY bm25_score DESC LIMIT 6",
        scope.where_proj
    );
    if let Ok(mut resp) = scope
        .db
        .query(&ent_query)
        .bind(("p_raw", scope.p_raw.to_string()))
        .bind(("p_clean", scope.p_clean.to_string()))
        .bind(("q", scope.query))
        .await
    {
        if let Ok(rows) = resp.take::<Vec<Value>>(0) {
            for row in rows {
                let id = row.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                let name = row.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                let desc = row.get("description").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                let raw_score = row.get("bm25_score").and_then(|v| v.as_f64()).unwrap_or(1.0);
                let score = (0.70 + (raw_score / (raw_score + 2.0)) * 0.28) as f32;
                let snippet = row
                    .get("bm25_snippet")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .unwrap_or(&desc)
                    .to_string();

                if !id.is_empty() {
                    entity_ids.insert(id.clone());
                }
                candidates.push(RetrievalCandidate {
                    source_type: "Entity".to_string(),
                    title: name,
                    snippet,
                    score,
                    entity_id: Some(id),
                });
            }
        }
    }

    // 2. Entity Chunks BM25
    let chunk_query = format!(
        "SELECT id, entity_id, content, search::score(1) AS bm25_score, search::highlight('<b>', '</b>', 1) AS bm25_snippet \
         FROM entity_chunks WHERE {} AND content @1@ $q \
         ORDER BY bm25_score DESC LIMIT 6",
        scope.where_proj
    );
    if let Ok(mut resp) = scope
        .db
        .query(&chunk_query)
        .bind(("p_raw", scope.p_raw.to_string()))
        .bind(("p_clean", scope.p_clean.to_string()))
        .bind(("q", scope.query))
        .await
    {
        if let Ok(rows) = resp.take::<Vec<Value>>(0) {
            for row in rows {
                let ent_id = row.get("entity_id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                let content = row.get("content").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                let raw_score = row.get("bm25_score").and_then(|v| v.as_f64()).unwrap_or(1.0);
                let score = (0.65 + (raw_score / (raw_score + 2.0)) * 0.30) as f32;
                let snippet = row
                    .get("bm25_snippet")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .unwrap_or(&content)
                    .to_string();

                if !ent_id.is_empty() {
                    entity_ids.insert(ent_id.clone());
                }
                candidates.push(RetrievalCandidate {
                    source_type: "Lore Chunk".to_string(),
                    title: "Entity Section".to_string(),
                    snippet,
                    score,
                    entity_id: Some(ent_id),
                });
            }
        }
    }

    // 3. Chapters BM25
    let chap_query = format!(
        "SELECT id, title, content, search::score(1) AS bm25_score, search::highlight('<b>', '</b>', 1) AS bm25_snippet \
         FROM chapters WHERE {} AND (title @1@ $q OR content @1@ $q) \
         ORDER BY bm25_score DESC LIMIT 4",
        scope.where_proj
    );
    if let Ok(mut resp) = scope
        .db
        .query(&chap_query)
        .bind(("p_raw", scope.p_raw.to_string()))
        .bind(("p_clean", scope.p_clean.to_string()))
        .bind(("q", scope.query))
        .await
    {
        if let Ok(rows) = resp.take::<Vec<Value>>(0) {
            for row in rows {
                let title = row.get("title").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                let content = row.get("content").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                let raw_score = row.get("bm25_score").and_then(|v| v.as_f64()).unwrap_or(1.0);
                let score = (0.65 + (raw_score / (raw_score + 2.0)) * 0.30) as f32;
                let snippet = row
                    .get("bm25_snippet")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| content.chars().take(400).collect());

                candidates.push(RetrievalCandidate {
                    source_type: "Chapter".to_string(),
                    title,
                    snippet,
                    score,
                    entity_id: None,
                });
            }
        }
    }
}

pub(crate) async fn fetch_semantic_candidates(
    embedder: &EmbedderService,
    scope: &SearchScope<'_>,
    candidates: &mut Vec<RetrievalCandidate>,
    entity_ids: &mut HashSet<String>,
) {
    if let Ok(query_vec) = embedder.embed_query(scope.query).await {
        // Vector search on entity_chunks
        let vec_chunk_sql = format!(
            "SELECT entity_id, content, vector::similarity::cosine(embeddings.nemotron, $vec) AS sim \
             FROM entity_chunks WHERE {} AND embeddings.nemotron != NONE \
             ORDER BY sim DESC LIMIT 5",
            scope.where_proj
        );
        if let Ok(mut resp) = scope
            .db
            .query(&vec_chunk_sql)
            .bind(("p_raw", scope.p_raw.to_string()))
            .bind(("p_clean", scope.p_clean.to_string()))
            .bind(("vec", query_vec.clone()))
            .await
        {
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
             FROM entities WHERE {} AND embeddings.nemotron != NONE \
             ORDER BY sim DESC LIMIT 5",
            scope.where_proj
        );
        if let Ok(mut resp) = scope
            .db
            .query(&vec_ent_sql)
            .bind(("p_raw", scope.p_raw.to_string()))
            .bind(("p_clean", scope.p_clean.to_string()))
            .bind(("vec", query_vec))
            .await
        {
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

pub(crate) async fn expand_graph_relations(
    db: &Surreal<Db>,
    entity_ids: &HashSet<String>,
) -> String {
    let mut relations_xml = String::new();
    if !entity_ids.is_empty() {
        let seed_list: Vec<RecordId> = entity_ids
            .iter()
            .filter_map(|s| {
                let raw = s.strip_prefix("entities:").unwrap_or(s).trim_matches('`');
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
    relations_xml
}
