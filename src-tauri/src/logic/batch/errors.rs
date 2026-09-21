use std::fmt;

#[derive(Debug)]
pub enum BatchError {
    Database(surrealdb::Error),
    Serialization(serde_json::Error),
    Transaction(String),
    NotFound(String),
    InvalidData(String),
    OperationFailed(String),
}

impl fmt::Display for BatchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BatchError::Database(e) => write!(f, "Database error: {}", e),
            BatchError::Serialization(e) => write!(f, "JSON serialization error: {}", e),
            BatchError::Transaction(msg) => write!(f, "Transaction errors: {}", msg),
            BatchError::NotFound(msg) => write!(f, "Item not found: {}", msg),
            BatchError::InvalidData(msg) => write!(f, "Invalid batch data: {}", msg),
            BatchError::OperationFailed(msg) => write!(f, "Batch operation failed: {}", msg),
        }
    }
}

impl std::error::Error for BatchError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            BatchError::Database(e) => Some(e),
            BatchError::Serialization(e) => Some(e),
            _ => None,
        }
    }
}

impl From<surrealdb::Error> for BatchError {
    fn from(err: surrealdb::Error) -> Self {
        BatchError::Database(err)
    }
}

impl From<serde_json::Error> for BatchError {
    fn from(err: serde_json::Error) -> Self {
        BatchError::Serialization(err)
    }
}

impl From<BatchError> for String {
    fn from(err: BatchError) -> Self {
        err.to_string()
    }
}

impl serde::Serialize for BatchError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

