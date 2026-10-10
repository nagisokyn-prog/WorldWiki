use cerberus_domain::BuiltinRuleRegistry;
use cerberus_infrastructure::{ErrorRulesChecker, FeErrorRulesChecker};
use std::path::Path;
use syn::parse_file;

#[test]
fn test_err_001_wildcard_let_detected() {
    let code = r#"
        pub fn save_data() {
            let _ = file.write(&buf);
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/storage.rs", "worldwiki-infrastructure", &rules);
    let violations = checker.check_file(&syntax);

    assert!(violations.iter().any(|v| v.rule_id == "ERR-001"));
}

#[test]
fn test_err_002_drop_panic_detected() {
    let code = r#"
        struct Guard;
        impl Drop for Guard {
            fn drop(&mut self) {
                panic!("failed cleanup");
            }
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/guard.rs", "worldwiki-infrastructure", &rules);
    let violations = checker.check_file(&syntax);

    assert!(violations.iter().any(|v| v.rule_id == "ERR-002"));
}

#[test]
fn test_err_003_untyped_result_detected() {
    let code = r#"
        pub fn load_profile() -> Result<Profile, String> {
            Ok(Profile::default())
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/profile.rs", "worldwiki-domain", &rules);
    let violations = checker.check_file(&syntax);

    assert!(violations.iter().any(|v| v.rule_id == "ERR-003"));
}

#[test]
fn test_sdb_009_surrealdb_take_unwrap_or_default_detected() {
    let code = r#"
        pub async fn get_entities() -> Vec<Entity> {
            let mut res = db.query("SELECT * FROM entity").await?;
            res.take(0).unwrap_or_default()
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/reader.rs", "worldwiki-infrastructure", &rules);
    let violations = checker.check_file(&syntax);

    assert!(violations.iter().any(|v| v.rule_id == "SDB-009"));
}

#[test]
fn test_err_004_result_unwrap_or_default_detected() {
    let code = r#"
        pub fn fetch_data() -> Vec<String> {
            let rows = query.execute().unwrap_or_default();
            rows
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/service.rs", "worldwiki-application", &rules);
    let violations = checker.check_file(&syntax);

    assert!(violations.iter().any(|v| v.rule_id == "ERR-004"));
}

#[test]
fn test_err_006_lossy_ok_detected() {
    let code = r#"
        pub async fn read_record() -> Option<Record> {
            let res = db.read("records:1").await.ok()?;
            Some(res)
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/repo.rs", "worldwiki-infrastructure", &rules);
    let violations = checker.check_file(&syntax);

    assert!(violations.iter().any(|v| v.rule_id == "ERR-006"));
}

#[test]
fn test_err_007_impl_from_for_string_detected_in_tauri() {
    let code = r#"
        pub enum IpcError {
            NotFound,
        }
        impl From<IpcError> for String {
            fn from(err: IpcError) -> String {
                "error".to_string()
            }
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/adapters/tauri/commands.rs", "worldwiki-adapters", &rules);
    let violations = checker.check_file(&syntax);

    assert!(violations.iter().any(|v| v.rule_id == "ERR-007"));
}

#[test]
fn test_fe_err_001_empty_catch_block() {
    let code = r#"
        try {
            doSomething();
        } catch {
        }
    "#;
    let path = Path::new("apps/spa/src/features/notes/useNotes.ts");
    let violations = FeErrorRulesChecker::check_source(code, path);
    assert!(violations.iter().any(|v| v.rule_id == "FE-ERR-001"));
}

#[test]
fn test_fe_err_002_silent_mutation_catch() {
    let code = r#"
        export async function createChapter(title: string) {
            try {
                await api.createChapter(title);
            } catch (e) {
                deps.addLog(e, 'error');
            }
        }
    "#;
    let path = Path::new("apps/spa/src/stores/manuscript/shell.manuscript.ts");
    let violations = FeErrorRulesChecker::check_source(code, path);
    assert!(violations.iter().any(|v| v.rule_id == "FE-ERR-002"));
}

#[test]
fn test_fe_err_003_raw_project_id_interpolation() {
    let code = r#"
        const id = `projects:${props.project}`;
    "#;
    let path = Path::new("apps/spa/src/features/calendar/useCalendar.ts");
    let violations = FeErrorRulesChecker::check_source(code, path);
    assert!(violations.iter().any(|v| v.rule_id == "FE-ERR-003"));
}

#[test]
fn test_fe_err_004_catch_as_any() {
    let code = r#"
        try {
            save();
        } catch (e) {
            console.error((e as any).message);
        }
    "#;
    let path = Path::new("apps/spa/src/features/entity/useEntity.ts");
    let violations = FeErrorRulesChecker::check_source(code, path);
    assert!(violations.iter().any(|v| v.rule_id == "FE-ERR-004"));
}

#[test]
fn test_exact_lines_symbols_and_deduplication() {
    let code = r#"
        pub fn process_order() {
            let mut res = db.query("SELECT *").await?;
            let items: Vec<Item> = res.take(0).unwrap_or_default();
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/order.rs", "worldwiki-application", &rules);
    let violations = checker.check_file(&syntax);

    // 1. SDB-009 is detected
    let sdb_v = violations.iter().find(|v| v.rule_id == "SDB-009").expect("SDB-009 must be detected");
    // 2. Line number must be real (> 1, specifically line 4)
    assert!(sdb_v.line > 1, "Line must be accurate (> 1), got {}", sdb_v.line);
    // 3. Symbol must be the function name
    assert_eq!(sdb_v.symbol, "process_order");
    // 4. ERR-004 must NOT duplicate SDB-009
    assert!(!violations.iter().any(|v| v.rule_id == "ERR-004"), "ERR-004 must not duplicate SDB-009 on take()");
}

#[test]
fn test_conc_010_poison_swallowing_detected() {
    let code = r#"
        pub fn get_states(&self) -> HashMap<String, String> {
            self.states.lock().unwrap_or_default()
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/manager.rs", "worldwiki-infrastructure", &rules);
    let violations = checker.check_file(&syntax);

    let conc_v = violations.iter().find(|v| v.rule_id == "CONC-010").expect("CONC-010 must be detected");
    assert_eq!(conc_v.symbol, "get_states");
    assert!(conc_v.line > 1);
    assert!(!violations.iter().any(|v| v.rule_id == "ERR-004"), "ERR-004 must not trigger on lock()");
}

#[test]
fn test_fingerprint_uniqueness_across_locations() {
    let code1 = r#"
        pub fn handler_one() {
            let _ = file.write(&buf);
        }
    "#;
    let code2 = r#"
        pub fn handler_two() {
            let _ = file.write(&buf);
        }
    "#;
    let syntax1 = parse_file(code1).unwrap();
    let syntax2 = parse_file(code2).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker1 = ErrorRulesChecker::new("src/one.rs", "crate", &rules);
    let checker2 = ErrorRulesChecker::new("src/two.rs", "crate", &rules);

    let v1 = checker1.check_file(&syntax1);
    let v2 = checker2.check_file(&syntax2);

    assert_ne!(
        v1[0].fingerprint, v2[0].fingerprint,
        "Fingerprints must be unique across different files/symbols even with identical code snippets!"
    );
}

#[test]
fn test_rwlock_read_and_write_routed_to_conc_010() {
    let code = r#"
        pub fn get_permissions(&self) -> Vec<String> {
            let m = self.user_permissions.read().map(|m| m.clone()).unwrap_or_default();
            m
        }

        pub fn reset_lock(&self) {
            self.rwlock.write().unwrap_or_default();
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/permissions.rs", "worldwiki-infrastructure", &rules);
    let violations = checker.check_file(&syntax);

    // Both should trigger CONC-010
    let conc_violations: Vec<_> = violations.iter().filter(|v| v.rule_id == "CONC-010").collect();
    assert_eq!(conc_violations.len(), 2, "Both .read() and .write() on locks must trigger CONC-010");

    // Neither should trigger ERR-004
    assert!(
        !violations.iter().any(|v| v.rule_id == "ERR-004"),
        "ERR-004 must not trigger on in-memory lock .read() or .write()"
    );
}

#[test]
fn test_compile_time_constant_from_str_not_flagged() {
    let code = r#"
        const BUILTIN_THEME: &str = "{\"mode\": \"dark\"}";
        static STATIC_CONFIG: &str = "{}";

        pub fn load_builtin() -> Value {
            let v1 = serde_json::from_str(BUILTIN_THEME).unwrap_or(Value::Null);
            let v2 = serde_json::from_str(DEFAULT_CONFIG).unwrap_or(Value::Null);
            let v3 = serde_json::from_str(include_str!("theme.json")).unwrap_or_default();
            let v4 = serde_json::from_str("{\"inline\": 1}").unwrap_or_default();
            let v5 = serde_json::from_str(STATIC_CONFIG).unwrap_or(Value::Null);
            let v6 = serde_json::from_slice(STATIC_BYTES).unwrap_or_default();
            let v7 = serde_json::from_str(BUILTIN_THEME).map(|v| v).unwrap_or(Value::Null);
            v1
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/theme.rs", "worldwiki-infrastructure", &rules);
    let violations = checker.check_file(&syntax);

    // Compile-time constants must not be flagged by ERR-004
    assert!(
        !violations.iter().any(|v| v.rule_id == "ERR-004"),
        "Compile-time constants in from_str must not trigger ERR-004, got: {:?}",
        violations.iter().filter(|v| v.rule_id == "ERR-004").collect::<Vec<_>>()
    );
}

#[test]
fn test_observability_barrier_unwrap_or_else_not_flagged() {
    let code = r#"
        pub fn load_dynamic_with_logging(content: &str) -> Value {
            serde_json::from_str(content).unwrap_or_else(|err| {
                tracing::warn!("Failed to parse JSON: {err}");
                Value::Null
            })
        }

        pub fn load_with_log_error(content: &str) -> Value {
            serde_json::from_str(content).unwrap_or_else(|err| {
                log::error!("Error reading configuration: {err}");
                Value::Null
            })
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/theme.rs", "worldwiki-infrastructure", &rules);
    let violations = checker.check_file(&syntax);

    assert!(
        !violations.iter().any(|v| v.rule_id == "ERR-004"),
        "unwrap_or_else with logging must not trigger ERR-004"
    );
}

#[test]
fn test_dynamic_unlogged_from_str_flagged_as_err_004() {
    let code = r#"
        pub fn load_corrupted(content: &str) -> Value {
            serde_json::from_str(content).unwrap_or(Value::Null)
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/theme.rs", "worldwiki-infrastructure", &rules);
    let violations = checker.check_file(&syntax);

    assert!(
        violations.iter().any(|v| v.rule_id == "ERR-004"),
        "Dynamic untrusted from_str without logging MUST trigger ERR-004"
    );
}

