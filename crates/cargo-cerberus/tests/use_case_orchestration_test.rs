use cargo_cerberus::application::{
    ExplainClustersUseCase, ReconcileBaselineUseCase, ScanScope, ScanWorkspaceUseCase,
    SignSuppressionUseCase,
};
use cargo_cerberus::domain::{
    Category, RuleDefinition, RulesConfig, Severity, Suppression, Violation,
};
use cargo_cerberus::infrastructure::{
    DbscanClustererAdapter, FileBaselineStorageAdapter, MockStorageAdapter,
    SemanticEmbedderAdapter,
};
use cargo_cerberus::ports::{
    AstEnginePort, FileSystemScannerPort, ManifestParserPort,
    RulesRepositoryPort, ScannedSourceFile,
};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tempfile::tempdir;


// Mock implementations for comprehensive unit testing
struct MockScanner(Vec<ScannedSourceFile>);
impl FileSystemScannerPort for MockScanner {
    fn scan_files(&self, _root_dir: &Path, _scope: ScanScope) -> Vec<ScannedSourceFile> {
        self.0.clone()
    }
}

struct MockAstEngine {
    violations: Vec<Violation>,
    errors: Vec<String>,
}
impl AstEnginePort for MockAstEngine {
    fn parse_batch(&self, _files: &[ScannedSourceFile]) -> (Vec<Violation>, Vec<String>) {
        (self.violations.clone(), self.errors.clone())
    }
}

struct MockManifestParser(Vec<Violation>);
impl ManifestParserPort for MockManifestParser {
    fn check_manifest_layers(&self, _workspace_root: &Path) -> Result<Vec<Violation>, String> {
        Ok(self.0.clone())
    }
}

struct MockRulesRepo(Vec<RuleDefinition>);
impl RulesRepositoryPort for MockRulesRepo {
    fn load_config(&self) -> Result<RulesConfig, String> {
        Ok(RulesConfig {
            schema: None,
            version: "1.0.0".into(),
            ignore: vec![],
            rules: self.0.clone(),
        })
    }
    fn get_rule(&self, rule_id: &str) -> Option<RuleDefinition> {
        self.0.iter().find(|r| r.id == rule_id).cloned()
    }
}

#[test]
fn test_scan_workspace_use_case_filters_stale_rule_versions() {
    let mock_scanner = Arc::new(MockScanner(vec![ScannedSourceFile {
        path: PathBuf::from("src/lib.rs"),
        crate_name: "test-crate".into(),
    }]));

    let v1 = Violation {
        rule_id: "ARCH-001".into(),
        rule_version: "1.0".into(),
        category: Category::Architecture,
        severity: Severity::Deny,
        file: PathBuf::from("src/lib.rs"),
        line: 1,
        column: 1,
        symbol: "sym".into(),
        snippet: "use tauri;".into(),
        message: "err".into(),
        remediation: "fix".into(),
        fingerprint: "fp1".into(),
    };

    let v_stale = Violation {
        rule_id: "ARCH-001".into(),
        rule_version: "0.9".into(), // Older version, should be filtered out
        category: Category::Architecture,
        severity: Severity::Deny,
        file: PathBuf::from("src/lib.rs"),
        line: 5,
        column: 1,
        symbol: "sym2".into(),
        snippet: "use tauri;".into(),
        message: "err".into(),
        remediation: "fix".into(),
        fingerprint: "fp2".into(),
    };

    let mock_engine = Arc::new(MockAstEngine {
        violations: vec![v1, v_stale],
        errors: vec!["parse error 1".into()],
    });

    let mock_repo = Arc::new(MockRulesRepo(vec![RuleDefinition {
        id: "ARCH-001".into(),
        version: "1.0".into(),
        category: Category::Architecture,
        severity: Severity::Deny,
        title: "Test".into(),
        description: "Test".into(),
        remediation: "Test".into(),
    }]));

    let use_case = ScanWorkspaceUseCase::new(mock_scanner, mock_engine, mock_repo, ScanScope::All);
    let result = use_case.execute(Path::new("."));

    assert_eq!(result.violations.len(), 1, "Stale rule version 0.9 must be filtered out");
    assert_eq!(result.violations[0].rule_version, "1.0");
    assert_eq!(result.parse_errors.len(), 1);
    assert_eq!(result.total_files_scanned, 1);
}

#[test]
fn test_reconcile_baseline_use_case_edge_cases() {
    let temp = tempdir().unwrap();
    let storage = Arc::new(FileBaselineStorageAdapter::new());
    let use_case = ReconcileBaselineUseCase::new(storage);

    // 1. Nonexistent file returns 0
    let missing_path = temp.path().join("nonexistent.json");
    let count_missing = use_case.execute(&missing_path).unwrap();
    assert_eq!(count_missing, 0);

    // 2. Corrupted git merge conflict format: [ "hash1" ][ "hash2" ]
    let git_merge_conflict_path = temp.path().join("conflict_baseline.json");
    let conflict_content = r#"[
  "b84293f0b2401f80e9a65d9333535900de5deba621531e08cb08ff1e3e01869e"
][
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
]"#;
    std::fs::write(&git_merge_conflict_path, conflict_content).unwrap();

    let count_conflict = use_case.execute(&git_merge_conflict_path).unwrap();
    assert_eq!(count_conflict, 2, "Reconcile must parse concatenated arrays from git merge");

    // 3. Extract unique hashes pure function
    let hashes = ReconcileBaselineUseCase::extract_unique_hashes("abc invalid 64char_string_that_is_not_hex_000000000000000000000000000000000000000 b84293f0b2401f80e9a65d9333535900de5deba621531e08cb08ff1e3e01869e");
    assert_eq!(hashes.len(), 1);
}

