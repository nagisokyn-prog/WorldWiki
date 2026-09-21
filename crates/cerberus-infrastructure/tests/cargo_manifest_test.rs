use cerberus_infrastructure::CargoMetadataManifestAdapter;
use cerberus_ports::ManifestParserPort;
use tempfile::tempdir;

#[test]
#[allow(clippy::default_constructed_unit_structs)]
fn test_cargo_metadata_manifest_default_and_non_existent() {
    let adapter = CargoMetadataManifestAdapter::default();
    let temp = tempdir().unwrap();
    let violations = adapter.check_manifest_layers(temp.path()).unwrap();
    assert!(violations.is_empty());
}

#[test]
fn test_cargo_metadata_missing_layer_warning_arch021() {
    let temp = tempdir().unwrap();
    let cargo_toml = temp.path().join("Cargo.toml");
    let content = r#"
        [workspace]
        members = ["test-crate"]
    "#;
    std::fs::write(&cargo_toml, content).unwrap();

    let sub_crate_dir = temp.path().join("test-crate");
    std::fs::create_dir_all(sub_crate_dir.join("src")).unwrap();
    std::fs::write(sub_crate_dir.join("src/lib.rs"), "pub fn hello() {}").unwrap();
    let sub_cargo = r#"
        [package]
        name = "test-crate"
        version = "0.1.0"
        edition = "2021"
    "#;
    std::fs::write(sub_crate_dir.join("Cargo.toml"), sub_cargo).unwrap();

    let adapter = CargoMetadataManifestAdapter::new();
    let violations = adapter.check_manifest_layers(&cargo_toml).unwrap();
    let arch021 = violations.iter().find(|v| v.rule_id == "ARCH-021");
    assert!(arch021.is_some(), "Should warn about missing [package.metadata.cerberus]");
}

#[test]
fn test_cargo_metadata_layer_violations_arch001_arch002_arch020() {
    let temp = tempdir().unwrap();
    let cargo_toml = temp.path().join("Cargo.toml");
    let root_content = r#"
        [workspace]
        members = ["domain-crate", "app-crate", "ports-crate", "infra-crate"]
    "#;
    std::fs::write(&cargo_toml, root_content).unwrap();

    let infra_dir = temp.path().join("infra-crate");
    std::fs::create_dir_all(infra_dir.join("src")).unwrap();
    std::fs::write(infra_dir.join("src/lib.rs"), "pub fn i() {}").unwrap();
    let infra_cargo = r#"
        [package]
        name = "infra-crate"
        version = "0.1.0"
        edition = "2021"

        [package.metadata.cerberus]
        layer = "infrastructure"

        [dependencies]
        serde = "1.0"
    "#;
    std::fs::write(infra_dir.join("Cargo.toml"), infra_cargo).unwrap();

    let domain_dir = temp.path().join("domain-crate");
    std::fs::create_dir_all(domain_dir.join("src")).unwrap();
    std::fs::write(domain_dir.join("src/lib.rs"), "pub fn d() {}").unwrap();
    let domain_cargo = r#"
        [package]
        name = "domain-crate"
        version = "0.1.0"
        edition = "2021"

        [package.metadata.cerberus]
        layer = "domain"

        [dependencies]
        serde = "1.0"
        tokio = { version = "1.0", optional = true }
        infra-crate = { path = "../infra-crate" }

        [dev-dependencies]
        tempfile = "3.8"
    "#;
    std::fs::write(domain_dir.join("Cargo.toml"), domain_cargo).unwrap();

    let app_dir = temp.path().join("app-crate");
    std::fs::create_dir_all(app_dir.join("src")).unwrap();
    std::fs::write(app_dir.join("src/lib.rs"), "pub fn a() {}").unwrap();
    let app_cargo = r#"
        [package]
        name = "app-crate"
        version = "0.1.0"
        edition = "2021"

        [package.metadata.cerberus]
        layer = "application"

        [dependencies]
        domain-crate = { path = "../domain-crate" }
        tauri = { version = "2.0", optional = true }
    "#;
    std::fs::write(app_dir.join("Cargo.toml"), app_cargo).unwrap();

    let ports_dir = temp.path().join("ports-crate");
    std::fs::create_dir_all(ports_dir.join("src")).unwrap();
    std::fs::write(ports_dir.join("src/lib.rs"), "pub fn p() {}").unwrap();
    let ports_cargo = r#"
        [package]
        name = "ports-crate"
        version = "0.1.0"
        edition = "2021"

        [package.metadata.cerberus]
        layer = "ports"

        [dependencies]
        reqwest = { version = "0.11", optional = true }
    "#;
    std::fs::write(ports_dir.join("Cargo.toml"), ports_cargo).unwrap();

    let adapter = CargoMetadataManifestAdapter::new();
    let violations = adapter.check_manifest_layers(&cargo_toml).unwrap();

    assert!(violations.iter().any(|v| v.rule_id == "ARCH-001" && v.symbol.contains("tokio")));
    assert!(violations.iter().any(|v| v.rule_id == "ARCH-020" && v.symbol.contains("domain-crate -> infra-crate")));
    assert!(violations.iter().any(|v| v.rule_id == "ARCH-002" && v.symbol.contains("tauri")));
    assert!(violations.iter().any(|v| v.rule_id == "ARCH-020" && v.symbol.contains("ports-crate -> reqwest")));
}

