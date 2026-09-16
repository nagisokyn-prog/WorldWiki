use cerberus_application::{
    DownloadModelUseCase, ExplainClustersUseCase, ReSignAllUseCase, ReSignOptions,
    ReconcileBaselineUseCase, ScanScope, ScanWorkspaceUseCase, SignSuppressionUseCase,
};
use cerberus_domain::{
    Category, RuleDefinition, RulesConfig, Severity, Suppression, Violation,
};
use cerberus_ports::{
    AstEnginePort, BaselineStoragePort, ClustererPort, FileSystemScannerPort, KeyStoragePort,
    ManifestParserPort, ModelDownloaderPort, RulesRepositoryPort, ScannedSourceFile,
    VectorEmbedderPort,
};
use chrono::Utc;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tempfile::tempdir;

// ==========================================
// Mock implementations of Ports
// ==========================================

#[derive(Default)]
struct MockScanner {
    pub files: Vec<ScannedSourceFile>,
}

impl FileSystemScannerPort for MockScanner {
    fn scan_files(&self, _root_dir: &Path, scope: ScanScope) -> Vec<ScannedSourceFile> {
        match scope {
            ScanScope::All => self.files.clone(),
            ScanScope::FrontendOnly => self
                .files
                .iter()
                .filter(|f| f.path.extension().is_some_and(|e| e == "vue" || e == "css" || e == "ts"))
                .cloned()
                .collect(),
            ScanScope::BackendOnly => self
                .files
                .iter()
                .filter(|f| f.path.extension().is_some_and(|e| e == "rs" || e == "toml"))
                .cloned()
                .collect(),
        }
    }
}

struct MockAstEngine {
    pub violations_to_return: Vec<Violation>,
    pub parse_errors_to_return: Vec<String>,
}

impl AstEnginePort for MockAstEngine {
    fn parse_batch(&self, _files: &[ScannedSourceFile]) -> (Vec<Violation>, Vec<String>) {
        (self.violations_to_return.clone(), self.parse_errors_to_return.clone())
    }
}

struct MockRulesRepo {
    pub config: RulesConfig,
}

impl RulesRepositoryPort for MockRulesRepo {
    fn load_config(&self) -> Result<RulesConfig, String> {
        Ok(self.config.clone())
    }

    fn get_rule(&self, rule_id: &str) -> Option<RuleDefinition> {
        self.config.rules.iter().find(|r| r.id == rule_id).cloned()
    }
}

#[derive(Default)]
struct MockManifestParser {
    pub layer_violations: Vec<Violation>,
    pub fail_manifest: bool,
}

impl ManifestParserPort for MockManifestParser {
    fn check_manifest_layers(&self, _workspace_root: &Path) -> Result<Vec<Violation>, String> {
        if self.fail_manifest {
            return Err("Manifest parse failure simulated".into());
        }
        Ok(self.layer_violations.clone())
    }
}

#[derive(Default)]
struct MockBaselineStorage {
    pub content: Mutex<Option<String>>,
    pub fail_writes: AtomicBool,
}

impl BaselineStoragePort for MockBaselineStorage {
    fn read(&self, _path: &Path) -> Result<Option<String>, String> {
        Ok(self.content.lock().unwrap().clone())
    }

    fn write(&self, _path: &Path, content: &str) -> Result<(), String> {
        if self.fail_writes.load(Ordering::SeqCst) {
            return Err("Disk write failure simulated".to_string());
        }
        *self.content.lock().unwrap() = Some(content.to_string());
        Ok(())
    }
}

struct MockKeyStorage {
    pub key: Mutex<Vec<u8>>,
}

impl KeyStoragePort for MockKeyStorage {
    fn get_key(&self) -> Result<Vec<u8>, String> {
        let guard = self.key.lock().unwrap();
        if guard.is_empty() {
            return Err("No key found in storage".to_string());
        }
        Ok(guard.clone())
    }

    fn set_key(&self, secret: &[u8]) -> Result<(), String> {
        *self.key.lock().unwrap() = secret.to_vec();
        Ok(())
    }
}

