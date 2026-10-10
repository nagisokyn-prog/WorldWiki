use std::fmt;

#[derive(Debug)]
pub enum EntityError {
    Database(surrealdb::Error),
    Serialization(serde_json::Error),
    NotFound(String),
    Transaction(String),
    OperationFailed(String),
}

impl fmt::Display for EntityError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EntityError::Database(e) => write!(f, "Database error: {}", e),
            EntityError::Serialization(e) => write!(f, "JSON serialization error: {}", e),
            EntityError::NotFound(msg) => write!(f, "Entity not found: {}", msg),
            EntityError::Transaction(msg) => write!(f, "Transaction errors: {}", msg),
            EntityError::OperationFailed(msg) => write!(f, "Entity operation failed: {}", msg),
        }
    }
}

impl std::error::Error for EntityError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            EntityError::Database(e) => Some(e),
            EntityError::Serialization(e) => Some(e),
            _ => None,
        }
    }
}

impl From<surrealdb::Error> for EntityError {
    fn from(err: surrealdb::Error) -> Self {
        EntityError::Database(err)
    }
}

impl From<serde_json::Error> for EntityError {
    fn from(err: serde_json::Error) -> Self {
        EntityError::Serialization(err)
    }
}

impl serde::Serialize for EntityError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        eprintln!("[IPC ERROR][Entity] {}", self);
        serializer.serialize_str(&self.to_string())
    }
}

