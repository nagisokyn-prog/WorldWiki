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
