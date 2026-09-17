use cerberus_infrastructure::WalkDirScannerAdapter;
use cerberus_ports::{FileSystemScannerPort, ScanScope};
use tempfile::tempdir;

#[test]
fn test_walkdir_scanner_respects_scopes_and_filters() {
    let temp = tempdir().unwrap();
    let root = temp.path();

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

    let all_files = scanner.scan_files(root, ScanScope::All);
    assert_eq!(all_files.len(), 3);
    assert_eq!(all_files[0].crate_name, "my-crate");

    let front_files = scanner.scan_files(root, ScanScope::FrontendOnly);
    assert_eq!(front_files.len(), 2);

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

    let src = root.join("src");
    std::fs::create_dir_all(&src).unwrap();
    std::fs::write(src.join("lib.rs"), "pub fn ok() {}").unwrap();

    let legacy = src.join(".logic_legacy/ai");
    std::fs::create_dir_all(&legacy).unwrap();
    std::fs::write(legacy.join("manager.rs"), "pub fn bad() {}").unwrap();

    let ignored_dir = root.join("custom_ignore");
    std::fs::create_dir_all(&ignored_dir).unwrap();
    std::fs::write(ignored_dir.join("skip.rs"), "pub fn skip() {}").unwrap();

    let scanner = WalkDirScannerAdapter::new().with_ignores(vec!["custom_ignore".into()]);
    let files = scanner.scan_files(root, ScanScope::All);

    assert_eq!(files.len(), 1);
    assert_eq!(files[0].path.file_name().unwrap(), "lib.rs");
}

#[test]
fn test_walkdir_pattern_matching_and_fallback_inferences() {
    use cerberus_infrastructure::scanner::matches_ignore_pattern;

    // Pattern matching tests
    assert!(matches_ignore_pattern("dist/bundle.min.js", "**/*.min.js"));
    assert!(matches_ignore_pattern("temp/file.tmp", "*.tmp"));
    assert!(matches_ignore_pattern("docs/architecture/spec.md", "docs/**"));
    assert!(matches_ignore_pattern("crates/pkg/target/debug/app", "**/target/**"));

    // Fallback directory inference tests
    let temp = tempdir().unwrap();
    let crate_dir = temp.path().join("nameless_crate");
    std::fs::create_dir_all(&crate_dir).unwrap();
    std::fs::write(crate_dir.join("Cargo.toml"), "[workspace]\n").unwrap();
    let rs_file = crate_dir.join("lib.rs");
    std::fs::write(&rs_file, "pub fn ok() {}").unwrap();

    let scanner = WalkDirScannerAdapter::new();
    let files = scanner.scan_files(&crate_dir, ScanScope::BackendOnly);
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].crate_name, "nameless_crate");

    let js_dir = temp.path().join("nameless_pkg");
    std::fs::create_dir_all(&js_dir).unwrap();
    std::fs::write(js_dir.join("package.json"), "{\n  \"version\": \"1.0\"\n}").unwrap();
    let js_file = js_dir.join("index.ts");
    std::fs::write(&js_file, "export const x = 1;").unwrap();

    let files_js = scanner.scan_files(&js_dir, ScanScope::FrontendOnly);
    assert_eq!(files_js.len(), 1);
    assert_eq!(files_js[0].crate_name, "nameless_pkg");
}
