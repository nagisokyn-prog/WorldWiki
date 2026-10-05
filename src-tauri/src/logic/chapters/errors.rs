use std::fmt;

#[derive(Debug)]
pub enum ChapterError {
    Database(surrealdb::Error),
    Serialization(serde_json::Error),
    Transaction(String),
    InvalidData(String),
    NotFound(String),
    OperationFailed(String),
}

impl fmt::Display for ChapterError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ChapterError::Database(e) => write!(f, "Database error: {}", e),
            ChapterError::Serialization(e) => write!(f, "JSON serialization error: {}", e),
            ChapterError::Transaction(msg) => write!(f, "Transaction error: {}", msg),
            ChapterError::InvalidData(msg) => write!(f, "Invalid chapter data: {}", msg),
            ChapterError::NotFound(msg) => write!(f, "Chapter not found: {}", msg),
            ChapterError::OperationFailed(msg) => write!(f, "Chapter operation failed: {}", msg),
        }
    }
}

impl std::error::Error for ChapterError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ChapterError::Database(e) => Some(e),
            ChapterError::Serialization(e) => Some(e),
            _ => None,
        }
    }
}

impl From<surrealdb::Error> for ChapterError {
    fn from(err: surrealdb::Error) -> Self {
        ChapterError::Database(err)
    }
}

impl From<surreal_domain::SurrealDomainError> for ChapterError {
    fn from(err: surreal_domain::SurrealDomainError) -> Self {
        match err {
            surreal_domain::SurrealDomainError::Database(e) => ChapterError::Database(e),
            surreal_domain::SurrealDomainError::Serialization(e) => ChapterError::Serialization(e),
            surreal_domain::SurrealDomainError::NotFound { table, id } => {
                ChapterError::NotFound(format!("{}:{}", table, id))
            }
            surreal_domain::SurrealDomainError::ConstraintViolation(msg) => {
                ChapterError::InvalidData(msg)
            }
            surreal_domain::SurrealDomainError::InvalidParameter(msg) => {
                ChapterError::InvalidData(msg)
            }
        }
    }
}

impl From<serde_json::Error> for ChapterError {
    fn from(err: serde_json::Error) -> Self {
        ChapterError::Serialization(err)
    }
}

impl From<ChapterError> for String {
    fn from(err: ChapterError) -> Self {
        let msg = err.to_string();
        eprintln!("[IPC ERROR][Chapter] {}", msg);
        msg
    }
}

impl serde::Serialize for ChapterError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        eprintln!("[IPC ERROR][Chapter] {}", self);
        serializer.serialize_str(&self.to_string())
    }
}
