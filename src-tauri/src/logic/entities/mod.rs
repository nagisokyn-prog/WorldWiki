//! Модуль сущностей: декомпозирован на types, errors, entities_crud, schemas_crud, history_crud, relations и commands.

pub mod commands;
pub mod crud_helpers;
pub mod entities_crud;
pub mod errors;
pub mod history_crud;
pub mod relation_schemas;
pub mod relations;
pub mod schemas_crud;
pub mod types;

pub use commands::*;
pub use entities_crud::*;
pub use errors::*;
pub use history_crud::*;
pub use relation_schemas::*;
pub use relations::*;
pub use schemas_crud::*;
pub use types::*;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn safe_pid_normalizes() {
        assert_eq!(safe_pid("proj1"), "projects:proj1");
        assert_eq!(safe_pid("projects:proj1"), "projects:proj1");
        assert_eq!(safe_pid("  proj1  "), "projects:proj1");
    }

    #[test]
    fn safe_pid_falls_back_to_default() {
        assert_eq!(safe_pid(""), "projects:default");
        assert_eq!(safe_pid("undefined"), "projects:default");
        assert_eq!(safe_pid("projects:"), "projects:default");
    }

    #[test]
    fn safe_id_adds_table_prefix() {
        assert_eq!(safe_id("entities", "abc"), "entities:abc");
        assert_eq!(safe_id("entities", "entities:abc"), "entities:abc");
        assert_eq!(safe_id("entities", "  abc  "), "entities:abc");
    }

    #[test]
    fn safe_id_falls_back_to_default() {
        assert_eq!(safe_id("entities", ""), "entities:default");
        assert_eq!(safe_id("entities", "undefined"), "entities:default");
        assert_eq!(safe_id("entities", "entities:"), "entities:");
    }

    #[test]
    fn flatten_thing_converts_record_to_string() {
        let mut val = json!({
            "key": { "tb": "entities", "id": { "String": "e1" } }
        });
        flatten_thing(&mut val);
        assert_eq!(val["key"], json!("entities:e1"));
    }

    #[test]
    fn flatten_thing_plain_id_string() {
        let mut val = json!({
            "key": { "tb": "entities", "id": "e2" }
        });
        flatten_thing(&mut val);
        assert_eq!(val["key"], json!("entities:e2"));
    }

    #[test]
    fn flatten_thing_does_not_touch_non_thing_objects() {
        let mut val = json!({ "key": { "hello": "world" } });
        flatten_thing(&mut val);
        assert_eq!(val["key"]["hello"], "world");
    }

    #[test]
    fn flatten_thing_skips_non_string_id() {
        let mut val = json!({ "key": { "tb": "entities", "id": { "Object": "x" } } });
        flatten_thing(&mut val);
        assert!(val["key"]["tb"] == "entities");
    }

    #[test]
    fn entity_error_formatting_and_conversion() {
        let not_found = EntityError::NotFound("e123".to_string());
        assert_eq!(not_found.to_string(), "Entity not found: e123");

        let err_str = not_found.to_string();
        assert_eq!(err_str, "Entity not found: e123");

        let op_failed = EntityError::OperationFailed("db error".to_string());
        assert_eq!(op_failed.to_string(), "Entity operation failed: db error");

        let tx_err = EntityError::Transaction("tx rollback".to_string());
        assert_eq!(tx_err.to_string(), "Transaction errors: tx rollback");
    }
}

