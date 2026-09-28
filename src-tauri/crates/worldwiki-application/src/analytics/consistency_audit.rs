use std::sync::Arc;
use worldwiki_domain::analytics::{
    ContradictionAnomaly, ContradictionRule, ContradictionSeverity,
};
use worldwiki_ports::repositories::{
    AnalyticsRepositoryPort, ChapterRepository, EntityRepository, PlotPromiseRepository,
    TimelineEventRepository,
};
use crate::errors::ApplicationError;

pub struct ConsistencyAuditWorkflow {
    pub analytics_repo: Arc<dyn AnalyticsRepositoryPort>,
    pub entity_repo: Arc<dyn EntityRepository>,
    pub chapter_repo: Arc<dyn ChapterRepository>,
    pub timeline_repo: Arc<dyn TimelineEventRepository>,
    pub promise_repo: Arc<dyn PlotPromiseRepository>,
}

impl ConsistencyAuditWorkflow {
    pub fn new(
        analytics_repo: Arc<dyn AnalyticsRepositoryPort>,
        entity_repo: Arc<dyn EntityRepository>,
        chapter_repo: Arc<dyn ChapterRepository>,
        timeline_repo: Arc<dyn TimelineEventRepository>,
        promise_repo: Arc<dyn PlotPromiseRepository>,
    ) -> Self {
        Self {
            analytics_repo,
            entity_repo,
            chapter_repo,
            timeline_repo,
            promise_repo,
        }
    }

