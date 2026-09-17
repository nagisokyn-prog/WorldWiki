use super::common::TestWorkspace;

#[test]
fn test_perf_011_io_inside_loop() {
    let ws = TestWorkspace::new();

    ws.write_file(
        "src/batch_io.rs",
        r#"
        pub fn load_all(paths: Vec<String>) {
            for p in paths {
                let _ = std::fs::read(&p);
            }
        }
        "#,
    );

    let violations = ws.scan();
    let perf011: Vec<_> = violations.iter().filter(|v| v.rule_id == "PERF-011").collect();
    assert_eq!(perf011.len(), 1, "Expected PERF-011 for I/O in for-loop");
}

#[test]
fn test_perf_012_unbounded_channel() {
    let ws = TestWorkspace::new();

    ws.write_file(
        "src/stream.rs",
        r#"
        pub fn create_stream() {
            let (_tx, _rx) = tokio::sync::mpsc::unbounded_channel::<i32>();
        }
        "#,
    );

    let violations = ws.scan();
    let perf012: Vec<_> = violations.iter().filter(|v| v.rule_id == "PERF-012").collect();
    assert_eq!(perf012.len(), 1, "Expected PERF-012 for unbounded channel");
}

#[test]
fn test_perf_006_blocking_io_in_drop() {
    let ws = TestWorkspace::new();

    ws.write_file(
        "src/drop_flush.rs",
        r#"
        pub struct FlushOnDrop;
        impl Drop for FlushOnDrop {
            fn drop(&mut self) {
                let _ = std::fs::write("exit.log", "closing");
            }
        }
        "#,
    );

    let violations = ws.scan();
    let perf006: Vec<_> = violations.iter().filter(|v| v.rule_id == "PERF-006").collect();
    assert_eq!(perf006.len(), 1, "Expected PERF-006 for blocking I/O in drop");
}
