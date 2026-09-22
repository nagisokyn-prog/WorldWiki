use super::formatters::format_entity_dossier_value;
use crate::surrealdb::chat_repo::clean_record_id;
use crate::surrealdb::repos::helpers::{canonicalize_name, fuzzy_match_name};
use serde_json::Value;
use std::collections::HashSet;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;

pub(crate) struct FallbackSearchParams<'a> {
    pub where_proj: &'a str,
    pub p_raw: &'a str,
    pub p_clean: &'a str,
    pub q_trimmed: &'a str,
    pub q_canon: &'a str,
    pub top_k: usize,
}

pub(crate) async fn run_fallback_search(
    db: &Surreal<Db>,
    params: FallbackSearchParams<'_>,
    list: &mut Vec<Value>,
    entity_ids: &mut HashSet<String>,
) -> Result<(), DomainError> {
    let FallbackSearchParams {
        where_proj,
        p_raw,
        p_clean,
        q_trimmed,
        q_canon,
        top_k,
    } = params;
    if list.len() < top_k {
        let mut res_ch = db
            .query(format!(
                "SELECT id, title, content, 'chapter' AS source_type FROM chapters WHERE {where_proj}"
            ))
            .bind(("p_raw", p_raw.to_string()))
            .bind(("p_clean", p_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let chaps: Vec<Value> = res_ch.take(0).unwrap_or_default();

        let mut res_en = db
            .query(format!(
                "SELECT id, name, type_key, description, tags, attributes, 'entity' AS source_type FROM entities WHERE {where_proj}"
            ))
            .bind(("p_raw", p_raw.to_string()))
            .bind(("p_clean", p_clean.to_string()))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let ents: Vec<Value> = res_en.take(0).unwrap_or_default();

        for raw_item in chaps.into_iter().chain(ents) {
            let is_entity = raw_item.get("source_type").and_then(|v| v.as_str()) == Some("entity")
                || raw_item.get("type_key").is_some();
            let item = if is_entity {
                format_entity_dossier_value(&raw_item)
            } else {
                raw_item
            };

            let id_str = item.get("id").and_then(clean_record_id).unwrap_or_default();
            if list.iter().any(|existing| {
                existing
                    .get("id")
                    .and_then(clean_record_id)
                    .unwrap_or_default()
                    == id_str
            }) {
                continue;
            }
            let t = item
                .get("title")
                .or_else(|| item.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let cont = item
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let tags: Vec<String> = item
                .get("tags")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();

            let q_stem = crate::surrealdb::stemmer::SnowballStemmer::stem_phrase(q_canon);
            let cont_canon = canonicalize_name(cont);
            let cont_stem = crate::surrealdb::stemmer::SnowballStemmer::stem_phrase(&cont_canon);

            if q_canon.is_empty()
                || fuzzy_match_name(q_trimmed, t, &tags)
                || canonicalize_name(t).contains(q_canon)
                || cont_canon.contains(q_canon)
                || (!q_stem.is_empty() && cont_stem.contains(&q_stem))
            {
                if let Some(eid) = item.get("id").and_then(clean_record_id) {
                    entity_ids.insert(eid);
                }
                list.push(item);
            }
            if list.len() >= top_k {
                break;
            }
        }
    }

    // Graph relation expansion
    let has_relations = list
        .iter()
        .any(|r| r.get("source_type").and_then(|v| v.as_str()) == Some("relation"));
    if !has_relations && !entity_ids.is_empty() {
        let seed_list: Vec<RecordId> = entity_ids
            .iter()
            .filter_map(|s| {
                let raw = s
                    .strip_prefix("entities:")
                    .unwrap_or(s)
                    .replace(['⟨', '⟩', '`'], "");
                if raw.is_empty() {
                    None
                } else {
                    Some(RecordId::new("entities", raw))
                }
            })
            .collect();
        let rel_sql = "SELECT in, out, rel_type, description, strength FROM entity_rel WHERE in IN $seeds OR out IN $seeds ORDER BY strength DESC LIMIT 10";
        if let Ok(mut resp) = db.query(rel_sql).bind(("seeds", seed_list)).await {
            if let Ok(rows) = resp.take::<Vec<Value>>(0) {
                for r in rows {
                    list.push(serde_json::json!({
                        "source_type": "relation",
                        "from": r.get("in"),
                        "to": r.get("out"),
                        "rel_type": r.get("rel_type"),
                        "description": r.get("description"),
                        "strength": r.get("strength"),
                    }));
                }
            }
        }
    }

    Ok(())
}
