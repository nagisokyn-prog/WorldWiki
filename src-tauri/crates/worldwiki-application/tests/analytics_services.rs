mod common;

use common::{FakeAnalyticsRepo, FakeChapterRepo, FakeEntityRepo, FakePromiseRepo};
use std::sync::Arc;
use worldwiki_application::analytics::{
    CharacterJourneyService, CrossReferenceMatrixService, ItemTrackerService,
    ManuscriptAnalyticsService, TimelineInspectorService,
};
use worldwiki_domain::analytics::JourneyFilterMode;
use worldwiki_domain::knowledge::Entity;
use worldwiki_domain::manuscript::Chapter;

#[tokio::test]
async fn test_character_journey_service_success_and_error() {
    let ok_svc = CharacterJourneyService::new(Arc::new(FakeAnalyticsRepo { fail: false }));
    let journey = ok_svc.get_journey("p1", "e1").await.unwrap();
    assert_eq!(journey.entity_id, "e1");

    let multi = ok_svc
        .get_multi_journey("p1", &["e1".into(), "e2".into()], JourneyFilterMode::Intersection)
        .await
        .unwrap();
    assert_eq!(multi.filter_mode, JourneyFilterMode::Intersection);
    assert_eq!(multi.requested_entity_ids.len(), 2);

    let err_svc = CharacterJourneyService::new(Arc::new(FakeAnalyticsRepo { fail: true }));
    assert!(err_svc.get_journey("p1", "e1").await.is_err());
    assert!(err_svc
        .get_multi_journey("p1", &[], JourneyFilterMode::Union)
        .await
        .is_err());
}

#[tokio::test]
async fn test_cross_ref_matrix_and_item_tracker_services() {
    let ok_repo = Arc::new(FakeAnalyticsRepo { fail: false });
    let matrix_svc = CrossReferenceMatrixService::new(ok_repo.clone());
    let matrix = matrix_svc.get_matrix("p1").await.unwrap();
    assert_eq!(matrix.chapters.len(), 1);

    let item_svc = ItemTrackerService::new(ok_repo);
    assert_eq!(
        item_svc.get_item_tracker("p1").await.unwrap().summary.total_items,
        1
    );
    assert_eq!(
        item_svc.get_item_journey("p1", "i1").await.unwrap().item_name,
        "Sword"
    );

    let err_repo = Arc::new(FakeAnalyticsRepo { fail: true });
    assert!(CrossReferenceMatrixService::new(err_repo.clone())
        .get_matrix("p1")
        .await
        .is_err());
    let err_item = ItemTrackerService::new(err_repo);
    assert!(err_item.get_item_tracker("p1").await.is_err());
    assert!(err_item.get_item_journey("p1", "i1").await.is_err());
}

#[tokio::test]
async fn test_timeline_inspector_service_reader_limit_and_error() {
    let svc = TimelineInspectorService::new(Arc::new(FakeAnalyticsRepo { fail: false }));

    let full = svc.get_inspector_data("p1", None).await.unwrap();
    assert_eq!(full.events.len(), 2);
    assert_eq!(full.chapters.len(), 2);

    let limited = svc.get_inspector_data("p1", Some(3)).await.unwrap();
    assert_eq!(limited.chapters.len(), 1);
    assert_eq!(limited.chapters[0].id, "c1");
    assert_eq!(limited.events.len(), 1);
    assert_eq!(limited.events[0].event_id, "e1");
    assert_eq!(limited.events[0].reveals.len(), 1);

    let err_svc = TimelineInspectorService::new(Arc::new(FakeAnalyticsRepo { fail: true }));
    assert!(err_svc.get_inspector_data("p1", None).await.is_err());
}

#[tokio::test]
async fn test_manuscript_analytics_service_success_and_error() {
    let mut c1 = Chapter::new("p1", "C1", 1);
    c1.id = "c1".into();
    c1.word_count = 1200;
    let mut c2 = Chapter::new("p1", "C2", 2);
    c2.id = "c2".into();
    c2.word_count = 800;

    let ch_repo = Arc::new(FakeChapterRepo::default());
    ch_repo.storage.lock().unwrap().insert("c1".into(), c1);
    ch_repo.storage.lock().unwrap().insert("c2".into(), c2);

    let mut ent = Entity::new("p1", "character", "Hero");
    ent.id = "e1".into();
    let ent_repo = Arc::new(FakeEntityRepo::default());
    ent_repo.storage.lock().unwrap().insert("e1".into(), ent);

    let svc = ManuscriptAnalyticsService::new(
        ch_repo,
        ent_repo,
        Arc::new(FakePromiseRepo::default()),
    );

    let stats = svc.get_statistics("p1").await.unwrap();
    assert_eq!(stats.total_chapters, 2);
    assert_eq!(stats.total_words, 2000);
    assert_eq!(stats.total_entities, 1);
    assert_eq!(stats.unresolved_promises, 0);

    let fail_ch = ManuscriptAnalyticsService::new(
        Arc::new(FakeChapterRepo {
            fail_list: true,
            ..Default::default()
        }),
        Arc::new(FakeEntityRepo::default()),
        Arc::new(FakePromiseRepo::default()),
    );
    assert!(fail_ch.get_statistics("p1").await.is_err());

    let fail_ent = ManuscriptAnalyticsService::new(
        Arc::new(FakeChapterRepo::default()),
        Arc::new(FakeEntityRepo {
            fail_list: true,
            ..Default::default()
        }),
        Arc::new(FakePromiseRepo::default()),
    );
    assert!(fail_ent.get_statistics("p1").await.is_err());
}
