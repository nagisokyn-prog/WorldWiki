pub mod commands;
pub mod config;
pub mod errors;
pub mod lifecycle;
pub mod raw_query;

pub use commands::*;
pub use config::*;
pub use errors::*;
pub use lifecycle::*;
pub use raw_query::*;

#[cfg(test)]
mod tests {
    use super::*;
    use surrealdb::Surreal;

    #[test]
    fn project_error_formatting_and_conversion() {
        let not_found = ProjectError::NotFound("proj1".to_string());
        assert_eq!(not_found.to_string(), "Project not found: proj1");

        let err_str = not_found.to_string();
        assert_eq!(err_str, "Project not found: proj1");

        let inv = ProjectError::InvalidData("no name".to_string());
        assert_eq!(inv.to_string(), "Invalid project data: no name");
    }

    #[tokio::test]
    async fn test_execute_raw_surql_inner() {
        use surrealdb::engine::local::Mem;
        let db = Surreal::new::<Mem>(()).await.expect("in-memory db");
        db.use_ns("test").use_db("test").await.expect("use ns/db");

        let res = execute_raw_surql_inner(&db, "RETURN 1 + 1;").await.expect("exec raw surql");
        assert_eq!(res, serde_json::json!(2));

        let res_multi = execute_raw_surql_inner(&db, "RETURN 'a'; RETURN 'b';").await.expect("exec raw surql multi");
        assert_eq!(res_multi, serde_json::json!(["a", "b"]));
    }
}
