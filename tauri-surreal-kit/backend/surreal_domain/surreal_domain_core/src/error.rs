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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_constructors_and_serialization() {
        let err_nf = SurrealDomainError::not_found("entities", "e123");
        assert_eq!(err_nf.to_string(), "Entity not found: table 'entities', id 'e123'");
        let json_nf = serde_json::to_string(&err_nf).unwrap();
        assert_eq!(json_nf, "\"Entity not found: table 'entities', id 'e123'\"");

        let err_inv = SurrealDomainError::invalid_parameter("invalid format");
        assert_eq!(err_inv.to_string(), "Invalid parameter: invalid format");
        let json_inv = serde_json::to_string(&err_inv).unwrap();
        assert_eq!(json_inv, "\"Invalid parameter: invalid format\"");

        let err_con = SurrealDomainError::constraint_violation("duplicate name");
        assert_eq!(err_con.to_string(), "Constraint violation: duplicate name");
        let json_con = serde_json::to_string(&err_con).unwrap();
        assert_eq!(json_con, "\"Constraint violation: duplicate name\"");

        let err_serde: SurrealDomainError = serde_json::from_str::<i32>("not_a_number").unwrap_err().into();
        assert!(err_serde.to_string().starts_with("Serialization error:"));
        let json_serde = serde_json::to_string(&err_serde).unwrap();
        assert!(json_serde.contains("Serialization error:"));
    }
}

