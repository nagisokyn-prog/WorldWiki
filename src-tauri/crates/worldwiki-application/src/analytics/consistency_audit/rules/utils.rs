pub fn clean_id(id: &str) -> &str {
    id.strip_prefix("entities:")
        .or_else(|| id.strip_prefix("chapters:"))
        .or_else(|| id.strip_prefix("timeline_events:"))
        .or_else(|| id.strip_prefix("plot_promises:"))
        .unwrap_or(id)
}

pub fn is_participant(participants: &[String], entity_id: &str) -> bool {
    let clean_ent = clean_id(entity_id);
    participants.iter().any(|p| clean_id(p) == clean_ent)
}
