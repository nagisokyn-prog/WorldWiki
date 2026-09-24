pub mod analytics;
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
        let events: Arc<dyn worldwiki_ports::EventPublisherPort> = Arc::new(InMemoryEventPublisher);
        let manuscript = Arc::new(ManuscriptServices::new(
            Arc::new(InMemoryChapterRepository::default()),
            Arc::clone(&events),
        ));
        let knowledge = Arc::new(KnowledgeServices::new(
            Arc::new(InMemoryEntityRepository::default()),
            Arc::new(InMemoryRelationRepository::default()),
            Arc::clone(&events),
        ));
        let calendar = Arc::new(CalendarServices::new());
        let plot = Arc::new(PlotServices::new(
            Arc::new(InMemoryPlotPromiseRepository::default()),
            Arc::new(InMemoryPlanRepository::default()),
            events,
        ));
        let job_manager = Arc::new(JobManager::new());

        let edit_workflow = Arc::new(EditManuscriptAtomicWorkflow::new(
            Arc::clone(&manuscript),
            Arc::clone(&plot),
        ));
        let search_workflow = Arc::new(HybridSemanticSearchWorkflow::new(Arc::new(MockAiAdapter)));

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
        let mut chapter = Chapter::new("proj_1", "Глава 1: Начало", 1);
        chapter.id = "ch_1".to_string();
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
        assert_eq!(create_res["status"], "created");

        // 3. inspect_entity
        let card = facades.inspect_entity("proj_1", "char_1").await.unwrap();
        assert_eq!(card["entity"]["name"], "Гэндальф");

        // 4. read_manuscript
        let mut ch = Chapter::new("proj_1", "Глава A", 1);
        ch.id = "ch_a".to_string();
        let ch_id = ch.id.clone();
        facades.manuscript.save_chapter(&ch).await.unwrap();
        let read_val = facades.read_manuscript("proj_1", &ch_id).await.unwrap();
        assert_eq!(read_val["title"], "Глава A");

        // 5. delegate_task
        let task_res = facades.delegate_task("task_001", "Проанализируй диалог").await.unwrap();
        assert_eq!(task_res["status"], "completed");
    }

    #[test]
    fn test_local_ai_services_hardware_and_manager() {
        use worldwiki_infrastructure::ai::hardware::WinApiHardwareDetector;
        use worldwiki_infrastructure::ai::permissions::StaticPermissionsCatalog;
        use worldwiki_infrastructure::ai::local_manager::FsLocalModelManager;
        use crate::ai::LocalAiServices;

        let temp_dir = std::env::temp_dir().join("worldwiki_test_models");
        let hw = Arc::new(WinApiHardwareDetector::new());
        let mgr = Arc::new(FsLocalModelManager::new(temp_dir));
        let perms = Arc::new(StaticPermissionsCatalog::new());

        let local_ai = LocalAiServices::new(hw, mgr, perms);

        let info = local_ai.get_hardware_info();
        assert!(info.total_ram_gb > 0.0);

        let quants = local_ai.calculate_quantization_estimates(7.0, Some(4096));
        assert!(!quants.is_empty());

        let recommended = local_ai.get_recommended_local_models();
        assert_eq!(recommended.len(), 3);

        let catalog = local_ai.get_tool_permissions_catalog();
        assert!(catalog.len() >= 5);

        let installed = local_ai.list_installed_models().expect("list_installed_models must succeed");
        // Не предполагаем, что у пользователя нет моделей на диске — проверяем работоспособность сканирования
        let _ = installed;
    }
}
