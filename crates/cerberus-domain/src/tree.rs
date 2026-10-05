use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HealthLevel {
    Healthy,
    Warning,
    Critical,
}

impl HealthLevel {
    pub fn badge_symbol(&self) -> &'static str {
        match self {
            HealthLevel::Healthy => "✅",
            HealthLevel::Warning => "⚠️",
            HealthLevel::Critical => "🚨",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetricsNode {
    pub name: String,
    pub path: PathBuf,
    pub sloc: usize,
    pub functions: usize,
    pub cyclomatic: usize,
    pub dependencies: usize,
    pub ast_depth: usize,
    pub pressure: f64,
    pub health: HealthLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirNode {
    pub name: String,
    pub path: PathBuf,
    pub children: Vec<TreeItemNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TreeItemNode {
    Dir(DirNode),
    File(FileMetricsNode),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageNode {
    pub name: String,
    pub path: PathBuf,
    pub ca: usize,
    pub ce: usize,
    pub instability: f64,
    pub abstractness: f64,
    pub distance: f64,
    pub is_zone_of_pain: bool,
    pub children: Vec<TreeItemNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeReport {
    pub packages: Vec<PackageNode>,
    pub total_files: usize,
    pub healthy_count: usize,
    pub warning_count: usize,
    pub critical_count: usize,
    pub avg_distance: f64,
    pub hotspots: Vec<FileMetricsNode>,
}

impl TreeReport {
    pub fn new(packages: Vec<PackageNode>) -> Self {
        let mut total_files = 0;
        let mut healthy_count = 0;
        let mut warning_count = 0;
        let mut critical_count = 0;
        let mut total_distance = 0.0;
        let mut hotspots = Vec::new();

        for pkg in &packages {
            total_distance += pkg.distance;
            traverse_tree(
                &pkg.children,
                &mut total_files,
                &mut healthy_count,
                &mut warning_count,
                &mut critical_count,
                &mut hotspots,
            );
        }

        let avg_distance = if packages.is_empty() {
            0.0
        } else {
            total_distance / (packages.len() as f64)
        };

        hotspots.sort_by(|a, b| b.pressure.partial_cmp(&a.pressure).unwrap_or(std::cmp::Ordering::Equal));

        Self {
            packages,
            total_files,
            healthy_count,
            warning_count,
            critical_count,
            avg_distance,
            hotspots,
        }
    }
}

fn traverse_tree(
    items: &[TreeItemNode],
    total_files: &mut usize,
    healthy_count: &mut usize,
    warning_count: &mut usize,
    critical_count: &mut usize,
    hotspots: &mut Vec<FileMetricsNode>,
) {
    for item in items {
        match item {
            TreeItemNode::File(file) => {
                *total_files += 1;
                match file.health {
                    HealthLevel::Healthy => *healthy_count += 1,
                    HealthLevel::Warning => *warning_count += 1,
                    HealthLevel::Critical => {
                        *critical_count += 1;
                        hotspots.push(file.clone());
                    }
                }
            }
            TreeItemNode::Dir(dir) => {
                traverse_tree(
                    &dir.children,
                    total_files,
                    healthy_count,
                    warning_count,
                    critical_count,
                    hotspots,
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_level_badge_symbols() {
        assert_eq!(HealthLevel::Healthy.badge_symbol(), "✅");
        assert_eq!(HealthLevel::Warning.badge_symbol(), "⚠️");
        assert_eq!(HealthLevel::Critical.badge_symbol(), "🚨");
    }

    #[test]
    fn test_tree_report_empty() {
        let report = TreeReport::new(vec![]);
        assert_eq!(report.total_files, 0);
        assert_eq!(report.healthy_count, 0);
        assert_eq!(report.warning_count, 0);
        assert_eq!(report.critical_count, 0);
        assert_eq!(report.avg_distance, 0.0);
        assert!(report.hotspots.is_empty());
    }

    #[test]
    fn test_tree_report_with_nested_structure() {
        let file_healthy = FileMetricsNode {
            name: "healthy.rs".into(),
            path: PathBuf::from("src/healthy.rs"),
            sloc: 50,
            functions: 3,
            cyclomatic: 2,
            dependencies: 1,
            ast_depth: 3,
            pressure: 10.0,
            health: HealthLevel::Healthy,
        };
        let file_warning = FileMetricsNode {
            name: "warning.rs".into(),
            path: PathBuf::from("src/warning.rs"),
            sloc: 150,
            functions: 8,
            cyclomatic: 10,
            dependencies: 4,
            ast_depth: 6,
            pressure: 120.0,
            health: HealthLevel::Warning,
        };
        let file_critical_1 = FileMetricsNode {
            name: "crit1.rs".into(),
            path: PathBuf::from("src/crit1.rs"),
            sloc: 400,
            functions: 20,
            cyclomatic: 30,
            dependencies: 12,
            ast_depth: 10,
            pressure: 350.0,
            health: HealthLevel::Critical,
        };
        let file_critical_2 = FileMetricsNode {
            name: "crit2.rs".into(),
            path: PathBuf::from("src/sub/crit2.rs"),
            sloc: 600,
            functions: 35,
            cyclomatic: 50,
            dependencies: 20,
            ast_depth: 15,
            pressure: 500.0,
            health: HealthLevel::Critical,
        };

        let sub_dir = DirNode {
            name: "sub".into(),
            path: PathBuf::from("src/sub"),
            children: vec![TreeItemNode::File(file_critical_2)],
        };

        let pkg = PackageNode {
            name: "core".into(),
            path: PathBuf::from("crates/core"),
            ca: 2,
            ce: 1,
            instability: 0.33,
            abstractness: 0.5,
            distance: 0.17,
            is_zone_of_pain: false,
            children: vec![
                TreeItemNode::File(file_healthy),
                TreeItemNode::File(file_warning),
                TreeItemNode::File(file_critical_1),
                TreeItemNode::Dir(sub_dir),
            ],
        };

        let report = TreeReport::new(vec![pkg]);
        assert_eq!(report.total_files, 4);
        assert_eq!(report.healthy_count, 1);
        assert_eq!(report.warning_count, 1);
        assert_eq!(report.critical_count, 2);
        assert_eq!(report.avg_distance, 0.17);
        assert_eq!(report.hotspots.len(), 2);
        // Critical 2 with pressure 500 should come before Critical 1 with pressure 350
        assert_eq!(report.hotspots[0].name, "crit2.rs");
        assert_eq!(report.hotspots[1].name, "crit1.rs");
    }
}
