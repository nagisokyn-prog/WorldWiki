use super::common::TestWorkspace;

#[test]
fn test_conc_002_orphan_tokio_spawn() {
    let ws = TestWorkspace::new();

    // 1. Negative Case: unhandled tokio::spawn
    ws.write_file(
        "src/tasks.rs",
        r#"
        pub fn fire_and_forget() {
            tokio::spawn(async {
                println!("untracked background task");
            });
        }
        "#,
    );

    // 2. Positive Case: bound join handle
    ws.write_file(
        "src/tracked_tasks.rs",
        r#"
        pub fn tracked() -> tokio::task::JoinHandle<()> {
            let handle = tokio::spawn(async {
                println!("tracked task");
            });
            handle
        }
        "#,
    );

    let violations = ws.scan();
    let conc002: Vec<_> = violations.iter().filter(|v| v.rule_id == "CONC-002").collect();
    assert_eq!(conc002.len(), 1, "Expected CONC-002 only for unbounded fire_and_forget");
}

#[test]
fn test_conc_008_static_mut_forbidden() {
    let ws = TestWorkspace::new();

    ws.write_file(
        "src/static_mut.rs",
        r#"
        static mut GLOBAL_COUNTER: u64 = 0;
        "#,
    );

    let violations = ws.scan();
    let conc008: Vec<_> = violations.iter().filter(|v| v.rule_id == "CONC-008").collect();
    assert_eq!(conc008.len(), 1, "Expected CONC-008 for static mut");
}
