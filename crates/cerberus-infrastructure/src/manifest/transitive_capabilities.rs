use cargo_metadata::Metadata;
use cerberus_domain::{
    compute_fingerprint, ArchLayer, Category, Severity, Violation,
};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(Default)]
pub struct TransitiveCapabilityChecker;

impl TransitiveCapabilityChecker {
    pub fn new() -> Self {
        Self
    }

    /// Check if pure layers (domain, ports) pull forbidden transitive capabilities
    pub fn check_transitive_capabilities(
        metadata: &Metadata,
        package_layers: &HashMap<String, ArchLayer>,
        package_manifests: &HashMap<String, PathBuf>,
    ) -> Vec<Violation> {
        let prohibited_crates = [
            "reqwest", "hyper", "ureq", "tungstenite", "tokio-native-tls", "native-tls",
            "posix-spawn", "subprocess", "duct", "open",
        ];

        let mut violations = Vec::new();

        for pkg in &metadata.packages {
            let pkg_name = pkg.name.as_str();
            let layer = package_layers.get(pkg_name).cloned().unwrap_or(ArchLayer::Unknown);

            if matches!(layer, ArchLayer::Domain | ArchLayer::Ports) {
                let manifest_file = package_manifests
                    .get(pkg_name)
                    .cloned()
                    .unwrap_or_else(|| PathBuf::from(format!("crates/{}/Cargo.toml", pkg_name)));

                let mut visited: HashSet<String> = HashSet::new();
                let mut queue: Vec<String> = pkg.dependencies.iter().map(|d| d.name.clone()).collect();

                while let Some(dep_name) = queue.pop() {
                    if !visited.insert(dep_name.clone()) {
                        continue;
                    }

                    if prohibited_crates.contains(&dep_name.as_str()) {
                        let snippet = format!(
                            "Crate '{}' (layer: {}) pulls prohibited transitive dependency '{}'",
                            pkg_name, layer.as_str(), dep_name
                        );
                        let fingerprint = compute_fingerprint("SEC-002", "1.0", pkg_name, &snippet);

                        violations.push(Violation {
                            rule_id: "SEC-002".into(),
                            rule_version: "1.0".into(),
                            category: Category::Security,
                            severity: Severity::Warn,
                            file: manifest_file.clone(),
                            line: 1,
                            column: 1,
                            symbol: format!("{} -> {}", pkg_name, dep_name),
                            snippet,
                            message: format!(
                                "Transitive Capability Alert: Pure layer '{}' pulls dependency '{}' which exposes raw network/shell execution capabilities.",
                                layer.as_str(), dep_name
                            ),
                            remediation: "Remove dependency or replace it with a pure in-memory contract/port.".into(),
                            fingerprint,
                        });
                    }

                    if let Some(target_pkg) = metadata.packages.iter().find(|p| p.name == dep_name) {
                        for child_dep in &target_pkg.dependencies {
                            if child_dep.kind == cargo_metadata::DependencyKind::Normal {
                                queue.push(child_dep.name.clone());
                            }
                        }
                    }
                }
            }
        }

        violations
    }

