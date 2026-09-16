use cerberus_domain::{
    compute_fingerprint, Category, PackageMetrics, Severity, Violation,
};
use std::collections::HashMap;
use std::path::PathBuf;
use syn::visit::{self, Visit};
use syn::{File, ItemEnum, ItemStruct, ItemTrait, ItemUnion, Visibility};

#[derive(Default)]
struct TypeVisitor {
    pub abstract_types: usize, // pub trait
    pub concrete_types: usize, // pub struct, pub enum, pub union
}

impl<'ast> Visit<'ast> for TypeVisitor {
    fn visit_item_trait(&mut self, node: &'ast ItemTrait) {
        if matches!(node.vis, Visibility::Public(_)) {
            self.abstract_types += 1;
        }
        visit::visit_item_trait(self, node);
    }

    fn visit_item_struct(&mut self, node: &'ast ItemStruct) {
        if matches!(node.vis, Visibility::Public(_)) {
            self.concrete_types += 1;
        }
        visit::visit_item_struct(self, node);
    }

    fn visit_item_enum(&mut self, node: &'ast ItemEnum) {
        if matches!(node.vis, Visibility::Public(_)) {
            self.concrete_types += 1;
        }
        visit::visit_item_enum(self, node);
    }

    fn visit_item_union(&mut self, node: &'ast ItemUnion) {
        if matches!(node.vis, Visibility::Public(_)) {
            self.concrete_types += 1;
        }
        visit::visit_item_union(self, node);
    }
}

#[derive(Default)]
pub struct PackageTopologyAnalyzer;

impl PackageTopologyAnalyzer {
    pub fn new() -> Self {
        Self
    }

    /// Count abstract and concrete types from Rust source files in a package
    pub fn count_types_in_sources(sources: &[String]) -> (usize, usize) {
        let mut total_abstract = 0;
        let mut total_concrete = 0;

        for src in sources {
            if let Ok(parsed) = syn::parse_str::<File>(src) {
                let mut visitor = TypeVisitor::default();
                visitor.visit_file(&parsed);
                total_abstract += visitor.abstract_types;
                total_concrete += visitor.concrete_types;
            }
        }

        (total_abstract, total_concrete + total_abstract)
    }

    /// Compute package coupling ($C_a, C_e$) from a dependency graph
    /// `dependencies_map`: package_name -> list of internal packages it depends on
    pub fn compute_topology_metrics(
        package_names: &[String],
        dependencies_map: &HashMap<String, Vec<String>>,
        type_counts: &HashMap<String, (usize, usize)>, // pkg -> (abstract_count, total_count)
    ) -> Vec<PackageMetrics> {
        let mut afferent_map: HashMap<String, usize> = HashMap::new();
        let mut efferent_map: HashMap<String, usize> = HashMap::new();

        for name in package_names {
            afferent_map.insert(name.clone(), 0);
            efferent_map.insert(name.clone(), 0);
        }

        for (from_pkg, to_pkgs) in dependencies_map {
            // Efferent coupling for from_pkg
            let valid_internal_deps: Vec<_> = to_pkgs
                .iter()
                .filter(|p| package_names.contains(p))
                .collect();
            efferent_map.insert(from_pkg.clone(), valid_internal_deps.len());

            // Afferent coupling for target packages
            for to_pkg in valid_internal_deps {
                let current_ca = afferent_map.entry(to_pkg.clone()).or_insert(0);
                *current_ca += 1;
            }
        }

        let mut results = Vec::new();
        for name in package_names {
            let ca = *afferent_map.get(name).unwrap_or(&0);
            let ce = *efferent_map.get(name).unwrap_or(&0);
            let (na, nc) = *type_counts.get(name).unwrap_or(&(0, 0));

            results.push(PackageMetrics::compute(name.clone(), ca, ce, na, nc));
        }

        results
    }

