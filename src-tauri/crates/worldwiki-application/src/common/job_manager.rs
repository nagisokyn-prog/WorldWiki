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
