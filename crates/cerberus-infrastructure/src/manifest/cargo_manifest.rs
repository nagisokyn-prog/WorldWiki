use cargo_metadata::MetadataCommand;
use cerberus_domain::{ArchLayer, Category, Severity, Violation};
use cerberus_ports::ManifestParserPort;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub struct CargoMetadataManifestAdapter;

impl CargoMetadataManifestAdapter {
    pub fn new() -> Self {
        Self
    }

    pub fn compute_workspace_martin_metrics(
        &self,
        workspace_root: &Path,
    ) -> Result<(Vec<cerberus_domain::PackageMetrics>, Vec<Violation>), String> {
        use crate::metrics::PackageTopologyAnalyzer;

        let manifest_path = if workspace_root.is_file() && workspace_root.ends_with("Cargo.toml") {
            workspace_root.to_path_buf()
        } else {
            workspace_root.join("Cargo.toml")
        };

        if !manifest_path.exists() {
            return Ok((Vec::new(), Vec::new()));
        }

        let metadata = MetadataCommand::new()
            .manifest_path(&manifest_path)
            .exec()
            .map_err(|e| format!("Failed to read cargo metadata: {}", e))?;

        let mut package_names = Vec::new();
        let mut dependencies_map: HashMap<String, Vec<String>> = HashMap::new();
        let mut type_counts: HashMap<String, (usize, usize)> = HashMap::new();
        let mut package_manifest_paths: HashMap<String, PathBuf> = HashMap::new();

        for pkg in &metadata.packages {
            if metadata.workspace_members.contains(&pkg.id) {
                let name = pkg.name.to_string();
                package_names.push(name.clone());
                package_manifest_paths
                    .insert(name.clone(), pkg.manifest_path.clone().into_std_path_buf());

                let mut internal_deps = Vec::new();
                for dep in &pkg.dependencies {
                    if dep.kind == cargo_metadata::DependencyKind::Normal {
                        internal_deps.push(dep.name.clone());
                    }
                }
                dependencies_map.insert(name.clone(), internal_deps);

                let pkg_root = pkg
                    .manifest_path
                    .parent()
                    .map(|p| p.as_std_path())
                    .unwrap_or(Path::new("."));
                let src_dir = pkg_root.join("src");
                let mut sources = Vec::new();
                if src_dir.exists() {
                    for entry in walkdir::WalkDir::new(&src_dir).into_iter().flatten() {
                        if entry.path().extension().is_some_and(|e| e == "rs") {
                            if let Ok(content) = std::fs::read_to_string(entry.path()) {
                                sources.push(content);
                            }
                        }
                    }
                }
                let counts = PackageTopologyAnalyzer::count_types_in_sources(&sources);
                type_counts.insert(name, counts);
            }
        }

        let metrics = PackageTopologyAnalyzer::compute_topology_metrics(
            &package_names,
            &dependencies_map,
            &type_counts,
        );

        let violations =
            PackageTopologyAnalyzer::check_zone_of_pain(&metrics, &package_manifest_paths);

        Ok((metrics, violations))
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

        let mut violations = Vec::new();

        let metadata = match MetadataCommand::new().manifest_path(&manifest_path).exec() {
            Ok(m) => m,
            Err(e) => {
                let err_msg = e.to_string();
                if err_msg.contains("cyclic package dependency")
                    || err_msg.contains("cyclic dependency")
                {
                    violations.push(Violation {
                        rule_id: "ARCH-022".into(),
                        rule_version: "1.0".into(),
                        category: Category::Architecture,
                        severity: Severity::Deny,
                        file: manifest_path,
                        line: 1,
                        column: 1,
                        symbol: "workspace::cyclic_dependency".into(),
                        snippet: err_msg.clone(),
                        message: format!("Cyclic package dependency detected in Cargo workspace graph: {}", err_msg),
                        remediation: "Break package cycle by extracting shared types into a common crate or using abstract traits.".into(),
                        fingerprint: cerberus_domain::compute_fingerprint("ARCH-022", "1.0", "workspace", &err_msg),
                    });
                    return Ok(violations);
                }
                return Err(format!("Failed to read cargo metadata: {}", err_msg));
            }
        };

        let mut package_layers: HashMap<String, String> = HashMap::new();
        let mut package_arch_layers: HashMap<String, ArchLayer> = HashMap::new();
        let mut package_manifests: HashMap<String, PathBuf> = HashMap::new();

        // 0. Extract workspace architecture metadata
        let ws_arch: cerberus_domain::WorkspaceArchMetadata = metadata
            .workspace_metadata
            .get("cerberus")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        let topology = cerberus_domain::LayerTopologyMatrix::from_workspace_metadata(&ws_arch);

        // 1. First pass: extract declared layers for each workspace package
        for pkg in &metadata.packages {
            if metadata.workspace_members.contains(&pkg.id) {
                let pkg_name_str = pkg.name.to_string();
                let declared_layer = pkg
                    .metadata
                    .get("cerberus")
                    .and_then(|m| m.get("layer"))
                    .and_then(|l| l.as_str());

                let (layer_str, arch_layer) = match declared_layer {
                    Some(l_str) => (l_str.to_string(), ArchLayer::parse(l_str)),
                    None => {
                        let detected =
                            topology.detect_layer(pkg.manifest_path.as_str(), Some(&pkg_name_str));
                        if detected != "unknown" {
                            (detected.clone(), ArchLayer::parse(&detected))
                        } else {
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
                                    "Crate '{}' is missing architectural layer metadata [package.metadata.cerberus].layer in Cargo.toml",
                                    pkg_name_str
                                ),
                                remediation: "Declare layer = \"domain|ports|application|infrastructure|adapter|cli\" in Cargo.toml".into(),
                                fingerprint: format!("arch021_{}", pkg_name_str),
                            });
                            ("unknown".to_string(), ArchLayer::Unknown)
                        }
                    }
                };