#[test]
fn test_cargo_metadata_corrupted_manifest_fails() {
    let temp = tempdir().unwrap();
    let cargo_toml = temp.path().join("Cargo.toml");
    std::fs::write(&cargo_toml, "[broken toml syntax").unwrap();

    let adapter = CargoMetadataManifestAdapter::new();
    assert!(adapter.check_manifest_layers(&cargo_toml).is_err());
    assert!(adapter.compute_workspace_martin_metrics(&cargo_toml).is_err());

    let non_existent = temp.path().join("missing/Cargo.toml");
    let (empty_metrics, empty_violations) = adapter.compute_workspace_martin_metrics(&non_existent).unwrap();
    assert!(empty_metrics.is_empty());
    assert!(empty_violations.is_empty());
}

#[test]
fn test_compute_workspace_martin_metrics_success() {
    let temp = tempdir().unwrap();
    let cargo_toml = temp.path().join("Cargo.toml");
    let workspace_toml = r#"
        [workspace]
        members = ["crate-a", "crate-b"]
        resolver = "2"
    "#;
    std::fs::write(&cargo_toml, workspace_toml).unwrap();

    let a_dir = temp.path().join("crate-a");
    std::fs::create_dir_all(a_dir.join("src")).unwrap();
    std::fs::write(a_dir.join("src/lib.rs"), "pub trait Action { fn run(&self); }\npub struct Actor;").unwrap();
    let a_cargo = r#"
        [package]
        name = "crate-a"
        version = "0.1.0"
        edition = "2021"
    "#;
    std::fs::write(a_dir.join("Cargo.toml"), a_cargo).unwrap();

    let b_dir = temp.path().join("crate-b");
    std::fs::create_dir_all(b_dir.join("src")).unwrap();
    std::fs::write(b_dir.join("src/lib.rs"), "use crate_a::Action;\npub fn b() {}").unwrap();
    let b_cargo = r#"
        [package]
        name = "crate-b"
        version = "0.1.0"
        edition = "2021"

        [dependencies]
        crate-a = { path = "../crate-a" }
    "#;
    std::fs::write(b_dir.join("Cargo.toml"), b_cargo).unwrap();

    let adapter = CargoMetadataManifestAdapter::new();
    let (metrics, _violations) = adapter.compute_workspace_martin_metrics(&cargo_toml).unwrap();
    assert_eq!(metrics.len(), 2);
    let a_metric = metrics.iter().find(|m| m.package_name == "crate-a").unwrap();
    assert_eq!(a_metric.afferent_coupling, 1);
    assert_eq!(a_metric.abstractness, 0.5);
}

#[test]
fn test_cargo_metadata_workspace_arch_metadata_preset() {
    let temp = tempdir().unwrap();
    let cargo_toml = temp.path().join("Cargo.toml");
    let workspace_toml = r#"
        [workspace]
        members = ["core-crate", "plugin-crate"]
        resolver = "2"

        [workspace.metadata.cerberus]
        preset = "microkernel"
        enforce_module_boundaries = true
    "#;
    std::fs::write(&cargo_toml, workspace_toml).unwrap();

    let core_dir = temp.path().join("core-crate");
    std::fs::create_dir_all(core_dir.join("src")).unwrap();
    std::fs::write(core_dir.join("src/lib.rs"), "pub fn run() {}").unwrap();
    let core_cargo = r#"
        [package]
        name = "core-crate"
        version = "0.1.0"
        edition = "2021"

        [package.metadata.cerberus]
        layer = "core"
    "#;
    std::fs::write(core_dir.join("Cargo.toml"), core_cargo).unwrap();

    let plugin_dir = temp.path().join("plugin-crate");
    std::fs::create_dir_all(plugin_dir.join("src")).unwrap();
    std::fs::write(plugin_dir.join("src/lib.rs"), "pub fn p() {}").unwrap();
    let plugin_cargo = r#"
        [package]
        name = "plugin-crate"
        version = "0.1.0"
        edition = "2021"

        [package.metadata.cerberus]
        layer = "plugin"

        [dependencies]
        core-crate = { path = "../core-crate" }
    "#;
    std::fs::write(plugin_dir.join("Cargo.toml"), plugin_cargo).unwrap();

    let adapter = CargoMetadataManifestAdapter::new();
    let violations = adapter.check_manifest_layers(&cargo_toml).unwrap();
    assert!(violations.iter().any(|v| v.rule_id == "ARCH-020"), "Plugin cannot directly depend on core in microkernel preset");
}
