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
use worldwiki_infrastructure::surrealdb::chat_repo::SurrealChatRepository;
use worldwiki_infrastructure::surrealdb::memory_repos::{
    InMemoryChapterRepository, InMemoryEntityRepository, InMemoryPlanRepository,
    InMemoryPlotPromiseRepository, InMemoryRelationRepository,
};
use worldwiki_infrastructure::surrealdb::profile_repo::SurrealAiProfileRepository;
use worldwiki_infrastructure::surrealdb::repos::{
    SurrealChapterRepository, SurrealEntityRepository, SurrealPlanRepository,
    SurrealPlotPromiseRepository, SurrealRAGAdapter, SurrealRelationRepository,
};
use worldwiki_infrastructure::surrealdb::skill_repo::SurrealSkillRepository;
use worldwiki_ports::ai::RAGContextPort;
use worldwiki_ports::events::EventPublisherPort;
use worldwiki_ports::repositories::{
    ChapterRepository, EntityRepository, PlanRepository, PlotPromiseRepository,
    RelationRepository,
};
use worldwiki_tauri::state::AppServices;

struct CoreDomainServices {
    manuscript: Arc<ManuscriptServices>,
    knowledge: Arc<KnowledgeServices>,
    calendar: Arc<CalendarServices>,
    plot: Arc<PlotServices>,
    job_manager: Arc<JobManager>,
}

fn build_core_domain(
    chapter_repo: Arc<dyn ChapterRepository>,
    entity_repo: Arc<dyn EntityRepository>,
    relation_repo: Arc<dyn RelationRepository>,
    promise_repo: Arc<dyn PlotPromiseRepository>,
    plan_repo: Arc<dyn PlanRepository>,
    events: Arc<dyn EventPublisherPort>,
) -> CoreDomainServices {
    CoreDomainServices {
        manuscript: Arc::new(ManuscriptServices::new(chapter_repo, events.clone())),
        knowledge: Arc::new(KnowledgeServices::new(entity_repo, relation_repo, events.clone())),
        calendar: Arc::new(CalendarServices::new()),
        plot: Arc::new(PlotServices::new(promise_repo, plan_repo, events)),
        job_manager: Arc::new(JobManager::new()),
    }
}

struct WorkflowsAndTools {
    edit_workflow: Arc<EditManuscriptAtomicWorkflow>,
    search_workflow: Arc<HybridSemanticSearchWorkflow>,
    ai_tools: Arc<AiToolFacades>,
}

fn build_workflows_and_tools(
    core: &CoreDomainServices,
    search_port: Arc<dyn RAGContextPort>,
) -> WorkflowsAndTools {
    let edit_workflow = Arc::new(EditManuscriptAtomicWorkflow::new(
        core.manuscript.clone(),
        core.plot.clone(),
    ));
    let search_workflow = Arc::new(HybridSemanticSearchWorkflow::new(search_port));
    let ai_tools = Arc::new(AiToolFacades::new(
        core.manuscript.clone(),
        core.knowledge.clone(),
        core.calendar.clone(),
        core.plot.clone(),
        edit_workflow.clone(),
        search_workflow.clone(),
        core.job_manager.clone(),
    ));

    WorkflowsAndTools {
        edit_workflow,
        search_workflow,
        ai_tools,
    }
}

fn build_local_ai_layer() -> Arc<LocalAiServices> {
    let hw = Arc::new(WinApiHardwareDetector::new());
    let models_dir = FsLocalModelManager::default_dir();
    let model_mgr = Arc::new(FsLocalModelManager::new(models_dir));
    let permissions = Arc::new(StaticPermissionsCatalog::new());
    Arc::new(LocalAiServices::new(hw, model_mgr, permissions))
}

pub fn build_app_services() -> AppServices {
    let events = Arc::new(InMemoryEventPublisher);
    let ai_adapter = Arc::new(MockAiAdapter);

    let core = build_core_domain(
        Arc::new(InMemoryChapterRepository::default()),
        Arc::new(InMemoryEntityRepository::default()),
        Arc::new(InMemoryRelationRepository::default()),
        Arc::new(InMemoryPlotPromiseRepository::default()),
        Arc::new(InMemoryPlanRepository::default()),
        events.clone(),
    );

    let workflows = build_workflows_and_tools(&core, ai_adapter.clone());

    let dummy_db = Arc::new(Surreal::init());
    let chat_repo = Arc::new(SurrealChatRepository::new(dummy_db.clone()));
    let profile_repo = Arc::new(SurrealAiProfileRepository::new(dummy_db.clone()));
    let skill_repo = Arc::new(SurrealSkillRepository::new(dummy_db.clone()));
    let chat = Arc::new(ChatServices::new(
        chat_repo,
        profile_repo,
        ai_adapter,
        events,
        None,
        Some(skill_repo),
        Some(workflows.ai_tools.clone()),
    ));

    let local_ai = build_local_ai_layer();

    AppServices {
        manuscript: core.manuscript,
        knowledge: core.knowledge,
        calendar: core.calendar,
        plot: core.plot,
        edit_workflow: workflows.edit_workflow,
        search_workflow: workflows.search_workflow,
        job_manager: core.job_manager,
        ai_tools: workflows.ai_tools,
        chat,
        local_ai,
        db: dummy_db,
    }
}

pub fn build_surreal_app_services(
    db: Arc<Surreal<Db>>,
    event_publisher: Arc<dyn EventPublisherPort>,
) -> AppServices {
    let rag_adapter = Arc::new(SurrealRAGAdapter::new(db.clone()));

    let core = build_core_domain(
        Arc::new(SurrealChapterRepository::new(db.clone())),
        Arc::new(SurrealEntityRepository::new(db.clone())),
        Arc::new(SurrealRelationRepository::new(db.clone())),
        Arc::new(SurrealPlotPromiseRepository::new(db.clone())),
        Arc::new(SurrealPlanRepository::new(db.clone())),
        event_publisher.clone(),
    );

    let workflows = build_workflows_and_tools(&core, rag_adapter.clone());

    let chat_repo = Arc::new(SurrealChatRepository::new(db.clone()));
    let profile_repo = Arc::new(SurrealAiProfileRepository::new(db.clone()));
    let stream_adapter = Arc::new(worldwiki_infrastructure::ai::ClawStreamAdapter::new());
    let skill_repo = Arc::new(SurrealSkillRepository::new(db.clone()));

    let chat = Arc::new(ChatServices::new(
        chat_repo,
        profile_repo,
        stream_adapter,
        event_publisher,
        Some(rag_adapter),
        Some(skill_repo),
        Some(workflows.ai_tools.clone()),
    ));

    let local_ai = build_local_ai_layer();

    AppServices {
        manuscript: core.manuscript,
        knowledge: core.knowledge,
        calendar: core.calendar,
        plot: core.plot,
        edit_workflow: workflows.edit_workflow,
        search_workflow: workflows.search_workflow,
        job_manager: core.job_manager,
        ai_tools: workflows.ai_tools,
        chat,
        local_ai,
        db,
    }
}
