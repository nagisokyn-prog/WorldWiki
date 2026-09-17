use super::common::TestWorkspace;
use cerberus_application::SignSuppressionUseCase;
use cerberus_infrastructure::MockStorageAdapter;
use std::sync::Arc;

#[test]
fn test_ai_008_unverified_unsafe_blocks_and_proximity_safety_passes() {
    let ws = TestWorkspace::new();

    // 1. Negative Case A: raw unsafe with no comment at all
    ws.write_file("src/bad_a.rs", "pub fn bad_a() { unsafe { let _ = 42; } }\n");

    // 2. Negative Case B: safety comment far away at top of file (> 3 lines above)
    ws.write_file(
        "src/bad_b.rs",
        r#"// SAFETY: This comment is at the top of file






pub fn bad_b() {
    let x = 1;
    let y = 2;
    unsafe {
        let _ = x + y;
    }
}
"#,
    );

    // 3. Positive Case C: safety comment immediately preceding unsafe block
    ws.write_file(
        "src/good.rs",
        r#"
pub fn good() {
    // SAFETY: Invariant verified by memory layout
    unsafe {
        let _ = 42;
    }
}
"#,
    );

    let violations = ws.scan();
    let ai008_violations: Vec<_> = violations.iter().filter(|v| v.rule_id == "AI-008").collect();
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
fn test_ai_009_strict_todo_regex_rules() {
    let ws = TestWorkspace::new();

    ws.write_file(
        "src/todos.rs",
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
    );

    let violations = ws.scan();
    let todo_violations: Vec<_> = violations.iter().filter(|v| v.rule_id == "AI-009").collect();
    assert_eq!(
        todo_violations.len(),
        3,
        "Expected 3 invalid TODO/FIXME comments to fail"
    );
}

#[test]
fn test_ai_013_universal_compiler_suppression_and_signed_ledger_pass() {
    let ws = TestWorkspace::new();

    ws.write_file(
        "src/suppressions.rs",
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
    );

    // 1. Initial scan: 3 unauthorized allow suppressions detected
    let initial_violations = ws.scan();
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
    let storage = Arc::new(MockStorageAdapter::new());
    let target_fp = &ai013_violations[0].fingerprint;
    let expires = chrono::Utc::now() + chrono::Duration::days(30);
    SignSuppressionUseCase::sign(
        storage.as_ref(),
        "AI-013",
        target_fp,
        "Temporary allowance during refactoring",
        "lead@worldwiki.org",
        &expires,
    )
    .unwrap();

    // Verify storage has suppression record
    let record = storage.find_suppression(target_fp).unwrap();
    assert!(record.is_some());
    let record = record.unwrap();
    assert_eq!(record.rule_id, "AI-013");
    assert_eq!(record.approved_by, "lead@worldwiki.org");
}