                package_layers.insert(pkg_name_str.clone(), layer_str);
                package_arch_layers.insert(pkg_name_str.clone(), arch_layer);
                package_manifests
                    .insert(pkg_name_str, pkg.manifest_path.clone().into_std_path_buf());
            }
        }

        // 2. Second pass: check dependencies against layer matrix
        for pkg in &metadata.packages {
            if !metadata.workspace_members.contains(&pkg.id) {
                continue;
            }

            let pkg_name_str = pkg.name.as_str();
            let current_layer_str = package_layers
                .get(pkg_name_str)
                .cloned()
                .unwrap_or_default();
            let current_arch_layer = package_arch_layers
                .get(pkg_name_str)
                .cloned()
                .unwrap_or(ArchLayer::Unknown);
            let manifest_file = package_manifests
                .get(pkg_name_str)
                .cloned()
                .unwrap_or_default();

            for dep in &pkg.dependencies {
                if dep.kind != cargo_metadata::DependencyKind::Normal {
                    continue;
                }

                if let Some(target_layer_str) = package_layers.get(&dep.name) {
                    if !topology.is_dependency_allowed(&current_layer_str, target_layer_str) {
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
                                current_layer_str,
                                dep.name,
                                target_layer_str
                            ),
                            remediation: format!(
                                "Invert dependency or move logic: layer '{}' cannot depend on '{}'",
                                current_layer_str,
                                target_layer_str
                            ),
                            fingerprint: format!("arch020_{}_{}", pkg.name, dep.name),
                        });
                    }
                    continue;
                }

                if topology.is_external_dep_forbidden(&current_layer_str, &dep.name) {
                    violations.push(Violation {
                        rule_id: "ARCH-001".into(),
                        rule_version: "1.0".into(),
                        category: Category::Architecture,
                        severity: Severity::Deny,
                        file: manifest_file.clone(),
                        line: 1,
                        column: 1,
                        symbol: format!("{} -> {}", pkg_name_str, dep.name),
                        snippet: format!("{} = \"{}\"", dep.name, dep.req),
                        message: format!(
                            "Layer '{}' in crate '{}' forbids external dependency '{}' in Cargo.toml",
                            current_layer_str, pkg_name_str, dep.name
                        ),
                        remediation: "Move external dependency to outer infrastructure layers or invert via traits.".into(),
                        fingerprint: format!("arch001_forbid_{}_{}", pkg_name_str, dep.name),
                    });
                } else if !topology.is_external_dep_allowed(&current_layer_str, &dep.name)
                    || (!topology.allowed_external.contains_key(&current_layer_str)
                        && (topology.preset_name == "hexagonal" || topology.preset_name.is_empty()))
                {
                    validate_external_dependency(
                        &current_arch_layer,
                        pkg_name_str,
                        dep,
                        &manifest_file,
                        &mut violations,
                    );
                }
            }
        }

        // 3. Third pass: Transitive capabilities check for pure layers (SEC-002)
        violations.extend(super::transitive_capabilities::TransitiveCapabilityChecker::check_transitive_capabilities(
            &metadata,
            &package_arch_layers,
            &package_manifests,
        ));

        Ok(violations)
    }
}

