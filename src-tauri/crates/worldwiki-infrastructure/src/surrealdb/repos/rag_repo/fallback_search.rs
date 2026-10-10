use super::formatters::format_entity_dossier_value;
use crate::surrealdb::chat_repo::clean_record_id;
use serde_json::Value;
use std::collections::HashSet;
use surrealdb::engine::local::Db;
use surrealdb::types::RecordId;
use surrealdb::Surreal;
use worldwiki_domain::errors::DomainError;

pub(crate) struct FallbackSearchParams<'a> {
    pub p_raw: &'a str,
    pub p_clean: &'a str,
    pub q_trimmed: &'a str,
    pub top_k: usize,
}

pub(crate) async fn run_fallback_search(
    db: &Surreal<Db>,
    params: FallbackSearchParams<'_>,
    list: &mut Vec<Value>,
    entity_ids: &mut HashSet<String>,
) -> Result<(), DomainError> {
    let FallbackSearchParams {
        p_raw,
        p_clean,
        q_trimmed,
        top_k,
    } = params;
    if list.len() < top_k {
        let ch_sql = if !q_trimmed.is_empty() {
            "SELECT id, title, content, 'chapter' AS source_type FROM chapters WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw) AND (string::lowercase(title) CONTAINS string::lowercase($q) OR (content != NONE AND string::lowercase(type::string(content)) CONTAINS string::lowercase($q))) LIMIT $limit"
        } else {
            "SELECT id, title, content, 'chapter' AS source_type FROM chapters WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw) LIMIT $limit"
        };
        let mut res_ch = db
            .query(ch_sql)
            .bind(("p_raw", p_raw.to_string()))
            .bind(("p_clean", p_clean.to_string()))
            .bind(("q", q_trimmed.to_string()))
            .bind(("limit", top_k))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let chaps: Vec<Value> = res_ch
            .take(0)
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let en_sql = if !q_trimmed.is_empty() {
            "SELECT id, name, type_key, description, tags, attributes, 'entity' AS source_type FROM entities WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw) AND (string::lowercase(name) CONTAINS string::lowercase($q) OR (description != NONE AND string::lowercase(type::string(description)) CONTAINS string::lowercase($q))) LIMIT $limit"
        } else {
            "SELECT id, name, type_key, description, tags, attributes, 'entity' AS source_type FROM entities WHERE (project_id = type::record('projects', $p_clean) OR project_id = $p_raw) LIMIT $limit"
        };
        let mut res_en = db
            .query(en_sql)
            .bind(("p_raw", p_raw.to_string()))
            .bind(("p_clean", p_clean.to_string()))
            .bind(("q", q_trimmed.to_string()))
            .bind(("limit", top_k))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let ents: Vec<Value> = res_en
            .take(0)
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

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

            if let Some(eid) = item.get("id").and_then(clean_record_id) {
                entity_ids.insert(eid);
            }
            list.push(item);
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
        if let Ok(mut resp) = db.query(rel_sql).bind(("seeds", seed_list)).await
            && let Ok(rows) = resp.take::<Vec<Value>>(0) {
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

    Ok(())
}
