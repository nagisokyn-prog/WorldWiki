use cerberus_domain::Severity;
use cerberus_ports::{SurqlLinterPort, SurqlScanRequest};
use cerberus_surql::{SurqlConfig, SurqlEngine};
use std::fs;
use std::path::Path;
use tempfile::tempdir;

// =========================================================================
// 1. ПОЗИТИВНЫЕ ТЕСТЫ (Clean Code & Complete Valid Schemas -> 0 Violations)
// =========================================================================

#[test]
fn test_clean_valid_schema_has_zero_violations() {
    let clean_surql = r#"
        -- 1. Table Definitions
        DEFINE TABLE OVERWRITE users SCHEMAFULL;
        DEFINE FIELD OVERWRITE name ON users TYPE string;
        DEFINE FIELD OVERWRITE email ON users TYPE option<string | null>;
        DEFINE FIELD OVERWRITE is_active ON users TYPE bool DEFAULT false;
        DEFINE FIELD OVERWRITE is_verified ON users TYPE option<bool>;
        DEFINE FIELD OVERWRITE tags ON users TYPE array<string> DEFAULT [];
        DEFINE FIELD OVERWRITE metadata ON users TYPE object DEFAULT {};
        DEFINE FIELD OVERWRITE created_at ON users TYPE datetime DEFAULT time::now();
        DEFINE INDEX OVERWRITE idx_user_name ON users FIELDS name;
        DEFINE INDEX OVERWRITE idx_user_email_ft ON users FIELDS email FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;

        -- 2. Graph Relation Edges
        DEFINE TABLE OVERWRITE user_follows TYPE RELATION IN users OUT users SCHEMAFULL;
        DEFINE FIELD OVERWRITE in ON user_follows TYPE record<users>;
        DEFINE FIELD OVERWRITE out ON user_follows TYPE record<users>;
        DEFINE FIELD OVERWRITE created_at ON user_follows TYPE datetime DEFAULT time::now();

        -- 3. Stored Functions with Projection, Limit, and Types
        DEFINE FUNCTION OVERWRITE fn::get_user($user_id: record<users>) {
            RETURN (
                SELECT id, name, email FROM users WHERE id = $user_id LIMIT 1
            );
        };

        -- 4. Transactional Multi-Mutation Function
        DEFINE FUNCTION OVERWRITE fn::archive_user($user_id: record<users>) {
            BEGIN TRANSACTION;
            DELETE user_follows WHERE in = $user_id OR out = $user_id;
            UPDATE users SET is_active = false WHERE id = $user_id;
            COMMIT TRANSACTION;
        };

        -- 5. Full-Text Search with Proper Score Ordering
        DEFINE FUNCTION OVERWRITE fn::search_users($query: string) {
            RETURN (
                SELECT id, name, search::score(1) AS score
                FROM users
                WHERE email @1@ $query
                ORDER BY search::score(1) DESC
                LIMIT 20
            );
        };
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine
        .scan_surql_content(clean_surql, Path::new("clean_schema.surql"))
        .unwrap();

    assert!(
        violations.is_empty(),
        "Expected 0 violations for clean schema, found {:#?}",
        violations
    );
}

// =========================================================================
// 2. НЕГАТИВНЫЕ ТЕСТЫ: DDL И ТИПИЗАЦИЯ (SURQL-007 .. SURQL-012)
// =========================================================================

#[test]
fn test_surql_007_schemaless_detection() {
    let surql = "DEFINE TABLE OVERWRITE logs;";
    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();

    assert_eq!(violations.len(), 1);
    assert_eq!(violations[0].rule_id, "SURQL-007");
    assert_eq!(violations[0].severity, Severity::Deny);
}

#[test]
fn test_surql_008_non_idempotent_ddl() {
    let surql = r#"
        DEFINE TABLE users SCHEMAFULL;
        DEFINE FIELD name ON users TYPE string;
        DEFINE INDEX idx_users ON users FIELDS name;
        DEFINE FUNCTION fn::test() { RETURN 1; };
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();

    let v008: Vec<_> = violations.iter().filter(|v| v.rule_id == "SURQL-008").collect();
    assert_eq!(v008.len(), 4);
}