    pub fn audit_from_workspace_root(workspace_root: &Path) -> Result<Vec<Violation>, String> {
        let manifest_path = if workspace_root.is_file() && workspace_root.ends_with("Cargo.toml") {
            workspace_root.to_path_buf()
        } else {
            workspace_root.join("Cargo.toml")
        };

        if !manifest_path.exists() {
            return Ok(Vec::new());
        }

        let metadata = cargo_metadata::MetadataCommand::new()
            .manifest_path(&manifest_path)
            .exec()
            .map_err(|e| format!("Failed to read cargo metadata: {}", e))?;

        let mut package_layers = HashMap::new();
        let mut package_manifests = HashMap::new();

        for pkg in &metadata.packages {
            if metadata.workspace_members.contains(&pkg.id) {
                let name = pkg.name.to_string();
                package_manifests.insert(name.clone(), pkg.manifest_path.clone().into_std_path_buf());
                let declared_layer = pkg
                    .metadata
                    .get("cerberus")
                    .or_else(|| pkg.metadata.get("arch-guard"))
                    .and_then(|m| m.get("layer"))
                    .and_then(|l| l.as_str());

                let layer = match declared_layer {
                    Some(l) => ArchLayer::parse(l),
                    None => ArchLayer::Unknown,
                };
                package_layers.insert(name, layer);
            }
        }

        Ok(Self::check_transitive_capabilities(
            &metadata,
            &package_layers,
            &package_manifests,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_transitive_capabilities_audit() {
        let temp = tempdir().unwrap();
        let cargo_toml = temp.path().join("Cargo.toml");
        let workspace_toml = r#"
            [workspace]
            members = ["domain-crate", "ports-crate", "app-crate"]
            resolver = "2"
        "#;
        std::fs::write(&cargo_toml, workspace_toml).unwrap();

        // 1. domain-crate with cerberus layer
        let domain_dir = temp.path().join("domain-crate");
        std::fs::create_dir_all(domain_dir.join("src")).unwrap();
        std::fs::write(domain_dir.join("src/lib.rs"), "pub fn ok() {}").unwrap();
        let domain_cargo = r#"
            [package]
            name = "domain-crate"
            version = "0.1.0"
            edition = "2021"

            [package.metadata.cerberus]
            layer = "domain"

            [dependencies]
            reqwest = { version = "0.11", optional = true }
        "#;
        std::fs::write(domain_dir.join("Cargo.toml"), domain_cargo).unwrap();

        // 2. ports-crate with legacy arch-guard layer and clean dependencies
        let ports_dir = temp.path().join("ports-crate");
        std::fs::create_dir_all(ports_dir.join("src")).unwrap();
        std::fs::write(ports_dir.join("src/lib.rs"), "pub fn ok() {}").unwrap();
        let ports_cargo = r#"
            [package]
            name = "ports-crate"
            version = "0.1.0"
            edition = "2021"

            [package.metadata.arch-guard]
            layer = "ports"
        "#;
        std::fs::write(ports_dir.join("Cargo.toml"), ports_cargo).unwrap();

        // 3. app-crate with application layer
        let app_dir = temp.path().join("app-crate");
        std::fs::create_dir_all(app_dir.join("src")).unwrap();
        std::fs::write(app_dir.join("src/lib.rs"), "pub fn ok() {}").unwrap();
        let app_cargo = r#"
            [package]
            name = "app-crate"
            version = "0.1.0"
            edition = "2021"
        "#;
        std::fs::write(app_dir.join("Cargo.toml"), app_cargo).unwrap();

        // Audit from direct Cargo.toml file path
        let violations = TransitiveCapabilityChecker::audit_from_workspace_root(&cargo_toml).unwrap();
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "SEC-002");

        // Audit from workspace root directory path
        let violations_dir = TransitiveCapabilityChecker::audit_from_workspace_root(temp.path()).unwrap();
        assert_eq!(violations_dir.len(), 1);

        // Test non-existent path
        let missing = temp.path().join("missing/Cargo.toml");
        assert!(TransitiveCapabilityChecker::audit_from_workspace_root(&missing).unwrap().is_empty());

        // Test invalid/corrupted manifest path error
        let invalid_cargo = temp.path().join("invalid_dir");
        std::fs::create_dir_all(&invalid_cargo).unwrap();
        std::fs::write(invalid_cargo.join("Cargo.toml"), "invalid [toml").unwrap();
        assert!(TransitiveCapabilityChecker::audit_from_workspace_root(&invalid_cargo).is_err());

        // Test direct metadata check with ports layer and fallback manifest
        let mut layers = HashMap::new();
        layers.insert("ports-crate".to_string(), ArchLayer::Ports);
        let manifests = HashMap::new(); // empty manifests map to test fallback
        let metadata = cargo_metadata::MetadataCommand::new()
            .manifest_path(&cargo_toml)
            .exec()
            .unwrap();
        let fallback_violations = TransitiveCapabilityChecker::check_transitive_capabilities(
            &metadata,
            &layers,
            &manifests,
        );
        assert!(fallback_violations.is_empty());

        // Test new & default
        let _checker = TransitiveCapabilityChecker::new();
        let _def = TransitiveCapabilityChecker;
    }
}
