use cerberus_domain::CerberusConfig;
use cerberus_infrastructure::SurqlAstParserAdapter;
use cerberus_ports::AstParserPort;
use std::fs;
use std::io::Write;
use std::path::Path;
use tempfile::NamedTempFile;

#[test]
fn test_surql_integration_modular_schema_sibling_indexes() {
    let temp_dir = tempfile::tempdir().unwrap();
    let tables_path = temp_dir.path().join("01_tables.surql");
    let indexes_path = temp_dir.path().join("02_indexes.surql");

    fs::write(
        &tables_path,
        "DEFINE TABLE OVERWRITE orders TYPE NORMAL SCHEMAFULL;\nDEFINE FIELD OVERWRITE user_id ON TABLE orders TYPE record<user>;\n",
    ).unwrap();

    fs::write(
        &indexes_path,
        "DEFINE INDEX OVERWRITE idx_orders_user ON TABLE orders FIELDS user_id;\n",
    ).unwrap();

    let adapter = SurqlAstParserAdapter::new();
    let violations = adapter.parse_file(&tables_path, "test_crate").unwrap();
    assert!(violations.is_empty());

    fs::remove_file(&indexes_path).unwrap();
    let violations_without_idx = adapter.parse_file(&tables_path, "test_crate").unwrap();
    assert!(!violations_without_idx.is_empty());
    assert!(violations_without_idx.iter().any(|v| v.rule_id == "SURQL-017"));
}

#[test]
fn test_surql_integration_unreadable_sibling_surql() {
    let temp_dir = tempfile::tempdir().unwrap();
    let tables_path = temp_dir.path().join("01_tables.surql");
    let unreadable_sibling = temp_dir.path().join("directory_sibling.surql");
    fs::create_dir(&unreadable_sibling).unwrap();

    fs::write(
        &tables_path,
        "DEFINE TABLE OVERWRITE user TYPE NORMAL SCHEMAFULL;\nDEFINE FIELD OVERWRITE name ON TABLE user TYPE string;\n",
    ).unwrap();

    let adapter = SurqlAstParserAdapter::new();
    let violations = adapter.parse_file(&tables_path, "test_crate").unwrap();
    assert!(violations.is_empty());
}

#[test]
fn test_surql_integration_parent_edge_cases() {
    let adapter = SurqlAstParserAdapter::new();

    let no_parent_res = adapter.parse_file(Path::new(""), "test_crate");
    assert!(no_parent_res.is_err());

    let mut temp = NamedTempFile::new().unwrap();
    writeln!(temp, "DEFINE TABLE OVERWRITE user TYPE NORMAL SCHEMAFULL;\nDEFINE FIELD OVERWRITE name ON TABLE user TYPE string;").unwrap();
    let violations = adapter.parse_file(temp.path(), "test_crate").unwrap();
    assert!(violations.is_empty());
}

#[test]
fn test_surql_integration_bidirectional_subfolder_discovery() {
    let temp_dir = tempfile::tempdir().unwrap();
    let tables_path = temp_dir.path().join("01_tables.surql");
    let indexes_path = temp_dir.path().join("02_indexes.surql");
    let functions_dir = temp_dir.path().join("functions");
    fs::create_dir(&functions_dir).unwrap();
    let fn_path = functions_dir.join("01_analytics.surql");

    fs::write(
        &tables_path,
        "DEFINE TABLE OVERWRITE orders TYPE NORMAL SCHEMAFULL;\nDEFINE FIELD OVERWRITE user_id ON TABLE orders TYPE record<user>;\n",
    ).unwrap();

    fs::write(
        &indexes_path,
        "DEFINE INDEX OVERWRITE idx_orders_user ON TABLE orders FIELDS user_id;\n",
    ).unwrap();

    fs::write(
        &fn_path,
        "DEFINE FUNCTION OVERWRITE fn::get_orders() {\n    RETURN (SELECT id, user_id FROM orders LIMIT 10);\n};\n",
    ).unwrap();

    let adapter = SurqlAstParserAdapter::new();
    let fn_violations = adapter.parse_file(&fn_path, "test_crate").unwrap();
    assert!(fn_violations.is_empty());

    let tables_violations = adapter.parse_file(&tables_path, "test_crate").unwrap();
    assert!(tables_violations.is_empty());
}