#[test]
fn test_surql_009_nullable_relation_endpoints() {
    let surql = r#"
        DEFINE TABLE OVERWRITE edge TYPE RELATION IN a OUT b SCHEMAFULL;
        DEFINE FIELD OVERWRITE in ON edge TYPE option<record<a> | null>;
        DEFINE FIELD OVERWRITE out ON edge TYPE record<b> | null;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();

    let v009: Vec<_> = violations.iter().filter(|v| v.rule_id == "SURQL-009").collect();
    assert_eq!(v009.len(), 2);
    assert_eq!(v009[0].severity, Severity::Deny);
}

#[test]
fn test_surql_010_three_valued_boolean_hazard() {
    let surql = r#"
        DEFINE TABLE OVERWRITE users SCHEMAFULL;
        DEFINE FIELD OVERWRITE is_active ON users TYPE bool | null;
        DEFINE FIELD OVERWRITE is_admin ON users TYPE option<bool | null>;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();

    let v010: Vec<_> = violations.iter().filter(|v| v.rule_id == "SURQL-010").collect();
    assert_eq!(v010.len(), 2);
}

#[test]
fn test_surql_011_nullable_collection() {
    let surql = r#"
        DEFINE TABLE OVERWRITE users SCHEMAFULL;
        DEFINE FIELD OVERWRITE tags ON users TYPE array<string> | null;
        DEFINE FIELD OVERWRITE attrs ON users TYPE object | null;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();

    let v011: Vec<_> = violations.iter().filter(|v| v.rule_id == "SURQL-011").collect();
    assert_eq!(v011.len(), 2);
}

#[test]
fn test_surql_012_naked_option_json_hazard() {
    let surql = r#"
        DEFINE TABLE OVERWRITE users SCHEMAFULL;
        DEFINE FIELD OVERWRITE bio ON users TYPE option<string>;
        DEFINE FIELD OVERWRITE age ON users TYPE option<int>;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();

    let v012: Vec<_> = violations.iter().filter(|v| v.rule_id == "SURQL-012").collect();
    assert_eq!(v012.len(), 2);
    assert_eq!(v012[0].severity, Severity::Warn);
}

// =========================================================================
// 3. НЕГАТИВНЫЕ ТЕСТЫ: DML, ЗАПРОСЫ И МУТАЦИИ (SURQL-001 .. SURQL-015)
// =========================================================================

#[test]
fn test_surql_001_loop_mutation_in_function() {
    let surql = r#"
        DEFINE FUNCTION OVERWRITE fn::bad_batch($items: array) {
            FOR $item IN $items {
                CREATE item SET val = $item;
            };
        };
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("fn.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-001"));
}

#[test]
fn test_surql_002_and_003_select_star() {
    let ad_hoc = "SELECT * FROM orders;";
    let inside_fn = r#"
        DEFINE FUNCTION OVERWRITE fn::get_orders() {
            RETURN (SELECT * FROM orders);
        };
    "#;

    let engine = SurqlEngine::with_default_config();

    let v_adhoc = engine.scan_surql_content(ad_hoc, Path::new("adhoc.surql")).unwrap();
    assert!(v_adhoc.iter().any(|v| v.rule_id == "SURQL-002" && v.severity == Severity::Warn));

    let v_fn = engine.scan_surql_content(inside_fn, Path::new("fn.surql")).unwrap();
    assert!(v_fn.iter().any(|v| v.rule_id == "SURQL-003" && v.severity == Severity::Deny));
}

#[test]
fn test_surql_004_unbounded_function_select() {
    let surql = r#"
        DEFINE FUNCTION OVERWRITE fn::get_all() {
            RETURN (SELECT id, name FROM users);
        };
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("fn.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-004"));
}

