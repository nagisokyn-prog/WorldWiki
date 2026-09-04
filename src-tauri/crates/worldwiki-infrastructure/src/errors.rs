use thiserror::Error;
use worldwiki_domain::errors::DomainError;

#[derive(Error, Debug)]
pub enum InfrastructureError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("AI service error: {0}")]
    AiService(String),
}

impl From<InfrastructureError> for DomainError {
    fn from(err: InfrastructureError) -> Self {
        DomainError::ConstraintViolation(err.to_string())
    }
}