#[test]
fn test_surql_integration_cross_references_rust_and_ts_calls() {
    let temp_dir = tempfile::tempdir().unwrap();
    let ws_root = temp_dir.path();
    fs::write(ws_root.join("package.json"), "{}").unwrap();

    let schema_dir = ws_root.join("apps").join("spa").join("src").join("logic").join("schema");
    fs::create_dir_all(&schema_dir).unwrap();
    let fn_file = schema_dir.join("01_users.surql");
    fs::write(
        &fn_file,
        "DEFINE FUNCTION OVERWRITE fn::fetch_users() { RETURN []; };\nDEFINE FUNCTION OVERWRITE fn::unused_fn() { RETURN 1; };\n",
    ).unwrap();

    let rust_dir = ws_root.join("src-tauri").join("src").join("logic");
    fs::create_dir_all(&rust_dir).unwrap();
    fs::write(
        rust_dir.join("users.rs"),
        r#"
        pub async fn get_users() {
            let _ = "RETURN fn::fetch_users();";
        }
        "#,
    ).unwrap();

    let adapter = SurqlAstParserAdapter::new();
    let violations = adapter.parse_file(&fn_file, "test_crate").unwrap();

    let fetch_users_orphan = violations.iter().any(|v| v.rule_id == "SURQL-027" && v.symbol == "fn::fetch_users");
    assert!(!fetch_users_orphan);

    let unused_orphan = violations.iter().any(|v| v.rule_id == "SURQL-027" && v.symbol == "fn::unused_fn");
    assert!(unused_orphan);
}

#[test]
fn test_surql_integration_workspace_cargo_toml_discovery() {
    let temp_dir = tempfile::tempdir().unwrap();
    let ws_root = temp_dir.path();
    fs::write(ws_root.join("Cargo.toml"), "[workspace]\nmembers = [\"service\"]\n").unwrap();

    let schema_dir = ws_root.join("sub_module").join("schema");
    fs::create_dir_all(&schema_dir).unwrap();
    let fn_file = schema_dir.join("calc.surql");
    fs::write(
        &fn_file,
        "DEFINE FUNCTION OVERWRITE fn::calculate_score() { RETURN 100; };\n",
    ).unwrap();

    let rust_dir = ws_root.join("src");
    fs::create_dir_all(&rust_dir).unwrap();
    fs::write(
        rust_dir.join("lib.rs"),
        r#"
        pub fn run() {
            let _ = "RETURN fn::calculate_score();";
        }
        "#,
    ).unwrap();

    let adapter = SurqlAstParserAdapter::new();
    let violations = adapter.parse_file(&fn_file, "test_crate").unwrap();
    let is_orphaned = violations.iter().any(|v| v.rule_id == "SURQL-027" && v.symbol == "fn::calculate_score");
    assert!(!is_orphaned);
}

#[test]
fn test_surql_integration_flat_root_scan_roots_fallback() {
    let temp_dir = tempfile::tempdir().unwrap();
    let ws_root = temp_dir.path();
    fs::write(ws_root.join("cerberus.json"), "{}").unwrap();

    let custom_dir = ws_root.join("custom_service");
    fs::create_dir_all(&custom_dir).unwrap();

    let fn_file = custom_dir.join("logic.surql");
    fs::write(
        &fn_file,
        "DEFINE FUNCTION OVERWRITE fn::custom_ping() { RETURN 'pong'; };\n",
    ).unwrap();

    fs::write(
        custom_dir.join("handler.rs"),
        r#"
        pub fn handle() {
            let _ = "fn::custom_ping()";
        }
        "#,
    ).unwrap();

    let adapter = SurqlAstParserAdapter::new();
    let violations = adapter.parse_file(&fn_file, "test_crate").unwrap();
    let is_orphaned = violations.iter().any(|v| v.rule_id == "SURQL-027" && v.symbol == "fn::custom_ping");
    assert!(!is_orphaned);
}

#[test]
fn test_surql_integration_with_cerberus_config_layers() {
    use std::collections::HashMap;
    let temp_dir = tempfile::tempdir().unwrap();
    let ws_root = temp_dir.path();

    let mut layers = HashMap::new();
    layers.insert(
        "custom_backend".to_string(),
        cerberus_domain::LayerRule {
            patterns: vec!["**/custom_api/**".to_string()],
            ..Default::default()
        },
    );

    let cerberus_cfg = CerberusConfig {
        layers,
        ignore: vec!["ignore_me.rs".to_string()],
        ..Default::default()
    };

    let custom_api_dir = ws_root.join("custom_api");
    fs::create_dir_all(&custom_api_dir).unwrap();
    fs::write(
        custom_api_dir.join("query.rs"),
        r#"
        pub fn run() {
            let _ = "fn::compute_total()";
        }
        "#,
    ).unwrap();

    let schema_dir = ws_root.join("schema");
    fs::create_dir_all(&schema_dir).unwrap();
    let fn_file = schema_dir.join("logic.surql");
    fs::write(
        &fn_file,
        "DEFINE FUNCTION OVERWRITE fn::compute_total() { RETURN 42; };\n",
    ).unwrap();

    let adapter = SurqlAstParserAdapter::new().with_cerberus_config(
        Some(cerberus_cfg),
        Some(ws_root.to_path_buf()),
    );

    let violations = adapter.parse_file(&fn_file, "test_crate").unwrap();
    let is_orphaned = violations.iter().any(|v| v.rule_id == "SURQL-027" && v.symbol == "fn::compute_total");
    assert!(!is_orphaned);
}
