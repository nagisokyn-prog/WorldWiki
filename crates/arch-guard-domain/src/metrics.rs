use crate::rules::{Severity, Violation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageMetrics {
    pub package_name: String,
    pub afferent_coupling: usize, // Ca
    pub efferent_coupling: usize, // Ce
    pub instability: f64,         // I = Ce / (Ca + Ce)
    pub abstractness: f64,        // A = Na / Nc
    pub distance_from_main_sequence: f64, // D = |A + I - 1|
    pub in_zone_of_pain: bool,    // A < 0.2 && I < 0.2
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
            }
        }

        (weighted_sum / (total_loc as f64)) * 1000.0
    }
}
