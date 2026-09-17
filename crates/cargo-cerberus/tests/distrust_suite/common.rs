use cerberus_application::{ScanScope, ScanWorkspaceUseCase};
use cerberus_domain::{BuiltinRuleRegistry, Severity, Violation};
use cerberus_infrastructure::{
    ParallelAstEngineAdapter, RulesJsonRepository, WalkDirScannerAdapter,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tempfile::tempdir;

pub struct TestWorkspace {
    pub root: tempfile::TempDir,
    pub src_dir: PathBuf,
    pub rules_repo: Arc<RulesJsonRepository>,
}

impl Default for TestWorkspace {
    fn default() -> Self {
        Self::new()
    }
}

impl TestWorkspace {
    pub fn new() -> Self {
        let root = tempdir().unwrap();
        let src_dir = root.path().join("src");
        fs::create_dir_all(&src_dir).unwrap();

        let rules_file = root.path().join(".cerberus").join("rules.json");
        fs::create_dir_all(rules_file.parent().unwrap()).unwrap();
        let mut config = serde_json::json!({
            "version": "2.0",
            "rules": {}
        });
        for rule in BuiltinRuleRegistry::all_rules() {
            config["rules"][&rule.id] = serde_json::Value::String(match rule.severity {
                Severity::Deny => "deny".into(),
                Severity::Warn => "warn".into(),
                Severity::Off => "off".into(),
            });
        }
        fs::write(&rules_file, serde_json::to_string_pretty(&config).unwrap()).unwrap();
        let rules_repo = Arc::new(RulesJsonRepository::load_from_file(&rules_file).unwrap());

        Self {
            root,
            src_dir,
            rules_repo,
        }
    }

    pub fn write_file(&self, relative_path: &str, content: &str) -> PathBuf {
        let full_path = self.root.path().join(relative_path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&full_path, content).unwrap();
        full_path
    }

    pub fn scan(&self) -> Vec<Violation> {
        let scanner = Arc::new(WalkDirScannerAdapter::new());
        let parser = Arc::new(ParallelAstEngineAdapter::new(4));

        let use_case = ScanWorkspaceUseCase::new(
            scanner,
            parser,
            self.rules_repo.clone(),
            ScanScope::All,
        );
        let result = use_case.execute(self.root.path());
        result.violations
    }
}
