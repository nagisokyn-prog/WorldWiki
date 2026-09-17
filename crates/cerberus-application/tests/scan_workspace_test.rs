use cerberus_application::{ScanScope, ScanWorkspaceUseCase};
use cerberus_domain::{Category, RuleDefinition, RulesConfig, Severity, Violation};
use cerberus_ports::{AstEnginePort, FileSystemScannerPort, ManifestParserPort, RulesRepositoryPort, ScannedSourceFile};
use std::path::{Path, PathBuf};
use std::sync::Arc;

struct MockScanner;
impl FileSystemScannerPort for MockScanner {
    fn scan_files(&self, _root_dir: &Path, _scope: ScanScope) -> Vec<ScannedSourceFile> {
        vec![ScannedSourceFile {
            path: PathBuf::from("src/lib.rs"),
            crate_name: "test-crate".into(),
        }]
    }
}

struct MockEngine;
impl AstEnginePort for MockEngine {
    fn parse_batch(&self, _files: &[ScannedSourceFile]) -> (Vec<Violation>, Vec<String>) {
        (
            vec![Violation {
                rule_id: "ARCH-001".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: PathBuf::from("src/lib.rs"),
                line: 1,
                column: 1,
                symbol: "s".into(),
                snippet: "snip".into(),
                message: "m".into(),
                remediation: "r".into(),
                fingerprint: "fp".into(),
            }],
            vec![],
        )
    }
}

struct MockRules;
impl RulesRepositoryPort for MockRules {
    fn load_config(&self) -> Result<RulesConfig, String> {
        Ok(RulesConfig {
            schema: None,
            version: "1.0".into(),
            ignore: vec![],
            rules: vec![],
        })
    }

    fn get_rule(&self, rule_id: &str) -> Option<RuleDefinition> {
        if rule_id == "ARCH-001" {
            Some(RuleDefinition {
                id: "ARCH-001".into(),
                version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                title: "t".into(),
                description: "d".into(),
                remediation: "r".into(),
            })
        } else {
            None
        }
    }
}

struct MockManifestErr;
impl ManifestParserPort for MockManifestErr {
    fn check_manifest_layers(&self, _workspace_root: &Path) -> Result<Vec<Violation>, String> {
        Err("Manifest parse error".into())
    }
}

struct MockManifestSuccess;
impl ManifestParserPort for MockManifestSuccess {
    fn check_manifest_layers(&self, _workspace_root: &Path) -> Result<Vec<Violation>, String> {
        Ok(vec![Violation {
            rule_id: "ARCH-020".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from("Cargo.toml"),
            line: 1,
            column: 1,
            symbol: "dep".into(),
            snippet: "dep".into(),
            message: "dep violation".into(),
            remediation: "fix".into(),
            fingerprint: "fp20".into(),
        }])
    }
}

#[test]
fn test_scan_workspace_use_case_with_manifest_err() {
    let scanner = Arc::new(MockScanner);
    let engine = Arc::new(MockEngine);
    let rules = Arc::new(MockRules);
    let manifest = Arc::new(MockManifestErr);

    assert!(rules.load_config().is_ok());

    let use_case = ScanWorkspaceUseCase::new(scanner, engine, rules, ScanScope::All)
        .with_manifest_parser(manifest);

    let res = use_case.execute(Path::new("."));
    assert_eq!(res.total_files_scanned, 1);
    assert_eq!(res.violations.len(), 1);
    assert_eq!(res.parse_errors.len(), 1);
    assert!(format!("{:?}", res).contains("ScanResult"));
}

#[test]
fn test_scan_workspace_scope_and_manifest_success() {
    let scanner = Arc::new(MockScanner);
    let engine = Arc::new(MockEngine);
    let rules = Arc::new(MockRules);
    let manifest = Arc::new(MockManifestSuccess);

    // Backend only with manifest success
    let backend_use_case = ScanWorkspaceUseCase::new(scanner.clone(), engine.clone(), rules.clone(), ScanScope::BackendOnly)
        .with_manifest_parser(manifest.clone());
    let res_backend = backend_use_case.execute(Path::new("."));
    assert_eq!(res_backend.violations.len(), 2);
    assert!(res_backend.parse_errors.is_empty());

    // Frontend only (should not check manifest)
    let frontend_use_case = ScanWorkspaceUseCase::new(scanner, engine, rules, ScanScope::FrontendOnly)
        .with_manifest_parser(manifest);
    let res_frontend = frontend_use_case.execute(Path::new("."));
    assert_eq!(res_frontend.violations.len(), 1);
}

struct MockEngineMismatch;
impl AstEnginePort for MockEngineMismatch {
    fn parse_batch(&self, _files: &[ScannedSourceFile]) -> (Vec<Violation>, Vec<String>) {
        (
            vec![Violation {
                rule_id: "ARCH-001".into(),
                rule_version: "99.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: PathBuf::from("src/lib.rs"),
                line: 1,
                column: 1,
                symbol: "s".into(),
                snippet: "snip".into(),
                message: "m".into(),
                remediation: "r".into(),
                fingerprint: "fp".into(),
            }],
            vec![],
        )
    }
}

#[test]
fn test_scan_workspace_rule_version_mismatch_filters_out() {
    let scanner = Arc::new(MockScanner);
    let engine = Arc::new(MockEngineMismatch);
    let rules = Arc::new(MockRules);

    let use_case = ScanWorkspaceUseCase::new(scanner, engine, rules, ScanScope::All);
    let res = use_case.execute(Path::new("."));
    assert!(res.violations.is_empty());
}
