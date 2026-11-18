mod common;

use common::{
    FakeChapterRepo, FakeEntityRepo, FakeEventPublisher, FakePromiseRepo, FakeRagPort,
    FakeRelationRepo, FakeTodoRepo, LocalTestAiMock,
};
use std::sync::Arc;
use worldwiki_application::ai::{AiToolFacades, LocalAiServices};
use worldwiki_application::calendar::CalendarServices;
use worldwiki_application::common::JobManager;
use worldwiki_application::knowledge::KnowledgeServices;
use worldwiki_application::manuscript::ManuscriptServices;
use worldwiki_application::plot::PlotServices;
use worldwiki_application::workflows::{
    EditManuscriptAtomicWorkflow, EditManuscriptRequest, HybridSemanticSearchWorkflow,
    PlantedPromiseDto,
};
use worldwiki_domain::manuscript::Chapter;
use worldwiki_domain::plot::Todo;
use worldwiki_ports::repositories::PlotPromiseRepository;
use worldwiki_ports::EventPublisherPort;

fn setup_test_services() -> AiToolFacades {
    let events: Arc<dyn EventPublisherPort> = Arc::new(FakeEventPublisher::default());
    let manuscript = Arc::new(ManuscriptServices::new(
        Arc::new(FakeChapterRepo::default()),
        Arc::clone(&events),
    ));
    let knowledge = Arc::new(KnowledgeServices::new(
        Arc::new(FakeEntityRepo::default()),
        Arc::new(FakeRelationRepo::default()),
        Arc::clone(&events),
    ));
    let calendar = Arc::new(CalendarServices::new());
    let plot = Arc::new(PlotServices::new(
        Arc::new(FakePromiseRepo::default()),
        Arc::new(FakeTodoRepo::default()),
        events,
    ));
    let job_manager = Arc::new(JobManager::new());

    let edit_workflow = Arc::new(EditManuscriptAtomicWorkflow::new(
        Arc::clone(&manuscript),
        Arc::clone(&plot),
    ));
    let search_workflow = Arc::new(HybridSemanticSearchWorkflow::new(Arc::new(FakeRagPort)));

    AiToolFacades::new(
        manuscript,
        knowledge,
        calendar,
        plot,
        edit_workflow,
        search_workflow,
        job_manager,
    )
}

#[tokio::test]
async fn test_edit_manuscript_atomic_workflow() {
    let facades = setup_test_services();

    let mut chapter = Chapter::new("vol_1", "Глава 1: Начало", 1);
    chapter.id = "ch_1".to_string();
    let ch_id = chapter.id.clone();
    facades.manuscript.save_chapter(&chapter).await.unwrap();

    let req = EditManuscriptRequest {
        chapter_id: ch_id.clone(),
        content_patch: "В комнате на стене висел странный меч ((Экскалибур)).".to_string(),
        project_id: Some("proj_1".to_string()),
        planted_promises: vec![PlantedPromiseDto {
            kind: "gun".to_string(),
            quote: "странный меч ((Экскалибур))".to_string(),
            note: Some("Понадобится в битве с драконом".to_string()),
        }],
        resolved_promise_ids: vec![],
        completed_plan_ids: vec![],
    };

    let res = facades.edit_manuscript(req).await.unwrap();
    assert_eq!(res.promises_planted, 1);
    assert_eq!(res.word_count, 8);

    let updated_ch = facades.manuscript.get_chapter(&ch_id).await.unwrap();
    assert_eq!(
        updated_ch.content,
        "В комнате на стене висел странный меч ((Экскалибур))."
    );
}

#[tokio::test]
async fn test_volume_audit_consistency_detects_blockers() {
    let facades = setup_test_services();

    let todo = Todo::new("vol_1", "Завершить финальную битву", 1);
    let id = facades.plot.todo_repo.save(&todo).await.unwrap();

    let report = facades.plot.audit_volume("vol_1").await.unwrap();
    assert!(report.has_blockers);
    assert_eq!(report.pending_todos_count, 1);

    facades.plot.toggle_todo(&id).await.unwrap();
    let report_after = facades.plot.audit_volume("vol_1").await.unwrap();
    assert!(!report_after.has_blockers);
    assert_eq!(report_after.pending_todos_count, 0);
}

