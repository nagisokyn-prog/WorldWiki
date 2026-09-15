use arch_guard_domain::Violation;
pub use arch_guard_ports::ScanScope;
use arch_guard_ports::{
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

        // Manifest layers validation (ARCH-020, ARCH-021)
        if let Some(manifest_checker) = &self.manifest_parser {
            if self.scope == ScanScope::All || self.scope == ScanScope::BackendOnly {
                match manifest_checker.check_manifest_layers(root_dir) {
                    Ok(manifest_violations) => violations.extend(manifest_violations),
                    Err(err) => parse_errors.push(err),
                }
            }
        }

        violations.retain(|v| {
            if let Some(def) = self.rules_repo.get_rule(&v.rule_id) {
                v.rule_version == def.version
            } else {
                true
            }
        });

        ScanResult {
            violations,
            parse_errors,
            total_files_scanned,
        }
    }
}


