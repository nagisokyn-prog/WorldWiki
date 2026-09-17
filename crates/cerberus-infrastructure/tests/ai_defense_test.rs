use cerberus_infrastructure::ast::AiDefenseChecker;
use cerberus_domain::BuiltinRuleRegistry;
use syn::parse_file;

#[test]
fn test_ai_defense_unauthorized_allow_detected() {
    let code = r#"
        #[allow(dead_code)]
        pub fn vibe_function() {}

        #[allow(unused_variables)]
        pub struct VibeStruct;
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = AiDefenseChecker::new("src/vibe.rs", "my_crate", &rules, code);
    let violations = checker.check_file(&syntax);

    assert!(violations.iter().any(|v| v.rule_id == "AI-013" && v.symbol == "vibe_function"));
    assert!(violations.iter().any(|v| v.rule_id == "AI-013" && v.symbol == "VibeStruct"));
}

#[test]
fn test_ai_defense_unsafe_without_safety_comment() {
    let bad_code = r#"
        pub fn bad() {
            unsafe {
                let ptr = 0x1234 as *const u8;
                let _ = *ptr;
            }
        }
    "#;
    let syntax = parse_file(bad_code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = AiDefenseChecker::new("src/unsafe.rs", "my_crate", &rules, bad_code);
    let violations = checker.check_file(&syntax);

    assert!(violations.iter().any(|v| v.rule_id == "AI-008"));

    let good_code = r#"
        pub fn good() {
            // SAFETY: Memory pointer is guaranteed valid by hardware memory map
            unsafe {
                let ptr = 0x1234 as *const u8;
            }
        }
    "#;
    let syntax_good = parse_file(good_code).unwrap();
    let checker_good = AiDefenseChecker::new("src/unsafe_good.rs", "my_crate", &rules, good_code);
    let violations_good = checker_good.check_file(&syntax_good);
    assert!(!violations_good.iter().any(|v| v.rule_id == "AI-008"));
}

#[test]
fn test_ai_defense_undated_todo_comment() {
    let code = r#"
        // TODO: refactor this when possible
        pub fn task1() {}

        // TODO(2026-12-01, #42): scheduled deprecation
        pub fn task2() {}

        // FIXME: fix race condition
        pub fn task3() {}
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    let checker = AiDefenseChecker::new("src/todos.rs", "my_crate", &rules, code);
    let violations = checker.check_file(&syntax);

    let todo_violations: Vec<_> = violations.iter().filter(|v| v.rule_id == "AI-009").collect();
    assert_eq!(todo_violations.len(), 2);
}

#[test]
fn test_ai_defense_reflection_probe_outside_infra() {
    let code = r#"
        pub fn probe() {
            let exe = std::env::current_exe().unwrap();
        }
    "#;
    let syntax = parse_file(code).unwrap();
    let rules = BuiltinRuleRegistry::all_rules();
    
    // In domain/application -> Deny
    let checker_domain = AiDefenseChecker::new("crates/domain/src/lib.rs", "domain", &rules, code);
    let violations_domain = checker_domain.check_file(&syntax);
    assert!(violations_domain.iter().any(|v| v.rule_id == "AI-003"));

    // In infrastructure -> Allowed
    let checker_infra = AiDefenseChecker::new("crates/infrastructure/src/lib.rs", "infrastructure", &rules, code);
    let violations_infra = checker_infra.check_file(&syntax);
    assert!(!violations_infra.iter().any(|v| v.rule_id == "AI-003"));
}
