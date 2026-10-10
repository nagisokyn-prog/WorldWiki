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
