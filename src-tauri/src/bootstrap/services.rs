use std::sync::Arc;
use worldwiki_application::manuscript::ManuscriptServices;
use worldwiki_application::knowledge::KnowledgeServices;
use worldwiki_application::calendar::CalendarServices;
use worldwiki_application::plot::PlotServices;
use worldwiki_application::workflows::{EditManuscriptAtomicWorkflow, HybridSemanticSearchWorkflow};
use worldwiki_application::ai::AiToolFacades;
use worldwiki_application::common::JobManager;
use worldwiki_infrastructure::surrealdb::memory_repos::{
    InMemoryChapterRepository, InMemoryEntityRepository, InMemoryRelationRepository,
    InMemoryPlotPromiseRepository, InMemoryPlanRepository
};
use worldwiki_infrastructure::ai::mock_ai::MockAiAdapter;
use worldwiki_infrastructure::events::InMemoryEventPublisher;
use worldwiki_tauri::state::AppServices;

pub fn build_app_services() -> AppServices {
    // 1. Repositories
    let chapter_repo = Arc::new(InMemoryChapterRepository::default());
    let entity_repo = Arc::new(InMemoryEntityRepository::default());
    let relation_repo = Arc::new(InMemoryRelationRepository::default());
    let promise_repo = Arc::new(InMemoryPlotPromiseRepository::default());
    let plan_repo = Arc::new(InMemoryPlanRepository::default());

    // 2. Adapters & Ports
    let events = Arc::new(InMemoryEventPublisher);
    let ai_adapter = Arc::new(MockAiAdapter);

    // 3. Application Services
    let manuscript = Arc::new(ManuscriptServices::new(chapter_repo.clone(), events.clone()));
    let knowledge = Arc::new(KnowledgeServices::new(entity_repo.clone(), relation_repo.clone(), events.clone()));
    let calendar = Arc::new(CalendarServices::new());
    let plot = Arc::new(PlotServices::new(promise_repo.clone(), plan_repo.clone(), events.clone()));
    let job_manager = Arc::new(JobManager::new());

    // 4. Workflows
    let edit_workflow = Arc::new(EditManuscriptAtomicWorkflow::new(manuscript.clone(), plot.clone()));
    let search_workflow = Arc::new(HybridSemanticSearchWorkflow::new(ai_adapter.clone()));

    // 5. AI Facades
    let ai_tools = Arc::new(AiToolFacades::new(
        manuscript.clone(),
        knowledge.clone(),
        calendar.clone(),
        plot.clone(),
        edit_workflow.clone(),
        search_workflow.clone(),
        job_manager.clone(),
    ));

    AppServices {
        manuscript,
        knowledge,
        calendar,
        plot,
        edit_workflow,
        search_workflow,
        job_manager,
        ai_tools,
    }
}
