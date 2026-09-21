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
    ChapterRepository, EntityRepository, PlanRepository, PlotPromiseRepository, RelationRepository,
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
    let manuscript = Arc::new(ManuscriptServices::new(chapter_repo, Arc::clone(&events)));
    let knowledge = Arc::new(KnowledgeServices::new(
        entity_repo,
        relation_repo,
        Arc::clone(&events),
    ));
    let calendar = Arc::new(CalendarServices::new());
    let plot = Arc::new(PlotServices::new(promise_repo, plan_repo, events));
    let job_manager = Arc::new(JobManager::new());

    CoreDomainServices {
        manuscript,
        knowledge,
        calendar,
        plot,
        job_manager,
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
        Arc::clone(&core.manuscript),
        Arc::clone(&core.plot),
    ));
    let search_workflow = Arc::new(HybridSemanticSearchWorkflow::new(search_port));
    let ai_tools = Arc::new(AiToolFacades::new(
        Arc::clone(&core.manuscript),
        Arc::clone(&core.knowledge),
        Arc::clone(&core.calendar),
        Arc::clone(&core.plot),
        Arc::clone(&edit_workflow),
        Arc::clone(&search_workflow),
        Arc::clone(&core.job_manager),
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

struct SurrealRepos {
    chapter: Arc<SurrealChapterRepository>,
    entity: Arc<SurrealEntityRepository>,
    relation: Arc<SurrealRelationRepository>,
    promise: Arc<SurrealPlotPromiseRepository>,
    plan: Arc<SurrealPlanRepository>,
    rag: Arc<SurrealRAGAdapter>,
    chat: Arc<SurrealChatRepository>,
    profile: Arc<SurrealAiProfileRepository>,
    skill: Arc<SurrealSkillRepository>,
}

impl SurrealRepos {
    fn new(db: &Arc<Surreal<Db>>) -> Self {
        Self {
            chapter: Arc::new(SurrealChapterRepository::new(Arc::clone(db))),
            entity: Arc::new(SurrealEntityRepository::new(Arc::clone(db))),
            relation: Arc::new(SurrealRelationRepository::new(Arc::clone(db))),
            promise: Arc::new(SurrealPlotPromiseRepository::new(Arc::clone(db))),
            plan: Arc::new(SurrealPlanRepository::new(Arc::clone(db))),
            rag: Arc::new(SurrealRAGAdapter::new(Arc::clone(db))),
            chat: Arc::new(SurrealChatRepository::new(Arc::clone(db))),
            profile: Arc::new(SurrealAiProfileRepository::new(Arc::clone(db))),
            skill: Arc::new(SurrealSkillRepository::new(Arc::clone(db))),
        }
    }
}

pub fn build_app_services() -> AppServices {
    let events: Arc<dyn EventPublisherPort> = Arc::new(InMemoryEventPublisher);
    let ai_adapter = Arc::new(MockAiAdapter);

    let core = build_core_domain(
        Arc::new(InMemoryChapterRepository::default()),
        Arc::new(InMemoryEntityRepository::default()),
        Arc::new(InMemoryRelationRepository::default()),
        Arc::new(InMemoryPlotPromiseRepository::default()),
        Arc::new(InMemoryPlanRepository::default()),
        Arc::clone(&events),
    );

    let workflows =
        build_workflows_and_tools(&core, Arc::clone(&ai_adapter) as Arc<dyn RAGContextPort>);

    let dummy_db = Arc::new(Surreal::init());
    let repos = SurrealRepos::new(&dummy_db);

    let chat = Arc::new(ChatServices::new(
        repos.chat,
        repos.profile,
        ai_adapter,
        events,
        None,
        Some(repos.skill),
        Some(Arc::clone(&workflows.ai_tools)),
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
    let repos = SurrealRepos::new(&db);

    let core = build_core_domain(
        repos.chapter,
        repos.entity,
        repos.relation,
        repos.promise,
        repos.plan,
        Arc::clone(&event_publisher),
    );

    let workflows =
        build_workflows_and_tools(&core, Arc::clone(&repos.rag) as Arc<dyn RAGContextPort>);

    let stream_adapter = Arc::new(worldwiki_infrastructure::ai::ClawStreamAdapter::new());

    let chat = Arc::new(ChatServices::new(
        repos.chat,
        repos.profile,
        stream_adapter,
        event_publisher,
        Some(repos.rag),
        Some(repos.skill),
        Some(Arc::clone(&workflows.ai_tools)),
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
