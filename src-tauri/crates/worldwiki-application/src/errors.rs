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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn application_error_constructors_and_from_domain() {
        assert_eq!(
            ApplicationError::not_found("id1").to_string(),
            "Not found: id1"
        );
        assert_eq!(
            ApplicationError::conflict("dup").to_string(),
            "Conflict: dup"
        );
        assert_eq!(
            ApplicationError::validation("bad").to_string(),
            "Validation failed: bad"
        );
        assert_eq!(
            ApplicationError::execution_failed("boom").to_string(),
            "Execution failed: boom"
        );
        assert_eq!(
            ApplicationError::permission_denied("nope").to_string(),
            "Permission denied: nope"
        );

        let from_dom: ApplicationError = DomainError::Validation("v".into()).into();
        assert_eq!(from_dom.to_string(), "Domain error: Validation error: v");
        assert_eq!(ApplicationError::Cancelled.to_string(), "Task cancelled");
    }
}
