use serde_json::Value;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use std::collections::HashSet;

use super::candidate::RetrievalCandidate;

pub(crate) async fn fetch_exact_chapter(
    db: &Surreal<Db>,
    where_proj: &str,
    p_raw: &str,
    p_clean: &str,
    ch_num: i64,
) -> Option<String> {
    println!("[RetrievalRouter] Intent: Exact Document Retrieval for Chapter {}", ch_num);
    let num_str = ch_num.to_string();
    let exact_q = format!(
        "SELECT title, content, chunk_index FROM entity_chunks WHERE {where_proj} AND (title CONTAINS $num_str OR title CONTAINS 'Глава' OR title CONTAINS 'Chapter' OR title CONTAINS 'глава') ORDER BY chunk_index ASC LIMIT 8"
    );
    if let Ok(mut resp) = db
        .query(&exact_q)
        .bind(("p_raw", p_raw.to_string()))
        .bind(("p_clean", p_clean.to_string()))
        .bind(("num_str", num_str))
        .await
    {
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
    None
}

pub(crate) async fn fetch_fuzzy_entities(
    db: &Surreal<Db>,
    where_proj: &str,
    p_raw: &str,
    p_clean: &str,
    query: &str,
    candidates: &mut Vec<RetrievalCandidate>,
    entity_ids: &mut HashSet<String>,
) {
    let all_ent_query = format!("SELECT id, name, description, tags, custom_fields FROM entities WHERE {where_proj}");
    if let Ok(mut resp) = db
        .query(&all_ent_query)
        .bind(("p_raw", p_raw.to_string()))
        .bind(("p_clean", p_clean.to_string()))
        .await
    {
        if let Ok(rows) = resp.take::<Vec<Value>>(0) {
            for row in rows {
                let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let tags: Vec<String> = row
                    .get("tags")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()
                    })
                    .unwrap_or_default();
                if !name.is_empty() && crate::surrealdb::repos::fuzzy_match_name(query, name, &tags) {
                    let id = row.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let desc = row.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if !id.is_empty() {
                        entity_ids.insert(id.clone());
                    }
                    candidates.push(RetrievalCandidate {
                        source_type: "Entity".to_string(),
                        title: name.to_string(),
                        snippet: desc,
                        score: 1.0,
                        entity_id: Some(id),
                    });
                }
            }
        }
    }
}