#[test]
fn test_surql_005_subquery_in_projection_n_plus_one() {
    let surql = r#"
        SELECT id, (SELECT id FROM ->orders) AS order_ids FROM users;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("query.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-005"));
}

#[test]
fn test_surql_006_mutation_block_without_transaction() {
    let surql = r#"
        DEFINE FUNCTION OVERWRITE fn::delete_and_relate($u: record<user>, $t: record<target>) {
            DELETE user_rel WHERE in = $u;
            RELATE $u -> user_rel -> $t;
        };
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("fn.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-006"));
}

#[test]
fn test_surql_013_scalar_aggregate_without_group() {
    let surql = r#"
        SELECT math::sum(amount) AS total, math::max(score) AS high FROM transactions;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("query.surql")).unwrap();

    let v013: Vec<_> = violations.iter().filter(|v| v.rule_id == "SURQL-013").collect();
    assert_eq!(v013.len(), 2);
}

#[test]
fn test_surql_014_unbounded_subquery_first_index() {
    let surql = r#"
        LET $first_user = (SELECT name FROM users WHERE active = true)[0];
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("query.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-014"));
}

#[test]
fn test_surql_015_mass_mutation_without_where() {
    let surql = r#"
        UPDATE accounts SET balance = 0;
        DELETE FROM logs;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("query.surql")).unwrap();

    let v015: Vec<_> = violations.iter().filter(|v| v.rule_id == "SURQL-015").collect();
    assert_eq!(v015.len(), 2);
    assert_eq!(v015[0].severity, Severity::Deny);
}

// =========================================================================
// 4. НЕГАТИВНЫЕ ТЕСТЫ: ХРАНИЛИЩЕ, ИНДЕКСЫ И ИСТОРИЯ (SURQL-016 .. 019)
// =========================================================================

#[test]
fn test_surql_016_heavy_type_in_history_table() {
    let surql = r#"
        DEFINE TABLE OVERWRITE item_history SCHEMAFULL;
        DEFINE FIELD OVERWRITE embeddings ON item_history TYPE array<float>;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-016"));
}

#[test]
fn test_surql_017_unindexed_foreign_key() {
    let surql = r#"
        DEFINE TABLE OVERWRITE orders SCHEMAFULL;
        DEFINE FIELD OVERWRITE customer_id ON orders TYPE record<customers>;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-017"));
}

#[test]
fn test_surql_018_unindexed_order_by() {
    let surql = r#"
        DEFINE TABLE OVERWRITE events SCHEMAFULL;
        DEFINE FIELD OVERWRITE timestamp ON events TYPE datetime;

        SELECT id FROM events ORDER BY timestamp;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-018"));
}

#[test]
fn test_surql_019_array_contains_instead_of_edge() {
    let surql = r#"
        SELECT * FROM rooms WHERE participant_ids CONTAINS $user;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("query.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-019"));
}

// =========================================================================
// 5. НЕГАТИВНЫЕ ТЕСТЫ: ФУНКЦИИ И FTS (SURQL-020 .. SURQL-026)
// =========================================================================

#[test]
fn test_surql_020_untyped_function_parameter() {
    let surql = r#"
        DEFINE FUNCTION OVERWRITE fn::add($a, $b: int) {
            RETURN $a + $b;
        };
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("fn.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-020"));
}

#[test]
fn test_surql_021_and_022_fts_scoring_predicates() {
    let unranked_surql = "SELECT * FROM docs WHERE title @1@ 'rust';";
    let dangling_surql = "SELECT *, search::score(2) AS score FROM docs WHERE title @1@ 'rust';";

    let engine = SurqlEngine::with_default_config();

    let v1 = engine.scan_surql_content(unranked_surql, Path::new("q1.surql")).unwrap();
    assert!(v1.iter().any(|v| v.rule_id == "SURQL-021"));

    let v2 = engine.scan_surql_content(dangling_surql, Path::new("q2.surql")).unwrap();
    assert!(v2.iter().any(|v| v.rule_id == "SURQL-022"));
}

