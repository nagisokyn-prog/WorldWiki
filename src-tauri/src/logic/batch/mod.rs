//! Модуль пакетных операций: декомпозирован на executor, errors и commands.

pub mod commands;
pub mod errors;
pub mod reader;
pub mod writer;

pub use commands::*;
pub use errors::*;
pub use reader::*;
pub use writer::*;

// Re-export common helpers from entities for backward compatibility
pub use crate::logic::entities::{deserialize_list, flatten_thing, safe_id, safe_pid};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_pid_reexported() {
        assert_eq!(safe_pid("proj1"), "projects:proj1");
    }

    #[test]
    fn safe_id_reexported() {
        assert_eq!(safe_id("entities", "e1"), "entities:e1");
    }

    #[test]
    fn batch_error_formatting_and_conversion() {
        let not_found = BatchError::NotFound("e99".to_string());
        assert_eq!(not_found.to_string(), "Item not found: e99");

        let err_str = not_found.to_string();
        assert_eq!(err_str, "Item not found: e99");

        let inv_data = BatchError::InvalidData("bad format".to_string());
        assert_eq!(inv_data.to_string(), "Invalid batch data: bad format");

        let tx_err = BatchError::Transaction("tx conflict".to_string());
        assert_eq!(tx_err.to_string(), "Transaction errors: tx conflict");
    }
}