#[tokio::test]
async fn test_all_8_ai_facades_smoke() {
    let facades = setup_test_services();

    let search_res = facades
        .query_world("proj_1", "магия", "all", 5)
        .await
        .unwrap();
    assert!(!search_res.is_empty());

    let create_res = facades
        .manage_entity(
            "create",
            serde_json::json!({
                "id": "char_1",
                "project_id": "proj_1",
                "type_key": "character",
                "name": "Гэндальф",
                "attributes": {},
                "tags": [],
                "created_at": chrono::Utc::now(),
                "updated_at": chrono::Utc::now()
            }),
        )
        .await
        .unwrap();
    assert_eq!(create_res["status"], "created");

    let card = facades.inspect_entity("proj_1", "char_1").await.unwrap();
    assert_eq!(card["entity"]["name"], "Гэндальф");

    let mut ch = Chapter::new("proj_1", "Глава A", 1);
    ch.id = "ch_a".to_string();
    let ch_id = ch.id.clone();
    facades.manuscript.save_chapter(&ch).await.unwrap();
    let read_val = facades.read_manuscript("proj_1", &ch_id).await.unwrap();
    assert_eq!(read_val["title"], "Глава A");

    let task_res = facades
        .delegate_task("task_001", "Проанализируй диалог")
        .await
        .unwrap();
    assert_eq!(task_res["status"], "completed");
}

#[test]
fn test_local_ai_services_hardware_and_manager() {
    let mock = Arc::new(LocalTestAiMock);
    let local_ai = LocalAiServices::new(mock.clone(), mock.clone(), mock);

    let info = local_ai.get_hardware_info();
    assert!(info.total_ram_gb > 0.0);

    let quants = local_ai.calculate_quantization_estimates(7.0, Some(4096));
    assert!(!quants.is_empty());

    let recommended = local_ai.get_recommended_local_models();
    assert_eq!(recommended.len(), 3);

    let catalog = local_ai.get_tool_permissions_catalog();
    assert!(catalog.len() >= 5);

    let installed = local_ai
        .list_installed_models()
        .expect("list_installed_models must succeed");
    let _ = installed;
}

#[tokio::test]
async fn test_edit_manuscript_workflow_all_kinds_resolve_and_errors() {
    use worldwiki_application::ApplicationError;
    use worldwiki_domain::plot::{PlotPromise, PromiseKind, PromiseStatus};

    let ch_repo = Arc::new(FakeChapterRepo::default());
    let promise_repo = Arc::new(FakePromiseRepo::default());
    let todo_repo = Arc::new(FakeTodoRepo::default());
    let events: Arc<dyn EventPublisherPort> = Arc::new(FakeEventPublisher::default());

    let manuscript = Arc::new(ManuscriptServices::new(ch_repo.clone(), Arc::clone(&events)));
    let plot = Arc::new(PlotServices::new(
        promise_repo.clone(),
        todo_repo.clone(),
        events,
    ));
    let workflow = EditManuscriptAtomicWorkflow::new(manuscript.clone(), plot.clone());

    // Prepare existing chapter, promise, and todo
    let mut chapter = Chapter::new("vol_1", "Ch", 1);
    chapter.id = "ch_full".into();
    manuscript.save_chapter(&chapter).await.unwrap();

    let mut existing_p = PlotPromise::new(PromiseKind::Mystery, "Secret");
    existing_p.id = "p_exist".into();
    promise_repo.save(&existing_p).await.unwrap();

    let todo_id = plot.create_todo("ch_full", "Finish draft", 1).await.unwrap();

    let res = workflow
        .execute(EditManuscriptRequest {
            chapter_id: "ch_full".into(),
            content_patch: "Updated text".into(),
            project_id: None,
            planted_promises: vec![
                PlantedPromiseDto {
                    kind: "foreshadowing".into(),
                    quote: "Q1".into(),
                    note: None,
                },
                PlantedPromiseDto {
                    kind: "mystery".into(),
                    quote: "Q2".into(),
                    note: None,
                },
                PlantedPromiseDto {
                    kind: "question".into(),
                    quote: "Q3".into(),
                    note: None,
                },
            ],
            resolved_promise_ids: vec!["p_exist".into(), "p_missing".into()],
            completed_plan_ids: vec![todo_id, "missing_todo".into()],
        })
        .await
        .unwrap();

    assert_eq!(res.promises_planted, 3);
    assert_eq!(res.promises_resolved, 1);
    assert_eq!(res.plans_completed, 1);
    assert_eq!(
        promise_repo
            .storage
            .lock()
            .unwrap()
            .get("p_exist")
            .unwrap()
            .status,
        PromiseStatus::Resolved
    );

    // NotFound chapter error
    let missing_err = workflow
        .execute(EditManuscriptRequest {
            chapter_id: "no_such_ch".into(),
            content_patch: "".into(),
            project_id: None,
            planted_promises: vec![],
            resolved_promise_ids: vec![],
            completed_plan_ids: vec![],
        })
        .await
        .unwrap_err();
    assert!(matches!(missing_err, ApplicationError::NotFound(_)));

    // plant_promise failure propagates
    let fail_plot = Arc::new(PlotServices::new(
        Arc::new(FakePromiseRepo {
            fail: true,
            ..Default::default()
        }),
        todo_repo,
        Arc::new(FakeEventPublisher::default()),
    ));
    let fail_wf = EditManuscriptAtomicWorkflow::new(manuscript, fail_plot);
    assert!(fail_wf
        .execute(EditManuscriptRequest {
            chapter_id: "ch_full".into(),
            content_patch: "X".into(),
            project_id: None,
            planted_promises: vec![PlantedPromiseDto {
                kind: "gun".into(),
                quote: "G".into(),
                note: None,
            }],
            resolved_promise_ids: vec![],
            completed_plan_ids: vec![],
        })
        .await
        .is_err());

    // save_chapter failure propagates
    let fail_save_repo = Arc::new(FakeChapterRepo {
        fail_save: true,
        ..Default::default()
    });
    fail_save_repo
        .storage
        .lock()
        .unwrap()
        .insert("ch_full".into(), chapter);
    let fail_save_ms = Arc::new(ManuscriptServices::new(
        fail_save_repo,
        Arc::new(FakeEventPublisher::default()),
    ));
    let fail_save_wf = EditManuscriptAtomicWorkflow::new(
        fail_save_ms,
        Arc::new(PlotServices::new(
            Arc::new(FakePromiseRepo::default()),
            Arc::new(FakeTodoRepo::default()),
            Arc::new(FakeEventPublisher::default()),
        )),
    );
    assert!(fail_save_wf
        .execute(EditManuscriptRequest {
            chapter_id: "ch_full".into(),
            content_patch: "X".into(),
            project_id: None,
            planted_promises: vec![],
            resolved_promise_ids: vec![],
            completed_plan_ids: vec![],
        })
        .await
        .is_err());
}

