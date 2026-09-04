use std::sync::Arc;
use serde_json::Value;
use worldwiki_domain::knowledge::{Entity, EntityRelation};
use crate::errors::ApplicationError;
use crate::manuscript::ManuscriptServices;
use crate::knowledge::KnowledgeServices;
use crate::calendar::CalendarServices;
use crate::plot::PlotServices;
use crate::workflows::{EditManuscriptAtomicWorkflow, EditManuscriptRequest, EditManuscriptResult, HybridSemanticSearchWorkflow};
use crate::common::JobManager;

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
    pub async fn query_world(&self, project_id: &str, query: &str, scope: &str, top_k: usize) -> Result<Vec<Value>, ApplicationError> {
        self.search_workflow.search(project_id, query, scope, top_k).await
    }

    /// 2. 🧙‍♂️ inspect_entity
    pub async fn inspect_entity(&self, entity_id: &str) -> Result<Value, ApplicationError> {
        let card = self.knowledge.get_full_card(entity_id).await?;
        Ok(serde_json::to_value(card).unwrap_or_default())
    }

    /// 3. ✍️ manage_entity
    pub async fn manage_entity(&self, action: &str, payload: Value) -> Result<Value, ApplicationError> {
        match action {
            "create" | "update" => {
                let entity: Entity = serde_json::from_value(payload)
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                self.knowledge.save_entity(&entity).await?;
                Ok(serde_json::json!({ "status": "success", "entity_id": entity.id }))
            }
            "relate" => {
                let rel: EntityRelation = serde_json::from_value(payload)
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                self.knowledge.add_relation(&rel).await?;
                Ok(serde_json::json!({ "status": "success", "relation_id": rel.id }))
            }
            "delete" => {
                let entity_id = payload.as_str().ok_or_else(|| ApplicationError::Validation("Expected entity_id string".into()))?;
                self.knowledge.entity_repo.delete(entity_id).await?;
                Ok(serde_json::json!({ "status": "success", "deleted_id": entity_id }))
            }
            _ => Err(ApplicationError::Validation(format!("Unsupported action: {action}"))),
        }
    }

    /// 4. 📖 read_manuscript
    pub async fn read_manuscript(&self, chapter_id: &str) -> Result<Value, ApplicationError> {
        let chapter = self.manuscript.get_chapter(chapter_id).await?;
        Ok(serde_json::to_value(chapter).unwrap_or_default())
    }

    /// 5. 📝 edit_manuscript
    pub async fn edit_manuscript(&self, req: EditManuscriptRequest) -> Result<EditManuscriptResult, ApplicationError> {
        self.edit_workflow.execute(req).await
    }

    /// 6. ⏳ timeline_manager
    pub async fn timeline_manager(&self, action: &str, payload: Value) -> Result<Value, ApplicationError> {
        match action {
            "convert_absolute" => {
                let minute = payload["minute"].as_i64().unwrap_or(0);
                let cal_val = &payload["calendar"];
                let cal = serde_json::from_value(cal_val.clone())
                    .map_err(|e| ApplicationError::Validation(e.to_string()))?;
                let era_index = payload["era_index"].as_u64().unwrap_or(0) as usize;
                self.calendar.convert_absolute_to_local(minute, &cal, era_index)
            }
            _ => Err(ApplicationError::Validation(format!("Unsupported timeline action: {action}"))),
        }
    }

    /// 7. 🛡️ audit_consistency
    pub async fn audit_consistency(&self, target_type: &str, target_id: &str) -> Result<Value, ApplicationError> {
        match target_type {
            "volume" => {
                let report = self.plot.audit_volume(target_id).await?;
                Ok(serde_json::to_value(report).unwrap_or_default())
            }
            _ => Err(ApplicationError::Validation(format!("Unsupported audit target: {target_type}"))),
        }
    }

    /// 8. 🤖 delegate_task (AI Orchestration & Runtime)
    pub async fn delegate_task(&self, task_id: &str, prompt: &str) -> Result<Value, ApplicationError> {
        let token = self.job_manager.create_job(task_id).await;
        token.check()?;
        Ok(serde_json::json!({
            "task_id": task_id,
            "status": "spawned",
            "prompt": prompt
        }))
    }
}