#[test]
fn test_surql_023_fts_operator_on_unindexed_field() {
    let surql = r#"
        DEFINE TABLE OVERWRITE articles SCHEMAFULL;
        DEFINE FIELD OVERWRITE body ON articles TYPE string;

        SELECT * FROM articles WHERE body @@ 'database';
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("articles.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-023"));
}

#[test]
fn test_surql_024_linear_scan_on_fts_field() {
    let surql = r#"
        DEFINE TABLE OVERWRITE articles SCHEMAFULL;
        DEFINE FIELD OVERWRITE title ON articles TYPE string;
        DEFINE INDEX OVERWRITE idx_art_title ON articles FIELDS title FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;

        SELECT * FROM articles WHERE string::lowercase(title) CONTAINS 'rust';
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("articles.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-024"));
}

#[test]
fn test_surql_025_multiple_fts_indexes_in_or() {
    let surql = r#"
        SELECT * FROM articles WHERE title @1@ $q OR body @2@ $q;
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("query.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-025"));
}

#[test]
fn test_surql_026_datetime_coerced_to_string() {
    let surql = r#"
        DEFINE TABLE OVERWRITE logs SCHEMAFULL;
        DEFINE FIELD OVERWRITE created_at ON logs TYPE datetime;

        UPDATE logs SET created_at = type::string(time::now());
    "#;

    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("logs.surql")).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "SURQL-026"));
}

// =========================================================================
// 6. FALSE-POSITIVE EDGE CASES (Проверка отсутствия ложных срабатываний)
// =========================================================================

#[test]
fn test_false_positive_scalar_math_abs() {
    let surql = "SELECT math::abs(delta) AS offset FROM stats;";
    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("query.surql")).unwrap();
    assert!(!violations.iter().any(|v| v.rule_id == "SURQL-013"));
}

#[test]
fn test_false_positive_option_bool() {
    let surql = r#"
        DEFINE TABLE OVERWRITE users SCHEMAFULL;
        DEFINE FIELD OVERWRITE is_verified ON users TYPE option<bool>;
    "#;
    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();
    assert!(!violations.iter().any(|v| v.rule_id == "SURQL-010"));
}

#[test]
fn test_false_positive_history_exempt_tables() {
    let surql = r#"
        DEFINE TABLE OVERWRITE user_history_preferences SCHEMAFULL;
        DEFINE FIELD OVERWRITE embeddings ON user_history_preferences TYPE array<float>;
    "#;
    let mut config = SurqlConfig::default();
    config.heavy_data.exempt_tables.push("user_history_preferences".to_string());

    let engine = SurqlEngine::new(config);
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();
    assert!(!violations.iter().any(|v| v.rule_id == "SURQL-016"));
}

#[test]
fn test_false_positive_datetime_string_in_object_field() {
    let surql = r#"
        DEFINE TABLE OVERWRITE logs SCHEMAFULL;
        DEFINE FIELD OVERWRITE metadata ON logs TYPE object;

        UPDATE logs SET metadata = { created_at_str: type::string(time::now()) };
    "#;
    let engine = SurqlEngine::with_default_config();
    let violations = engine.scan_surql_content(surql, Path::new("schema.surql")).unwrap();
    assert!(!violations.iter().any(|v| v.rule_id == "SURQL-026"));
}

// =========================================================================
// 7. RUST INLINE & SEC-011 ИНТЕГРАЦИОННЫЕ ТЕСТЫ
// =========================================================================

#[test]
fn test_rust_inline_scanner_catches_sec011_format_injection() {
    let dir = tempdir().unwrap();
    let rs_file = dir.path().join("repo.rs");
    let rust_code = r#"
        pub async fn find_user(db: &SurrealDb, user_name: &str) -> Result<()> {
            let sql = format!("SELECT * FROM users WHERE name = '{}'", user_name);
            db.query(sql).await?;
            Ok(())
        }
    "#;
    fs::write(&rs_file, rust_code).unwrap();

    let request = SurqlScanRequest {
        surql_files: Vec::new(),
        rust_files: vec![rs_file],
        workspace_root: dir.path().to_path_buf(),
    };

    let engine = SurqlEngine::with_default_config();
    let result = engine.scan(&request).unwrap();

    assert!(result.violations.iter().any(|v| v.rule_id == "SEC-011"));
}

