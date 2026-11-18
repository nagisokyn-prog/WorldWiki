mod common;

use common::{FakeChapterRepo, FakeEventPublisher};
use std::sync::Arc;
use worldwiki_application::manuscript::SaveChapterWithMentionsWorkflow;
use worldwiki_domain::manuscript::Chapter;

#[tokio::test]
async fn test_save_chapter_with_mentions_success() {
    let repo = Arc::new(FakeChapterRepo::default());
    let events = Arc::new(FakeEventPublisher::default());
    let workflow = SaveChapterWithMentionsWorkflow::new(repo.clone(), events.clone());

    let mut ch = Chapter::new("proj_1", "Глава 1", 1);
    ch.id = "chapters:ch1".to_string();
    ch.content = "В комнату вошел ((Арагорн)) с мечом ((Нарсиль)).".to_string();

    let extracted = workflow.execute(ch).await.unwrap();
    assert_eq!(extracted, vec!["Арагорн", "Нарсиль"]);
    assert_eq!(
        *repo.synced_mentions.lock().unwrap(),
        vec!["Арагорн", "Нарсиль"]
    );
    assert_eq!(events.published.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn test_save_chapter_with_mentions_error_paths() {
    let ch = Chapter::new("proj_1", "Глава 1", 1);

    let fail_save = SaveChapterWithMentionsWorkflow::new(
        Arc::new(FakeChapterRepo {
            fail_save: true,
            ..Default::default()
        }),
        Arc::new(FakeEventPublisher::default()),
    );
    assert!(fail_save.execute(ch.clone()).await.is_err());

    let fail_sync = SaveChapterWithMentionsWorkflow::new(
        Arc::new(FakeChapterRepo {
            fail_sync_mentions: true,
            ..Default::default()
        }),
        Arc::new(FakeEventPublisher::default()),
    );
    assert!(fail_sync.execute(ch.clone()).await.is_err());

    let fail_evt = SaveChapterWithMentionsWorkflow::new(
        Arc::new(FakeChapterRepo::default()),
        Arc::new(FakeEventPublisher {
            fail: true,
            ..Default::default()
        }),
    );
    assert!(fail_evt.execute(ch).await.is_err());
}

#[tokio::test]
async fn test_manuscript_services_not_found_and_errors() {
    use worldwiki_application::manuscript::ManuscriptServices;
    use worldwiki_application::ApplicationError;

    let ch = Chapter::new("proj_1", "Глава 1", 1);

    let ok_svc = ManuscriptServices::new(
        Arc::new(FakeChapterRepo::default()),
        Arc::new(FakeEventPublisher::default()),
    );
    assert!(matches!(
        ok_svc.get_chapter("missing").await,
        Err(ApplicationError::NotFound(_))
    ));

    let fail_get = ManuscriptServices::new(
        Arc::new(FakeChapterRepo {
            fail_get: true,
            ..Default::default()
        }),
        Arc::new(FakeEventPublisher::default()),
    );
    assert!(fail_get.get_chapter("c1").await.is_err());

    let fail_save = ManuscriptServices::new(
        Arc::new(FakeChapterRepo {
            fail_save: true,
            ..Default::default()
        }),
        Arc::new(FakeEventPublisher::default()),
    );
    assert!(fail_save.save_chapter(&ch).await.is_err());

    let fail_sync = ManuscriptServices::new(
        Arc::new(FakeChapterRepo {
            fail_sync_mentions: true,
            ..Default::default()
        }),
        Arc::new(FakeEventPublisher::default()),
    );
    assert!(fail_sync.save_chapter(&ch).await.is_err());

    let fail_evt = ManuscriptServices::new(
        Arc::new(FakeChapterRepo::default()),
        Arc::new(FakeEventPublisher {
            fail: true,
            ..Default::default()
        }),
    );
    assert!(fail_evt.save_chapter(&ch).await.is_err());
}
