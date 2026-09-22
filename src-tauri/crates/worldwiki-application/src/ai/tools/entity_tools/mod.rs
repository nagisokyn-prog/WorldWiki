pub mod inspector;
pub mod mutator;

pub use inspector::inspect_entity;
pub use mutator::manage_entity;

use crate::errors::ApplicationError;
use crate::knowledge::KnowledgeServices;
use serde_json::Value;
use std::sync::Arc;

pub struct EntityTools;

impl EntityTools {
    pub async fn inspect_entity(
        knowledge: &Arc<KnowledgeServices>,
        project_id: &str,
        entity_id_or_query: &str,
    ) -> Result<Value, ApplicationError> {
        inspector::inspect_entity(knowledge, project_id, entity_id_or_query).await
    }

    pub async fn manage_entity(
        knowledge: &Arc<KnowledgeServices>,
        action: &str,
        payload: Value,
    ) -> Result<Value, ApplicationError> {
        mutator::manage_entity(knowledge, action, payload).await
    }
}
