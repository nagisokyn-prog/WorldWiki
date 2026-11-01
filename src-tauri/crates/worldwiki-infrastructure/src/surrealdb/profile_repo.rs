use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

use worldwiki_domain::ai::{AiModelInfo, AiProfile};
use worldwiki_domain::errors::DomainError;
use worldwiki_ports::ai::AiProfileRepository;

use super::chat_repo::clean_record_id;

pub struct SurrealAiProfileRepository {
    db: Arc<Surreal<Db>>,
}

impl SurrealAiProfileRepository {
    pub fn new(db: Arc<Surreal<Db>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl AiProfileRepository for SurrealAiProfileRepository {
    async fn get_profiles(&self, project_id: &str) -> Result<Vec<AiProfile>, DomainError> {
        let proj_clean = project_id.trim_start_matches("projects:");
        let proj_id = format!("projects:{proj_clean}");

        let mut res = self
            .db
            .query("SELECT id, project_id, name, provider, base_url, api_key, settings, is_active, is_global FROM ai_profiles WHERE project_id = fn::normalize_project_id($proj) OR is_global = true")
            .bind(("proj", proj_id))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let rows: Vec<Value> = res
            .take(0)
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;
        let mut profiles = Vec::with_capacity(rows.len());

        for v in rows {
            let id = clean_record_id(v.get("id").unwrap_or(&Value::Null));
            let name = v
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("Default")
                .to_string();
            let provider = v
                .get("provider")
                .and_then(|x| x.as_str())
                .unwrap_or("anthropic")
                .to_string();
            let base_url = v
                .get("base_url")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string());
            let api_key = v
                .get("api_key")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string());
            let settings = v.get("settings").cloned().unwrap_or(serde_json::json!({}));
            let is_active = v
                .get("is_active")
                .and_then(|x| x.as_bool())
                .unwrap_or(false);
            let is_global = v
                .get("is_global")
                .and_then(|x| x.as_bool())
                .unwrap_or(false);

            profiles.push(AiProfile {
                id,
                project_id: project_id.to_string(),
                name,
                provider,
                base_url,
                api_key,
                settings,
                is_active,
                is_global,
            });
        }

        Ok(profiles)
    }

    async fn get_active_profile(&self, project_id: &str) -> Result<Option<AiProfile>, DomainError> {
        let profiles = self.get_profiles(project_id).await?;
        Ok(profiles.into_iter().find(|p| p.is_active))
    }

    async fn save_profile(&self, profile: &AiProfile) -> Result<AiProfile, DomainError> {
        let proj_clean = profile.project_id.trim_start_matches("projects:");
        let proj_id = format!("projects:{proj_clean}");

        let id_val = if let Some(ref id) = profile.id {
            let clean = id.trim_start_matches("ai_profiles:");
            format!("ai_profiles:{clean}")
        } else {
            let uid = uuid::Uuid::new_v4().to_string();
            format!("ai_profiles:{uid}")
        };

        self.db
            .query(
                "UPSERT type::record($id) SET name = $name, provider = $provider, base_url = $base_url, api_key = $api_key, settings = $settings, is_active = $is_active, is_global = $is_global, project_id = fn::normalize_project_id($proj)"
            )
            .bind(("id", id_val.clone()))
            .bind(("name", profile.name.clone()))
            .bind(("provider", profile.provider.clone()))
            .bind(("base_url", profile.base_url.clone()))
            .bind(("api_key", profile.api_key.clone()))
            .bind(("settings", profile.settings.clone()))
            .bind(("is_active", profile.is_active))
            .bind(("is_global", profile.is_global))
            .bind(("proj", proj_id))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        let mut saved = profile.clone();
        saved.id = Some(id_val);
        Ok(saved)
    }

    async fn delete_profile(&self, id: &str) -> Result<(), DomainError> {
        let clean = id.trim_start_matches("ai_profiles:");
        let p_id = format!("ai_profiles:{clean}");

        self.db
            .query("DELETE type::record($id)")
            .bind(("id", p_id))
            .await
            .map_err(|e| DomainError::ConstraintViolation(e.to_string()))?;

        Ok(())
    }

    async fn fetch_models(
        &self,
        provider: &str,
        api_key: Option<&str>,
    ) -> Result<Vec<AiModelInfo>, DomainError> {
        crate::ai::model_discovery::fetch_provider_models(provider, api_key).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use surrealdb::engine::local::Mem;

    async fn setup_test_db() -> Arc<Surreal<Db>> {
        let db = Surreal::new::<Mem>(()).await.unwrap();
        db.use_ns("test").use_db("test").await.unwrap();
        let analyzers = include_str!("../../../../../apps/spa/src/logic/schema/no_ai/00_analyzers.surql");
        let workspace = include_str!("../../../../../apps/spa/src/logic/schema/ai/01_workspace_tables.surql");
        let _ = db.query(analyzers).await;
        let _ = db.query(workspace).await;
        Arc::new(db)
    }

    #[tokio::test]
    async fn test_profile_repo_crud() {
        let db = setup_test_db().await;
        let repo = SurrealAiProfileRepository::new(db);

        let profile = AiProfile {
            id: Some("ai_profiles:prof1".to_string()),
            project_id: "projects:p1".to_string(),
            name: "Anthropic Profile".to_string(),
            provider: "anthropic".to_string(),
            base_url: None,
            api_key: Some("sk-ant-test".to_string()),
            settings: serde_json::json!({ "model": "claude-3-7-sonnet" }),
            is_active: true,
            is_global: false,
        };

        let saved = repo.save_profile(&profile).await.unwrap();
        assert_eq!(saved.id.as_deref(), Some("ai_profiles:prof1"));

        let active = repo.get_active_profile("projects:p1").await.unwrap();
        assert!(active.is_some());
        let err_res = repo.fetch_models("anthropic", None).await;
        assert!(err_res.is_err());
    }
}