struct MockEmbedder;

impl VectorEmbedderPort for MockEmbedder {
    fn embed_texts(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        Ok(texts.iter().map(|_| vec![0.1; 768]).collect())
    }

    fn dimension(&self) -> usize {
        768
    }
}

struct MockClusterer {
    pub cluster_assignments: Vec<Option<usize>>,
}

impl ClustererPort for MockClusterer {
    fn cluster(
        &self,
        embeddings: &[Vec<f32>],
        _eps: f32,
        _min_points: usize,
    ) -> Result<Vec<Option<usize>>, String> {
        if self.cluster_assignments.len() == embeddings.len() {
            Ok(self.cluster_assignments.clone())
        } else {
            Ok(vec![Some(0); embeddings.len()])
        }
    }
}

struct MockDownloader {
    pub simulate_error: bool,
}

impl ModelDownloaderPort for MockDownloader {
    fn download_file(&self, _url: &str, dest_path: &Path) -> Result<(), String> {
        if self.simulate_error {
            return Err("Simulated network failure / hash mismatch".to_string());
        }
        if let Some(parent) = dest_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(dest_path, "model binary content").map_err(|e| e.to_string())?;
        Ok(())
    }
}

// ==========================================
// 1. ScanWorkspaceUseCase Tests
// ==========================================

#[test]
fn test_scan_workspace_use_case_scopes_and_manifest_merging() {
    let scanner = Arc::new(MockScanner {
        files: vec![
            ScannedSourceFile {
                path: PathBuf::from("crates/domain/src/lib.rs"),
                crate_name: "domain".into(),
            },
            ScannedSourceFile {
                path: PathBuf::from("apps/spa/src/App.vue"),
                crate_name: "spa".into(),
            },
        ],
    });

    let ast_engine = Arc::new(MockAstEngine {
        violations_to_return: vec![Violation {
            rule_id: "VUE-001".into(),
            rule_version: "1.0".into(),
            category: Category::Convention,
            severity: Severity::Deny,
            file: PathBuf::from("apps/spa/src/App.vue"),
            line: 1,
            column: 1,
            symbol: "App".into(),
            snippet: "ref(1)".into(),
            message: "Bloated SFC".into(),
            remediation: "Extract".into(),
            fingerprint: "fp_vue_1".into(),
        }],
        parse_errors_to_return: Vec::new(),
    });

    let rules_repo = Arc::new(MockRulesRepo {
        config: RulesConfig {
            schema: None,
            version: "1.0".into(),
            ignore: Vec::new(),
            rules: vec![RuleDefinition {
                id: "VUE-001".into(),
                version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Deny,
                title: "title".into(),
                description: "desc".into(),
                remediation: "rem".into(),
            }],
        },
    });

    let manifest_parser = Arc::new(MockManifestParser {
        layer_violations: vec![Violation {
            rule_id: "ARCH-001".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from("crates/domain/Cargo.toml"),
            line: 1,
            column: 1,
            symbol: "domain".into(),
            snippet: "tauri".into(),
            message: "Domain imports tauri".into(),
            remediation: "Invert".into(),
            fingerprint: "fp_arch_1".into(),
        }],
        fail_manifest: false,
    });

    // 1. Scan All scope
    let use_case = ScanWorkspaceUseCase::new(scanner.clone(), ast_engine.clone(), rules_repo.clone(), ScanScope::All)
        .with_manifest_parser(manifest_parser.clone());
    let result = use_case.execute(Path::new("."));
    assert_eq!(result.violations.len(), 2);
    assert_eq!(result.total_files_scanned, 2);

    // 2. Scan Frontend Only scope (manifest violations are not included in frontend only)
    let fe_use_case = ScanWorkspaceUseCase::new(scanner.clone(), ast_engine.clone(), rules_repo.clone(), ScanScope::FrontendOnly)
        .with_manifest_parser(manifest_parser.clone());
    let fe_result = fe_use_case.execute(Path::new("."));
    assert_eq!(fe_result.violations.len(), 1);
    assert_eq!(fe_result.violations[0].rule_id, "VUE-001");
    assert_eq!(fe_result.total_files_scanned, 1);

    // 3. Scan Backend Only with manifest failure
    let fail_manifest_parser = Arc::new(MockManifestParser {
        layer_violations: Vec::new(),
        fail_manifest: true,
    });
    let be_use_case = ScanWorkspaceUseCase::new(scanner.clone(), ast_engine.clone(), rules_repo.clone(), ScanScope::BackendOnly)
        .with_manifest_parser(fail_manifest_parser);
    let be_result = be_use_case.execute(Path::new("."));
    assert_eq!(be_result.parse_errors.len(), 1);
}