#[test]
fn test_sign_suppression_use_case_lifecycle() {
    let storage = MockStorageAdapter::new(vec![0xAA; 32]);

    let expires_future = chrono::Utc::now() + chrono::Duration::days(30);
    let expires_past = chrono::Utc::now() - chrono::Duration::days(1);

    // 1. Sign suppression
    let sig = SignSuppressionUseCase::sign(
        &storage,
        "ARCH-001",
        "fp123456",
        "Refactoring planned",
        "lead-dev",
        &expires_future,
    )
    .expect("Signing must succeed");

    let valid_suppression = Suppression {
        rule_id: "ARCH-001".into(),
        fingerprint: "fp123456".into(),
        reason: "Refactoring planned".into(),
        author: "lead-dev".into(),
        expires: expires_future,
        signature: sig.clone(),
    };

    // 2. Verify valid
    assert!(SignSuppressionUseCase::verify(&storage, &valid_suppression));

    // 3. Verify expired suppression is rejected
    let expired_suppression = Suppression {
        rule_id: "ARCH-001".into(),
        fingerprint: "fp123456".into(),
        reason: "Refactoring planned".into(),
        author: "lead-dev".into(),
        expires: expires_past,
        signature: sig.clone(),
    };
    assert!(!SignSuppressionUseCase::verify(&storage, &expired_suppression));

    // 4. Verify tampered suppression is rejected
    let tampered_suppression = Suppression {
        rule_id: "ARCH-002".into(), // Changed rule_id
        fingerprint: "fp123456".into(),
        reason: "Refactoring planned".into(),
        author: "lead-dev".into(),
        expires: expires_future,
        signature: sig,
    };
    assert!(!SignSuppressionUseCase::verify(&storage, &tampered_suppression));
}

#[test]
fn test_explain_clusters_use_case_empty_and_noise() {
    let embedder = Arc::new(SemanticEmbedderAdapter::default());
    let clusterer = Arc::new(DbscanClustererAdapter::new());
    let use_case = ExplainClustersUseCase::with_params(embedder, clusterer, 0.5, 3);

    // 1. Empty list
    let empty_report = use_case.execute(&[]).unwrap();
    assert_eq!(empty_report.total_violations, 0);
    assert_eq!(empty_report.total_clusters, 0);
    assert_eq!(empty_report.noise_count, 0);

    // 2. Single violation (isolated noise)
    let single = vec![Violation {
        rule_id: "ARCH-001".into(),
        rule_version: "1.0".into(),
        category: Category::Architecture,
        severity: Severity::Deny,
        file: PathBuf::from("src/lib.rs"),
        line: 1,
        column: 1,
        symbol: "sym".into(),
        snippet: "use tauri;".into(),
        message: "msg".into(),
        remediation: "rem".into(),
        fingerprint: "fp".into(),
    }];

    let single_report = use_case.execute(&single).unwrap();
    assert_eq!(single_report.total_violations, 1);
    assert_eq!(single_report.total_clusters, 0);
    assert_eq!(single_report.noise_count, 1);
}

#[test]
fn test_scan_workspace_orchestration_with_manifest_parser() {
    let mock_scanner = Arc::new(MockScanner(vec![]));
    let mock_engine = Arc::new(MockAstEngine {
        violations: vec![],
        errors: vec![],
    });
    let mock_repo = Arc::new(MockRulesRepo(vec![RuleDefinition {
        id: "ARCH-020".into(),
        version: "1.0".into(),
        category: Category::Architecture,
        severity: Severity::Deny,
        title: "Layer manifest violation".into(),
        description: "Test".into(),
        remediation: "Test".into(),
    }]));

    let manifest_violation = Violation {
        rule_id: "ARCH-020".into(),
        rule_version: "1.0".into(),
        category: Category::Architecture,
        severity: Severity::Deny,
        file: PathBuf::from("Cargo.toml"),
        line: 1,
        column: 1,
        symbol: "domain -> ports".into(),
        snippet: "ports = ...".into(),
        message: "Layer violation".into(),
        remediation: "Fix layer".into(),
        fingerprint: "arch020_fp".into(),
    };

    let mock_manifest = Arc::new(MockManifestParser(vec![manifest_violation]));

    let use_case = ScanWorkspaceUseCase::new(mock_scanner, mock_engine, mock_repo, ScanScope::All)
        .with_manifest_parser(mock_manifest);

    let result = use_case.execute(Path::new("."));
    assert_eq!(result.violations.len(), 1);
    assert_eq!(result.violations[0].rule_id, "ARCH-020");
}

