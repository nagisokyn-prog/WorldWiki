use cerberus_infrastructure::ast::{
    ConcurrencyRulesChecker, ErrorRulesChecker, RustPerfChecker, TestabilityChecker,
};
use cerberus_domain::{BuiltinRuleRegistry, Violation};
use syn::parse_file;

fn has_rule(violations: &[Violation], rule_id: &str) -> bool {
    for v in violations {
        if v.rule_id == rule_id {
            return true;
        }
    }
    false
}

#[test]
fn test_testability_deterministic_domain_rules() {
    let domain_code = r#"
        pub fn calculate_score() {
            let now = std::time::SystemTime::now();
            let id = uuid::Uuid::new_v4();
        }
    "#;
    let syntax = parse_file(domain_code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = TestabilityChecker::new("crates/domain/src/score.rs", "domain", &rules);
    let violations = checker.check_file(&syntax);

    assert!(has_rule(&violations, "TEST-005"));

    // Check outside domain
    let checker_infra = TestabilityChecker::new("crates/infrastructure/src/score.rs", "infrastructure", &rules);
    let violations_infra = checker_infra.check_file(&syntax);
    assert!(!has_rule(&violations_infra, "TEST-005"));
}

#[test]
fn test_testability_mutable_global_state() {
    let code = r#"
        static GLOBAL_LOCK: std::sync::Mutex<i32> = std::sync::Mutex::new(0);
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = TestabilityChecker::new("src/state.rs", "app", &rules);
    let violations = checker.check_file(&syntax);

    assert!(has_rule(&violations, "TEST-002"));
}

#[test]
fn test_error_rules_hygiene() {
    let code = r#"
        pub struct Resource;
        impl Drop for Resource {
            fn drop(&mut self) {
                panic!("boom in drop");
            }
        }

        pub fn do_io() {
            let _ = std::fs::write("file.txt", "data");
        }

        pub fn bad_pub_api() -> Result<i32, String> {
            Ok(42)
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ErrorRulesChecker::new("src/lib.rs", "my_lib", &rules);
    let violations = checker.check_file(&syntax);

    assert!(has_rule(&violations, "ERR-001"));
    assert!(has_rule(&violations, "ERR-002"));
    assert!(has_rule(&violations, "ERR-003"));
}

#[test]
fn test_concurrency_and_static_mut_rules() {
    let code = r#"
        static mut COUNTER: u32 = 0;

        pub fn spawn_orphan() {
            tokio::spawn(async {
                println!("orphan task");
            });
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = ConcurrencyRulesChecker::new("src/async_tasks.rs", &rules);
    let violations = checker.check_file(&syntax);

    assert!(has_rule(&violations, "CONC-008"));
    assert!(has_rule(&violations, "CONC-002"));
}

#[test]
fn test_rust_performance_rules() {
    let code = r#"
        pub struct DropResource;
        impl Drop for DropResource {
            fn drop(&mut self) {
                std::fs::write("log.txt", "closed").unwrap();
            }
        }

        pub fn process_items(items: Vec<String>) {
            let (tx, _rx) = tokio::sync::mpsc::unbounded_channel::<i32>();
            for item in items {
                let _ = std::fs::read(&item);
            }
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = RustPerfChecker::new("src/perf.rs", &rules);
    let violations = checker.check_file(&syntax);

    assert!(has_rule(&violations, "PERF-006"));
    assert!(has_rule(&violations, "PERF-011"));
    assert!(has_rule(&violations, "PERF-012"));
}
