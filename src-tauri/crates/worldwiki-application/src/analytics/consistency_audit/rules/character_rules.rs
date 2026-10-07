use super::utils::is_participant;
use worldwiki_domain::analytics::{
    ContradictionAnomaly, ContradictionRule, ContradictionSeverity, CrossRefMatrixDto,
    TimelineInspectorDto,
};

pub fn eval_deceased_rules(
    matrix: &CrossRefMatrixDto,
    timeline_data: &TimelineInspectorDto,
    anomalies: &mut Vec<ContradictionAnomaly>,
) {
    for ent in &matrix.entities {
        if ent.is_deceased
            && let Some(death_m_abs) = ent.death_m_abs
        {
            for ev in &timeline_data.events {
                if is_participant(&ev.participants, &ent.id) && ev.m_abs > death_m_abs {
                    anomalies.push(ContradictionAnomaly {
                        rule: ContradictionRule::DeceasedEntityActive,
                        severity: ContradictionSeverity::Critical,
                        title: format!("Погибший персонаж участвует в событии: {}", ent.name),
                        description: format!(
                            "Персонаж '{}' погиб в минуту {}, но участвует в событии '{}' (минута {})",
                            ent.name, death_m_abs, ev.title, ev.m_abs
                        ),
                        entity_ids: vec![ent.id.clone()],
                        chapter_ids: vec![],
                        event_ids: vec![ev.event_id.clone()],
                        promise_ids: vec![],
                    });
                }
            }
        }
    }
}

pub fn eval_birth_rules(
    matrix: &CrossRefMatrixDto,
    timeline_data: &TimelineInspectorDto,
    anomalies: &mut Vec<ContradictionAnomaly>,
) {
    for ent in &matrix.entities {
        if let Some(birth_m_abs) = ent.birth_m_abs {
            for ev in &timeline_data.events {
                if is_participant(&ev.participants, &ent.id) && ev.m_abs < birth_m_abs {
                    anomalies.push(ContradictionAnomaly {
                        rule: ContradictionRule::ActionBeforeBirth,
                        severity: ContradictionSeverity::Critical,
                        title: format!("Действие персонажа до его рождения: {}", ent.name),
                        description: format!(
                            "Персонаж '{}' родился в минуту {}, но участвует в событии '{}' (минута {})",
                            ent.name, birth_m_abs, ev.title, ev.m_abs
                        ),
                        entity_ids: vec![ent.id.clone()],
                        chapter_ids: vec![],
                        event_ids: vec![ev.event_id.clone()],
                        promise_ids: vec![],
                    });
                }
            }
        }
    }
}

pub fn eval_anachronism_rules(
    timeline_data: &TimelineInspectorDto,
    anomalies: &mut Vec<ContradictionAnomaly>,
) {
    for ev in &timeline_data.events {
        for rev in &ev.reveals {
            if rev.is_anachronism {
                anomalies.push(ContradictionAnomaly {
                    rule: ContradictionRule::RevealBeforeEvent,
                    severity: ContradictionSeverity::Warning,
                    title: format!("Преждевременное раскрытие: {}", ev.title),
                    description: format!(
                        "Событие '{}' раскрыто в главе '{}' до момента его свершения",
                        ev.title, rev.chapter_title
                    ),
                    entity_ids: vec![],
                    chapter_ids: vec![rev.chapter_id.clone()],
                    event_ids: vec![ev.event_id.clone()],
                    promise_ids: vec![],
                });
            }
        }
    }
}

pub fn eval_bilocation_rules(
    timeline_data: &TimelineInspectorDto,
    anomalies: &mut Vec<ContradictionAnomaly>,
) {
    for (i, ev1) in timeline_data.events.iter().enumerate() {
        for ev2 in timeline_data.events.iter().skip(i + 1) {
            if ev1.m_abs == ev2.m_abs && ev1.event_id != ev2.event_id {
                for p in &ev1.participants {
                    if ev2.participants.contains(p) {
                        anomalies.push(ContradictionAnomaly {
                            rule: ContradictionRule::EntityBilocation,
                            severity: ContradictionSeverity::Warning,
                            title: format!("Билокация персонажа в минуту {}", ev1.m_abs),
                            description: format!(
                                "Персонаж одновременно участвует в событиях '{}' и '{}'",
                                ev1.title, ev2.title
                            ),
                            entity_ids: vec![p.clone()],
                            chapter_ids: vec![],
                            event_ids: vec![ev1.event_id.clone(), ev2.event_id.clone()],
                            promise_ids: vec![],
                        });
                    }
                }
            }
        }
    }
}

pub fn eval_absence_rules(
    matrix: &CrossRefMatrixDto,
    anomalies: &mut Vec<ContradictionAnomaly>,
) {
    for w in &matrix.absence_warnings {
        anomalies.push(ContradictionAnomaly {
            rule: ContradictionRule::ForgottenPlotPromise,
            severity: ContradictionSeverity::Notice,
            title: format!("Персонаж исчез из сюжета: {}", w.entity_name),
            description: format!(
                "Персонаж '{}' не появляется уже {} глав подряд (с главы {})",
                w.entity_name, w.skipped_chapters_count, w.missing_since_chapter_id
            ),
            entity_ids: vec![w.entity_id.clone()],
            chapter_ids: vec![w.missing_since_chapter_id.clone()],
            event_ids: vec![],
            promise_ids: vec![],
        });
    }
}
