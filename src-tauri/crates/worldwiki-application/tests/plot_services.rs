mod common;

use common::{FakeEventPublisher, FakePromiseRepo, FakeTodoRepo};
use std::sync::Arc;
use worldwiki_application::plot::{PlotServices, TodoServices};
use worldwiki_application::ApplicationError;
use worldwiki_domain::plot::{PlotPromise, PromiseKind, Todo, TodoStatus};
use worldwiki_ports::repositories::TodoRepository;

#[tokio::test]
async fn test_plot_services_promises_and_delegates() {
    let promise_repo = Arc::new(FakePromiseRepo::default());
    let todo_repo = Arc::new(FakeTodoRepo::default());
    let events = Arc::new(FakeEventPublisher::default());
    let svc = PlotServices::new(promise_repo, todo_repo, events.clone());

    let mut p = PlotPromise::new(PromiseKind::Gun, "Gun on wall");
    p.id = "p1".into();

    svc.plant_promise(&p).await.unwrap();
    let saved = svc.save_promise(&p).await.unwrap();
    assert_eq!(saved.id, "p1");
    svc.delete_promise("p1").await.unwrap();
    assert_eq!(events.published.lock().unwrap().len(), 3);

    let id1 = svc.create_todo("ch:1", "Task 1", 1).await.unwrap();
    let id2 = svc
        .create_todo_ext("ch:1", "Task 2", 2, Some("arc:1".into()), None)
        .await
        .unwrap();
    svc.auto_start_chapter("ch:1").await.unwrap();
    let updated = svc.set_todo_status(&id2, "done").await.unwrap();
    assert_eq!(updated.status, TodoStatus::Done);
    svc.update_todo(&id1, "Task 1 edited").await.unwrap();
    let dep = svc.set_todo_dependency(&id1, Some(id2.clone())).await.unwrap();
    assert_eq!(dep.depends_on, Some(id2.clone()));
    svc.complete_todo(&id1).await.unwrap();
    let toggled = svc.toggle_todo(&id1).await.unwrap();
    assert!(toggled.is_done);
    let toggled_back = svc.toggle_todo(&id1).await.unwrap();
    assert!(!toggled_back.is_done);
    let list = svc.list_todos_by_owner("ch:1").await.unwrap();
    assert_eq!(list.len(), 2);
    svc.delete_todo(&id1).await.unwrap();

    let report = svc.audit_volume("vol:1").await.unwrap();
    assert_eq!(report.volume_id, "vol:1");
}

#[tokio::test]
async fn test_plot_services_errors() {
    let fail_promise = Arc::new(FakePromiseRepo {
        fail: true,
        ..Default::default()
    });
    let todo_repo = Arc::new(FakeTodoRepo::default());
    let ok_events = Arc::new(FakeEventPublisher::default());
    let svc = PlotServices::new(fail_promise, todo_repo.clone(), ok_events);

    let p = PlotPromise::new(PromiseKind::Conflict, "Conflict");
    assert!(svc.plant_promise(&p).await.is_err());
    assert!(svc.save_promise(&p).await.is_err());
    assert!(svc.delete_promise("p1").await.is_err());
    assert!(svc.audit_volume("vol:1").await.is_err());

    let ok_promise = Arc::new(FakePromiseRepo::default());
    let fail_events = Arc::new(FakeEventPublisher {
        fail: true,
        ..Default::default()
    });
    let svc2 = PlotServices::new(ok_promise, todo_repo, fail_events);
    assert!(svc2.plant_promise(&p).await.is_err());
    assert!(svc2.save_promise(&p).await.is_err());
    assert!(svc2.delete_promise("p1").await.is_err());
}

#[tokio::test]
async fn test_set_todo_dependency_blocks_and_unblocks() {
    let repo = Arc::new(FakeTodoRepo::default());
    let parent = Todo::new("chapters:c1", "Parent task", 1);
    let parent_id = repo.save(&parent).await.unwrap();

    let child = Todo::new("chapters:c2", "Child task", 1);
    let child_id = repo.save(&child).await.unwrap();

    let service = TodoServices::new(repo);

    let updated = service
        .set_todo_dependency(&child_id, Some(parent_id.clone()))
        .await
        .unwrap();
    assert_eq!(updated.status, TodoStatus::Blocked);
    assert_eq!(updated.depends_on, Some(parent_id));

    let unblocked = service.set_todo_dependency(&child_id, None).await.unwrap();
    assert_eq!(unblocked.status, TodoStatus::Planned);
    assert_eq!(unblocked.depends_on, None);
}

