use crate::rules::{Severity, Violation};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PackageMetrics {
    pub package_name: String,
    pub afferent_coupling: usize,
    pub efferent_coupling: usize,
    pub instability: f64,
    pub abstractness: f64,
    pub distance_from_main_sequence: f64,
    pub in_zone_of_pain: bool,
}

impl PackageMetrics {
    pub fn compute(
        package_name: String,
        afferent: usize,
        efferent: usize,
        abstract_classes: usize,
        total_classes: usize,
    ) -> Self {
        let instability = if afferent + efferent == 0 {
            0.0
        } else {
            efferent as f64 / (afferent + efferent) as f64
        };

        let abstractness = if total_classes == 0 {
            0.0
        } else {
            abstract_classes as f64 / total_classes as f64
        };

        let distance = (abstractness + instability - 1.0).abs();
        let in_zone_of_pain = abstractness < 0.2 && instability < 0.2 && afferent > 3;

        Self {
            package_name,
            afferent_coupling: afferent,
            efferent_coupling: efferent,
            instability,
            abstractness,
            distance_from_main_sequence: distance,
            in_zone_of_pain,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PressureWeights {
    pub w_sloc: f64,
    pub w_functions: f64,
    pub w_cyclomatic: f64,
    pub w_dependencies: f64,
    pub w_ast_depth: f64,
    pub w_distance_d: f64,
}

impl Default for PressureWeights {
    fn default() -> Self {
        Self {
            w_sloc: 0.1,
            w_functions: 2.0,
            w_cyclomatic: 3.0,
            w_dependencies: 1.5,
            w_ast_depth: 4.0,
            w_distance_d: 20.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FileMetrics {
    pub file_path: PathBuf,
    pub sloc: usize,
    pub functions: usize,
    pub cyclomatic: usize,
    pub dependencies: usize,
    pub ast_depth: usize,
    pub distance_d: f64,
    pub pressure_score: f64,
}

impl FileMetrics {
    #[allow(clippy::too_many_arguments)]
    pub fn compute(
        file_path: PathBuf,
        sloc: usize,
        functions: usize,
        cyclomatic: usize,
        dependencies: usize,
        ast_depth: usize,
        distance_d: f64,
        weights: &PressureWeights,
    ) -> Self {
        let score = (weights.w_sloc * sloc as f64)
            + (weights.w_functions * functions as f64)
            + (weights.w_cyclomatic * cyclomatic as f64)
            + (weights.w_dependencies * dependencies as f64)
            + (weights.w_ast_depth * ast_depth as f64)
            + (weights.w_distance_d * distance_d);

        Self {
            file_path,
            sloc,
            functions,
            cyclomatic,
            dependencies,
            ast_depth,
            distance_d,
            pressure_score: score,
        }
    }
}

pub struct PressureCalculator;

impl PressureCalculator {
    pub fn compute_score(violations: &[Violation], total_loc: usize) -> f64 {
        if total_loc == 0 {
            return 0.0;
        }

        let mut weighted_sum = 0.0;
        for v in violations {
            match v.severity {
                Severity::Deny => weighted_sum += 10.0,
                Severity::Warn => weighted_sum += 3.0,
                Severity::Off => {}
            }
        }

        (weighted_sum / (total_loc as f64)) * 1000.0
    }
}
