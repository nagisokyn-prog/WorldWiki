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

    #[tokio::test]
    async fn test_save_project_config_multiple_renames() {
        use surrealdb::engine::local::Mem;
        let db = Surreal::new::<Mem>(()).await.expect("in-memory db");
        db.use_ns("test").use_db("test").await.expect("use ns/db");

        db.query(r#"
            DEFINE TABLE OVERWRITE projects SCHEMAFULL;
            DEFINE FIELD OVERWRITE name        ON projects TYPE string;
            DEFINE FIELD OVERWRITE type        ON projects TYPE option<string | null>;
            DEFINE FIELD OVERWRITE genres      ON projects TYPE array<string> DEFAULT [] VALUE IF $value = NONE OR $value = NULL THEN [] ELSE $value END;
            DEFINE FIELD OVERWRITE cover_image ON projects TYPE option<string | null>;
            DEFINE FIELD OVERWRITE created_at  ON projects TYPE option<datetime | null> DEFAULT time::now();

            DEFINE FUNCTION OVERWRITE fn::normalize_project_id($p: any) {
                LET $str = type::string($p);
                LET $clean = string::replace(string::replace(string::replace(string::replace(string::replace($str, 'projects:', ''), '⟨', ''), '⟩', ''), '`', ''), '\\', '');
                RETURN type::record('projects', $clean);
            };
        "#).await.expect("schema").check().expect("check");

        // 1. Create project "Original Name"
        let _ = create_project_inner(&db, serde_json::json!({
            "name": "Original Name",
            "type": "novel",
            "genres": ["Фэнтези"]
        })).await.expect("create");

        // 2. Rename from "Original Name" to "Rename 1"
        save_project_config_inner(&db, "Original Name", serde_json::json!({
            "name": "Rename 1",
            "type": "Манга",
            "genres": ["Фэнтези", "Приключения"]
        })).await.expect("rename 1");

        // 3. Rename from "Rename 1" to "Rename 2" (second rename!)
        save_project_config_inner(&db, "Rename 1", serde_json::json!({
            "name": "Rename 2",
            "type": "Манга",
            "genres": ["Фэнтези", "Приключения", "Драма"]
        })).await.expect("rename 2");

        // Verify that the record now has name "Rename 2" and all genres
        let mut check_res = db.query("SELECT id, name, type, genres, cover_image, created_at FROM projects LIMIT 1;").await.expect("query");
        let project_val: Option<serde_json::Value> = check_res.take(0).expect("take");
        assert!(project_val.is_some());
        let p = project_val.unwrap();
        assert_eq!(p.get("name").and_then(|v| v.as_str()), Some("Rename 2"));
        assert_eq!(p.get("type").and_then(|v| v.as_str()), Some("Манга"));
    }
}
