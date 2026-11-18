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

impl ApplicationError {
    pub fn not_found<E: std::fmt::Display>(err: E) -> Self {
        Self::NotFound(err.to_string())
    }

    pub fn conflict<E: std::fmt::Display>(err: E) -> Self {
        Self::Conflict(err.to_string())
    }

    pub fn validation<E: std::fmt::Display>(err: E) -> Self {
        Self::Validation(err.to_string())
    }

    pub fn execution_failed<E: std::fmt::Display>(err: E) -> Self {
        Self::ExecutionFailed(err.to_string())
    }

    pub fn permission_denied<E: std::fmt::Display>(err: E) -> Self {
        Self::PermissionDenied(err.to_string())
    }
}
