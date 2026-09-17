use cerberus_domain::{LimitsConfig, PackageNode, PressureWeights, TreeReport};
use std::path::Path;

use crate::tree_hierarchy::build_tree_hierarchy;
use crate::tree_metrics::TreeMetricsCollector;

pub struct RenderTreeUseCase {
    limits: LimitsConfig,
    weights: PressureWeights,
}

impl RenderTreeUseCase {
    pub fn new(limits: LimitsConfig, weights: PressureWeights) -> Self {
        Self { limits, weights }
    }

    pub fn execute(&self, root: &Path) -> Result<TreeReport, String> {
        if !root.exists() {
            return Err(format!("Path does not exist: {}", root.display()));
        }

        let collector = TreeMetricsCollector::new(&self.limits, &self.weights);
        let mut packages = Vec::new();
        let cargo_toml_files = collector.find_cargo_tomls(root);

        if cargo_toml_files.is_empty() {
            let name = root
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "root".to_string());
            let pkg = self.build_package_node(&collector, &name, root)?;
            packages.push(pkg);
        } else {
            for cargo_path in &cargo_toml_files {
                let pkg_dir = cargo_path.parent().unwrap_or(root);
                let pkg_name = collector.extract_package_name(cargo_path).unwrap_or_else(|| {
                    pkg_dir
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| "crate".to_string())
                });

                if pkg_dir.join("src").exists() {
                    let pkg = self.build_package_node(&collector, &pkg_name, pkg_dir)?;
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
    ) -> Result<PackageNode, String> {
        let src_dir = if dir.join("src").exists() {
            dir.join("src")
        } else {
            dir.to_path_buf()
        };

        let mut all_files = Vec::new();
        collector.collect_source_files(&src_dir, &mut all_files);

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
