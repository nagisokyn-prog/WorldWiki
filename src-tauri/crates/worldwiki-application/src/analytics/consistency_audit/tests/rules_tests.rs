use super::mocks::*;
use crate::analytics::consistency_audit::ConsistencyAuditWorkflow;
use std::sync::Arc;
use worldwiki_domain::analytics::*;

#[tokio::test]
async fn test_deceased_entity_anomaly_detected() {
    let matrix = CrossRefMatrixDto {
        chapters: vec![],
        entities: vec![EntityRowDto {
            id: "entities:arthur".to_string(),
            name: "Артур".to_string(),
            entity_type: "character".to_string(),
            is_deceased: true,
            death_m_abs: Some(100),
            birth_m_abs: Some(0),
            role_in_story: Some("главный".to_string()),
            status_category: Some("Мёртв".to_string()),
            appearances_by_chapter: vec![],
        }],
        absence_warnings: vec![],
    };

    let timeline = TimelineInspectorDto {
        events: vec![TimelineInspectorEventNode {
            event_id: "timeline_events:ev_post_death".to_string(),
            title: "Битва после смерти".to_string(),
            description: None,
            m_abs: 150,
            calendar_id: "cal_1".to_string(),
            participants: vec!["entities:arthur".to_string()],
            reveals: vec![],
            kind: None,
            location_id: None,
        }],
        chapters: vec![],
        entity_swimlanes: vec![],
        detected_crossings: 0,
    };

    let workflow = ConsistencyAuditWorkflow::new(
        Arc::new(MockAnalyticsRepo {
            matrix,
            timeline,
            items: None,
        }),
        Arc::new(MockEntityRepo),
        Arc::new(MockChapterRepo),
        Arc::new(MockTimelineRepo),
        Arc::new(MockPromiseRepo),
    );

    let report = workflow.execute("proj_1").await.unwrap();
    assert_eq!(report.anomalies.len(), 1);
    assert_eq!(
        report.anomalies[0].rule,
        ContradictionRule::DeceasedEntityActive
    );
    assert_eq!(
        report.anomalies[0].severity,
        ContradictionSeverity::Critical
    );
    assert_eq!(report.summary.critical_count, 1);
    assert_eq!(report.summary.healthy_percent, 85);
}

#[tokio::test]
async fn test_action_before_birth_anomaly_detected() {
    let matrix = CrossRefMatrixDto {
        chapters: vec![],
        entities: vec![EntityRowDto {
            id: "entities:frodo".to_string(),
            name: "Фродо".to_string(),
            entity_type: "character".to_string(),
            is_deceased: false,
            death_m_abs: None,
            birth_m_abs: Some(2968),
            role_in_story: Some("главный".to_string()),
            status_category: Some("Жив".to_string()),
            appearances_by_chapter: vec![],
        }],
        absence_warnings: vec![],
    };

    let timeline = TimelineInspectorDto {
        events: vec![TimelineInspectorEventNode {
            event_id: "timeline_events:ancient_war".to_string(),
            title: "Древняя битва".to_string(),
            description: None,
            m_abs: 1000,
            calendar_id: "cal_1".to_string(),
            participants: vec!["entities:frodo".to_string()],
            reveals: vec![],
            kind: None,
            location_id: None,
        }],
        chapters: vec![],
        entity_swimlanes: vec![],
        detected_crossings: 0,
    };

    let workflow = ConsistencyAuditWorkflow::new(
        Arc::new(MockAnalyticsRepo {
            matrix,
            timeline,
            items: None,
        }),
        Arc::new(MockEntityRepo),
        Arc::new(MockChapterRepo),
        Arc::new(MockTimelineRepo),
        Arc::new(MockPromiseRepo),
    );

    let report = workflow.execute("proj_1").await.unwrap();
    assert_eq!(report.anomalies.len(), 1);
    assert_eq!(report.anomalies[0].rule, ContradictionRule::ActionBeforeBirth);
    assert_eq!(
        report.anomalies[0].severity,
        ContradictionSeverity::Critical
    );
    assert_eq!(report.summary.critical_count, 1);
    assert_eq!(report.summary.healthy_percent, 85);
}

#[tokio::test]
async fn test_forgotten_item_anomaly() {
    let matrix = CrossRefMatrixDto {
        chapters: vec![],
        entities: vec![],
        absence_warnings: vec![],
    };
    let timeline = TimelineInspectorDto {
        events: vec![],
        chapters: vec![],
        entity_swimlanes: vec![],
        detected_crossings: 0,
    };
    let items = ItemTrackerDto {
        summary: ItemTrackerSummaryDto {
            total_items: 1,
            active_count: 0,
            sleeping_count: 0,
            forgotten_count: 1,
            destroyed_count: 0,
        },
        items: vec![TrackedItemDto {
            id: "entities:sword".to_string(),
            name: "Меч Дракона".to_string(),
            item_type: "оружие".to_string(),
            status_category: "Цел / Активен".to_string(),
            current_owner_id: None,
            current_owner_name: None,
            first_chapter_order: Some(1),
            last_chapter_order: Some(1),
            skipped_chapters: 12,
            total_mentions: 1,
            usage_state: ItemUsageState::Forgotten,
            custody_chain: vec![],
        }],
    };

    let workflow = ConsistencyAuditWorkflow::new(
        Arc::new(MockAnalyticsRepo {
            matrix,
            timeline,
            items: Some(items),
        }),
        Arc::new(MockEntityRepo),
        Arc::new(MockChapterRepo),
        Arc::new(MockTimelineRepo),
        Arc::new(MockPromiseRepo),
    );

    let report = workflow.execute("proj_1").await.unwrap();
    assert_eq!(report.anomalies.len(), 1);
    assert_eq!(report.anomalies[0].rule, ContradictionRule::ForgottenItem);
    assert_eq!(report.anomalies[0].severity, ContradictionSeverity::Warning);
    assert_eq!(report.summary.warning_count, 1);
    assert_eq!(report.summary.healthy_percent, 95);
}
