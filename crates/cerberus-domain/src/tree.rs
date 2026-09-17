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
