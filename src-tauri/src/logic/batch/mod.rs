//! Модуль пакетных операций: декомпозирован на executor и commands.

pub mod commands;
pub mod executor;

pub use commands::*;
pub use executor::*;

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
}
