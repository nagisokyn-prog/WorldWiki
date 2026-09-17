use super::common::TestWorkspace;

#[test]
fn test_test_005_domain_clock_and_entropy_forbidden() {
    let ws = TestWorkspace::new();

    // 1. Negative Case: domain calls SystemTime::now() and Uuid::new_v4()
    ws.write_file(
        "domain/src/entity.rs",
        r#"
        use std::time::SystemTime;

        pub fn create_entity() {
            let _time = SystemTime::now();
            let _id = uuid::Uuid::new_v4();
        }
        "#,
    );

    // 2. Positive Case: infrastructure calls SystemTime::now() (allowed)
    ws.write_file(
        "infrastructure/src/clock_adapter.rs",
        r#"
        use std::time::SystemTime;

        pub fn get_clock() -> SystemTime {
            SystemTime::now()
        }
        "#,
    );

    let violations = ws.scan();
    let test005_violations: Vec<_> = violations
        .iter()
        .filter(|v| v.rule_id == "TEST-005")
        .collect();

    assert!(
        !test005_violations.is_empty(),
        "Expected TEST-005 violation in domain crate"
    );
    for v in &test005_violations {
        assert!(
            v.file.to_string_lossy().contains("domain"),
            "Violation must point to domain file"
        );
        assert!(
            !v.file.to_string_lossy().contains("infrastructure"),
            "Infrastructure must NOT trigger TEST-005"
        );
    }
}

#[test]
fn test_test_002_mutable_global_static_lock_forbidden() {
    let ws = TestWorkspace::new();

    // Negative Case: mutable global static state
    ws.write_file(
        "src/globals.rs",
        r#"
        use std::sync::Mutex;
        static GLOBAL_STATE: Mutex<Vec<i32>> = Mutex::new(Vec::new());
        "#,
    );

    let violations = ws.scan();
    let test002_violations: Vec<_> = violations
        .iter()
        .filter(|v| v.rule_id == "TEST-002")
        .collect();

    assert_eq!(
        test002_violations.len(),
        1,
        "Expected TEST-002 violation for global static Mutex"
    );
}

#[test]
fn test_test_003_direct_adapter_instantiation_in_application() {
    let ws = TestWorkspace::new();

    // Negative Case: application directly instantiates concrete adapter
    ws.write_file(
        "application/src/service.rs",
        r#"
        pub struct Service;
        impl Service {
            pub fn new() -> Self {
                let _storage = SqlStorageAdapter::new();
                Self
            }
        }
        "#,
    );

    let violations = ws.scan();
    let test003_violations: Vec<_> = violations
        .iter()
        .filter(|v| v.rule_id == "TEST-003")
        .collect();

    assert_eq!(
        test003_violations.len(),
        1,
        "Expected TEST-003 violation for direct adapter instantiation"
    );
}