    pub async fn execute(&self, project_id: &str) -> Result<Vec<ContradictionAnomaly>, ApplicationError> {
        let mut anomalies = Vec::new();

        // 1. Fetch cross ref data & timeline data
        let matrix = self.analytics_repo.get_cross_reference_matrix(project_id).await?;
        let timeline_data = self.analytics_repo.get_timeline_inspector_data(project_id).await?;

        // Rule 1: 🔴 Deceased entity acting after death
        for ent in &matrix.entities {
            if ent.is_deceased {
                if let Some(death_m_abs) = ent.death_m_abs {
                    for ev in &timeline_data.events {
                        if ev.participants.contains(&ent.id) && ev.m_abs > death_m_abs {
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

        // Rule 1.2: 🔴 Action before birth
        for ent in &matrix.entities {
            if let Some(birth_m_abs) = ent.birth_m_abs {
                for ev in &timeline_data.events {
                    if ev.participants.contains(&ent.id) && ev.m_abs < birth_m_abs {
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

        // Rule 2: 🟡 Reveal before event occurrence (Anachronism)
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

        // Rule 3: 🟡 Bilocation: Character in two different events at exact same m_abs
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

        // Rule 4: 🟡 Absence warning (Буровский эффект)
        for w in matrix.absence_warnings {
            anomalies.push(ContradictionAnomaly {
                rule: ContradictionRule::ForgottenPlotPromise,
                severity: ContradictionSeverity::Notice,
                title: format!("Персонаж исчез из сюжета: {}", w.entity_name),
                description: format!(
                    "Персонаж '{}' не появляется уже {} глав подряд (с главы {})",
                    w.entity_name, w.skipped_chapters_count, w.missing_since_chapter_id
                ),
                entity_ids: vec![w.entity_id],
                chapter_ids: vec![w.missing_since_chapter_id],
                event_ids: vec![],
                promise_ids: vec![],
            });
        }

        Ok(anomalies)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use worldwiki_domain::analytics::*;
    use worldwiki_domain::errors::DomainError;
    use worldwiki_domain::calendar::{EventReveal, TimelineEvent};
    use worldwiki_domain::knowledge::Entity;
    use worldwiki_domain::manuscript::Chapter;
    use worldwiki_domain::plot::PlotPromise;

    struct MockAnalyticsRepo {
        matrix: CrossRefMatrixDto,
        timeline: TimelineInspectorDto,
    }

    #[async_trait]
    impl AnalyticsRepositoryPort for MockAnalyticsRepo {
        async fn get_cross_reference_matrix(&self, _proj: &str) -> Result<CrossRefMatrixDto, DomainError> {
            Ok(self.matrix.clone())
        }
        async fn get_timeline_inspector_data(&self, _proj: &str) -> Result<TimelineInspectorDto, DomainError> {
            Ok(self.timeline.clone())
        }
        async fn get_graph_time_slice(&self, _proj: &str) -> Result<GraphTimeSliceDto, DomainError> {
            Ok(GraphTimeSliceDto { nodes: vec![], edges: vec![] })
        }
        async fn get_character_journey(&self, _proj: &str, _ent: &str) -> Result<CharacterJourneyDto, DomainError> {
            Err(DomainError::Validation("Mock character journey not implemented".to_string()))
        }
    }

    struct MockEntityRepo;
    #[async_trait]
    impl EntityRepository for MockEntityRepo {
        async fn get_by_id(&self, _id: &str) -> Result<Option<Entity>, DomainError> { Ok(None) }
        async fn save(&self, _entity: &Entity) -> Result<(), DomainError> { Ok(()) }
        async fn delete(&self, _id: &str) -> Result<(), DomainError> { Ok(()) }
        async fn search(&self, _project_id: &str, _query: &str, _top_k: usize) -> Result<Vec<Entity>, DomainError> { Ok(vec![]) }
        async fn list_by_type(&self, _project_id: &str, _type_key: &str) -> Result<Vec<Entity>, DomainError> { Ok(vec![]) }
        async fn list_by_project(&self, _proj: &str) -> Result<Vec<Entity>, DomainError> { Ok(vec![]) }
    }

    struct MockChapterRepo;
    #[async_trait]
    impl ChapterRepository for MockChapterRepo {
        async fn get_by_id(&self, _id: &str) -> Result<Option<Chapter>, DomainError> { Ok(None) }
        async fn save(&self, _chapter: &Chapter) -> Result<(), DomainError> { Ok(()) }
        async fn delete(&self, _id: &str) -> Result<(), DomainError> { Ok(()) }
        async fn list_by_project(&self, _proj: &str) -> Result<Vec<Chapter>, DomainError> { Ok(vec![]) }
        async fn list_by_volume(&self, _volume_id: &str) -> Result<Vec<Chapter>, DomainError> { Ok(vec![]) }
        async fn sync_mentions_appearances(&self, _chapter_id: &str, _names: &[String]) -> Result<(), DomainError> { Ok(()) }
    }

    struct MockTimelineRepo;
    #[async_trait]
    impl TimelineEventRepository for MockTimelineRepo {
        async fn get_by_id(&self, _id: &str) -> Result<Option<TimelineEvent>, DomainError> { Ok(None) }
        async fn save(&self, _event: &TimelineEvent) -> Result<String, DomainError> { Ok(String::new()) }
        async fn delete(&self, _id: &str) -> Result<(), DomainError> { Ok(()) }
        async fn list_by_project(&self, _project_id: &str) -> Result<Vec<TimelineEvent>, DomainError> { Ok(vec![]) }
        async fn add_reveal(&self, _reveal: &EventReveal) -> Result<(), DomainError> { Ok(()) }
        async fn remove_reveal(&self, _event_id: &str, _chapter_id: &str) -> Result<(), DomainError> { Ok(()) }
    }

    struct MockPromiseRepo;
    #[async_trait]
    impl PlotPromiseRepository for MockPromiseRepo {
        async fn get_by_id(&self, _id: &str) -> Result<Option<PlotPromise>, DomainError> { Ok(None) }
        async fn save(&self, _promise: &PlotPromise) -> Result<(), DomainError> { Ok(()) }
        async fn delete(&self, _id: &str) -> Result<(), DomainError> { Ok(()) }
        async fn list_by_chapter(&self, _chapter_id: &str) -> Result<Vec<PlotPromise>, DomainError> { Ok(vec![]) }
        async fn list_unresolved_by_volume(&self, _volume_id: &str) -> Result<Vec<PlotPromise>, DomainError> { Ok(vec![]) }
    }

    #[tokio::test]
    async fn test_consistency_audit_detects_deceased_active() {
        let matrix = CrossRefMatrixDto {
            chapters: vec![],
            entities: vec![
                EntityRowDto {
                    id: "entities:boromir".to_string(),
                    name: "Боромир".to_string(),
                    entity_type: "character".to_string(),
                    is_deceased: true,
                    death_m_abs: Some(1000),
                    birth_m_abs: Some(0),
                    role_in_story: Some("главный".to_string()),
                    status_category: Some("Мёртв".to_string()),
                    appearances_by_chapter: vec![],
                }
            ],
            absence_warnings: vec![],
        };

        let timeline = TimelineInspectorDto {
            events: vec![
                TimelineInspectorEventNode {
                    event_id: "timeline_events:battle".to_string(),
                    title: "Битва при Минас Тирите".to_string(),
                    description: None,
                    m_abs: 1500, // After Boromir's death at 1000!
                    calendar_id: "cal_1".to_string(),
                    participants: vec!["entities:boromir".to_string()],
                    reveals: vec![],
                }
            ],
            chapters: vec![],
            entity_swimlanes: vec![],
            detected_crossings: 0,
        };

        let workflow = ConsistencyAuditWorkflow::new(
            Arc::new(MockAnalyticsRepo { matrix, timeline }),
            Arc::new(MockEntityRepo),
            Arc::new(MockChapterRepo),
            Arc::new(MockTimelineRepo),
            Arc::new(MockPromiseRepo),
        );

        let anomalies = workflow.execute("proj_1").await.unwrap();
        assert_eq!(anomalies.len(), 1);
        assert_eq!(anomalies[0].rule, ContradictionRule::DeceasedEntityActive);
        assert_eq!(anomalies[0].severity, ContradictionSeverity::Critical);
    }

    #[tokio::test]
    async fn test_consistency_audit_detects_action_before_birth() {
        let matrix = CrossRefMatrixDto {
            chapters: vec![],
            entities: vec![
                EntityRowDto {
                    id: "entities:frodo".to_string(),
                    name: "Фродо".to_string(),
                    entity_type: "character".to_string(),
                    is_deceased: false,
                    death_m_abs: None,
                    birth_m_abs: Some(2968),
                    role_in_story: Some("главный".to_string()),
                    status_category: Some("Жив".to_string()),
                    appearances_by_chapter: vec![],
                }
            ],
            absence_warnings: vec![],
        };

        let timeline = TimelineInspectorDto {
            events: vec![
                TimelineInspectorEventNode {
                    event_id: "timeline_events:ancient_war".to_string(),
                    title: "Древняя битва".to_string(),
                    description: None,
                    m_abs: 1000, // Before Frodo's birth at 2968!
                    calendar_id: "cal_1".to_string(),
                    participants: vec!["entities:frodo".to_string()],
                    reveals: vec![],
                }
            ],
            chapters: vec![],
            entity_swimlanes: vec![],
            detected_crossings: 0,
        };

        let workflow = ConsistencyAuditWorkflow::new(
            Arc::new(MockAnalyticsRepo { matrix, timeline }),
            Arc::new(MockEntityRepo),
            Arc::new(MockChapterRepo),
            Arc::new(MockTimelineRepo),
            Arc::new(MockPromiseRepo),
        );

        let anomalies = workflow.execute("proj_1").await.unwrap();
        assert_eq!(anomalies.len(), 1);
        assert_eq!(anomalies[0].rule, ContradictionRule::ActionBeforeBirth);
        assert_eq!(anomalies[0].severity, ContradictionSeverity::Critical);
    }
}
