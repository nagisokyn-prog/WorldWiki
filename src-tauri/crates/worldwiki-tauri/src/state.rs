use std::sync::Arc;
use worldwiki_application::manuscript::ManuscriptServices;
use worldwiki_application::knowledge::KnowledgeServices;
use worldwiki_application::calendar::CalendarServices;
use worldwiki_application::plot::PlotServices;
use worldwiki_application::workflows::{EditManuscriptAtomicWorkflow, HybridSemanticSearchWorkflow};
use worldwiki_application::ai::{AiToolFacades, ChatServices, LocalAiServices};
use worldwiki_application::common::JobManager;

pub struct AppServices {
    pub manuscript: Arc<ManuscriptServices>,
    pub knowledge: Arc<KnowledgeServices>,
    pub calendar: Arc<CalendarServices>,
    pub plot: Arc<PlotServices>,
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
