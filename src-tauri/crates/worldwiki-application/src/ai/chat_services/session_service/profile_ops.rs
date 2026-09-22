use std::sync::Arc;
use worldwiki_domain::ai::{AiModelInfo, AiProfile};
use worldwiki_ports::ai::AiProfileRepository;
use crate::errors::ApplicationError;

pub async fn fetch_models(
    profile_repo: &Arc<dyn AiProfileRepository>,
    provider: &str,
    api_key: Option<&str>,
) -> Result<Vec<AiModelInfo>, ApplicationError> {
    profile_repo
        .fetch_models(provider, api_key)
        .await
        .map_err(ApplicationError::from)
}

pub async fn get_profiles(
    profile_repo: &Arc<dyn AiProfileRepository>,
    project_id: &str,
) -> Result<Vec<AiProfile>, ApplicationError> {
    profile_repo
        .get_profiles(project_id)
        .await
        .map_err(ApplicationError::from)
}

pub async fn save_profile(
    profile_repo: &Arc<dyn AiProfileRepository>,
    profile: &AiProfile,
) -> Result<AiProfile, ApplicationError> {
    profile_repo
        .save_profile(profile)
        .await
        .map_err(ApplicationError::from)
}

pub async fn delete_profile(
    profile_repo: &Arc<dyn AiProfileRepository>,
    id: &str,
) -> Result<(), ApplicationError> {
    profile_repo
        .delete_profile(id)
        .await
        .map_err(ApplicationError::from)
}
