use cerberus_domain::Violation;
pub use cerberus_ports::ScanScope;
use cerberus_ports::{
    AstEnginePort, FileSystemScannerPort, ManifestParserPort, RulesRepositoryPort, ScannedSourceFile,
};
use std::path::Path;
use std::sync::Arc;

#[derive(Debug)]
pub struct ScanResult {
    pub violations: Vec<Violation>,
    pub parse_errors: Vec<String>,
    pub total_files_scanned: usize,
}

pub struct ScanWorkspaceUseCase {
    pub scanner: Arc<dyn FileSystemScannerPort>,
    pub ast_engine: Arc<dyn AstEnginePort>,
    pub manifest_parser: Option<Arc<dyn ManifestParserPort>>,
    pub rules_repo: Arc<dyn RulesRepositoryPort>,
    pub scope: ScanScope,
}

impl ScanWorkspaceUseCase {
    pub fn new(
        scanner: Arc<dyn FileSystemScannerPort>,
        ast_engine: Arc<dyn AstEnginePort>,
        rules_repo: Arc<dyn RulesRepositoryPort>,
        scope: ScanScope,
    ) -> Self {
        Self {
            scanner,
            ast_engine,
            manifest_parser: None,
            rules_repo,
            scope,
        }
    }

    pub fn with_manifest_parser(mut self, manifest_parser: Arc<dyn ManifestParserPort>) -> Self {
        self.manifest_parser = Some(manifest_parser);
        self
    }

