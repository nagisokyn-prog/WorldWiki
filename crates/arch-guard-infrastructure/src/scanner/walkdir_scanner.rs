use arch_guard_ports::{FileSystemScannerPort, ScanScope, ScannedSourceFile};
use std::path::Path;
use walkdir::WalkDir;


pub struct WalkDirScannerAdapter;

impl WalkDirScannerAdapter {
    pub fn new() -> Self {
        Self
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
    fn test_walkdir_scanner_package_json_inference() {
        let temp = tempdir().unwrap();
        let root = temp.path();
        std::fs::write(root.join("package.json"), "{\n  \"name\": \"@worldwiki/spa\"\n}").unwrap();
        let src = root.join("src");
        std::fs::create_dir_all(&src).unwrap();
        let vue_file = src.join("Main.vue");
        std::fs::write(&vue_file, "<template></template>").unwrap();

        let scanner = WalkDirScannerAdapter;
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
}