    /// Check if any package entered the Zone of Pain and produce violations
    pub fn check_zone_of_pain(
        metrics: &[PackageMetrics],
        package_manifest_paths: &HashMap<String, PathBuf>,
    ) -> Vec<Violation> {
        let mut violations = Vec::new();

        for m in metrics {
            if m.in_zone_of_pain {
                let file_path = package_manifest_paths
                    .get(&m.package_name)
                    .cloned()
                    .unwrap_or_else(|| PathBuf::from(format!("crates/{}/Cargo.toml", m.package_name)));

                let snippet = format!(
                    "Package '{}': Ca={}, Ce={}, I={:.2}, A={:.2}, D={:.2} (Zone of Pain)",
                    m.package_name,
                    m.afferent_coupling,
                    m.efferent_coupling,
                    m.instability,
                    m.abstractness,
                    m.distance_from_main_sequence
                );

                let fingerprint = compute_fingerprint("ARCH-013", "1.0", &m.package_name, &snippet);

                violations.push(Violation {
                    rule_id: "ARCH-013".into(),
                    rule_version: "1.0".into(),
                    category: Category::Architecture,
                    severity: Severity::Warn,
                    file: file_path,
                    line: 1,
                    column: 1,
                    symbol: m.package_name.clone(),
                    snippet,
                    message: format!(
                        "Package '{}' has entered the Zone of Pain (High Coupling Ca={}, Instability I={:.2}, Abstractness A={:.2})",
                        m.package_name, m.afferent_coupling, m.instability, m.abstractness
                    ),
                    remediation: "Introduce abstract traits in a ports layer to reduce concrete coupling from dependent crates.".into(),
                    fingerprint,
                });
            }
        }

        violations
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_types_in_sources() {
        let src1 = r#"
pub trait EntityRepository {
    fn find(&self);
}

pub struct UserEntity {
    pub id: String,
}

pub enum UserStatus {
    Active,
}
"#;
        let src2 = r#"
pub union MyUnion {
    pub f1: u32,
}
"#;
        let src_private = r#"
trait PrivateTrait {}
struct PrivateStruct;
enum PrivateEnum {}
union PrivateUnion { f: u8 }
"#;
        let (na_priv, nc_priv) = PackageTopologyAnalyzer::count_types_in_sources(&[src_private.to_string()]);
        assert_eq!(na_priv, 0);
        assert_eq!(nc_priv, 0);

        let (na, nc) = PackageTopologyAnalyzer::count_types_in_sources(&[
            src1.to_string(),
            src2.to_string(),
            "broken syntax {".to_string(),
        ]);
        assert_eq!(na, 1);
        assert_eq!(nc, 4); // 1 trait + 1 struct + 1 enum + 1 union = 4
    }

    #[test]
    fn test_compute_topology_metrics_and_zone_of_pain() {
        let packages = vec!["domain".to_string(), "app".to_string(), "infra".to_string()];
        let mut deps = HashMap::new();
        deps.insert("app".to_string(), vec!["domain".to_string()]);
        deps.insert("infra".to_string(), vec!["domain".to_string()]);

        let mut type_counts = HashMap::new();
        type_counts.insert("domain".to_string(), (0, 10)); // 0 traits, 10 structs -> A = 0
        type_counts.insert("app".to_string(), (5, 10));
        type_counts.insert("infra".to_string(), (0, 5));

        let metrics = PackageTopologyAnalyzer::compute_topology_metrics(
            &packages,
            &deps,
            &type_counts,
        );

        let domain_metric = metrics.iter().find(|m| m.package_name == "domain").unwrap();
        assert_eq!(domain_metric.afferent_coupling, 2); // app and infra depend on domain
        assert_eq!(domain_metric.efferent_coupling, 0);
        assert_eq!(domain_metric.instability, 0.0);
        assert_eq!(domain_metric.abstractness, 0.0);
        assert_eq!(domain_metric.distance_from_main_sequence, 1.0);

        // Simulate high coupling Ca = 4
        let mut pain_deps = HashMap::new();
        pain_deps.insert("c1".to_string(), vec!["domain".to_string()]);
        pain_deps.insert("c2".to_string(), vec!["domain".to_string()]);
        pain_deps.insert("c3".to_string(), vec!["domain".to_string()]);
        pain_deps.insert("c4".to_string(), vec!["domain".to_string()]);

        let pain_pkgs = vec![
            "domain".to_string(),
            "c1".to_string(),
            "c2".to_string(),
            "c3".to_string(),
            "c4".to_string(),
        ];
        let pain_metrics = PackageTopologyAnalyzer::compute_topology_metrics(
            &pain_pkgs,
            &pain_deps,
            &type_counts,
        );

        let mut manifest_map = HashMap::new();
        manifest_map.insert("domain".to_string(), PathBuf::from("crates/domain/Cargo.toml"));
        let violations = PackageTopologyAnalyzer::check_zone_of_pain(&pain_metrics, &manifest_map);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "ARCH-013");
        assert_eq!(violations[0].file, PathBuf::from("crates/domain/Cargo.toml"));

        // Test with empty manifest path map (fallback to default crates/<pkg>/Cargo.toml)
        let empty_manifests = HashMap::new();
        let fallback_violations = PackageTopologyAnalyzer::check_zone_of_pain(&pain_metrics, &empty_manifests);
        assert_eq!(fallback_violations.len(), 1);
        assert_eq!(fallback_violations[0].file, PathBuf::from("crates/domain/Cargo.toml"));

        // Test clean metrics produce 0 violations
        let clean_violations = PackageTopologyAnalyzer::check_zone_of_pain(&metrics, &manifest_map);
        assert!(clean_violations.is_empty());

        // Test new & default
        let _analyzer = PackageTopologyAnalyzer::new();
        let _default_analyzer = PackageTopologyAnalyzer;
    }
}