#[tokio::test]
async fn test_knowledge_services_error_paths() {
    use worldwiki_domain::knowledge::{Entity, EntityRelation};

    let mut ent = Entity::new("p1", "character", "Hero");
    ent.id = "e1".into();
    let mut rel = EntityRelation::new("e1", "e2", "ally");
    rel.id = "r1".into();
    rel.strength = Some(5);

    // fail_get on entity_repo
    let svc_get_err = KnowledgeServices::new(
        Arc::new(FakeEntityRepo {
            fail_get: true,
            ..Default::default()
        }),
        Arc::new(FakeRelationRepo::default()),
        Arc::new(FakeEventPublisher::default()),
    );
    assert!(svc_get_err.get_entity("e1").await.is_err());

    // relation_repo failure on get_full_card & add_relation
    let ok_ent = Arc::new(FakeEntityRepo::default());
    ok_ent.storage.lock().unwrap().insert("e1".into(), ent.clone());
    let svc_rel_err = KnowledgeServices::new(
        ok_ent.clone(),
        Arc::new(FakeRelationRepo {
            fail: true,
            ..Default::default()
        }),
        Arc::new(FakeEventPublisher::default()),
    );
    assert!(svc_rel_err.get_full_card("e1").await.is_err());
    assert!(svc_rel_err.add_relation(&rel).await.is_err());
    svc_rel_err.save_entity(&ent).await.unwrap();

    // save_entity fail_save
    let svc_save_err = KnowledgeServices::new(
        Arc::new(FakeEntityRepo {
            fail_save: true,
            ..Default::default()
        }),
        Arc::new(FakeRelationRepo::default()),
        Arc::new(FakeEventPublisher::default()),
    );
    assert!(svc_save_err.save_entity(&ent).await.is_err());

    // save_entity event publish fail
    let svc_evt_err = KnowledgeServices::new(
        ok_ent,
        Arc::new(FakeRelationRepo::default()),
        Arc::new(FakeEventPublisher {
            fail: true,
            ..Default::default()
        }),
    );
    assert!(svc_evt_err.save_entity(&ent).await.is_err());

    // add_relation success
    let svc_ok = KnowledgeServices::new(
        Arc::new(FakeEntityRepo::default()),
        Arc::new(FakeRelationRepo::default()),
        Arc::new(FakeEventPublisher::default()),
    );
    svc_ok.add_relation(&rel).await.unwrap();
}
