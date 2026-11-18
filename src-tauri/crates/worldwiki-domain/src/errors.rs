use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq, Eq)]
pub enum DomainError {
    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Constraint violation: {0}")]
    ConstraintViolation(String),

    #[error("Invalid entity state transition: {from} -> {to}")]
    InvalidStateTransition { from: String, to: String },

    #[error("Invalid timeline minute: {minute} is out of bounds for calendar {calendar}")]
    InvalidTimelineMinute { minute: i64, calendar: String },

    #[error("Invalid semantic AST node: {0}")]
    InvalidAstNode(String),

    #[error("Plot promise invariant violated: {0}")]
    InvalidPlotPromise(String),

    #[error("Entity relation mismatch: {from} cannot have relation '{rel_type}' to {to}")]
    InvalidEntityRelation {
        from: String,
        to: String,
        rel_type: String,
    },
}

impl DomainError {
    pub fn validation<E: std::fmt::Display>(err: E) -> Self {
        Self::Validation(err.to_string())
    }

    pub fn constraint_violation<E: std::fmt::Display>(err: E) -> Self {
        Self::ConstraintViolation(err.to_string())
    }

    pub fn invalid_ast_node<E: std::fmt::Display>(err: E) -> Self {
        Self::InvalidAstNode(err.to_string())
    }

    pub fn invalid_plot_promise<E: std::fmt::Display>(err: E) -> Self {
        Self::InvalidPlotPromise(err.to_string())
    }
}

pub trait DomainResultExt<T> {
    fn ctx_validation(self, ctx: &str) -> Result<T, DomainError>;
    fn ctx_constraint(self, ctx: &str) -> Result<T, DomainError>;
}

impl<T, E: std::fmt::Display> DomainResultExt<T> for Result<T, E> {
    fn ctx_validation(self, ctx: &str) -> Result<T, DomainError> {
        match self {
            Ok(v) => Ok(v),
            Err(e) => Err(DomainError::Validation(format!("{ctx}: {e}"))),
        }
    }

    fn ctx_constraint(self, ctx: &str) -> Result<T, DomainError> {
        match self {
            Ok(v) => Ok(v),
            Err(e) => Err(DomainError::ConstraintViolation(format!("{ctx}: {e}"))),
        }
    }
}

pub trait OptionStrExt {
    fn unwrap_or_str(self, fallback: &str) -> String;
}

impl OptionStrExt for Option<String> {
    fn unwrap_or_str(self, fallback: &str) -> String {
        match self {
            Some(s) => s,
            None => fallback.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn domain_error_constructors_and_extensions_cover_positive_and_negative() {
        assert_eq!(
            DomainError::validation("bad input"),
            DomainError::Validation("bad input".to_string())
        );
        assert_eq!(
            DomainError::constraint_violation("dup key"),
            DomainError::ConstraintViolation("dup key".to_string())
        );
        assert_eq!(
            DomainError::invalid_ast_node("bad node"),
            DomainError::InvalidAstNode("bad node".to_string())
        );
        assert_eq!(
            DomainError::invalid_plot_promise("bad promise"),
            DomainError::InvalidPlotPromise("bad promise".to_string())
        );

        let ok_res: Result<i32, &str> = Ok(42);
        assert_eq!(ok_res.ctx_validation("ctx").unwrap(), 42);
        assert_eq!(ok_res.ctx_constraint("ctx").unwrap(), 42);

        let err_res: Result<i32, &str> = Err("boom");
        assert_eq!(
            err_res.ctx_validation("step1").unwrap_err(),
            DomainError::Validation("step1: boom".to_string())
        );
        assert_eq!(
            err_res.ctx_constraint("step2").unwrap_err(),
            DomainError::ConstraintViolation("step2: boom".to_string())
        );

        assert_eq!(Some("val".to_string()).unwrap_or_str("fb"), "val");
        assert_eq!(None.unwrap_or_str("fb"), "fb");
    }
}
