use cargo_arch_guard::application::{
    ScanScope, ScanWorkspaceUseCase, SignSuppressionUseCase,
};
use cargo_arch_guard::domain::{compute_fingerprint, Suppression};
use cargo_arch_guard::infrastructure::{
    MockStorageAdapter, RulesJsonRepository, RustSynParserAdapter, VueSfcParserAdapter,
};
use cargo_arch_guard::ports::{AstParserPort, RulesRepositoryPort};
use cargo_arch_guard::infrastructure::taint::TaintGraphAnalyzer;

use std::path::PathBuf;
use std::sync::Arc;

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

#[test]
fn test_rules_repository_loads_and_validates() {
    let rules_path = manifest_dir().join("../../firewall/rules.json");
    if rules_path.exists() {
        let repo = RulesJsonRepository::load_from_file(&rules_path).expect("rules.json must load");
        assert!(repo.get_rule("ARCH-001").is_some());
        assert!(repo.get_rule("ASYNC-001").is_some());
        assert!(repo.get_rule("SEC-001").is_some());
        assert!(repo.get_rule("VUE-001").is_some());
        assert!(repo.get_rule("CSS-004").is_some());
    }
}

#[test]
fn test_fingerprint_deterministic() {
    let fp1 = compute_fingerprint("ARCH-001", "1.0", "DomainStruct", "use tauri;");
    let fp2 = compute_fingerprint("ARCH-001", "1.0", "DomainStruct", "use    tauri; \n");
    assert_eq!(fp1, fp2, "Fingerprint should normalize whitespace");
}

#[test]
fn test_invalid_domain_imports_detected() {
    let fixture_path = manifest_dir().join("tests/fixtures/invalid_domain_imports/src/lib.rs");
    if fixture_path.exists() {
        let parser = RustSynParserAdapter;
        let violations = parser
            .parse_file(&fixture_path, "worldwiki-domain")
            .expect("Should parse fixture");
        let arch_violations: Vec<_> = violations.iter().filter(|v| v.rule_id == "ARCH-001").collect();
        assert!(!arch_violations.is_empty(), "Should catch forbidden imports in domain");
    }
}

#[test]
fn test_invalid_mutex_await_detected() {
    let fixture_path = manifest_dir().join("tests/fixtures/invalid_mutex_await/src/lib.rs");
    if fixture_path.exists() {
        let parser = RustSynParserAdapter;
        let violations = parser
            .parse_file(&fixture_path, "worldwiki-infrastructure")
            .expect("Should parse fixture");
        let async_violations: Vec<_> = violations.iter().filter(|v| v.rule_id == "ASYNC-001").collect();
        assert!(!async_violations.is_empty(), "Should detect std::sync::Mutex across await");
    }
}

#[test]
fn test_clean_hexagonal_has_zero_violations() {
    let fixture_path = manifest_dir().join("tests/fixtures/valid_clean_hexagonal/src/lib.rs");
    if fixture_path.exists() {
        let parser = RustSynParserAdapter;
        let violations = parser
            .parse_file(&fixture_path, "worldwiki-domain")
            .expect("Should parse fixture");
        assert_eq!(violations.len(), 0, "Clean domain should have 0 violations");
    }
}

#[test]
fn test_taint_propagation() {
    let fixture_path = manifest_dir().join("tests/fixtures/taint_depth_3/src/lib.rs");
    if fixture_path.exists() {
        let content = std::fs::read_to_string(&fixture_path).unwrap();
        let syntax_tree = syn::parse_file(&content).unwrap();
        let mut analyzer = TaintGraphAnalyzer::new(&fixture_path);
        analyzer.collect_file(&syntax_tree);
        let violations = analyzer.analyze();
        assert!(!violations.is_empty(), "Taint flow to Command::new should be detected");
    }
}

#[test]
fn test_hmac_ledger_use_case_signing_and_verification() {
    let storage = MockStorageAdapter::new(vec![0x42; 32]);
    let expires = chrono::DateTime::parse_from_rfc3339("2099-01-01T00:00:00Z")
        .unwrap()
        .with_timezone(&chrono::Utc);

    let sig = SignSuppressionUseCase::sign(
        &storage,
        "ARCH-001",
        "abc123hash",
        "Legacy migration",
        "lead-arch",
        &expires,
    )
    .unwrap();

    let suppression = Suppression {
        rule_id: "ARCH-001".into(),
        fingerprint: "abc123hash".into(),
        reason: "Legacy migration".into(),
        author: "lead-arch".into(),
        expires,
        signature: sig,
    };

    assert!(SignSuppressionUseCase::verify(&storage, &suppression));
}

#[test]
fn test_vue_sfc_tauri_ipc_detected() {
    let sfc_content = r#"
<template><div>Test</div></template>
<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
invoke('save_chapter');
</script>
"#;
    let sfc = cargo_arch_guard::infrastructure::frontend::sfc_parser::VueSfcParser::parse(sfc_content);
    let violations = cargo_arch_guard::infrastructure::frontend::vue_rules::VueRuleChecker::check(
        &sfc,
        std::path::Path::new("TestComponent.vue"),
    );
    let tauri_v: Vec<_> = violations.iter().filter(|v| v.rule_id == "VUE-002").collect();
    assert!(!tauri_v.is_empty(), "Direct Tauri IPC in Vue SFC must be blocked");
}

#[test]
fn test_css_hardcoded_tokens_detected() {
    let css_content = r#"
.card {
    color: #ff0000;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.5);
}
"#;
    let violations = cargo_arch_guard::infrastructure::frontend::css_rules::CssRuleChecker::validate_css_file(
        css_content,
        std::path::Path::new("test.css"),
    );
    assert_eq!(violations.len(), 3, "Hex, RGB, and pixel radius must all be flagged");
}

#[test]
fn test_ts_lifecycle_leak_detected() {
    let ts_bad = r#"
export function useFeature() {
    window.addEventListener('resize', () => {});
    setInterval(() => {}, 1000);
}
"#;
    let violations =
        cargo_arch_guard::infrastructure::frontend::lifecycle_rules::LifecycleRuleChecker::check_typescript_file(
            ts_bad,
            std::path::Path::new("useFeature.ts"),
        );
    assert!(!violations.is_empty(), "Missing symmetric onUnmounted must be caught");

    let ts_good = r#"
import { onUnmounted } from 'vue';
export function useFeature() {
    window.addEventListener('resize', () => {});
    onUnmounted(() => {
        window.removeEventListener('resize', () => {});
    });
}
"#;
    let ok_violations =
        cargo_arch_guard::infrastructure::frontend::lifecycle_rules::LifecycleRuleChecker::check_typescript_file(
            ts_good,
            std::path::Path::new("useFeature.ts"),
        );
    assert_eq!(ok_violations.len(), 0, "Symmetric onUnmounted cleanup must pass");
}


#[test]
fn test_scan_workspace_use_case_orchestration() {
    let rules_path = manifest_dir().join("../../firewall/rules.json");
    if rules_path.exists() {
        let repo = Arc::new(RulesJsonRepository::load_from_file(&rules_path).unwrap());
        let parsers: Vec<Arc<dyn AstParserPort>> = vec![
            Arc::new(RustSynParserAdapter),
            Arc::new(VueSfcParserAdapter),
        ];

        let use_case = ScanWorkspaceUseCase::new(
            parsers,
            repo,
            ScanScope::All,
        );

        let result = use_case.execute(&manifest_dir().join("tests/fixtures/valid_clean_hexagonal"));
        assert_eq!(result.violations.len(), 0);
    }
}
