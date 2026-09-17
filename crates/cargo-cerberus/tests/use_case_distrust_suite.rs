use cerberus_application::{ScanScope, ScanWorkspaceUseCase, SignSuppressionUseCase};
use cerberus_domain::{BuiltinRuleRegistry, Severity};
use cerberus_infrastructure::{
    MockStorageAdapter, ParallelAstEngineAdapter, RulesJsonRepository, WalkDirScannerAdapter,
};
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tempfile::tempdir;

fn setup_test_rules_repo(temp_dir: &Path) -> Arc<RulesJsonRepository> {
    let rules_file = temp_dir.join(".cerberus").join("rules.json");
    fs::create_dir_all(rules_file.parent().unwrap()).unwrap();
    let mut config = serde_json::json!({
        "version": "2.0",
        "rules": {}
    });
    for rule in BuiltinRuleRegistry::all_rules() {
        config["rules"][&rule.id] = serde_json::Value::String(match rule.severity {
            Severity::Deny => "deny".into(),
            Severity::Warn => "warn".into(),
            Severity::Off => "off".into(),
        });
    }
    fs::write(&rules_file, serde_json::to_string_pretty(&config).unwrap()).unwrap();
    Arc::new(RulesJsonRepository::load_from_file(&rules_file).unwrap())
}

#[test]
fn test_use_case_ai_008_unverified_unsafe_blocks_and_proximity_safety_passes() {
    let temp = tempdir().unwrap();
    let src_dir = temp.path().join("src");
    fs::create_dir_all(&src_dir).unwrap();
    let rules_repo = setup_test_rules_repo(temp.path());

    // 1. Negative Case A: raw unsafe with no comment at all
    let bad_file_a = src_dir.join("bad_a.rs");
    fs::write(&bad_file_a, "pub fn bad_a() { unsafe { let _ = 42; } }\n").unwrap();

    // 2. Negative Case B: safety comment far away at top of file
    let bad_file_b = src_dir.join("bad_b.rs");
    fs::write(
        &bad_file_b,
        "// SAFETY: This comment is at the top of file\n\n\n\n\n\n\npub fn bad_b() {\n    let x = 1;\n    let y = 2;\n    unsafe {\n        let _ = x + y;\n    }\n}\n",
    )
    .unwrap();

    // 3. Positive Case C: safety comment immediately preceding unsafe block
    let good_file = src_dir.join("good.rs");
    fs::write(
        &good_file,
        "pub fn good() {\n    // SAFETY: Invariant verified by memory layout\n    unsafe {\n        let _ = 42;\n    }\n}\n",
    )
    .unwrap();

    let scanner = Arc::new(WalkDirScannerAdapter::new());
    let parsers: Vec<Arc<dyn cerberus_ports::AstParserPort>> =
        vec![Arc::new(cerberus_infrastructure::RustSynParserAdapter)];
    let parser = Arc::new(ParallelAstEngineAdapter::new(parsers));

    let use_case = ScanWorkspaceUseCase::new(scanner, parser, rules_repo, ScanScope::All);
    let result = use_case.execute(temp.path());
    let violations = result.violations;

    let ai008_violations: Vec<_> = violations
        .iter()
        .filter(|v| v.rule_id == "AI-008")
        .collect();
    assert_eq!(
        ai008_violations.len(),
        2,
        "Expected exactly 2 violations for bad_a and bad_b"
    );
    assert!(ai008_violations
        .iter()
        .any(|v| v.file.ends_with("bad_a.rs")));
    assert!(ai008_violations
        .iter()
        .any(|v| v.file.ends_with("bad_b.rs")));
    assert!(!ai008_violations.iter().any(|v| v.file.ends_with("good.rs")));
}

