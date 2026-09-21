use thiserror::Error;

#[derive(Debug, Error)]
pub enum SurrealDomainError {
    #[error("Database error: {0}")]
    Database(#[from] surrealdb::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Entity not found: table '{table}', id '{id}'")]
    NotFound { table: String, id: String },

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("Constraint violation: {0}")]
    ConstraintViolation(String),
}

impl SurrealDomainError {
    pub fn not_found(table: impl Into<String>, id: impl Into<String>) -> Self {
        Self::NotFound {
            table: table.into(),
            id: id.into(),
        }
    }

    pub fn invalid_parameter(msg: impl Into<String>) -> Self {
        Self::InvalidParameter(msg.into())
    }

    pub fn constraint_violation(msg: impl Into<String>) -> Self {
        Self::ConstraintViolation(msg.into())
    }
}

impl serde::Serialize for SurrealDomainError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

