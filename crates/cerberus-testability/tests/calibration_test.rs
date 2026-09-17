use cerberus_testability::application::RunCalibrationSuiteUseCase;
use cerberus_testability::domain::score::TestabilityTier;
use cerberus_testability::infrastructure::SyntheticAnchor;

#[test]
fn test_synthetic_anchors_calibration_and_monotonicity() {
    let result = RunCalibrationSuiteUseCase::run_suite();

    for (anchor, report) in &result.anchor_reports {
        println!(
            "Anchor {} ('{}'): Score = {:.1} (T_unit: {:.1}, T_int: {:.1}, SLOC: {}, Frictions: {}) | Expected: [{:.1}, {:.1}]",
            anchor.id,
            anchor.name,
            report.t_composite,
            report.t_unit,
            report.t_integration,
            report.sloc,
            report.frictions.len(),
            anchor.target_score_range.0,
            anchor.target_score_range.1,
        );
    }

    if !result.validation_errors.is_empty() {
        for err in &result.validation_errors {
            eprintln!("CALIBRATION ERROR: {}", err);
        }
    }

    assert!(result.is_monotonic, "Calibration suite MUST be strictly monotonic across Anchor 0..6");
    assert!(result.matches_expected_ranges, "All anchors MUST score within their expected target ranges");
}

#[test]
fn test_calibration_negative_and_out_of_range_validation() {
    // 1. Anchor with unrealistic target range (triggers out of range validation error)
    let bad_range_anchor = SyntheticAnchor {
        id: 99,
        name: "Broken Range Anchor",
        expected_tier: TestabilityTier::S,
        target_score_range: (10.0, 20.0), // pure code will score 100.0, which violates [10, 20]
        source_code: "pub fn pure() -> i32 { 42 }",
    };

    // 2. Non-monotonic pair: low score followed by high score
    let low_anchor = SyntheticAnchor {
        id: 100,
        name: "Low Score Anchor",
        expected_tier: TestabilityTier::F,
        target_score_range: (0.0, 50.0),
        source_code: "static mut X: Option<i32> = None; pub fn bad() { let _ = std::time::SystemTime::now(); }",
    };
    let high_anchor = SyntheticAnchor {
        id: 101,
        name: "High Score Anchor",
        expected_tier: TestabilityTier::S,
        target_score_range: (90.0, 100.0),
        source_code: "pub fn pure2() -> i32 { 100 }",
    };

    let invalid_suite = vec![bad_range_anchor, low_anchor, high_anchor];
    let res = RunCalibrationSuiteUseCase::validate_anchors(&invalid_suite);

    assert!(!res.is_monotonic, "Should detect monotonicity violation between low and high anchor");
    assert!(!res.matches_expected_ranges, "Should detect out of range violation");
    assert!(res.validation_errors.len() >= 2);
}