#[test]
fn test_use_case_ai_009_strict_todo_regex_rules() {
    let temp = tempdir().unwrap();
    let src_dir = temp.path().join("src");
    fs::create_dir_all(&src_dir).unwrap();
    let rules_repo = setup_test_rules_repo(temp.path());

    let file = src_dir.join("todos.rs");
    fs::write(
        &file,
        r#"
        // TODO: plain undated todo
        pub fn fn_1() {}

        // TODO(#123): todo without date
        pub fn fn_2() {}

        // FIXME(2026-10-01): fixme without issue
        pub fn fn_3() {}

        // TODO(2026-12-31, #42): valid todo with date and issue
        pub fn fn_4() {}

        // FIXME(2027-01-15, ARCH-001): valid fixme with ticket
        pub fn fn_5() {}
        "#,
    )
    .unwrap();

    let scanner = Arc::new(WalkDirScannerAdapter::new());
    let parsers: Vec<Arc<dyn cerberus_ports::AstParserPort>> =
        vec![Arc::new(cerberus_infrastructure::RustSynParserAdapter)];
    let parser = Arc::new(ParallelAstEngineAdapter::new(parsers));

    let use_case = ScanWorkspaceUseCase::new(scanner, parser, rules_repo, ScanScope::All);
    let result = use_case.execute(temp.path());
    let violations = result.violations;

    let todo_violations: Vec<_> = violations
        .iter()
        .filter(|v| v.rule_id == "AI-009")
        .collect();
    assert_eq!(
        todo_violations.len(),
        3,
        "Expected 3 invalid TODO/FIXME comments to fail"
    );
}

#[test]
fn test_use_case_ai_013_universal_compiler_suppression_and_signed_ledger_pass() {
    let temp = tempdir().unwrap();
    let src_dir = temp.path().join("src");
    fs::create_dir_all(&src_dir).unwrap();
    let rules_repo = setup_test_rules_repo(temp.path());

    let file = src_dir.join("suppressions.rs");
    fs::write(
        &file,
        r#"
        #[allow(dead_code)]
        pub fn unused_func() {}

        #[allow(unused_variables)]
        pub struct UnusedStruct {
            pub x: i32,
        }

        pub struct ImplTarget;
        impl ImplTarget {
            #[allow(clippy::all)]
            pub fn method(&self) {}
        }
        "#,
    )
    .unwrap();

    let scanner = Arc::new(WalkDirScannerAdapter::new());
    let parsers: Vec<Arc<dyn cerberus_ports::AstParserPort>> =
        vec![Arc::new(cerberus_infrastructure::RustSynParserAdapter)];
    let parser = Arc::new(ParallelAstEngineAdapter::new(parsers));
    let storage = MockStorageAdapter::new(vec![1, 2, 3, 4, 5, 6, 7, 8]);

    // 1. Initial scan: 3 unauthorized allow suppressions detected
    let use_case = ScanWorkspaceUseCase::new(scanner, parser, rules_repo, ScanScope::All);
    let initial_violations = use_case.execute(temp.path()).violations;
    let ai013_violations: Vec<_> = initial_violations
        .iter()
        .filter(|v| v.rule_id == "AI-013")
        .collect();
    assert_eq!(
        ai013_violations.len(),
        3,
        "Expected 3 AI-013 violations initially"
    );

    // 2. Authorize suppression for unused_func by signing in ledger
    let target_fp = &ai013_violations[0].fingerprint;
    let expires = chrono::Utc::now() + chrono::Duration::days(30);
    let signature = SignSuppressionUseCase::sign(
        &storage,
        "AI-013",
        target_fp,
        "Temporary allowance during refactoring",
        "lead@worldwiki.org",
        &expires,
    )
    .unwrap();

    let suppression = cerberus_domain::Suppression {
        rule_id: "AI-013".into(),
        fingerprint: target_fp.clone(),
        reason: "Temporary allowance during refactoring".into(),
        author: "lead@worldwiki.org".into(),
        expires,
        signature,
    };

    assert!(SignSuppressionUseCase::verify(&storage, &suppression));
}