#[tokio::test]
async fn test_todo_services_full_lifecycle_and_errors() {
    let repo = Arc::new(FakeTodoRepo::default());
    let service = TodoServices::new(repo.clone());

    let id1 = service.create_todo("ch:1", "Write intro", 1).await.unwrap();
    let mut t2 = Todo::new("ch:1", "Write outro", 2);
    t2.id = "todo:2".into();
    repo.save(&t2).await.unwrap();

    let id3 = service
        .create_todo_ext("ch:2", "Linked", 1, Some("arc:1".into()), Some(id1.clone()))
        .await
        .unwrap();
    let list_ch2 = service.list_todos_by_owner("ch:2").await.unwrap();
    assert_eq!(list_ch2.len(), 1);
    assert_eq!(list_ch2[0].arc_id.as_deref(), Some("arc:1"));
    assert_eq!(list_ch2[0].depends_on.as_deref(), Some(id1.as_str()));
    assert!(!id3.is_empty());

    service.auto_start_chapter("ch:1").await.unwrap();
    let started = repo.get_by_id(&id1).await.unwrap().unwrap();
    assert_eq!(started.status, TodoStatus::InProgress);

    let done = service.set_todo_status(&id1, "done").await.unwrap();
    assert_eq!(done.status, TodoStatus::Done);
    let blocked = service.set_todo_status(&id1, "blocked").await.unwrap();
    assert_eq!(blocked.status, TodoStatus::Blocked);
    let planned = service.set_todo_status(&id1, "other").await.unwrap();
    assert_eq!(planned.status, TodoStatus::Planned);

    assert!(matches!(
        service.set_todo_status("missing", "done").await,
        Err(ApplicationError::NotFound(_))
    ));

    service.update_todo(&id1, "Updated text").await.unwrap();
    assert_eq!(
        repo.get_by_id(&id1).await.unwrap().unwrap().text,
        "Updated text"
    );
    assert!(matches!(
        service.update_todo("missing", "x").await,
        Err(ApplicationError::NotFound(_))
    ));

    let toggled = service.toggle_todo(&id1).await.unwrap();
    assert!(toggled.is_done);
    service.complete_todo(&id1).await.unwrap();
    service.complete_todo("todo:2").await.unwrap();
    assert!(repo.get_by_id("todo:2").await.unwrap().unwrap().is_done);
    assert!(matches!(
        service.complete_todo("missing").await,
        Err(ApplicationError::NotFound(_))
    ));
    assert!(matches!(
        service.toggle_todo("missing").await,
        Err(ApplicationError::NotFound(_))
    ));

    let child_with_done_parent = service
        .set_todo_dependency("todo:2", Some(id1.clone()))
        .await
        .unwrap();
    assert_ne!(child_with_done_parent.status, TodoStatus::Blocked);

    let cleared = service
        .set_todo_dependency("todo:2", Some("   ".into()))
        .await
        .unwrap();
    assert_eq!(cleared.depends_on, None);

    service.delete_todo(&id1).await.unwrap();
    assert!(repo.get_by_id(&id1).await.unwrap().is_none());
}

#[tokio::test]
async fn test_todo_services_set_status_fallback_when_repo_returns_none() {
    let repo = Arc::new(FakeTodoRepo {
        set_status_returns_none: true,
        ..Default::default()
    });
    let mut t = Todo::new("ch:1", "Fallback", 1);
    t.id = "t1".into();
    repo.save(&t).await.unwrap();

    let svc = TodoServices::new(repo);
    assert_eq!(
        svc.set_todo_status("t1", "in_progress").await.unwrap().status,
        TodoStatus::InProgress
    );
    assert_eq!(
        svc.set_todo_status("t1", "done").await.unwrap().status,
        TodoStatus::Done
    );
    assert_eq!(
        svc.set_todo_status("t1", "blocked").await.unwrap().status,
        TodoStatus::Blocked
    );
    assert_eq!(
        svc.set_todo_status("t1", "unknown").await.unwrap().status,
        TodoStatus::Planned
    );

    // auto_start_chapter when no Planned todos exist
    svc.set_todo_status("t1", "done").await.unwrap();
    svc.auto_start_chapter("ch:1").await.unwrap();
}

#[tokio::test]
async fn test_todo_services_repo_error_propagation() {
    let svc = TodoServices::new(Arc::new(FakeTodoRepo {
        fail: true,
        ..Default::default()
    }));

    assert!(svc.create_todo("ch:1", "A", 1).await.is_err());
    assert!(svc.create_todo_ext("ch:1", "A", 1, None, None).await.is_err());
    assert!(svc.set_todo_status("t1", "done").await.is_err());
    assert!(svc.auto_start_chapter("ch:1").await.is_err());
    assert!(svc.update_todo("t1", "B").await.is_err());
    assert!(svc.set_todo_dependency("t1", None).await.is_err());
    assert!(svc.complete_todo("t1").await.is_err());
    assert!(svc.toggle_todo("t1").await.is_err());
    assert!(svc.delete_todo("t1").await.is_err());
    assert!(svc.list_todos_by_owner("ch:1").await.is_err());
}
