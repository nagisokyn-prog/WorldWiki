use arch_guard_domain::Violation;
use arch_guard_ports::{AstParserPort, RulesRepositoryPort};
use rayon::prelude::*;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use walkdir::WalkDir;

#[derive(Debug)]
pub struct ScanResult {
    pub violations: Vec<Violation>,
    pub parse_errors: Vec<String>,
    pub total_files_scanned: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScanScope {
    All,
    FrontendOnly,
    BackendOnly,
}

pub struct ScanWorkspaceUseCase {
    pub parsers: Vec<Arc<dyn AstParserPort>>,
    pub rules_repo: Arc<dyn RulesRepositoryPort>,
    pub scope: ScanScope,
}

impl ScanWorkspaceUseCase {
    pub fn new(
        parsers: Vec<Arc<dyn AstParserPort>>,
        rules_repo: Arc<dyn RulesRepositoryPort>,
        scope: ScanScope,
    ) -> Self {
        Self {
            parsers,
            rules_repo,
            scope,
        }
    }

    pub fn execute(&self, root_dir: &Path) -> ScanResult {
        let files: Vec<PathBuf> = WalkDir::new(root_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                let path = e.path();
                let path_str = path.to_string_lossy();
                if path_str.contains("target")
                    || path_str.contains("node_modules")
                    || path_str.contains(".git")
                    || path_str.contains("dist")
                    || path_str.contains("coverage")
                {
                    return false;
                }

                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                match self.scope {
                    ScanScope::All => matches!(ext, "rs" | "vue" | "css" | "ts" | "js"),
                    ScanScope::FrontendOnly => matches!(ext, "vue" | "css" | "ts" | "js"),
                    ScanScope::BackendOnly => ext == "rs",
                }
            })
            .map(|e| e.path().to_path_buf())
            .collect();

        let total_files_scanned = files.len();

        let results: Vec<Result<Vec<Violation>, String>> = files
            .par_iter()
            .map(|file_path| {
                let crate_name = infer_crate_name(file_path);
                for parser in &self.parsers {
                    if parser.can_parse(file_path) {
                        return parser.parse_file(file_path, &crate_name);
                    }
                }
                Ok(Vec::new())
            })
            .collect();

        let mut violations = Vec::new();
        let mut parse_errors = Vec::new();

        for res in results {
            match res {
                Ok(file_violations) => violations.extend(file_violations),
                Err(err) => parse_errors.push(err),
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

fn infer_crate_name(file_path: &Path) -> String {
    let mut current = file_path.parent();
    while let Some(dir) = current {
        if dir.join("Cargo.toml").exists() {
            if let Some(name) = dir.file_name() {
                return name.to_string_lossy().to_string();
            }
        }
        current = dir.parent();
    }
    "unknown".to_string()
}
