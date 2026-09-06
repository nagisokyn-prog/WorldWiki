use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

use worldwiki_application::ai::{AiToolFacades, ChatServices, LocalAiServices};
use worldwiki_application::calendar::CalendarServices;
use worldwiki_application::common::JobManager;
use worldwiki_application::knowledge::KnowledgeServices;
use worldwiki_application::manuscript::ManuscriptServices;
use worldwiki_application::plot::PlotServices;
use worldwiki_application::workflows::{
    EditManuscriptAtomicWorkflow, HybridSemanticSearchWorkflow,
};
use worldwiki_infrastructure::ai::mock_ai::MockAiAdapter;
use worldwiki_infrastructure::ai::{
    FsLocalModelManager, StaticPermissionsCatalog, WinApiHardwareDetector,
};
use worldwiki_infrastructure::events::InMemoryEventPublisher;
use worldwiki_infrastructure::surrealdb::chat_repo::{
    SurrealAiProfileRepository, SurrealChatRepository,
};
use worldwiki_infrastructure::surrealdb::memory_repos::{
    InMemoryChapterRepository, InMemoryEntityRepository, InMemoryPlanRepository,
    InMemoryPlotPromiseRepository, InMemoryRelationRepository,
};
use worldwiki_infrastructure::surrealdb::repos::{
    SurrealChapterRepository, SurrealEntityRepository, SurrealPlanRepository,
    SurrealPlotPromiseRepository, SurrealRAGAdapter, SurrealRelationRepository,
};
use worldwiki_ports::events::EventPublisherPort;
use worldwiki_tauri::state::AppServices;

pub fn build_app_services() -> AppServices {
    let chapter_repo = Arc::new(InMemoryChapterRepository::default());
    let entity_repo = Arc::new(InMemoryEntityRepository::default());
    let relation_repo = Arc::new(InMemoryRelationRepository::default());
    let promise_repo = Arc::new(InMemoryPlotPromiseRepository::default());
    let plan_repo = Arc::new(InMemoryPlanRepository::default());

    let events = Arc::new(InMemoryEventPublisher);
    let ai_adapter = Arc::new(MockAiAdapter);

    let manuscript = Arc::new(ManuscriptServices::new(
        chapter_repo.clone(),
        events.clone(),
    ));
    let knowledge = Arc::new(KnowledgeServices::new(
        entity_repo.clone(),
        relation_repo.clone(),
        events.clone(),
    ));
    let calendar = Arc::new(CalendarServices::new());
    let plot = Arc::new(PlotServices::new(
        promise_repo.clone(),
        plan_repo.clone(),
        events.clone(),
    ));
    let job_manager = Arc::new(JobManager::new());

    let edit_workflow = Arc::new(EditManuscriptAtomicWorkflow::new(
        manuscript.clone(),
        plot.clone(),
    ));
    let search_workflow = Arc::new(HybridSemanticSearchWorkflow::new(ai_adapter.clone()));

    let ai_tools = Arc::new(AiToolFacades::new(
        manuscript.clone(),
        knowledge.clone(),
        calendar.clone(),
        plot.clone(),
        edit_workflow.clone(),
        search_workflow.clone(),
        job_manager.clone(),
    ));

    let dummy_db = Arc::new(Surreal::init());
    let chat_repo = Arc::new(SurrealChatRepository::new(dummy_db.clone()));
    let profile_repo = Arc::new(SurrealAiProfileRepository::new(dummy_db.clone()));
    let chat = Arc::new(ChatServices::new(chat_repo, profile_repo));

    let hw = Arc::new(WinApiHardwareDetector::new());
    let models_dir = FsLocalModelManager::default_dir();
    let model_mgr = Arc::new(FsLocalModelManager::new(models_dir));
    let permissions = Arc::new(StaticPermissionsCatalog::new());
    let local_ai = Arc::new(LocalAiServices::new(hw, model_mgr, permissions));

    AppServices {
        manuscript,
        knowledge,
        calendar,
        plot,
        edit_workflow,
        search_workflow,
        job_manager,
        ai_tools,
        chat,
        local_ai,
        db: dummy_db,
    }
}

pub fn build_surreal_app_services(
    db: Arc<Surreal<Db>>,
    event_publisher: Arc<dyn EventPublisherPort>,
) -> AppServices {
    let chapter_repo = Arc::new(SurrealChapterRepository::new(db.clone()));
    let entity_repo = Arc::new(SurrealEntityRepository::new(db.clone()));
    let relation_repo = Arc::new(SurrealRelationRepository::new(db.clone()));
    let promise_repo = Arc::new(SurrealPlotPromiseRepository::new(db.clone()));
    let plan_repo = Arc::new(SurrealPlanRepository::new(db.clone()));
    let rag_adapter = Arc::new(SurrealRAGAdapter::new(db.clone()));

    let chat_repo = Arc::new(SurrealChatRepository::new(db.clone()));
    let profile_repo = Arc::new(SurrealAiProfileRepository::new(db.clone()));

    let manuscript = Arc::new(ManuscriptServices::new(
        chapter_repo.clone(),
        event_publisher.clone(),
    ));
    let knowledge = Arc::new(KnowledgeServices::new(
        entity_repo.clone(),
        relation_repo.clone(),
        event_publisher.clone(),
    ));
    let calendar = Arc::new(CalendarServices::new());
    let plot = Arc::new(PlotServices::new(
        promise_repo.clone(),
        plan_repo.clone(),
        event_publisher.clone(),
    ));
    let job_manager = Arc::new(JobManager::new());

    let edit_workflow = Arc::new(EditManuscriptAtomicWorkflow::new(
        manuscript.clone(),
        plot.clone(),
    ));
    let search_workflow = Arc::new(HybridSemanticSearchWorkflow::new(rag_adapter.clone()));

    let ai_tools = Arc::new(AiToolFacades::new(
        manuscript.clone(),
        knowledge.clone(),
        calendar.clone(),
        plot.clone(),
        edit_workflow.clone(),
        search_workflow.clone(),
        job_manager.clone(),
    ));

    let chat = Arc::new(ChatServices::new(chat_repo, profile_repo));

    let hw = Arc::new(WinApiHardwareDetector::new());
    let models_dir = FsLocalModelManager::default_dir();
    let model_mgr = Arc::new(FsLocalModelManager::new(models_dir));
    let permissions = Arc::new(StaticPermissionsCatalog::new());
    let local_ai = Arc::new(LocalAiServices::new(hw, model_mgr, permissions));

    AppServices {
        manuscript,
        knowledge,
        calendar,
        plot,
        edit_workflow,
        search_workflow,
        job_manager,
        ai_tools,
        chat,
        local_ai,
        db,
    }
}
