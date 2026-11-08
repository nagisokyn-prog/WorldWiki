use std::sync::Arc;
use surrealdb::Surreal;
use surrealdb::engine::local::Db;

use worldwiki_application::ai::{AiToolFacades, ChatServices, LocalAiServices};
use worldwiki_application::analytics::{
    CharacterJourneyService, CrossReferenceMatrixService, ItemTrackerService,
    ManuscriptAnalyticsService, TimelineInspectorService,
};
use worldwiki_application::calendar::CalendarServices;
use worldwiki_application::common::JobManager;
use worldwiki_application::knowledge::KnowledgeServices;
use worldwiki_application::manuscript::{ManuscriptServices, SaveChapterWithMentionsWorkflow};
use worldwiki_application::plot::{PlotServices, StoryArcServices};
use worldwiki_application::workflows::{
    EditManuscriptAtomicWorkflow, HybridSemanticSearchWorkflow,
};
#[cfg(feature = "ai")]
use worldwiki_ai::{
    ClawStreamAdapter, FsLocalModelManager, StaticPermissionsCatalog, WinApiHardwareDetector,
};
#[cfg(not(feature = "ai"))]
use worldwiki_infrastructure::mock_ai::MockAiAdapter;
use worldwiki_infrastructure::events::InMemoryEventPublisher;
use worldwiki_infrastructure::surrealdb::chat_repo::SurrealChatRepository;
use worldwiki_infrastructure::surrealdb::profile_repo::SurrealAiProfileRepository;
use worldwiki_infrastructure::surrealdb::repos::{
    SurrealAnalyticsRepository, SurrealChapterRepository, SurrealEntityRepository,
    SurrealPlotPromiseRepository, SurrealRAGAdapter, SurrealRelationRepository,
    SurrealStoryArcRepository, SurrealTodoRepository,
};
use worldwiki_infrastructure::surrealdb::skill_repo::SurrealSkillRepository;
use worldwiki_ports::ai::{
    AiProfileRepository, ChatRepository, LlmStreamPort, RAGContextPort, SkillRepositoryPort,
};
use worldwiki_ports::events::EventPublisherPort;
use worldwiki_ports::repositories::{
    AnalyticsRepositoryPort, ChapterRepository, EntityRepository, PlotPromiseRepository,
    RelationRepository, StoryArcRepository, TodoRepository,
};
use worldwiki_tauri::state::AppServices;

struct CoreDomainServices {
    manuscript: Arc<ManuscriptServices>,
    save_chapter_workflow: Arc<SaveChapterWithMentionsWorkflow>,
    knowledge: Arc<KnowledgeServices>,
    calendar: Arc<CalendarServices>,
    plot: Arc<PlotServices>,
    story_arcs: Arc<StoryArcServices>,
    cross_ref_service: Arc<CrossReferenceMatrixService>,
    timeline_inspector_service: Arc<TimelineInspectorService>,
    character_journey_service: Arc<CharacterJourneyService>,
    item_tracker_service: Arc<ItemTrackerService>,
    manuscript_stats_service: Arc<ManuscriptAnalyticsService>,
    job_manager: Arc<JobManager>,
}

