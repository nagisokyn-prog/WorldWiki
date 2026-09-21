use std::fmt;

#[derive(Debug)]
pub enum ConnectionError {
    Database(surrealdb::Error),
    Serialization(serde_json::Error),
    InvalidData(String),
    NotFound(String),
    Transaction(String),
    OperationFailed(String),
}

impl fmt::Display for ConnectionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConnectionError::Database(e) => write!(f, "Database error: {}", e),
            ConnectionError::Serialization(e) => write!(f, "JSON serialization error: {}", e),
            ConnectionError::InvalidData(msg) => write!(f, "Invalid connection data: {}", msg),
            ConnectionError::NotFound(msg) => write!(f, "Connection not found: {}", msg),
            ConnectionError::Transaction(msg) => write!(f, "Transaction error: {}", msg),
            ConnectionError::OperationFailed(msg) => write!(f, "Connection operation failed: {}", msg),
        }
    }
}

impl std::error::Error for ConnectionError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ConnectionError::Database(e) => Some(e),
            ConnectionError::Serialization(e) => Some(e),
            _ => None,
        }
    }
}

impl From<surrealdb::Error> for ConnectionError {
    fn from(err: surrealdb::Error) -> Self {
        ConnectionError::Database(err)
    }
}

impl From<serde_json::Error> for ConnectionError {
    fn from(err: serde_json::Error) -> Self {
        ConnectionError::Serialization(err)
    }
}

impl From<ConnectionError> for String {
    fn from(err: ConnectionError) -> Self {
        err.to_string()
    }
}

impl serde::Serialize for ConnectionError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

