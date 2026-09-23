use crate::knowledge::KnowledgeServices;
use std::sync::Arc;
use worldwiki_domain::knowledge::Entity;

pub async fn find_existing_entity(
    knowledge: &Arc<KnowledgeServices>,
    raw_id: &str,
    project_id: &str,
    name: &str,
) -> Option<Entity> {
    if !raw_id.is_empty() {
        let full_id = if raw_id.starts_with("entities:") {
            raw_id.to_string()
        } else {
            format!("entities:{raw_id}")
        };
        if let Ok(card) = knowledge.get_full_card(&full_id).await {
            return Some(card.entity);
        }
    }

    if !name.is_empty() {
        let search_res = knowledge
            .entity_repo
            .search(project_id, name, 5)
            .await
            .unwrap_or_default();
        if let Some(matched) = search_res.iter().find(|e| e.name.eq_ignore_ascii_case(name)) {
            if let Ok(card) = knowledge.get_full_card(&matched.id).await {
                return Some(card.entity);
            }
        }
    }

    None
}

pub fn resolve_entity_id(raw_id: &str) -> String {
    let is_safe_ascii = !raw_id.is_empty()
        && raw_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == ':');
    if raw_id.is_empty() || !is_safe_ascii {
        format!("entities:char_{}", uuid::Uuid::new_v4().simple())
    } else if !raw_id.starts_with("entities:") {
        format!("entities:{raw_id}")
    } else {
        raw_id.to_string()
    }
}
