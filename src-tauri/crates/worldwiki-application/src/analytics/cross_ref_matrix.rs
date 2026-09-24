use std::sync::Arc;
use worldwiki_domain::analytics::CrossRefMatrixDto;
use worldwiki_ports::repositories::AnalyticsRepositoryPort;
use crate::errors::ApplicationError;

pub struct CrossReferenceMatrixService {
    pub repo: Arc<dyn AnalyticsRepositoryPort>,
}

impl CrossReferenceMatrixService {
    pub fn new(repo: Arc<dyn AnalyticsRepositoryPort>) -> Self {
        Self { repo }
    }

    pub async fn get_matrix(&self, project_id: &str) -> Result<CrossRefMatrixDto, ApplicationError> {
        Ok(self.repo.get_cross_reference_matrix(project_id).await?)
    }
}
