use std::sync::Arc;
use worldwiki_application::ai::{AiToolFacades, ChatServices, LocalAiServices};
use worldwiki_application::analytics::{
    CharacterJourneyService, CrossReferenceMatrixService,
    ItemTrackerService, ManuscriptAnalyticsService, TimelineInspectorService,
};
use worldwiki_application::calendar::CalendarServices;
use worldwiki_application::common::JobManager;
use worldwiki_application::knowledge::KnowledgeServices;
use worldwiki_application::manuscript::{ManuscriptServices, SaveChapterWithMentionsWorkflow};
use worldwiki_application::plot::{PlotServices, StoryArcServices};
use worldwiki_application::workflows::{
    EditManuscriptAtomicWorkflow, HybridSemanticSearchWorkflow,
};

pub struct AppServices {
    pub manuscript: Arc<ManuscriptServices>,
    pub save_chapter_workflow: Arc<SaveChapterWithMentionsWorkflow>,
    pub knowledge: Arc<KnowledgeServices>,
    pub calendar: Arc<CalendarServices>,
    pub plot: Arc<PlotServices>,
    pub story_arcs: Arc<StoryArcServices>,
    pub cross_ref_service: Arc<CrossReferenceMatrixService>,
    pub timeline_inspector_service: Arc<TimelineInspectorService>,
    pub character_journey_service: Arc<CharacterJourneyService>,
    pub item_tracker_service: Arc<ItemTrackerService>,
    pub manuscript_stats_service: Arc<ManuscriptAnalyticsService>,
    pub edit_workflow: Arc<EditManuscriptAtomicWorkflow>,
    pub search_workflow: Arc<HybridSemanticSearchWorkflow>,
    pub job_manager: Arc<JobManager>,
    pub ai_tools: Arc<AiToolFacades>,
    pub chat: Arc<ChatServices>,
    pub local_ai: Arc<LocalAiServices>,
    pub db: Arc<surrealdb::Surreal<surrealdb::engine::local::Db>>,
}

pub struct AppState {
    pub services: AppServices,
}

impl AppState {
    pub fn new(services: AppServices) -> Self {
        Self { services }
    }
}

