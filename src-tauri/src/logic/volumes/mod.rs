pub mod auto_extend;
pub mod commands;
pub mod errors;
pub mod hierarchy;
pub mod lifecycle;
pub mod reorder;

pub use auto_extend::*;
pub use commands::*;
pub use errors::*;
pub use hierarchy::*;
pub use lifecycle::*;
pub use reorder::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn volume_error_formatting_and_conversion() {
        let not_found = VolumeError::NotFound("v1".to_string());
        assert_eq!(not_found.to_string(), "Volume not found: v1");

        let err_str = not_found.to_string();
        assert_eq!(err_str, "Volume not found: v1");

        let op_fail = VolumeError::OperationFailed("lock error".to_string());
        assert_eq!(op_fail.to_string(), "Volume operation failed: lock error");
    }
}