// ==========================================
// 2. ReconcileBaselineUseCase Tests
// ==========================================

#[test]
fn test_reconcile_baseline_with_git_conflict_markers() {
    let temp = tempdir().unwrap();
    let baseline_file = temp.path().join("cerberus-baseline.json");

    // Simulate 3-way merge conflict file with valid 64-character hex fingerprints
    let conflict_content = r#"[
<<<<<<< HEAD
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60001",
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60002",
=======
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60002",
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60003",
>>>>>>> feature-branch
]"#;

    let storage = Arc::new(MockBaselineStorage {
        content: Mutex::new(Some(conflict_content.to_string())),
        fail_writes: AtomicBool::new(false),
    });
    let use_case = ReconcileBaselineUseCase::new(storage.clone());

    let count = use_case.execute(&baseline_file).unwrap();
    assert_eq!(count, 3); // Deduplicated 3 unique hashes

    let written = storage.content.lock().unwrap().clone().unwrap();
    assert!(written.contains("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60001"));
    assert!(written.contains("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60002"));
    assert!(written.contains("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60003"));
}

#[test]
fn test_reconcile_baseline_write_failure_returns_error() {
    let temp = tempdir().unwrap();
    let baseline_file = temp.path().join("cerberus-baseline.json");

    let storage = Arc::new(MockBaselineStorage {
        content: Mutex::new(Some("[\"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60001\"]".to_string())),
        fail_writes: AtomicBool::new(true),
    });
    let use_case = ReconcileBaselineUseCase::new(storage);

    assert!(use_case.execute(&baseline_file).is_err());
}

// ==========================================
// 3. SignSuppressionUseCase & ReSignAllUseCase Tests
// ==========================================

#[test]
fn test_sign_suppression_and_re_sign_all_key_rotation() {
    let temp = tempdir().unwrap();
    let lock_file = temp.path().join("cerberus-ledger.lock");

    let key_storage = Arc::new(MockKeyStorage {
        key: Mutex::new(b"secret_key_v1_bytes".to_vec()),
    });

    // 1. Sign a suppression
    let expires = Utc::now() + chrono::Duration::days(30);
    let signature = SignSuppressionUseCase::sign(
        key_storage.as_ref(),
        "ARCH-001",
        "fp_abc_123",
        "Legacy migration exception",
        "TechLead",
        &expires,
    )
    .unwrap();

    let suppression = Suppression {
        rule_id: "ARCH-001".into(),
        fingerprint: "fp_abc_123".into(),
        reason: "Legacy migration exception".into(),
        author: "TechLead".into(),
        expires,
        signature: signature.clone(),
    };

    assert!(SignSuppressionUseCase::verify(key_storage.as_ref(), &suppression));

    // Write suppression list to file
    let list = vec![suppression.clone()];
    std::fs::write(&lock_file, serde_json::to_string_pretty(&list).unwrap()).unwrap();

    // 2. Key rotation: switch key to secret_key_v2_bytes using old_storage and new_storage
    let new_key_storage = MockKeyStorage {
        key: Mutex::new(b"secret_key_v2_bytes".to_vec()),
    };

    // Old signature must fail verification with new key
    assert!(!SignSuppressionUseCase::verify(&new_key_storage, &suppression));

    // Re-sign all entries in lock file
    let resign_count = ReSignAllUseCase::execute(ReSignOptions {
        lock_file: &lock_file,
        old_storage: Some(key_storage.as_ref()),
        new_storage: &new_key_storage,
        force: false,
    })
    .unwrap();

    assert_eq!(resign_count, 1);

    // Read updated lock file and verify with new key
    let updated_json = std::fs::read_to_string(&lock_file).unwrap();
    let updated_list: Vec<Suppression> = serde_json::from_str(&updated_json).unwrap();
    let updated_suppression = &updated_list[0];

    assert!(SignSuppressionUseCase::verify(&new_key_storage, updated_suppression));
}

