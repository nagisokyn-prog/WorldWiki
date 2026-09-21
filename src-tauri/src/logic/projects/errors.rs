use std::fmt;

#[derive(Debug)]
pub enum ProjectError {
    Database(surrealdb::Error),
    Serialization(serde_json::Error),
    InvalidData(String),
    NotFound(String),
    Transaction(String),
    OperationFailed(String),
}

impl fmt::Display for ProjectError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProjectError::Database(e) => write!(f, "Database error: {}", e),
            ProjectError::Serialization(e) => write!(f, "JSON serialization error: {}", e),
            ProjectError::InvalidData(msg) => write!(f, "Invalid project data: {}", msg),
            ProjectError::NotFound(msg) => write!(f, "Project not found: {}", msg),
            ProjectError::Transaction(msg) => write!(f, "Transaction error: {}", msg),
            ProjectError::OperationFailed(msg) => write!(f, "Project operation failed: {}", msg),
        }
    }
}

impl std::error::Error for ProjectError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ProjectError::Database(e) => Some(e),
            ProjectError::Serialization(e) => Some(e),
            _ => None,
        }
    }
}

impl From<surrealdb::Error> for ProjectError {
    fn from(err: surrealdb::Error) -> Self {
        ProjectError::Database(err)
    }
}

impl From<serde_json::Error> for ProjectError {
    fn from(err: serde_json::Error) -> Self {
        ProjectError::Serialization(err)
    }
}

impl From<ProjectError> for String {
    fn from(err: ProjectError) -> Self {
        err.to_string()
    }
}
