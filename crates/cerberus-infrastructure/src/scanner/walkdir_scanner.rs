use cerberus_domain::is_path_ignored;
pub use cerberus_domain::matches_ignore_pattern;
use cerberus_ports::{FileSystemScannerPort, ScanScope, ScannedSourceFile};
use std::path::Path;
use walkdir::WalkDir;

pub struct WalkDirScannerAdapter {
    pub ignore_patterns: Vec<String>,
}

impl WalkDirScannerAdapter {
    pub fn new() -> Self {
        Self {
            ignore_patterns: vec![
                "target".into(),
                "node_modules".into(),
                ".git".into(),
                "dist".into(),
                "coverage".into(),
            ],
        }
    }

    pub fn with_ignores(mut self, ignores: Vec<String>) -> Self {
        self.ignore_patterns.extend(ignores);
        self
    }
}

impl Default for WalkDirScannerAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl FileSystemScannerPort for WalkDirScannerAdapter {
    fn scan_files(&self, root_dir: &Path, scope: ScanScope) -> Vec<ScannedSourceFile> {
        WalkDir::new(root_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                let path = e.path();

                if let Ok(rel_path) = path.strip_prefix(root_dir) {
                    if is_path_ignored(rel_path, &self.ignore_patterns) {
                        return false;
                    }
                }

                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                match scope {
                    ScanScope::All => matches!(ext, "rs" | "vue" | "css" | "ts" | "js" | "surql"),
                    ScanScope::FrontendOnly => matches!(ext, "vue" | "css" | "ts" | "js"),
                    ScanScope::BackendOnly => matches!(ext, "rs" | "surql"),
                }
            })
            .map(|e| {
                let path = e.path().to_path_buf();
                let crate_name = infer_crate_name(&path);
                ScannedSourceFile { path, crate_name }
            })
            .collect()
    }
}

fn infer_crate_name(file_path: &Path) -> String {
    let mut current = file_path.parent();
    while let Some(dir) = current {
        let cargo_toml = dir.join("Cargo.toml");
        if cargo_toml.exists() {
            if let Ok(content) = std::fs::read_to_string(&cargo_toml) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("name") && trimmed.contains('=') {
                        if let Some(val) = trimmed.split('=').nth(1) {
                            return val.trim().trim_matches('"').trim_matches('\'').to_string();
                        }
                    }
                }
            }
            if let Some(name) = dir.file_name() {
                return name.to_string_lossy().to_string();
            }
        }

        let package_json = dir.join("package.json");
        if package_json.exists() {
            if let Ok(content) = std::fs::read_to_string(&package_json) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("\"name\"") && trimmed.contains(':') {
                        if let Some(val) = trimmed.split(':').nth(1) {
                            return val.trim().trim_matches(',').trim_matches('"').trim_matches('\'').trim().to_string();
                        }
                    }
                }
            }
            if let Some(name) = dir.file_name() {
                return name.to_string_lossy().to_string();
            }
        }

        current = dir.parent();
    }
    "unknown".to_string()
}