#[test]
fn test_sign_suppression_missing_key_returns_error() {
    let empty_storage = MockKeyStorage {
        key: Mutex::new(Vec::new()),
    };
    let expires = Utc::now() + chrono::Duration::days(1);
    assert!(SignSuppressionUseCase::sign(
        &empty_storage,
        "ARCH-001",
        "fp",
        "reason",
        "lead",
        &expires,
    )
    .is_err());
}

// ==========================================
// 4. ExplainClustersUseCase Tests
// ==========================================

#[test]
fn test_explain_clusters_use_case_clustering_and_empty() {
    let embedder = Arc::new(MockEmbedder);
    let clusterer = Arc::new(MockClusterer {
        cluster_assignments: vec![Some(0), Some(0)],
    });

    let use_case = ExplainClustersUseCase::new(embedder, clusterer);

    let violations = vec![
        Violation {
            rule_id: "ROB-001".into(),
            rule_version: "1.0".into(),
            category: Category::Robustness,
            severity: Severity::Warn,
            file: PathBuf::from("src/parser.rs"),
            line: 10,
            column: 1,
            symbol: "parse".into(),
            snippet: "unwrap()".into(),
            message: "Panic".into(),
            remediation: "Fix".into(),
            fingerprint: "fp1".into(),
        },
        Violation {
            rule_id: "ROB-001".into(),
            rule_version: "1.0".into(),
            category: Category::Robustness,
            severity: Severity::Warn,
            file: PathBuf::from("src/parser.rs"),
            line: 20,
            column: 1,
            symbol: "parse2".into(),
            snippet: "expect()".into(),
            message: "Panic".into(),
            remediation: "Fix".into(),
            fingerprint: "fp2".into(),
        },
    ];

    let report = use_case.execute(&violations).unwrap();
    assert_eq!(report.total_violations, 2);
    assert_eq!(report.total_clusters, 1);
    assert_eq!(report.clusters.len(), 1);

    // Empty violations case
    let empty_report = use_case.execute(&[]).unwrap();
    assert_eq!(empty_report.total_violations, 0);
    assert_eq!(empty_report.total_clusters, 0);
}

// ==========================================
// 5. DownloadModelUseCase Tests
// ==========================================

#[test]
fn test_download_model_use_case_success_and_status() {
    let temp = tempdir().unwrap();
    let cache_dir = temp.path().join("models");

    let downloader = Arc::new(MockDownloader {
        simulate_error: false,
    });
    let use_case = DownloadModelUseCase::new(downloader);

    // Initial status: not downloaded
    let initial_status = use_case.status(&cache_dir);
    assert!(!initial_status.model_exists);
    assert!(!initial_status.tokenizer_exists);

    // Download model files
    use_case
        .download(&cache_dir, "http://model.onnx", "http://tokenizer.json")
        .unwrap();

    let post_status = use_case.status(&cache_dir);
    assert!(post_status.model_exists);
    assert!(post_status.tokenizer_exists);

    // Clean models cache
    let deleted_count = use_case.clean(&cache_dir).unwrap();
    assert_eq!(deleted_count, 2);

    let final_status = use_case.status(&cache_dir);
    assert!(!final_status.model_exists);

    // Simulated error case
    let err_downloader = Arc::new(MockDownloader {
        simulate_error: true,
    });
    let err_use_case = DownloadModelUseCase::new(err_downloader);
    assert!(err_use_case
        .download(&cache_dir, "http://model.onnx", "http://tokenizer.json")
        .is_err());
}
