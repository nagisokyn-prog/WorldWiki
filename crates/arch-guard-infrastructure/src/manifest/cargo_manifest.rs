use arch_guard_domain::{ArchLayer, Category, Severity, Violation};
use arch_guard_ports::ManifestParserPort;
use cargo_metadata::MetadataCommand;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub struct CargoMetadataManifestAdapter;

impl CargoMetadataManifestAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Default for CargoMetadataManifestAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ManifestParserPort for CargoMetadataManifestAdapter {
    fn check_manifest_layers(&self, workspace_root: &Path) -> Result<Vec<Violation>, String> {
        let manifest_path = if workspace_root.is_file() && workspace_root.ends_with("Cargo.toml") {
            workspace_root.to_path_buf()
        } else {
            workspace_root.join("Cargo.toml")
        };

        if !manifest_path.exists() {
            return Ok(Vec::new());
        }

        let metadata = MetadataCommand::new()
            .manifest_path(&manifest_path)
            .exec()
            .map_err(|e| format!("Failed to read cargo metadata: {}", e))?;

        let mut violations = Vec::new();
        let mut package_layers: HashMap<String, ArchLayer> = HashMap::new();
        let mut package_manifests: HashMap<String, PathBuf> = HashMap::new();

        // 1. First pass: extract declared layers for each workspace package
        for pkg in &metadata.packages {
            if metadata.workspace_members.contains(&pkg.id) {
                let pkg_name_str = pkg.name.to_string();
                let declared_layer = pkg
                    .metadata
                    .get("arch-guard")
                    .and_then(|m| m.get("layer"))
                    .and_then(|l| l.as_str());

                let layer = match declared_layer {
                    Some(l_str) => ArchLayer::parse(l_str),
                    None => {
                        violations.push(Violation {
                            rule_id: "ARCH-021".into(),
                            rule_version: "1.0".into(),
                            category: Category::Architecture,
                            severity: Severity::Warn,
                            file: pkg.manifest_path.clone().into_std_path_buf(),
                            line: 1,
                            column: 1,
                            symbol: pkg_name_str.clone(),
                            snippet: format!("[package]\nname = \"{}\"", pkg_name_str),
                            message: format!(
                                "Crate '{}' is missing architectural layer metadata [package.metadata.arch-guard].layer in Cargo.toml",
                                pkg_name_str
                            ),
                            remediation: "Declare layer = \"domain|ports|application|infrastructure|adapter|cli\" in Cargo.toml".into(),
                            fingerprint: format!("arch021_{}", pkg_name_str),
                        });
                        ArchLayer::Unknown
                    }
                };

                package_layers.insert(pkg_name_str.clone(), layer);
                package_manifests.insert(pkg_name_str, pkg.manifest_path.clone().into_std_path_buf());
            }
        }

        // 2. Second pass: check dependencies against layer matrix
        for pkg in &metadata.packages {
            if !metadata.workspace_members.contains(&pkg.id) {
                continue;
            }

            let pkg_name_str = pkg.name.as_str();
            let current_layer = package_layers.get(pkg_name_str).copied().unwrap_or(ArchLayer::Unknown);
            let manifest_file = package_manifests.get(pkg_name_str).cloned().unwrap_or_default();


            for dep in &pkg.dependencies {
                // Ignore dev-dependencies and build-dependencies (serde_derive/syn, tests, etc.)
                if dep.kind != cargo_metadata::DependencyKind::Normal {
                    continue;
                }

                // 2a. Workspace cross-crate dependency validation
                if let Some(&target_layer) = package_layers.get(&dep.name) {
                    if !current_layer.can_depend_on(target_layer) {
                        violations.push(Violation {
                            rule_id: "ARCH-020".into(),
                            rule_version: "1.0".into(),
                            category: Category::Architecture,
                            severity: Severity::Deny,
                            file: manifest_file.clone(),
                            line: 1,
                            column: 1,
                            symbol: format!("{} -> {}", pkg.name, dep.name),
                            snippet: format!("{} = {{ path = ... }}", dep.name),
                            message: format!(
                                "Layer dependency violation: '{}' (layer: {}) is forbidden from depending on '{}' (layer: {})",
                                pkg.name,
                                current_layer.as_str(),
                                dep.name,
                                target_layer.as_str()
                            ),
                            remediation: format!(
                                "Invert dependency or move logic: layer '{}' cannot depend on '{}'",
                                current_layer.as_str(),
                                target_layer.as_str()
                            ),
                            fingerprint: format!("arch020_{}_{}", pkg.name, dep.name),
                        });
                    }
                    continue;
                }

                // 2b. Strict External Whitelist for pure layers
                match current_layer {
                    ArchLayer::Domain => {
                        let domain_whitelist = [
                            "serde", "serde_json", "sha2", "chrono", "thiserror", "uuid",
                            "num-traits", "bitflags", "zeroize", "regex", "derive_more",
                        ];
                        if !domain_whitelist.contains(&dep.name.as_str()) {
                            violations.push(Violation {
                                rule_id: "ARCH-001".into(),
                                rule_version: "1.0".into(),
                                category: Category::Architecture,
                                severity: Severity::Deny,
                                file: manifest_file.clone(),
                                line: 1,
                                column: 1,
                                symbol: format!("{} -> {}", pkg.name, dep.name),
                                snippet: format!("{} = \"{}\"", dep.name, dep.req),
                                message: format!(
                                    "Domain crate '{}' declared unauthorized external dependency '{}' in Cargo.toml",
                                    pkg.name, dep.name
                                ),
                                remediation: "Domain layer allows only pure DTO/math crates (serde, chrono, sha2, thiserror). Move I/O/UI crates to infrastructure.".into(),
                                fingerprint: format!("arch001_manifest_{}_{}", pkg.name, dep.name),
                            });
                        }
                    }
                    ArchLayer::Ports => {
                        let ports_whitelist = [
                            "serde", "serde_json", "chrono", "thiserror", "uuid", "async-trait",
                        ];
                        if !ports_whitelist.contains(&dep.name.as_str()) {
                            violations.push(Violation {
                                rule_id: "ARCH-020".into(),
                                rule_version: "1.0".into(),
                                category: Category::Architecture,
                                severity: Severity::Deny,
                                file: manifest_file.clone(),
                                line: 1,
                                column: 1,
                                symbol: format!("{} -> {}", pkg.name, dep.name),
                                snippet: format!("{} = \"{}\"", dep.name, dep.req),
                                message: format!(
                                    "Ports crate '{}' declared unauthorized external dependency '{}' in Cargo.toml",
                                    pkg.name, dep.name
                                ),
                                remediation: "Ports layer defines traits only. Move concrete SDK dependencies to infrastructure adapters.".into(),
                                fingerprint: format!("arch020_ports_manifest_{}_{}", pkg.name, dep.name),
                            });
                        }
                    }
                    ArchLayer::Application => {
                        let app_whitelist = [
                            "serde", "serde_json", "chrono", "hmac", "sha2", "thiserror",
                            "uuid", "regex", "async-trait",
                        ];
                        if !app_whitelist.contains(&dep.name.as_str()) {
                            violations.push(Violation {
                                rule_id: "ARCH-002".into(),
                                rule_version: "1.0".into(),
                                category: Category::Architecture,
                                severity: Severity::Deny,
                                file: manifest_file.clone(),
                                line: 1,
                                column: 1,
                                symbol: format!("{} -> {}", pkg.name, dep.name),
                                snippet: format!("{} = \"{}\"", dep.name, dep.req),
                                message: format!(
                                    "Application crate '{}' declared unauthorized external dependency '{}' in Cargo.toml",
                                    pkg.name, dep.name
                                ),
                                remediation: "Application layer orchestrates domain and ports. UI/Tauri/Database SDKs must reside in infrastructure or adapters.".into(),
                                fingerprint: format!("arch002_manifest_{}_{}", pkg.name, dep.name),
                            });
                        }
                    }
                    _ => {}
                }
            }
        }

        Ok(violations)

    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    #[allow(clippy::default_constructed_unit_structs)]
    fn test_cargo_metadata_manifest_default_and_non_existent() {
        let adapter = CargoMetadataManifestAdapter::default();
        let temp = tempdir().unwrap();
        // Missing Cargo.toml
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
        assert!(arch021.is_some(), "Should warn about missing [package.metadata.arch-guard]");
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

        // 1. Infra crate (with a normal dep to cover infra layer branch)
        let infra_dir = temp.path().join("infra-crate");
        std::fs::create_dir_all(infra_dir.join("src")).unwrap();
        std::fs::write(infra_dir.join("src/lib.rs"), "pub fn i() {}").unwrap();
        let infra_cargo = r#"
            [package]
            name = "infra-crate"
            version = "0.1.0"
            edition = "2021"

            [package.metadata.arch-guard]
            layer = "infrastructure"

            [dependencies]
            serde = "1.0"
        "#;
        std::fs::write(infra_dir.join("Cargo.toml"), infra_cargo).unwrap();

        // 2. Domain crate declaring prohibited external dep (tokio) AND prohibited internal dep (infra-crate)
        let domain_dir = temp.path().join("domain-crate");
        std::fs::create_dir_all(domain_dir.join("src")).unwrap();
        std::fs::write(domain_dir.join("src/lib.rs"), "pub fn d() {}").unwrap();
        let domain_cargo = r#"
            [package]
            name = "domain-crate"
            version = "0.1.0"
            edition = "2021"

            [package.metadata.arch-guard]
            layer = "domain"

            [dependencies]
            serde = "1.0"
            tokio = { version = "1.0", optional = true }
            infra-crate = { path = "../infra-crate" }

            [dev-dependencies]
            tempfile = "3.8"
        "#;
        std::fs::write(domain_dir.join("Cargo.toml"), domain_cargo).unwrap();

        // 3. Application crate depending on domain AND declaring prohibited dep (tauri)
        let app_dir = temp.path().join("app-crate");
        std::fs::create_dir_all(app_dir.join("src")).unwrap();
        std::fs::write(app_dir.join("src/lib.rs"), "pub fn a() {}").unwrap();
        let app_cargo = r#"
            [package]
            name = "app-crate"
            version = "0.1.0"
            edition = "2021"

            [package.metadata.arch-guard]
            layer = "application"

            [dependencies]
            domain-crate = { path = "../domain-crate" }
            tauri = { version = "2.0", optional = true }
        "#;
        std::fs::write(app_dir.join("Cargo.toml"), app_cargo).unwrap();

        // 4. Ports crate declaring prohibited external dep (tokio)
        let ports_dir = temp.path().join("ports-crate");
        std::fs::create_dir_all(ports_dir.join("src")).unwrap();
        std::fs::write(ports_dir.join("src/lib.rs"), "pub fn p() {}").unwrap();
        let ports_cargo = r#"
            [package]
            name = "ports-crate"
            version = "0.1.0"
            edition = "2021"

            [package.metadata.arch-guard]
            layer = "ports"

            [dependencies]
            tokio = { version = "1.0", optional = true }
        "#;
        std::fs::write(ports_dir.join("Cargo.toml"), ports_cargo).unwrap();

        let adapter = CargoMetadataManifestAdapter::new();
        let violations = adapter.check_manifest_layers(&cargo_toml).unwrap();

        // Check domain crate triggered ARCH-001 for tokio
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-001" && v.symbol.contains("tokio")));

        // Check domain crate triggered ARCH-020 for depending on infra-crate
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-020" && v.symbol.contains("domain-crate -> infra-crate")));

        // Check app crate triggered ARCH-002 for tauri
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-002" && v.symbol.contains("tauri")));

        // Check ports crate triggered ARCH-020 for tokio
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-020" && v.symbol.contains("ports-crate -> tokio")));
    }

    #[test]
    fn test_cargo_metadata_corrupted_manifest_fails() {
        let temp = tempdir().unwrap();
        let cargo_toml = temp.path().join("Cargo.toml");
        std::fs::write(&cargo_toml, "[broken toml syntax").unwrap();

        let adapter = CargoMetadataManifestAdapter::new();
        assert!(adapter.check_manifest_layers(&cargo_toml).is_err());
    }
}
