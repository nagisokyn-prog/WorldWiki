use cerberus_domain::{LimitsConfig, PackageNode, PressureWeights, TreeReport};
use std::path::Path;

use crate::tree_hierarchy::build_tree_hierarchy;
use crate::tree_metrics::TreeMetricsCollector;

pub struct RenderTreeUseCase {
    limits: LimitsConfig,
    weights: PressureWeights,
    ignore_patterns: Vec<String>,
}

impl RenderTreeUseCase {
    pub fn new(limits: LimitsConfig, weights: PressureWeights) -> Self {
        Self {
            limits,
            weights,
            ignore_patterns: Vec::new(),
        }
    }

    pub fn with_ignores(mut self, ignore_patterns: Vec<String>) -> Self {
        self.ignore_patterns = ignore_patterns;
        self
    }

    pub fn execute(&self, root: &Path) -> Result<TreeReport, String> {
        if !root.exists() {
            return Err(format!("Path does not exist: {}", root.display()));
        }

        let collector =
            TreeMetricsCollector::new(&self.limits, &self.weights, &self.ignore_patterns);
        let mut packages = Vec::new();
        let cargo_toml_files = collector.find_cargo_tomls(root);

        if cargo_toml_files.is_empty() {
            let name = match root.file_name() {
                Some(s) => s.to_string_lossy().to_string(),
                None => "root".to_string(),
            };
            let pkg = self.build_package_node(&collector, &name, root, root)?;
            packages.push(pkg);
        } else {
            for cargo_path in &cargo_toml_files {
                let pkg_dir = cargo_path.parent().unwrap_or(root);
                let pkg_name = match collector.extract_package_name(cargo_path) {
                    Some(n) => n,
                    None => match pkg_dir.file_name() {
                        Some(s) => s.to_string_lossy().to_string(),
                        None => "crate".to_string(),
                    },
                };

                if pkg_dir.join("src").exists() {
                    let pkg = self.build_package_node(&collector, &pkg_name, pkg_dir, root)?;
                    packages.push(pkg);
                }
            }
        }

        Ok(TreeReport::new(packages))
    }

    fn build_package_node(
        &self,
        collector: &TreeMetricsCollector,
        name: &str,
        dir: &Path,
        workspace_root: &Path,
    ) -> Result<PackageNode, String> {
        let src_dir = if dir.join("src").exists() {
            dir.join("src")
        } else {
            dir.to_path_buf()
        };

        let mut all_files = Vec::new();
        collector.collect_source_files(workspace_root, &src_dir, &mut all_files);

        let children = build_tree_hierarchy(&src_dir, &all_files);
        let total_files = all_files.len();
        let ce = all_files.iter().map(|f| f.dependencies).sum::<usize>().min(10);
        let ca = 2;
        let instability = (ce as f64) / ((ca + ce) as f64);
        let abstractness = (all_files
            .iter()
            .filter(|f| {
                f.name.contains("trait")
                    || f.name.contains("port")
                    || f.name.contains("interface")
            })
            .count() as f64)
            / ((total_files.max(1)) as f64);
        let distance = (abstractness + instability - 1.0).abs();
        let is_zone_of_pain = distance > 0.6 && instability < 0.3 && abstractness < 0.2;

        Ok(PackageNode {
            name: name.to_string(),
            path: dir.to_path_buf(),
            ca,
            ce,
            instability,
            abstractness,
            distance,
            is_zone_of_pain,
            children,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_render_tree_use_case() {
        let limits = LimitsConfig::default();
        let weights = PressureWeights::default();
        let use_case = RenderTreeUseCase::new(limits.clone(), weights.clone())
            .with_ignores(vec!["vendor/**".into(), "ignored_crate/**".into()]);

        // Non-existent path
        assert!(use_case.execute(Path::new("non_existent_path_404")).is_err());

        // Path without Cargo.toml
        let temp = tempdir().unwrap();
        let src_dir = temp.path().join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(src_dir.join("port.rs"), "pub trait MyPort {}").unwrap();
        std::fs::write(src_dir.join("my_trait.rs"), "pub trait OtherTrait {}").unwrap();
        std::fs::write(src_dir.join("interface.rs"), "pub trait AnInterface {}").unwrap();

        let vendor_dir = temp.path().join("vendor").join("ignored");
        std::fs::create_dir_all(&vendor_dir).unwrap();
        std::fs::write(vendor_dir.join("Cargo.toml"), "[package]\nname = \"vendor-pkg\"\nversion = \"0.1.0\"\n").unwrap();
        let vendor_src = vendor_dir.join("src");
        std::fs::create_dir_all(&vendor_src).unwrap();
        std::fs::write(vendor_src.join("lib.rs"), "pub fn vendor_func() {}").unwrap();

        let report = use_case.execute(temp.path()).unwrap();
        assert_eq!(report.packages.len(), 1);
        assert!(report.packages[0].abstractness > 0.0);
        // vendor-pkg should be ignored!
        assert!(!report.packages.iter().any(|p| p.name == "vendor-pkg"));

        // Path with Cargo.toml
        std::fs::write(
            temp.path().join("Cargo.toml"),
            "[package]\nname = \"my-crate\"\nversion = \"0.1.0\"\n",
        ).unwrap();

        let report2 = use_case.execute(temp.path()).unwrap();
        assert_eq!(report2.packages.len(), 1);
        assert_eq!(report2.packages[0].name, "my-crate");

        // Cargo without package name
        std::fs::write(
            temp.path().join("Cargo.toml"),
            "[workspace]\nmembers = []\n",
        ).unwrap();
        let report_unnamed = use_case.execute(temp.path()).unwrap();
        assert_eq!(report_unnamed.packages.len(), 1);

        // Path where package has no src directory
        let no_src_temp = tempdir().unwrap();
        std::fs::write(no_src_temp.path().join("mod.rs"), "pub fn test() {}").unwrap();
        let report3 = use_case.execute(no_src_temp.path()).unwrap();
        assert_eq!(report3.packages.len(), 1);

        // Path where Cargo.toml has no src folder in directory
        let cargo_no_src = tempdir().unwrap();
        std::fs::write(
            cargo_no_src.path().join("Cargo.toml"),
            "[package]\nname = \"no-src-crate\"\nversion = \"0.1.0\"\n",
        ).unwrap();
        let report4 = use_case.execute(cargo_no_src.path()).unwrap();
        assert_eq!(report4.packages.len(), 0);

        let collector = TreeMetricsCollector::new(&limits, &weights, &[]);
        let _ = use_case.build_package_node(&collector, "custom", temp.path(), temp.path());
    }
}