#[test]
fn test_use_case_test_005_domain_determinism() {
    let temp = tempdir().unwrap();
    let domain_dir = temp.path().join("domain").join("src");
    let infra_dir = temp.path().join("infrastructure").join("src");
    fs::create_dir_all(&domain_dir).unwrap();
    fs::create_dir_all(&infra_dir).unwrap();
    let rules_repo = setup_test_rules_repo(temp.path());

    // 1. Negative Case: domain calls SystemTime::now() and Uuid::new_v4()
    fs::write(
        domain_dir.join("entity.rs"),
        r#"
        use std::time::SystemTime;

        pub fn create_entity() {
            let _time = SystemTime::now();
            let _id = uuid::Uuid::new_v4();
        }
        "#,
    )
    .unwrap();

    // 2. Positive Case: infrastructure calls SystemTime::now() (allowed)
    fs::write(
        infra_dir.join("clock_adapter.rs"),
        r#"
        use std::time::SystemTime;

        pub fn get_clock() -> SystemTime {
            SystemTime::now()
        }
        "#,
    )
    .unwrap();

    let scanner = Arc::new(WalkDirScannerAdapter::new());
    let parsers: Vec<Arc<dyn cerberus_ports::AstParserPort>> =
        vec![Arc::new(cerberus_infrastructure::RustSynParserAdapter)];
    let parser = Arc::new(ParallelAstEngineAdapter::new(parsers));

    let use_case = ScanWorkspaceUseCase::new(scanner, parser, rules_repo, ScanScope::All);
    let violations = use_case.execute(temp.path()).violations;

    let test005_violations: Vec<_> = violations
        .iter()
        .filter(|v| v.rule_id == "TEST-005")
        .collect();
    assert!(
        !test005_violations.is_empty(),
        "Expected TEST-005 in domain"
    );
    for v in &test005_violations {
        assert!(v.file.to_string_lossy().contains("domain"));
        assert!(!v.file.to_string_lossy().contains("infrastructure"));
    }
}

#[test]
fn test_use_case_err_hygiene_and_concurrency_perf_rules() {
    let temp = tempdir().unwrap();
    let src_dir = temp.path().join("src");
    fs::create_dir_all(&src_dir).unwrap();
    let rules_repo = setup_test_rules_repo(temp.path());

    fs::write(
        src_dir.join("errors_and_concurrency.rs"),
        r#"
        pub struct BadDrop;
        impl Drop for BadDrop {
            fn drop(&mut self) {
                panic!("boom in drop");
            }
        }

        pub struct Service;
        impl Service {
            pub fn untyped_error(&self) -> Result<i32, String> {
                Ok(1)
            }
        }

        pub fn silent_suppression() {
            let _ = std::fs::write("test.txt", "data");
        }

        pub fn orphan_task() {
            tokio::spawn(async {
                println!("orphan");
            });
        }

        pub fn loop_io(items: Vec<String>) {
            for item in items {
                let _ = std::fs::read(&item);
            }
        }
        "#,
    )
    .unwrap();

    let scanner = Arc::new(WalkDirScannerAdapter::new());
    let parsers: Vec<Arc<dyn cerberus_ports::AstParserPort>> =
        vec![Arc::new(cerberus_infrastructure::RustSynParserAdapter)];
    let parser = Arc::new(ParallelAstEngineAdapter::new(parsers));

    let use_case = ScanWorkspaceUseCase::new(scanner, parser, rules_repo, ScanScope::All);
    let violations = use_case.execute(temp.path()).violations;

    assert!(
        violations.iter().any(|v| v.rule_id == "ERR-001"),
        "ERR-001 silent result drop"
    );
    assert!(
        violations.iter().any(|v| v.rule_id == "ERR-002"),
        "ERR-002 panic in drop"
    );
    assert!(
        violations.iter().any(|v| v.rule_id == "ERR-003"),
        "ERR-003 Result<T, String>"
    );
    assert!(
        violations.iter().any(|v| v.rule_id == "CONC-002"),
        "CONC-002 orphan tokio spawn"
    );
    assert!(
        violations.iter().any(|v| v.rule_id == "PERF-011"),
        "PERF-011 I/O in loop"
    );
}
