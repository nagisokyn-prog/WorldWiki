use cerberus_application::RenderTreeUseCase;
use cerberus_domain::{LimitsConfig, PressureWeights};
use std::fs;
use std::path::Path;
use tempfile::tempdir;

#[test]
fn test_render_tree_use_case_execution() {
    let temp = tempdir().unwrap();
    let crate_dir = temp.path().join("my_crate");
    let src_dir = crate_dir.join("src");
    fs::create_dir_all(&src_dir).unwrap();

    fs::write(
        crate_dir.join("Cargo.toml"),
        "[package]\nname = \"my_crate\"\nversion = \"0.1.0\"\n",
    )
    .unwrap();

    fs::write(
        src_dir.join("lib.rs"),
        "// Comment line\n/* Block comment */\n* aster\nuse std::io;\nasync fn foo() {\n    if true && false || true {\n        match 1 {\n            _ => (),\n        }\n    }\n}\n",
    )
    .unwrap();

    let use_case = RenderTreeUseCase::new(LimitsConfig::default(), PressureWeights::default());
    let report = use_case.execute(temp.path()).unwrap();

    assert_eq!(report.packages.len(), 1);
    assert_eq!(report.packages[0].name, "my_crate");
    assert_eq!(report.total_files, 1);
    assert_eq!(report.healthy_count, 1);
}

#[test]
fn test_render_tree_generic_package_without_src_dir() {
    let temp = tempdir().unwrap();
    let root = temp.path();

    fs::write(root.join("index.ts"), "export const x = 1;").unwrap();

    let use_case = RenderTreeUseCase::new(LimitsConfig::default(), PressureWeights::default());
    let report = use_case.execute(root).unwrap();

    assert_eq!(report.packages.len(), 1);
    assert_eq!(report.total_files, 1);
    assert_eq!(report.healthy_count, 1);
}

#[test]
fn test_render_tree_invalid_path_error() {
    let use_case = RenderTreeUseCase::new(LimitsConfig::default(), PressureWeights::default());
    let res = use_case.execute(Path::new("non_existent_dir_12345"));
    assert!(res.is_err());
}

#[test]
fn test_render_tree_workspace_all_branches_and_edge_cases() {
    let temp = tempdir().unwrap();
    let root = temp.path();

    // 1. Crate with single quotes in Cargo.toml and zone of pain
    let crate_a = root.join("crate_a");
    let src_a = crate_a.join("src").join("deep").join("nested");
    fs::create_dir_all(&src_a).unwrap();
    fs::write(
        crate_a.join("Cargo.toml"),
        "[package]\nname = 'crate_a'\nversion = \"0.1.0\"\n",
    )
    .unwrap();
    fs::write(
        src_a.join("heavy_logic.rs"),
        "fn compute() {\n    for _ in 0..10 {\n        while true {\n            let _ = 1;\n        }\n    }\n}\n",
    )
    .unwrap();

    // JS/TS/CSS/Vue and ignored extensions
    fs::write(src_a.join("styles.css"), "body { margin: 0; }").unwrap();
    fs::write(src_a.join("readme.md"), "# Readme").unwrap();

    // Ignored dir inside src_a
    let ignored_dir = src_a.join("target");
    fs::create_dir_all(&ignored_dir).unwrap();
    fs::write(ignored_dir.join("ignored.rs"), "pub fn ignored() {}").unwrap();

    // 2. Crate B without src directory (should be skipped)
    let crate_b = root.join("crate_b");
    fs::create_dir_all(&crate_b).unwrap();
    fs::write(
        crate_b.join("Cargo.toml"),
        "[package]\nname = \"crate_b\"\n",
    )
    .unwrap();

    // 3. Crate C without name = in Cargo.toml (fallback to dir name)
    let crate_c = root.join("crate_c");
    let src_c = crate_c.join("src");
    fs::create_dir_all(&src_c).unwrap();
    fs::write(crate_c.join("Cargo.toml"), "[workspace]\nmembers = []\n").unwrap();
    fs::write(src_c.join("trait_port.rs"), "pub trait DatabasePort {}").unwrap();
    fs::write(
        src_c.join("component.vue"),
        "<script>\nimport { ref } from 'vue';\nfunction render() {\n    const cb = () => {\n        return 1;\n    };\n}\n</script>\n",
    )
    .unwrap();

    // 4. Warning file by SLOC
    let mut warn_content = String::new();
    for i in 0..520 {
        warn_content.push_str(&format!("const line_{} = {};\n", i, i));
    }
    fs::write(src_c.join("warn.ts"), &warn_content).unwrap();

    // 5. Critical file by SLOC
    let mut crit_content = String::new();
    for i in 0..850 {
        crit_content.push_str(&format!("const heavy_{} = {};\n", i, i));
    }
    fs::write(src_c.join("critical.rs"), &crit_content).unwrap();

    let use_case = RenderTreeUseCase::new(LimitsConfig::default(), PressureWeights::default());
    let report = use_case.execute(root).unwrap();

    assert_eq!(report.packages.len(), 2);
    let pkg_a = report.packages.iter().find(|p| p.name == "crate_a").unwrap();
    assert_eq!(pkg_a.name, "crate_a");
    assert!(pkg_a.is_zone_of_pain);

    let pkg_c = report.packages.iter().find(|p| p.name == "crate_c").unwrap();
    assert_eq!(pkg_c.name, "crate_c");
    assert!(report.warning_count >= 1);
    assert!(report.critical_count >= 1);
}

#[test]
fn test_render_tree_root_name_fallbacks() {
    let temp = tempdir().unwrap();
    let root = temp.path();

    // Create Cargo.toml at root with no package name
    fs::write(root.join("Cargo.toml"), "[workspace]\n").unwrap();
    fs::create_dir_all(root.join("src")).unwrap();
    fs::write(root.join("src/lib.rs"), "pub fn ok() {}").unwrap();

    let use_case = RenderTreeUseCase::new(LimitsConfig::default(), PressureWeights::default());
    let report = use_case.execute(root).unwrap();
    assert_eq!(report.packages.len(), 1);
}