    pub fn execute(&self, root_dir: &Path) -> ScanResult {
        let files: Vec<ScannedSourceFile> = self.scanner.scan_files(root_dir, self.scope);
        let total_files_scanned = files.len();

        let (mut violations, mut parse_errors) = self.ast_engine.parse_batch(&files);

        if let Some(manifest_checker) = &self.manifest_parser {
            if self.scope == ScanScope::All || self.scope == ScanScope::BackendOnly {
                match manifest_checker.check_manifest_layers(root_dir) {
                    Ok(manifest_violations) => violations.extend(manifest_violations),
                    Err(err) => parse_errors.push(err),
                }
            }
        }

        violations.retain_mut(|v| {
            if let Some(def) = self.rules_repo.get_rule(&v.rule_id) {
                if def.severity == cerberus_domain::Severity::Off || v.rule_version != def.version {
                    return false;
                }
                v.severity = def.severity;
            }

            let rel_file = v.file.strip_prefix(root_dir).unwrap_or(&v.file);
            let file_str = rel_file.to_string_lossy().replace('\\', "/");
            v.fingerprint = cerberus_domain::compute_location_fingerprint(
                &v.rule_id,
                &v.rule_version,
                &file_str,
                &v.symbol,
                &v.snippet,
            );
            true
        });

        ScanResult {
            violations,
            parse_errors,
            total_files_scanned,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cerberus_domain::{Category, RuleDefinition, Severity, Violation};
    use std::path::PathBuf;

    struct FakeScanner(Vec<ScannedSourceFile>);
    impl FileSystemScannerPort for FakeScanner {
        fn scan_files(&self, _root_dir: &Path, _scope: ScanScope) -> Vec<ScannedSourceFile> {
            self.0.clone()
        }
    }

    struct FakeAstEngine(Vec<Violation>, Vec<String>);
    impl AstEnginePort for FakeAstEngine {
        fn parse_batch(&self, _files: &[ScannedSourceFile]) -> (Vec<Violation>, Vec<String>) {
            (self.0.clone(), self.1.clone())
        }
    }

    struct FakeManifestParser(Result<Vec<Violation>, String>);
    impl ManifestParserPort for FakeManifestParser {
        fn check_manifest_layers(&self, _root: &Path) -> Result<Vec<Violation>, String> {
            self.0.clone()
        }
    }

    struct FakeRulesRepo(Option<RuleDefinition>);
    impl RulesRepositoryPort for FakeRulesRepo {
        fn load_config(&self) -> Result<cerberus_domain::RulesConfig, String> {
            Ok(cerberus_domain::RulesConfig::default())
        }
        fn get_rule(&self, _id: &str) -> Option<RuleDefinition> {
            self.0.clone()
        }
    }

    #[test]
    fn test_scan_workspace_use_case_new() {
        let scanner = Arc::new(FakeScanner(vec![ScannedSourceFile {
            path: PathBuf::from("src/lib.rs"),
            crate_name: "test_crate".into(),
        }]));
        let ast_engine = Arc::new(FakeAstEngine(Vec::new(), Vec::new()));
        let rules_repo: Arc<dyn RulesRepositoryPort> = Arc::new(FakeRulesRepo(None));

        let use_case = ScanWorkspaceUseCase::new(
            scanner,
            ast_engine,
            Arc::clone(&rules_repo),
            ScanScope::BackendOnly,
        );
        assert!(use_case.manifest_parser.is_none());
        assert_eq!(use_case.scope, ScanScope::BackendOnly);

        let res = use_case.execute(Path::new("."));
        assert_eq!(res.total_files_scanned, 1);
        assert!(res.violations.is_empty());
        assert!(res.parse_errors.is_empty());
        assert!(rules_repo.load_config().is_ok());
    }

    #[test]
    fn test_scan_workspace_with_manifest_and_violations() {
        let scanner = Arc::new(FakeScanner(Vec::new()));
        let v1 = Violation {
            rule_id: "ARCH-001".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from("src/domain.rs"),
            line: 10,
            column: 1,
            symbol: "bad".into(),
            snippet: "use tokio;".into(),
            message: "msg".into(),
            remediation: "rem".into(),
            fingerprint: "".into(),
        };
        let ast_engine = Arc::new(FakeAstEngine(vec![v1], vec!["parse err".into()]));
        let manifest_parser = Arc::new(FakeManifestParser(Ok(vec![])));
        let rule_def = RuleDefinition {
            id: "ARCH-001".into(),
            version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Warn,
            title: "T".into(),
            description: "D".into(),
            remediation: "R".into(),
        };
        let rules_repo = Arc::new(FakeRulesRepo(Some(rule_def)));

        let use_case = ScanWorkspaceUseCase::new(
            scanner,
            ast_engine,
            rules_repo,
            ScanScope::All,
        )
        .with_manifest_parser(manifest_parser);

        let res = use_case.execute(Path::new("."));
        assert_eq!(res.violations.len(), 1);
        assert_eq!(res.violations[0].severity, Severity::Warn);
        assert_eq!(res.parse_errors.len(), 1);
    }

    #[test]
    fn test_scan_workspace_rule_severity_off_and_manifest_err() {
        let scanner = Arc::new(FakeScanner(Vec::new()));
        let v1 = Violation {
            rule_id: "ARCH-001".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from("src/domain.rs"),
            line: 10,
            column: 1,
            symbol: "bad".into(),
            snippet: "use tokio;".into(),
            message: "msg".into(),
            remediation: "rem".into(),
            fingerprint: "".into(),
        };
        let ast_engine = Arc::new(FakeAstEngine(vec![v1], vec![]));
        let manifest_parser = Arc::new(FakeManifestParser(Err("manifest err".into())));
        let rule_def = RuleDefinition {
            id: "ARCH-001".into(),
            version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Off,
            title: "T".into(),
            description: "D".into(),
            remediation: "R".into(),
        };
        let rules_repo = Arc::new(FakeRulesRepo(Some(rule_def)));

        let use_case = ScanWorkspaceUseCase::new(
            scanner,
            ast_engine,
            rules_repo,
            ScanScope::BackendOnly,
        )
        .with_manifest_parser(manifest_parser);

        let res = use_case.execute(Path::new("."));
        assert_eq!(res.violations.len(), 0); // filtered out due to Severity::Off
        assert_eq!(res.parse_errors.len(), 1);
    }
}
