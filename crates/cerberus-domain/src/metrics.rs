use crate::rules::{Severity, Violation};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PackageMetrics {
    pub package_name: String,
    pub afferent_coupling: usize, // Ca
    pub efferent_coupling: usize, // Ce
    pub instability: f64,         // I = Ce / (Ca + Ce)
    pub abstractness: f64,        // A = Na / Nc
    pub distance_from_main_sequence: f64, // D = |A + I - 1|
    pub in_zone_of_pain: bool,    // A < 0.2 && I < 0.2 && Ca > 3
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rules::Category;

    #[test]
    fn test_package_metrics_calculation() {
        let metrics = PackageMetrics::compute("domain".into(), 10, 0, 8, 10);
        assert_eq!(metrics.instability, 0.0);
        assert_eq!(metrics.abstractness, 0.8);
        assert!((metrics.distance_from_main_sequence - 0.2).abs() < 1e-6);
        assert!(!metrics.in_zone_of_pain);

        let pain = PackageMetrics::compute("concrete_god".into(), 10, 0, 0, 10);
        assert!(pain.in_zone_of_pain);

        // Zero coupling and zero classes
        let empty_metrics = PackageMetrics::compute("empty".into(), 0, 0, 0, 0);
        assert_eq!(empty_metrics.instability, 0.0);
        assert_eq!(empty_metrics.abstractness, 0.0);
    }

    #[test]
    fn test_file_metrics_and_pressure_calculation() {
        let weights = PressureWeights::default();
        let file_metrics = FileMetrics::compute(
            PathBuf::from("src/domain/entity.rs"),
            100, // sloc
            10,  // functions
            5,   // cyclomatic
            4,   // dependencies
            3,   // ast_depth
            0.1, // distance_d
            &weights,
        );

        // S_arch = (0.1 * 100) + (2.0 * 10) + (3.0 * 5) + (1.5 * 4) + (4.0 * 3) + (20.0 * 0.1)
        // S_arch = 10 + 20 + 15 + 6 + 12 + 2 = 65.0
        assert_eq!(file_metrics.sloc, 100);
        assert_eq!(file_metrics.functions, 10);
        assert_eq!(file_metrics.cyclomatic, 5);
        assert_eq!(file_metrics.dependencies, 4);
        assert_eq!(file_metrics.ast_depth, 3);
        assert!((file_metrics.distance_d - 0.1).abs() < 1e-6);
        assert!((file_metrics.pressure_score - 65.0).abs() < 1e-6);
    }

    #[test]
    fn test_pressure_calculator_score() {
        let violations = vec![
            Violation {
                rule_id: "ARCH-001".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: PathBuf::from("test.rs"),
                line: 1,
                column: 1,
                symbol: "fn".into(),
                snippet: "use tauri;".into(),
                message: "err".into(),
                remediation: "fix".into(),
                fingerprint: "fp1".into(),
            },
            Violation {
                rule_id: "CSS-003".into(),
                rule_version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Warn,
                file: PathBuf::from("test.css"),
                line: 1,
                column: 1,
                symbol: "css".into(),
                snippet: "dup".into(),
                message: "err".into(),
                remediation: "fix".into(),
                fingerprint: "fp2".into(),
            },
        ];

        let score = PressureCalculator::compute_score(&violations, 100);
        assert_eq!(score, 130.0);

        let zero = PressureCalculator::compute_score(&[], 0);
        assert_eq!(zero, 0.0);
    }
}
