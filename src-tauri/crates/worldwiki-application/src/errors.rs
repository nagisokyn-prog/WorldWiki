use thiserror::Error;
use worldwiki_domain::errors::DomainError;

#[derive(Error, Debug, Clone)]
pub enum ApplicationError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Validation failed: {0}")]
    Validation(String),

    #[error("Domain error: {0}")]
    Domain(#[from] DomainError),

    #[error("Task cancelled")]
    Cancelled,

    #[error("Execution failed: {0}")]
    ExecutionFailed(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}
