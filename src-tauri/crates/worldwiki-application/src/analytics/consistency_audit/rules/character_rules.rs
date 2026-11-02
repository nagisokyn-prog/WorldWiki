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
                if (is_participant(&ev.participants, &ent.id) || is_participant(&ev.participants, &ent.name))
                    && ev.m_abs > death_m_abs
                {
                    let ch_ids: Vec<String> = ev.reveals.iter().map(|r| r.chapter_id.clone()).collect();
                    anomalies.push(ContradictionAnomaly {
                        rule: ContradictionRule::DeceasedEntityActive,
                        severity: ContradictionSeverity::Critical,
                        title: format!("Погибший персонаж участвует в событии: {}", ent.name),
                        description: format!(
                            "Персонаж '{}' погиб в минуту {}, но участвует в событии '{}' (минута {})",
                            ent.name, death_m_abs, ev.title, ev.m_abs
                        ),
                        entity_ids: vec![ent.id.clone()],
                        chapter_ids: ch_ids,
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
                if (is_participant(&ev.participants, &ent.id) || is_participant(&ev.participants, &ent.name))
                    && ev.m_abs < birth_m_abs
                {
                    let ch_ids: Vec<String> = ev.reveals.iter().map(|r| r.chapter_id.clone()).collect();
                    anomalies.push(ContradictionAnomaly {
                        rule: ContradictionRule::ActionBeforeBirth,
                        severity: ContradictionSeverity::Critical,
                        title: format!("Действие персонажа до его рождения: {}", ent.name),
                        description: format!(
                            "Персонаж '{}' родился в минуту {}, но участвует в событии '{}' (минута {})",
                            ent.name, birth_m_abs, ev.title, ev.m_abs
                        ),
                        entity_ids: vec![ent.id.clone()],
                        chapter_ids: ch_ids,
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
    matrix: &CrossRefMatrixDto,
    timeline_data: &TimelineInspectorDto,
    anomalies: &mut Vec<ContradictionAnomaly>,
) {
    for (i, ev1) in timeline_data.events.iter().enumerate() {
        for ev2 in timeline_data.events.iter().skip(i + 1) {
            if ev1.m_abs == ev2.m_abs && ev1.event_id != ev2.event_id {
                for p in &ev1.participants {
                    let clean_p = super::utils::clean_id(p);
                    if ev2.participants.iter().any(|p2| super::utils::clean_id(p2) == clean_p || p2 == p) {
                        let ent_name = matrix
                            .entities
                            .iter()
                            .find(|e| super::utils::clean_id(&e.id) == clean_p || e.name == *p)
                            .map(|e| e.name.clone())
                            .unwrap_or_else(|| {
                                if !clean_p.is_empty() {
                                    clean_p.to_string()
                                } else {
                                    "Персонаж".to_string()
                                }
                            });

                        let mut ch_ids: Vec<String> = ev1.reveals.iter().map(|r| r.chapter_id.clone()).collect();
                        ch_ids.extend(ev2.reveals.iter().map(|r| r.chapter_id.clone()));
                        ch_ids.sort();
                        ch_ids.dedup();

                        anomalies.push(ContradictionAnomaly {
                            rule: ContradictionRule::EntityBilocation,
                            severity: ContradictionSeverity::Warning,
                            title: format!("Билокация персонажа '{}' в минуту {}", ent_name, ev1.m_abs),
                            description: format!(
                                "Персонаж '{}' одновременно участвует в событиях '{}' и '{}'",
                                ent_name, ev1.title, ev2.title
                            ),
                            entity_ids: vec![p.clone()],
                            chapter_ids: ch_ids,
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
