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

                // 1. Auto-skip hidden folders and files starting with '.' within root_dir
                if let Ok(rel_path) = path.strip_prefix(root_dir) {
                    for component in rel_path.components() {
                        let s = component.as_os_str().to_string_lossy();
                        if s.starts_with('.') {
                            return false;
                        }
                    }
                }

                // 2. Custom and built-in ignore patterns relative to root_dir
                if let Ok(rel_path) = path.strip_prefix(root_dir) {
                    let rel_str = rel_path.to_string_lossy().replace('\\', "/");
                    for pattern in &self.ignore_patterns {
                        if matches_ignore_pattern(&rel_str, pattern) {
                            return false;
                        }
                    }
                }

                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                match scope {
                    ScanScope::All => matches!(ext, "rs" | "vue" | "css" | "ts" | "js"),
                    ScanScope::FrontendOnly => matches!(ext, "vue" | "css" | "ts" | "js"),
                    ScanScope::BackendOnly => ext == "rs",
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

pub fn matches_ignore_pattern(rel_path: &str, pattern: &str) -> bool {
    let norm_path = rel_path.replace('\\', "/");
    let norm_pat = pattern.replace('\\', "/");

    // Suffix match (e.g. "*.min.js", "**/*.prod.js", "*.log")
    if norm_pat.contains('*') {
        if let Some(suffix) = norm_pat.strip_prefix("**/*") {
            if norm_path.ends_with(suffix) {
                return true;
            }
        }
        if let Some(suffix) = norm_pat.strip_prefix("*") {
            if norm_path.ends_with(suffix) {
                return true;
            }
        }
        if let Some(prefix) = norm_pat.strip_suffix("/**") {
            let clean_prefix = prefix.trim_start_matches("**/").trim_matches('/');
            if !clean_prefix.is_empty()
                && (norm_path == clean_prefix
                    || norm_path.starts_with(&format!("{clean_prefix}/"))
                    || norm_path.contains(&format!("/{clean_prefix}/"))
                    || norm_path.ends_with(&format!("/{clean_prefix}")))
            {
                return true;
            }
        }
    }

    // Direct folder or prefix match (e.g. "target", "node_modules", "dist")
    let clean = norm_pat.trim_matches('*').trim_matches('/');
    if !clean.is_empty()
        && (norm_path == clean
            || norm_path.starts_with(&format!("{clean}/"))
            || norm_path.contains(&format!("/{clean}/"))
            || norm_path.ends_with(&format!("/{clean}")))
    {
        return true;
    }

    false
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


#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_walkdir_scanner_respects_scopes_and_filters() {
        let temp = tempdir().unwrap();
        let root = temp.path();

        // Create directory structure:
        // root/
        //   Cargo.toml
        //   src/lib.rs
        //   src/App.vue
        //   src/style.css
        //   target/junk.rs
        //   node_modules/junk.js
        std::fs::write(root.join("Cargo.toml"), "[package]\nname = \"my-crate\"").unwrap();
        let src_dir = root.join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(src_dir.join("lib.rs"), "// rust").unwrap();
        std::fs::write(src_dir.join("App.vue"), "<template></template>").unwrap();
        std::fs::write(src_dir.join("style.css"), "body {}").unwrap();

        let target_dir = root.join("target");
        std::fs::create_dir_all(&target_dir).unwrap();
        std::fs::write(target_dir.join("junk.rs"), "// ignored").unwrap();

        let scanner = WalkDirScannerAdapter::new();

        // 1. All
        let all_files = scanner.scan_files(root, ScanScope::All);
        assert_eq!(all_files.len(), 3);
        assert_eq!(all_files[0].crate_name, "my-crate");

        // 2. FrontendOnly
        let front_files = scanner.scan_files(root, ScanScope::FrontendOnly);
        assert_eq!(front_files.len(), 2);

        // 3. BackendOnly
        let back_files = scanner.scan_files(root, ScanScope::BackendOnly);
        assert_eq!(back_files.len(), 1);
        assert_eq!(back_files[0].path.file_name().unwrap(), "lib.rs");
    }

    #[test]
    #[allow(clippy::default_constructed_unit_structs)]
    fn test_walkdir_scanner_package_json_inference() {
        let temp = tempdir().unwrap();
        let root = temp.path();
        std::fs::write(root.join("package.json"), "{\n  \"name\": \"@worldwiki/spa\"\n}").unwrap();
        let src = root.join("src");
        std::fs::create_dir_all(&src).unwrap();
        let vue_file = src.join("Main.vue");
        std::fs::write(&vue_file, "<template></template>").unwrap();

        let scanner = WalkDirScannerAdapter::default();
        let files = scanner.scan_files(root, ScanScope::FrontendOnly);
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].crate_name, "@worldwiki/spa");
    }

    #[test]
    fn test_walkdir_scanner_unknown_crate_inference() {
        let temp = tempdir().unwrap();
        let lone_file = temp.path().join("standalone.rs");
        std::fs::write(&lone_file, "// standalone").unwrap();

        let scanner = WalkDirScannerAdapter::new();
        let files = scanner.scan_files(temp.path(), ScanScope::BackendOnly);
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].crate_name, "unknown");
    }

    #[test]
    fn test_walkdir_scanner_skips_hidden_dot_directories_and_custom_ignores() {
        let temp = tempdir().unwrap();
        let root = temp.path();

        // 1. Normal file
        let src = root.join("src");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("lib.rs"), "pub fn ok() {}").unwrap();

        // 2. Hidden dot directory (.logic_legacy)
        let legacy = src.join(".logic_legacy/ai");
        std::fs::create_dir_all(&legacy).unwrap();
        std::fs::write(legacy.join("manager.rs"), "pub fn bad() {}").unwrap();

        // 3. Custom ignored directory
        let ignored_dir = root.join("custom_ignore");
        std::fs::create_dir_all(&ignored_dir).unwrap();
        std::fs::write(ignored_dir.join("skip.rs"), "pub fn skip() {}").unwrap();

        let scanner = WalkDirScannerAdapter::new().with_ignores(vec!["custom_ignore".into()]);
        let files = scanner.scan_files(root, ScanScope::All);

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path.file_name().unwrap(), "lib.rs");
    }
}



