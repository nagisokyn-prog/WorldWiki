pub mod errors;
pub mod common;
pub mod manuscript;
pub mod knowledge;
pub mod calendar;
pub mod plot;
pub mod workflows;
pub mod ai;

pub use errors::ApplicationError;

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use crate::manuscript::ManuscriptServices;
    use crate::knowledge::KnowledgeServices;
    use crate::calendar::CalendarServices;
    use crate::plot::PlotServices;
    use crate::workflows::{EditManuscriptAtomicWorkflow, EditManuscriptRequest, PlantedPromiseDto, HybridSemanticSearchWorkflow};
    use crate::ai::AiToolFacades;
    use crate::common::JobManager;
    use worldwiki_domain::manuscript::Chapter;
    use worldwiki_domain::plot::{Plan, PlanParentType};
    use worldwiki_infrastructure::surrealdb::memory_repos::{
        InMemoryChapterRepository, InMemoryEntityRepository, InMemoryRelationRepository,
        InMemoryPlotPromiseRepository, InMemoryPlanRepository
    };
    use worldwiki_infrastructure::ai::mock_ai::MockAiAdapter;
    use worldwiki_infrastructure::events::InMemoryEventPublisher;

    fn setup_test_services() -> AiToolFacades {
        let chapter_repo = Arc::new(InMemoryChapterRepository::default());
        let entity_repo = Arc::new(InMemoryEntityRepository::default());
        let relation_repo = Arc::new(InMemoryRelationRepository::default());
        let promise_repo = Arc::new(InMemoryPlotPromiseRepository::default());
        let plan_repo = Arc::new(InMemoryPlanRepository::default());

        let events = Arc::new(InMemoryEventPublisher);
        let ai_adapter = Arc::new(MockAiAdapter);

        let manuscript = Arc::new(ManuscriptServices::new(chapter_repo.clone(), events.clone()));
        let knowledge = Arc::new(KnowledgeServices::new(entity_repo.clone(), relation_repo.clone(), events.clone()));
        let calendar = Arc::new(CalendarServices::new());
        let plot = Arc::new(PlotServices::new(promise_repo.clone(), plan_repo.clone(), events.clone()));
        let job_manager = Arc::new(JobManager::new());

        let edit_workflow = Arc::new(EditManuscriptAtomicWorkflow::new(manuscript.clone(), plot.clone()));
        let search_workflow = Arc::new(HybridSemanticSearchWorkflow::new(ai_adapter.clone()));

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

        // 1. Create initial chapter
        let chapter = Chapter::new("proj_1", "Глава 1: Начало", 1);
        let ch_id = chapter.id.clone();
        facades.manuscript.save_chapter(&chapter).await.unwrap();

        // 2. Execute atomic edit workflow
        let req = EditManuscriptRequest {
            chapter_id: ch_id.clone(),
            content_patch: "В комнате на стене висел странный меч ((Экскалибур)).".to_string(),
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

        // Verify chapter content was updated
        let updated_ch = facades.manuscript.get_chapter(&ch_id).await.unwrap();
        assert_eq!(updated_ch.content, "В комнате на стене висел странный меч ((Экскалибур)).");
    }

    #[tokio::test]
    async fn test_volume_audit_consistency_detects_blockers() {
        let facades = setup_test_services();

        // 1. Add uncompleted plan to volume
        let plan = Plan::new("proj_1", "Завершить финальную битву", PlanParentType::Volume, Some("vol_1".to_string()), 1);
        facades.plot.plan_repo.save(&plan).await.unwrap();

        // 2. Audit volume
        let report = facades.plot.audit_volume("vol_1").await.unwrap();
        assert!(report.has_blockers);
        assert_eq!(report.pending_plans_count, 1);

        // 3. Complete plan and re-audit
        facades.plot.complete_plan(&plan.id).await.unwrap();
        let report_after = facades.plot.audit_volume("vol_1").await.unwrap();
        assert!(!report_after.has_blockers);
        assert_eq!(report_after.pending_plans_count, 0);
    }

    #[tokio::test]
    async fn test_all_8_ai_facades_smoke() {
        let facades = setup_test_services();

        // 1. query_world
        let search_res = facades.query_world("proj_1", "магия", "all", 5).await.unwrap();
        assert!(!search_res.is_empty());

        // 2. manage_entity create
        let create_res = facades.manage_entity("create", serde_json::json!({
            "id": "char_1",
            "project_id": "proj_1",
            "type_key": "character",
            "name": "Гэндальф",
            "attributes": {},
            "tags": [],
            "created_at": chrono::Utc::now(),
            "updated_at": chrono::Utc::now()
        })).await.unwrap();
        assert_eq!(create_res["status"], "success");

        // 3. inspect_entity
        let card = facades.inspect_entity("char_1").await.unwrap();
        assert_eq!(card["entity"]["name"], "Гэндальф");

        // 4. read_manuscript
        let ch = Chapter::new("proj_1", "Глава A", 1);
        let ch_id = ch.id.clone();
        facades.manuscript.save_chapter(&ch).await.unwrap();
        let read_val = facades.read_manuscript(&ch_id).await.unwrap();
        assert_eq!(read_val["title"], "Глава A");

        // 5. delegate_task
        let task_res = facades.delegate_task("task_001", "Проанализируй диалог").await.unwrap();
        assert_eq!(task_res["status"], "spawned");
    }
}
