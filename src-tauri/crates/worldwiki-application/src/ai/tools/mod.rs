//! High-level AI Tool Facades and Registry.

pub mod definitions;
pub mod entity_tools;
pub mod id_cleaner;
pub mod manuscript_tools;
pub mod system_tools;

pub use definitions::ToolDefinitions;
pub use entity_tools::EntityTools;
pub use id_cleaner::clean_record_id;
pub use manuscript_tools::ManuscriptTools;
pub use system_tools::SystemTools;

use std::sync::Arc;
use serde_json::Value;

use crate::calendar::CalendarServices;
use crate::common::JobManager;
use crate::errors::ApplicationError;
use crate::knowledge::KnowledgeServices;
use crate::manuscript::ManuscriptServices;
use crate::plot::PlotServices;
use crate::workflows::{
    EditManuscriptAtomicWorkflow, EditManuscriptRequest, EditManuscriptResult,
    HybridSemanticSearchWorkflow,
};

pub struct AiToolFacades {
    pub manuscript: Arc<ManuscriptServices>,
    pub knowledge: Arc<KnowledgeServices>,
    pub calendar: Arc<CalendarServices>,
    pub plot: Arc<PlotServices>,
    pub edit_workflow: Arc<EditManuscriptAtomicWorkflow>,
    pub search_workflow: Arc<HybridSemanticSearchWorkflow>,
    pub job_manager: Arc<JobManager>,
}

impl AiToolFacades {
    pub fn new(
        manuscript: Arc<ManuscriptServices>,
        knowledge: Arc<KnowledgeServices>,
        calendar: Arc<CalendarServices>,
        plot: Arc<PlotServices>,
        edit_workflow: Arc<EditManuscriptAtomicWorkflow>,
        search_workflow: Arc<HybridSemanticSearchWorkflow>,
        job_manager: Arc<JobManager>,
    ) -> Self {
        Self {
            manuscript,
            knowledge,
            calendar,
            plot,
            edit_workflow,
            search_workflow,
            job_manager,
        }
    }

    /// 1. 🔍 query_world
    pub async fn query_world(
        &self,
        project_id: &str,
        query: &str,
        scope: &str,
        top_k: usize,
    ) -> Result<Vec<Value>, ApplicationError> {
        SystemTools::query_world(&self.search_workflow, project_id, query, scope, top_k).await
    }

    /// 2. 🧙‍♂️ inspect_entity
    pub async fn inspect_entity(
        &self,
        project_id: &str,
        entity_id_or_query: &str,
    ) -> Result<Value, ApplicationError> {
        EntityTools::inspect_entity(&self.knowledge, project_id, entity_id_or_query).await
    }

    /// 3. ✍️ manage_entity
    pub async fn manage_entity(&self, action: &str, payload: Value) -> Result<Value, ApplicationError> {
        EntityTools::manage_entity(&self.knowledge, action, payload).await
    }

    /// 4. 📖 read_manuscript
    pub async fn read_manuscript(
        &self,
        project_id: &str,
        chapter_id_or_query: &str,
    ) -> Result<Value, ApplicationError> {
        ManuscriptTools::read_manuscript(&self.manuscript, project_id, chapter_id_or_query).await
    }

    /// 5. 📝 edit_manuscript
    pub async fn edit_manuscript(
        &self,
        req: EditManuscriptRequest,
    ) -> Result<EditManuscriptResult, ApplicationError> {
        ManuscriptTools::edit_manuscript(&self.edit_workflow, req).await
    }

    /// 6. ⏳ chronology / timeline_manager
    pub async fn chronology(&self, action: &str, payload: Value) -> Result<Value, ApplicationError> {
        self.timeline_manager(action, payload).await
    }

    pub async fn timeline_manager(&self, action: &str, payload: Value) -> Result<Value, ApplicationError> {
        SystemTools::timeline_manager(&self.calendar, action, payload)
    }

    /// 7. 🛡️ audit_consistency
    pub async fn audit_consistency(
        &self,
        target_type: &str,
        target_id: &str,
    ) -> Result<Value, ApplicationError> {
        SystemTools::audit_consistency(&self.plot, target_type, target_id).await
    }

    /// 8. 🤖 delegate_task
    pub async fn delegate_task(&self, task_id: &str, prompt: &str) -> Result<Value, ApplicationError> {
        SystemTools::delegate_task(&self.search_workflow, &self.job_manager, task_id, prompt).await
    }

    /// Schema definitions per mode
    pub fn tool_definitions_for_mode(mode: &str) -> Vec<Value> {
        ToolDefinitions::for_mode(mode)
    }

    /// Default definitions
    pub fn tool_definitions() -> Vec<Value> {
        ToolDefinitions::all()
    }
}