fn build_core_domain(
    repos: &SurrealRepos,
    events: Arc<dyn EventPublisherPort>,
) -> CoreDomainServices {
    let manuscript = Arc::new(ManuscriptServices::new(
        Arc::clone(&repos.chapter),
        Arc::clone(&events),
    ));
    let save_chapter_workflow = Arc::new(SaveChapterWithMentionsWorkflow::new(
        Arc::clone(&repos.chapter),
        Arc::clone(&events),
    ));
    let knowledge = Arc::new(KnowledgeServices::new(
        Arc::clone(&repos.entity),
        Arc::clone(&repos.relation),
        Arc::clone(&events),
    ));
    let calendar = Arc::new(CalendarServices::new());
    let plot = Arc::new(PlotServices::new(
        Arc::clone(&repos.promise),
        Arc::clone(&repos.todo),
        Arc::clone(&events),
    ));
    let story_arcs = Arc::new(StoryArcServices::new(Arc::clone(&repos.story_arc)));
    let cross_ref_service = Arc::new(CrossReferenceMatrixService::new(Arc::clone(
        &repos.analytics,
    )));
    let timeline_inspector_service =
        Arc::new(TimelineInspectorService::new(Arc::clone(&repos.analytics)));
    let character_journey_service =
        Arc::new(CharacterJourneyService::new(Arc::clone(&repos.analytics)));
    let item_tracker_service = Arc::new(ItemTrackerService::new(Arc::clone(&repos.analytics)));
    let manuscript_stats_service = Arc::new(ManuscriptAnalyticsService::new(
        Arc::clone(&repos.chapter),
        Arc::clone(&repos.entity),
        Arc::clone(&plot.promise_repo),
    ));
    let job_manager = Arc::new(JobManager::new());

    CoreDomainServices {
        manuscript,
        save_chapter_workflow,
        knowledge,
        calendar,
        plot,
        story_arcs,
        cross_ref_service,
        timeline_inspector_service,
        character_journey_service,
        item_tracker_service,
        manuscript_stats_service,
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
    #[cfg(feature = "ai")]
    {
        let hw = Arc::new(WinApiHardwareDetector::new());
        let models_dir = FsLocalModelManager::default_dir();
        let model_mgr = Arc::new(FsLocalModelManager::new(models_dir));
        let permissions = Arc::new(StaticPermissionsCatalog::new());
        Arc::new(LocalAiServices::new(hw, model_mgr, permissions))
    }
    #[cfg(not(feature = "ai"))]
    {
        let mock = Arc::new(MockAiAdapter::new());
        Arc::new(LocalAiServices::new(
            mock.clone(),
            mock.clone(),
            mock,
        ))
    }
}

struct SurrealRepos {
    chapter: Arc<dyn ChapterRepository>,
    entity: Arc<dyn EntityRepository>,
    relation: Arc<dyn RelationRepository>,
    promise: Arc<dyn PlotPromiseRepository>,
    todo: Arc<dyn TodoRepository>,
    story_arc: Arc<dyn StoryArcRepository>,
    analytics: Arc<dyn AnalyticsRepositoryPort>,
    rag: Arc<dyn RAGContextPort>,
    chat: Arc<dyn ChatRepository>,
    profile: Arc<dyn AiProfileRepository>,
    skill: Arc<dyn SkillRepositoryPort>,
}

impl SurrealRepos {
    fn new(db: &Arc<Surreal<Db>>) -> Self {
        Self {
            chapter: Arc::new(SurrealChapterRepository::new(Arc::clone(db))),
            entity: Arc::new(SurrealEntityRepository::new(Arc::clone(db))),
            relation: Arc::new(SurrealRelationRepository::new(Arc::clone(db))),
            promise: Arc::new(SurrealPlotPromiseRepository::new(Arc::clone(db))),
            todo: Arc::new(SurrealTodoRepository::new(Arc::clone(db))),
            story_arc: Arc::new(SurrealStoryArcRepository::new(Arc::clone(db))),
            analytics: Arc::new(SurrealAnalyticsRepository::new(Arc::clone(db))),
            rag: Arc::new(SurrealRAGAdapter::new(Arc::clone(db))),
            chat: Arc::new(SurrealChatRepository::new(Arc::clone(db))),
            profile: Arc::new(SurrealAiProfileRepository::new(Arc::clone(db))),
            skill: Arc::new(SurrealSkillRepository::new(Arc::clone(db))),
        }
    }
}

pub fn build_app_services() -> AppServices {
    let events: Arc<dyn EventPublisherPort> = Arc::new(InMemoryEventPublisher);
    let dummy_db = Arc::new(Surreal::init());
    build_surreal_app_services(dummy_db, events)
}

pub fn build_surreal_app_services(
    db: Arc<Surreal<Db>>,
    event_publisher: Arc<dyn EventPublisherPort>,
) -> AppServices {
    let repos = SurrealRepos::new(&db);
    let core = build_core_domain(&repos, Arc::clone(&event_publisher));

    let workflows = build_workflows_and_tools(&core, Arc::clone(&repos.rag));

    #[cfg(feature = "ai")]
    let stream_adapter: Arc<dyn LlmStreamPort> =
        Arc::new(ClawStreamAdapter::new());

    #[cfg(not(feature = "ai"))]
    let stream_adapter: Arc<dyn LlmStreamPort> =
        Arc::new(MockAiAdapter::new());

    let chat = Arc::new(ChatServices::new(
        Arc::clone(&repos.chat),
        Arc::clone(&repos.profile),
        stream_adapter,
        event_publisher,
        Some(Arc::clone(&repos.rag)),
        Some(Arc::clone(&repos.skill)),
        Some(Arc::clone(&workflows.ai_tools)),
    ));

    let local_ai = build_local_ai_layer();

    AppServices {
        manuscript: core.manuscript,
        save_chapter_workflow: core.save_chapter_workflow,
        knowledge: core.knowledge,
        calendar: core.calendar,
        plot: core.plot,
        story_arcs: core.story_arcs,
        cross_ref_service: core.cross_ref_service,
        timeline_inspector_service: core.timeline_inspector_service,
        character_journey_service: core.character_journey_service,
        item_tracker_service: core.item_tracker_service,
        manuscript_stats_service: core.manuscript_stats_service,
        edit_workflow: workflows.edit_workflow,
        search_workflow: workflows.search_workflow,
        job_manager: core.job_manager,
        ai_tools: workflows.ai_tools,
        chat,
        local_ai,
        db,
    }
}