#[test]
fn test_rust_inline_scanner_catches_sec011_concat_injection() {
    let dir = tempdir().unwrap();
    let rs_file = dir.path().join("repo.rs");
    let rust_code = r#"
        pub async fn find_user(db: &SurrealDb, user_name: &str) -> Result<()> {
            db.query("SELECT * FROM users WHERE name = " + user_name).await?;
            Ok(())
        }
    "#;
    fs::write(&rs_file, rust_code).unwrap();

    let request = SurqlScanRequest {
        surql_files: Vec::new(),
        rust_files: vec![rs_file],
        workspace_root: dir.path().to_path_buf(),
    };

    let engine = SurqlEngine::with_default_config();
    let result = engine.scan(&request).unwrap();

    assert!(result.violations.iter().any(|v| v.rule_id == "SEC-011"));
}

#[test]
fn test_rust_inline_scanner_passes_parameterized_queries() {
    let dir = tempdir().unwrap();
    let rs_file = dir.path().join("repo.rs");
    let rust_code = r#"
        pub async fn find_user(db: &SurrealDb, user_id: &str) -> Result<()> {
            db.query("SELECT id, name FROM users WHERE id = $id LIMIT 1")
                .bind(("id", user_id))
                .await?;
            Ok(())
        }
    "#;
    fs::write(&rs_file, rust_code).unwrap();

    let request = SurqlScanRequest {
        surql_files: Vec::new(),
        rust_files: vec![rs_file],
        workspace_root: dir.path().to_path_buf(),
    };

    let engine = SurqlEngine::with_default_config();
    let result = engine.scan(&request).unwrap();

    assert!(
        result.violations.is_empty(),
        "Expected 0 violations for parameterized Rust query, found {:#?}",
        result.violations
    );
}

// =========================================================================
// 8. ДВУХПРОХОДНЫЙ ИНТЕГРАЦИОННЫЙ ТЕСТ МЕЖДУ НЕСКОЛЬКИМИ ФАЙЛАМИ
// =========================================================================

#[test]
fn test_cross_file_schema_and_query_integration() {
    let dir = tempdir().unwrap();
    let f1 = dir.path().join("01_tables.surql");
    let f2 = dir.path().join("02_indexes.surql");
    let f3 = dir.path().join("03_functions.surql");

    fs::write(
        &f1,
        r#"
        DEFINE TABLE OVERWRITE products SCHEMAFULL;
        DEFINE FIELD OVERWRITE title ON products TYPE string;
        DEFINE FIELD OVERWRITE category_id ON products TYPE record<categories>;
    "#,
    )
    .unwrap();

    fs::write(
        &f2,
        r#"
        DEFINE INDEX OVERWRITE idx_prod_cat ON products FIELDS category_id;
        DEFINE INDEX OVERWRITE idx_prod_title_ft ON products FIELDS title FULLTEXT ANALYZER ru_en_analyzer BM25 HIGHLIGHTS;
    "#,
    )
    .unwrap();

    fs::write(
        &f3,
        r#"
        DEFINE FUNCTION OVERWRITE fn::find_product($q: string) {
            RETURN (
                SELECT id, title, search::score(1) AS relevance
                FROM products
                WHERE title @1@ $q
                ORDER BY search::score(1) DESC
                LIMIT 10
            );
        };
    "#,
    )
    .unwrap();

    let request = SurqlScanRequest {
        surql_files: vec![f1, f2, f3],
        rust_files: Vec::new(),
        workspace_root: dir.path().to_path_buf(),
    };

    let engine = SurqlEngine::with_default_config();
    let result = engine.scan(&request).unwrap();

    assert_eq!(
        result.violations.len(),
        0,
        "Expected 0 violations across connected schema files, found: {:#?}",
        result.violations
    );
}
