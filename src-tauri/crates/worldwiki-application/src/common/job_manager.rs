use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use crate::errors::ApplicationError;

#[derive(Debug, Clone)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl CancellationToken {
    pub fn new() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    pub fn check(&self) -> Result<(), ApplicationError> {
        if self.is_cancelled() {
            Err(ApplicationError::Cancelled)
        } else {
            Ok(())
        }
    }
}

impl Default for CancellationToken {
    fn default() -> Self {
        Self::new()
    }
}

pub struct JobManager {
    jobs: RwLock<HashMap<String, CancellationToken>>,
}

impl JobManager {
    pub fn new() -> Self {
        Self {
            jobs: RwLock::new(HashMap::new()),
        }
    }

    pub async fn create_job(&self, job_id: impl Into<String>) -> CancellationToken {
        let token = CancellationToken::new();
        let mut map = self.jobs.write().await;
        map.insert(job_id.into(), token.clone());
        token
    }

    pub async fn cancel_job(&self, job_id: &str) -> bool {
        let map = self.jobs.read().await;
        if let Some(token) = map.get(job_id) {
            token.cancel();
            true
        } else {
            false
        }
    }

    pub async fn remove_job(&self, job_id: &str) {
        let mut map = self.jobs.write().await;
        map.remove(job_id);
    }
}

impl Default for JobManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn job_manager_create_cancel_check_and_remove() {
        let mgr = JobManager::default();
        let token = mgr.create_job("job_1").await;
        assert!(!token.is_cancelled());
        assert!(token.check().is_ok());

        // Negative: cancel non-existent job returns false
        assert!(!mgr.cancel_job("missing").await);

        // Positive: cancel existing job
        assert!(mgr.cancel_job("job_1").await);
        assert!(token.is_cancelled());
        assert!(matches!(token.check(), Err(ApplicationError::Cancelled)));

        // Regression: double cancel & remove
        assert!(mgr.cancel_job("job_1").await);
        mgr.remove_job("job_1").await;
        assert!(!mgr.cancel_job("job_1").await);

        let def_tok = CancellationToken::default();
        assert!(!def_tok.is_cancelled());
    }
}
