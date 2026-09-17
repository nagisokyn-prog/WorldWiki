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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_package_metrics_math_and_zone_of_pain() {
        // Zero classes edge case
        let zero = PackageMetrics::compute("zero".into(), 0, 0, 0, 0);
        assert_eq!(zero.instability, 0.0);
        assert_eq!(zero.abstractness, 0.0);
        assert_eq!(zero.distance_from_main_sequence, 1.0);
        assert!(!zero.in_zone_of_pain);

        // Standard calculation: afferent=10, efferent=10, abstract=5, total=10
        let pm = PackageMetrics::compute("core".into(), 10, 10, 5, 10);
        assert_eq!(pm.instability, 0.5);
        assert_eq!(pm.abstractness, 0.5);
        assert_eq!(pm.distance_from_main_sequence, 0.0);
        assert!(!pm.in_zone_of_pain);

        // In Zone of Pain: abstractness < 0.2, instability < 0.2, afferent > 3
        let pain = PackageMetrics::compute("pain".into(), 10, 1, 1, 10);
        // instability = 1 / 11 ~= 0.0909 (< 0.2)
        // abstractness = 1 / 10 = 0.1 (< 0.2)
        // afferent = 10 (> 3)
        assert!(pain.abstractness < 0.2);
        assert!(pain.instability < 0.2);
        assert!(pain.afferent_coupling > 3);
        assert!(pain.in_zone_of_pain);

        // Boundary: abstractness = 0.2 (must NOT be in zone of pain)
        let not_pain_a = PackageMetrics::compute("not_pain".into(), 10, 1, 2, 10);
        assert_eq!(not_pain_a.abstractness, 0.2);
        assert!(!not_pain_a.in_zone_of_pain);

        // Boundary: instability = 0.2 (efferent=2, afferent=8 -> 2/10 = 0.2)
        let not_pain_i = PackageMetrics::compute("not_pain".into(), 8, 2, 1, 10);
        assert_eq!(not_pain_i.instability, 0.2);
        assert!(!not_pain_i.in_zone_of_pain);

        // Boundary: afferent = 3 (must NOT be in zone of pain since afferent > 3 required)
        let not_pain_aff = PackageMetrics::compute("not_pain".into(), 3, 0, 1, 10);
        assert_eq!(not_pain_aff.afferent_coupling, 3);
        assert!(!not_pain_aff.in_zone_of_pain);

        // Distance from main sequence: A=0.1, I=0.09090909090909091 -> distance = |0.190909... - 1.0| = 0.8090909090909091
        let expected_d = (pain.abstractness + pain.instability - 1.0).abs();
        assert_eq!(pain.distance_from_main_sequence, expected_d);
    }

    #[test]
    fn test_file_metrics_and_pressure_calculator() {
        let weights = PressureWeights::default();
        let fm = FileMetrics::compute(
            PathBuf::from("src/lib.rs"),
            100, // sloc * 0.1 = 10.0
            5,   // fn * 2.0 = 10.0
            4,   // cyclo * 3.0 = 12.0
            2,   // deps * 1.5 = 3.0
            3,   // ast * 4.0 = 12.0
            0.5, // dist * 20.0 = 10.0
            &weights,
        );
        assert_eq!(fm.pressure_score, 10.0 + 10.0 + 12.0 + 3.0 + 12.0 + 10.0);

        // Pressure Calculator
        assert_eq!(PressureCalculator::compute_score(&[], 1000), 0.0);
        assert_eq!(PressureCalculator::compute_score(&[], 0), 0.0);

        let violations = vec![
            Violation {
                rule_id: "R1".into(),
                rule_version: "1.0".into(),
                category: crate::rules::Category::Architecture,
                severity: Severity::Deny,
                file: PathBuf::from("a.rs"),
                line: 1,
                column: 1,
                symbol: "s".into(),
                snippet: "snip".into(),
                message: "msg".into(),
                remediation: "rem".into(),
                fingerprint: "fp1".into(),
            },
            Violation {
                rule_id: "R2".into(),
                rule_version: "1.0".into(),
                category: crate::rules::Category::Architecture,
                severity: Severity::Warn,
                file: PathBuf::from("b.rs"),
                line: 1,
                column: 1,
                symbol: "s".into(),
                snippet: "snip".into(),
                message: "msg".into(),
                remediation: "rem".into(),
                fingerprint: "fp2".into(),
            },
            Violation {
                rule_id: "R3".into(),
                rule_version: "1.0".into(),
                category: crate::rules::Category::Architecture,
                severity: Severity::Off,
                file: PathBuf::from("c.rs"),
                line: 1,
                column: 1,
                symbol: "s".into(),
                snippet: "snip".into(),
                message: "msg".into(),
                remediation: "rem".into(),
                fingerprint: "fp3".into(),
            },
        ];

        // 10.0 (Deny) + 3.0 (Warn) = 13.0. For 1000 loc -> (13.0 / 1000) * 1000 = 13.0
        let score = PressureCalculator::compute_score(&violations, 1000);
        assert_eq!(score, 13.0);
    }
}
