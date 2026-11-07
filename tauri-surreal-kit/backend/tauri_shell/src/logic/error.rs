use thiserror::Error;

#[derive(Debug, Error)]
pub enum SystemError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Item not found: {0}")]
    NotFound(String),

    #[error("Operation failed: {0}")]
    OperationFailed(String),
}

impl serde::Serialize for SystemError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_error_serialize_and_display() {
        let io_err = SystemError::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "io failed"));
        assert!(io_err.to_string().contains("I/O error: io failed"));
        let ser_io = serde_json::to_string(&io_err).expect("serialize io");
        assert_eq!(ser_io, "\"I/O error: io failed\"");

        let json_err = SystemError::Json(serde_json::from_str::<serde_json::Value>("{invalid}").unwrap_err());
        assert!(json_err.to_string().contains("Serialization error:"));
        let ser_json = serde_json::to_string(&json_err).expect("serialize json");
        assert!(ser_json.contains("Serialization error:"));

        let not_found = SystemError::NotFound("chapter_9".to_string());
        assert_eq!(not_found.to_string(), "Item not found: chapter_9");
        let ser_nf = serde_json::to_string(&not_found).expect("serialize not_found");
        assert_eq!(ser_nf, "\"Item not found: chapter_9\"");

        let op_failed = SystemError::OperationFailed("process crashed".to_string());
        assert_eq!(op_failed.to_string(), "Operation failed: process crashed");
        let ser_op = serde_json::to_string(&op_failed).expect("serialize op_failed");
        assert_eq!(ser_op, "\"Operation failed: process crashed\"");
    }
}
