use super::common::TestWorkspace;

#[test]
fn test_err_001_silent_result_suppression() {
    let ws = TestWorkspace::new();

    ws.write_file(
        "src/silent.rs",
        r#"
        pub fn do_work() {
            let _ = std::fs::write("output.txt", "data");
        }
        "#,
    );

    let violations = ws.scan();
    let err001: Vec<_> = violations.iter().filter(|v| v.rule_id == "ERR-001").collect();
    assert_eq!(err001.len(), 1, "Expected ERR-001 for let _ = result");
}

#[test]
fn test_err_002_panic_in_drop_forbidden() {
    let ws = TestWorkspace::new();

    ws.write_file(
        "src/bad_drop.rs",
        r#"
        pub struct BadResource;
        impl Drop for BadResource {
            fn drop(&mut self) {
                panic!("fatal in drop");
            }
        }
        "#,
    );

    let violations = ws.scan();
    let err002: Vec<_> = violations.iter().filter(|v| v.rule_id == "ERR-002").collect();
    assert_eq!(err002.len(), 1, "Expected ERR-002 for panic in drop");
}

#[test]
fn test_err_003_untyped_string_error_in_public_api() {
    let ws = TestWorkspace::new();

    ws.write_file(
        "src/api.rs",
        r#"
        pub struct ApiService;
        impl ApiService {
            pub fn handle_request(&self) -> Result<u64, String> {
                Ok(123)
            }
        }

        pub fn standalone_api() -> Result<bool, String> {
            Ok(true)
        }
        "#,
    );

    let violations = ws.scan();
    let err003: Vec<_> = violations.iter().filter(|v| v.rule_id == "ERR-003").collect();
    assert_eq!(err003.len(), 2, "Expected 2 ERR-003 violations for Result<T, String>");
}

#[test]
fn test_err_005_library_panic_forbidden() {
    let ws = TestWorkspace::new();

    ws.write_file(
        "src/lib.rs",
        r#"
        pub fn compute_sum(a: i32, b: i32) -> i32 {
            if a < 0 {
                panic!("Negative inputs not supported");
            }
            a + b
        }
        "#,
    );

    let violations = ws.scan();
    let err005: Vec<_> = violations.iter().filter(|v| v.rule_id == "ERR-005").collect();
    assert_eq!(err005.len(), 1, "Expected ERR-005 for panic! in lib.rs");
}
