use async_trait::async_trait;
use std::collections::HashMap;
use worldwiki_domain::ai::{SkillMatch, ToolPermissionConfig};
use worldwiki_domain::errors::DomainError;

pub trait PermissionsPort: Send + Sync {
    fn get_tool_permissions_catalog(&self) -> Vec<ToolPermissionConfig>;
    fn save_tool_permission(&self, tool_id: &str, level: &str) -> Result<(), DomainError>;
    fn save_all_tool_permissions(&self, permissions: &HashMap<String, String>) -> Result<(), DomainError>;
}

#[async_trait]
pub trait SkillRepositoryPort: Send + Sync {
    async fn resolve_active_skills(
        &self,
        project_id: Option<&str>,
        query: &str,
        limit: usize,
    ) -> Result<Vec<SkillMatch>, DomainError>;

    async fn get_skill_content(&self, skill_id: &str) -> Result<Option<String>, DomainError>;
}
