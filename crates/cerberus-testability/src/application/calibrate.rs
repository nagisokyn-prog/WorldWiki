use crate::domain::layer::LayerContext;
use crate::domain::score::FileTestabilityReport;
use crate::infrastructure::synthetic_fixtures::{ALL_ANCHORS, SyntheticAnchor};
use super::calculate_score::ComputeTestabilityUseCase;

#[derive(Debug, Clone)]
pub struct CalibrationResult {
    pub anchor_reports: Vec<(SyntheticAnchor, FileTestabilityReport)>,
    pub is_monotonic: bool,
    pub matches_expected_ranges: bool,
    pub validation_errors: Vec<String>,
}

pub struct RunCalibrationSuiteUseCase;

impl RunCalibrationSuiteUseCase {
    #[must_use]
    pub fn run_suite() -> CalibrationResult {
        Self::validate_anchors(ALL_ANCHORS)
    }

    #[must_use]
    pub fn validate_anchors(anchors: &[SyntheticAnchor]) -> CalibrationResult {
        let mut anchor_reports = Vec::new();
        let mut validation_errors = Vec::new();

        for anchor in anchors {
            let layer = LayerContext::Domain;

            let report = ComputeTestabilityUseCase::compute_for_source(
                anchor.name,
                anchor.source_code,
                layer,
            );

            let (min_expected, max_expected) = anchor.target_score_range;
            if report.t_composite < min_expected || report.t_composite > max_expected {
                validation_errors.push(format!(
                    "Anchor {} ('{}') scored {:.1}, outside target range [{:.1}, {:.1}]",
                    anchor.id, anchor.name, report.t_composite, min_expected, max_expected
                ));
            }

            anchor_reports.push((*anchor, report));
        }

        // Проверка монотонности (невозрастание: T_0 >= T_1 >= T_2 > T_3 > T_4 > T_5 > T_6)
        let mut is_monotonic = true;
        for i in 0..anchor_reports.len().saturating_sub(1) {
            let current_score = anchor_reports[i].1.t_composite;
            let next_score = anchor_reports[i + 1].1.t_composite;
            if current_score < next_score {
                is_monotonic = false;
                validation_errors.push(format!(
                    "Monotonicity violation: Anchor {} ({:.1}) is strictly less than Anchor {} ({:.1})",
                    anchor_reports[i].0.id, current_score, anchor_reports[i + 1].0.id, next_score
                ));
            }
        }

        let matches_expected_ranges = validation_errors.is_empty();

        CalibrationResult {
            anchor_reports,
            is_monotonic,
            matches_expected_ranges,
            validation_errors,
        }
    }
}
