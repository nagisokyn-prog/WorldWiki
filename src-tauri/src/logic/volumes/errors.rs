use std::fmt;

#[derive(Debug)]
pub enum VolumeError {
    Database(surrealdb::Error),
    Serialization(serde_json::Error),
    NotFound(String),
    OperationFailed(String),
}

impl fmt::Display for VolumeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            VolumeError::Database(e) => write!(f, "Database error: {}", e),
            VolumeError::Serialization(e) => write!(f, "JSON serialization error: {}", e),
            VolumeError::NotFound(msg) => write!(f, "Volume not found: {}", msg),
            VolumeError::OperationFailed(msg) => write!(f, "Volume operation failed: {}", msg),
        }
    }
}

impl std::error::Error for VolumeError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            VolumeError::Database(e) => Some(e),
            VolumeError::Serialization(e) => Some(e),
            _ => None,
        }
    }
}

impl From<surrealdb::Error> for VolumeError {
    fn from(err: surrealdb::Error) -> Self {
        VolumeError::Database(err)
    }
}

impl From<serde_json::Error> for VolumeError {
    fn from(err: serde_json::Error) -> Self {
        VolumeError::Serialization(err)
    }
}

impl serde::Serialize for VolumeError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        eprintln!("[IPC ERROR][Volume] {}", self);
        serializer.serialize_str(&self.to_string())
    }
}