fn validate_external_dependency(
    current_layer: &ArchLayer,
    pkg_name: &str,
    dep: &cargo_metadata::Dependency,
    manifest_file: &Path,
    violations: &mut Vec<Violation>,
) {
    match current_layer {
        ArchLayer::Domain => {
            let domain_whitelist = [
                "serde",
                "serde_json",
                "sha2",
                "chrono",
                "thiserror",
                "uuid",
                "num-traits",
                "bitflags",
                "zeroize",
                "regex",
                "derive_more",
                "strum",
                "strum_macros",
                "itertools",
                "smallvec",
                "tinyvec",
                "rust_decimal",
                "unicode-segmentation",
                "unicode-width",
                "ts-rs",
                "syn",
                "quote",
                "proc-macro2",
            ];
            if !domain_whitelist.contains(&dep.name.as_str()) {
                violations.push(Violation {
                    rule_id: "ARCH-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::Architecture,
                    severity: Severity::Deny,
                    file: manifest_file.to_path_buf(),
                    line: 1,
                    column: 1,
                    symbol: format!("{} -> {}", pkg_name, dep.name),
                    snippet: format!("{} = \"{}\"", dep.name, dep.req),
                    message: format!(
                        "Domain crate '{}' declared unauthorized external dependency '{}' in Cargo.toml",
                        pkg_name, dep.name
                    ),
                    remediation: "Domain layer allows only pure DTO/math crates (serde, chrono, sha2, thiserror). Move I/O/UI crates to infrastructure.".into(),
                    fingerprint: format!("arch001_manifest_{}_{}", pkg_name, dep.name),
                });
            }
        }
        ArchLayer::Ports => {
            let ports_whitelist = [
                "serde",
                "serde_json",
                "chrono",
                "thiserror",
                "uuid",
                "async-trait",
                "tokio",
                "futures",
                "futures-util",
                "futures-core",
                "tracing",
                "log",
                "num-traits",
                "bitflags",
                "derive_more",
                "strum",
                "strum_macros",
                "itertools",
                "smallvec",
                "tinyvec",
                "rust_decimal",
                "unicode-segmentation",
                "unicode-width",
                "ts-rs",
            ];
            if !ports_whitelist.contains(&dep.name.as_str()) {
                violations.push(Violation {
                    rule_id: "ARCH-020".into(),
                    rule_version: "1.0".into(),
                    category: Category::Architecture,
                    severity: Severity::Deny,
                    file: manifest_file.to_path_buf(),
                    line: 1,
                    column: 1,
                    symbol: format!("{} -> {}", pkg_name, dep.name),
                    snippet: format!("{} = \"{}\"", dep.name, dep.req),
                    message: format!(
                        "Ports crate '{}' declared unauthorized external dependency '{}' in Cargo.toml",
                        pkg_name, dep.name
                    ),
                    remediation: "Ports layer defines traits only. Move concrete SDK dependencies to infrastructure adapters.".into(),
                    fingerprint: format!("arch020_ports_manifest_{}_{}", pkg_name, dep.name),
                });
            }
        }
        ArchLayer::Application => {
            let app_whitelist = [
                "serde",
                "serde_json",
                "chrono",
                "hmac",
                "sha2",
                "thiserror",
                "uuid",
                "regex",
                "async-trait",
                "tokio",
                "futures",
                "futures-util",
                "futures-core",
                "tracing",
                "log",
                "num-traits",
                "bitflags",
                "zeroize",
                "derive_more",
                "strum",
                "strum_macros",
                "itertools",
                "smallvec",
                "tinyvec",
                "rust_decimal",
                "unicode-segmentation",
                "unicode-width",
                "ts-rs",
            ];
            if !app_whitelist.contains(&dep.name.as_str()) {
                violations.push(Violation {
                    rule_id: "ARCH-002".into(),
                    rule_version: "1.0".into(),
                    category: Category::Architecture,
                    severity: Severity::Deny,
                    file: manifest_file.to_path_buf(),
                    line: 1,
                    column: 1,
                    symbol: format!("{} -> {}", pkg_name, dep.name),
                    snippet: format!("{} = \"{}\"", dep.name, dep.req),
                    message: format!(
                        "Application crate '{}' declared unauthorized external dependency '{}' in Cargo.toml",
                        pkg_name, dep.name
                    ),
                    remediation: "Application layer orchestrates domain and ports. UI/Tauri/Database SDKs must reside in infrastructure or adapters.".into(),
                    fingerprint: format!("arch002_manifest_{}_{}", pkg_name, dep.name),
                });
            }
        }
        _ => {}
    }
}
