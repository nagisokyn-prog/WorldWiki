use serde::{Deserialize, Serialize};
use worldwiki_application::ApplicationError;
use worldwiki_domain::DomainError;

#[derive(Debug, Serialize, Deserialize)]
pub struct IpcError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

impl std::fmt::Display for IpcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}]: {}", self.code, self.message)
    }
}

impl std::error::Error for IpcError {}

impl From<ApplicationError> for IpcError {
    fn from(err: ApplicationError) -> Self {
        let ipc_err = match err {
            ApplicationError::NotFound(msg) => Self {
                code: "NOT_FOUND".to_string(),
                message: msg,
                details: None,
            },
            ApplicationError::Conflict(msg) => Self {
                code: "CONFLICT".to_string(),
                message: msg,
                details: None,
            },
            ApplicationError::Validation(msg) => Self {
                code: "VALIDATION_FAILED".to_string(),
                message: msg,
                details: None,
            },
            ApplicationError::Domain(domain_err) => return domain_err.into(),
            ApplicationError::Cancelled => Self {
                code: "TASK_CANCELLED".to_string(),
                message: "Operation was cancelled by user".to_string(),
                details: None,
            },
            ApplicationError::ExecutionFailed(msg) => Self {
                code: "EXECUTION_FAILED".to_string(),
                message: msg,
                details: None,
            },
            ApplicationError::PermissionDenied(msg) => Self {
                code: "PERMISSION_DENIED".to_string(),
                message: msg,
                details: None,
            },
        };
        eprintln!("[IPC ERROR][{}] {}", ipc_err.code, ipc_err.message);
        ipc_err
    }
}

impl From<DomainError> for IpcError {
    fn from(err: DomainError) -> Self {
        let msg = err.to_string();
        eprintln!("[IPC ERROR][DOMAIN_INVARIANT_VIOLATION] {}", msg);
        Self {
            code: "DOMAIN_INVARIANT_VIOLATION".to_string(),
            message: msg,
            details: None,
        }
    }
}

impl From<String> for IpcError {
    fn from(msg: String) -> Self {
        eprintln!("[IPC ERROR][INTERNAL_ERROR] {}", msg);
        Self {
            code: "INTERNAL_ERROR".to_string(),
            message: msg,
            details: None,
        }
    }
}

impl From<&str> for IpcError {
    fn from(msg: &str) -> Self {
        eprintln!("[IPC ERROR][INTERNAL_ERROR] {}", msg);
        Self {
            code: "INTERNAL_ERROR".to_string(),
            message: msg.to_string(),
            details: None,
        }
    }
}
