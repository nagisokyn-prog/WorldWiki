use super::utils::clean_id;
use worldwiki_domain::analytics::{
    ContradictionAnomaly, ContradictionRule, ContradictionSeverity, ItemTrackerDto,
    TimelineInspectorDto,
};

pub fn eval_item_rules(
    item_tracker: &ItemTrackerDto,
    timeline_data: &TimelineInspectorDto,
    anomalies: &mut Vec<ContradictionAnomaly>,
) {
    for item in &item_tracker.items {
        if item.usage_state == worldwiki_domain::analytics::ItemUsageState::Forgotten {
            anomalies.push(ContradictionAnomaly {
                rule: ContradictionRule::ForgottenItem,
                severity: ContradictionSeverity::Warning,
                title: format!("Забытый предмет (Чеховское ружьё): {}", item.name),
                description: format!(
                    "Предмет '{}' ({}) был введен в главе {}, но не упоминается уже {} глав подряд",
                    item.name,
                    item.item_type,
                    item.first_chapter_order.unwrap_or(1),
                    item.skipped_chapters
                ),
                entity_ids: vec![item.id.clone()],
                chapter_ids: vec![],
                event_ids: vec![],
                promise_ids: vec![],
            });
        }

        if let Some(ref current_owner) = item.current_owner_id {
            let clean_curr = clean_id(current_owner);
            let clean_item = clean_id(&item.id);
            for ev in &timeline_data.events {
                let item_present = ev.participants.iter().any(|p| clean_id(p) == clean_item);
                if item_present {
                    let owner_present = ev.participants.iter().any(|p| clean_id(p) == clean_curr);
                    let other_chars: Vec<&String> = ev
                        .participants
                        .iter()
                        .filter(|p| {
                            let cp = clean_id(p);
                            cp != clean_curr && cp != clean_item
                        })
                        .collect();

                    if !owner_present && !other_chars.is_empty() && item.custody_chain.is_empty() {
                        anomalies.push(ContradictionAnomaly {
                            rule: ContradictionRule::ChainOfCustodyViolation,
                            severity: ContradictionSeverity::Warning,
                            title: format!("Разрыв цепочки владения: {}", item.name),
                            description: format!(
                                "Предмет '{}' зафиксирован за персонажем '{}', но в событии '{}' (минута {}) используется другими участниками без зафиксированной сцены передачи",
                                item.name,
                                item.current_owner_name.as_deref().unwrap_or(current_owner),
                                ev.title,
                                ev.m_abs
                            ),
                            entity_ids: vec![item.id.clone(), current_owner.clone()],
                            chapter_ids: vec![],
                            event_ids: vec![ev.event_id.clone()],
                            promise_ids: vec![],
                        });
                    }
                }
            }
        }
    }
}
