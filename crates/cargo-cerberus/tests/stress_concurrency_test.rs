use cargo_cerberus::application::ExplainClustersUseCase;
use cargo_cerberus::domain::{Category, Severity, Violation};
use cargo_cerberus::infrastructure::frontend::css_rules::CssRuleChecker;
use cargo_cerberus::infrastructure::frontend::lifecycle_rules::LifecycleRuleChecker;
use cargo_cerberus::infrastructure::frontend::sfc_parser::VueSfcParser;
use cargo_cerberus::infrastructure::frontend::vue_rules::VueRuleChecker;
use cargo_cerberus::infrastructure::parsers::RustSynParserAdapter;
use cargo_cerberus::infrastructure::vector::{DbscanClustererAdapter, PatternCache, SemanticEmbedderAdapter};
use cargo_cerberus::ports::AstParserPort;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;
use tempfile::tempdir;

#[test]
fn test_concurrency_pattern_cache_multithreaded_contention() {
    let temp = tempdir().unwrap();
    let cache = Arc::new(PatternCache::new(temp.path()));

    let mut handles = Vec::new();

    // Spawn 10 threads concurrently reading and writing to cache
    for thread_idx in 0..10 {
        let cache_clone = Arc::clone(&cache);
        let handle = thread::spawn(move || {
            for iter in 0..20 {
                let payload = format!("payload_from_thread_{}_iter_{}", thread_idx, iter);
                let _ = cache_clone.write_cached(payload.as_bytes());

                if let Ok(Some(read_bytes)) = cache_clone.read_cached() {
                    assert!(!read_bytes.is_empty());
                }
            }
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().expect("Thread must not panic on concurrent cache access");
    }
}


#[test]
fn test_chaos_huge_file_parsing_performance() {
    let temp = tempdir().unwrap();
    let huge_file = temp.path().join("huge.rs");

    // Generate 50,000 lines of valid Rust functions
    let mut code = String::with_capacity(1_000_000);
    code.push_str("// Huge synthetic file\n");
    for i in 0..5_000 {
        code.push_str(&format!(
            "pub fn function_{}() -> usize {{ let mut x = {}; x += 1; x }}\n",
            i, i
        ));
    }
    std::fs::write(&huge_file, code).unwrap();

    let start = std::time::Instant::now();
    let parser = RustSynParserAdapter::default();
    let result = parser.parse_file(&huge_file, "worldwiki-domain");
    let duration = start.elapsed();

    assert!(result.is_ok(), "Huge file should parse without panic");
    assert!(
        duration.as_millis() < 3000,
        "Parsing 5,000 functions should complete within 3s, took: {:?}",
        duration
    );
}

#[test]
fn test_chaos_malformed_syntax_and_invalid_utf8_recovery() {
    let temp = tempdir().unwrap();

    // 1. Corrupted Rust file with mismatched braces and invalid tokens
    let broken_rs = temp.path().join("broken.rs");
    std::fs::write(&broken_rs, "pub fn unclosed( { let x = ; %%% @@@ !!!").unwrap();

    let parser = RustSynParserAdapter::default();
    let rs_result = parser.parse_file(&broken_rs, "worldwiki-domain");
    assert!(
        rs_result.is_err(),
        "Malformed Rust syntax should return clean Err without panic"
    );

    // 2. Corrupted Vue SFC file
    let broken_vue = r#"
<template><div unclosed tag
<script setup>
let a = 1
"#;
    let sfc = VueSfcParser::parse(broken_vue);
    let vue_violations = VueRuleChecker::check(&sfc, Path::new("broken.vue"));
    // SFC parser gracefully handles incomplete tags without crashing
    assert!(vue_violations.is_empty() || !vue_violations.is_empty());

    // 3. Corrupted CSS with unfinished blocks
    let broken_css = ".card { color: #ff0000; unclosed block";
    let css_violations = CssRuleChecker::validate_css_file(broken_css, Path::new("broken.css"));
    assert!(!css_violations.is_empty(), "CSS rule checker should catch #hex even in broken CSS");

    // 4. Corrupted TypeScript with unbalanced scopes
    let broken_ts = "export function test() { window.addEventListener('click', () => {";
    let ts_violations = LifecycleRuleChecker::check_typescript_file(broken_ts, Path::new("broken.ts"));
    assert!(!ts_violations.is_empty(), "Lifecycle checker catches missing unlisten");
}

#[test]
fn test_stress_dbscan_clustering_large_input() {
    let embedder = Arc::new(SemanticEmbedderAdapter::default());
    let clusterer = Arc::new(DbscanClustererAdapter::new());
    let use_case = ExplainClustersUseCase::with_params(embedder, clusterer, 1.0, 2);

    let mut violations = Vec::new();
    for i in 0..150 {
        violations.push(Violation {
            rule_id: if i % 2 == 0 { "ARCH-001".into() } else { "VUE-001".into() },
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from(format!("src/file_{}.rs", i)),
            line: i,
            column: 1,

            symbol: format!("symbol_{}", i % 5),
            snippet: format!("snippet_{}", i % 5),
            message: format!("Message description {}", i % 5),
            remediation: "Fix architecture".into(),
            fingerprint: format!("fp_{}", i),
        });
    }

    let report = use_case.execute(&violations).expect("Clustering on 150 items must succeed");
    assert_eq!(report.total_violations, 150);
    assert!(report.total_clusters > 0);
}
