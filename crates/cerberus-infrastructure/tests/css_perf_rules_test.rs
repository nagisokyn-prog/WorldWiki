use cerberus_domain::Severity;
use cerberus_infrastructure::CssPerfRuleChecker;
use std::path::Path;

#[test]
fn test_transition_all_rule_css_perf_004() {
    let file = Path::new("src/Button.css");

    // 1. Positive: transition: all must trigger Deny
    let positive_samples = [
        "transition: all 0.2s ease;",
        "transition: all;",
        "transition: inherit;",
        "transition: initial;",
    ];

    for (idx, sample) in positive_samples.iter().enumerate() {
        let violation = CssPerfRuleChecker::check_transition_all(sample, idx + 1, file);
        assert!(violation.is_some(), "Expected violation for {}", sample);
        let v = violation.unwrap();
        assert_eq!(v.rule_id, "CSS-PERF-004");
        assert_eq!(v.severity, Severity::Deny);
        assert_eq!(v.symbol, "no_transition_all");
    }

    // 2. Negative: Explicit property transitions must pass
    let negative_samples = [
        "transition: opacity 0.2s ease, transform 0.2s ease;",
        "transition: color 0.15s, background-color 0.15s;",
        "transition: border-color 0.2s;",
    ];

    for sample in &negative_samples {
        let violation = CssPerfRuleChecker::check_transition_all(sample, 1, file);
        assert!(violation.is_none(), "Unexpected violation for {}", sample);
    }
}

#[test]
fn test_compositor_only_animation_rule_css_perf_003() {
    let file = Path::new("src/Animation.css");

    // 1. Positive: Layout property in @keyframes -> Deny
    let keyframe_layout_props = [
        "width: 100px;",
        "height: 200px;",
        "margin-top: 20px;",
        "padding: 10px;",
        "top: 50px;",
        "box-shadow: 0 0 10px rgba(0,0,0,0.5);",
    ];

    for (idx, prop) in keyframe_layout_props.iter().enumerate() {
        let violation = CssPerfRuleChecker::check_compositor_animation(prop, true, idx + 1, file);
        assert!(violation.is_some(), "Expected keyframe violation for {}", prop);
        let v = violation.unwrap();
        assert_eq!(v.rule_id, "CSS-PERF-003");
        assert_eq!(v.severity, Severity::Deny);
        assert_eq!(v.symbol, "compositor_keyframes_layout");
    }

    // 2. Positive: Layout property in transition -> Warn
    let transition_layout_props = [
        "transition: width 0.3s ease;",
        "transition: height 0.5s;",
        "transition: margin 0.2s;",
        "transition: box-shadow 0.2s;",
    ];

    for (idx, prop) in transition_layout_props.iter().enumerate() {
        let violation = CssPerfRuleChecker::check_compositor_animation(prop, false, idx + 1, file);
        assert!(violation.is_some(), "Expected transition warning for {}", prop);
        let v = violation.unwrap();
        assert_eq!(v.rule_id, "CSS-PERF-003");
        assert_eq!(v.severity, Severity::Warn);
        assert_eq!(v.symbol, "compositor_transition_layout");
    }

    // 3. Negative: Compositor-only properties (transform, opacity) -> Allowed
    let allowed_props = [
        ("transform: scale(1.1) translateY(-5px);", true),
        ("opacity: 0.8;", true),
        ("transition: transform 0.2s, opacity 0.2s;", false),
    ];

    for (prop, is_kf) in allowed_props {
        let violation = CssPerfRuleChecker::check_compositor_animation(prop, is_kf, 1, file);
        assert!(violation.is_none(), "Unexpected violation for {}", prop);
    }
}

#[test]
fn test_blur_and_filter_budget_rule_css_perf_002() {
    let file = Path::new("src/Glass.css");

    // 1. Positive: Excessive blur radius > 30px -> Warn
    let violation = CssPerfRuleChecker::check_blur_and_filter_budget(
        "backdrop-filter: blur(50px);",
        30,
        4,
        1,
        file,
    );
    assert!(violation.is_some());
    let v = violation.unwrap();
    assert_eq!(v.rule_id, "CSS-PERF-002");
    assert_eq!(v.symbol, "excessive_blur_radius");
    assert!(v.message.contains("50px"));

    // 2. Positive: Too many chained filter functions (> 4) -> Warn
    let violation = CssPerfRuleChecker::check_blur_and_filter_budget(
        "filter: blur(5px) brightness(1.2) contrast(1.1) drop-shadow(0 2px 4px #000) grayscale(0.5);",
        30,
        4,
        1,
        file,
    );
    assert!(violation.is_some());
    let v = violation.unwrap();
    assert_eq!(v.rule_id, "CSS-PERF-002");
    assert_eq!(v.symbol, "excessive_filter_functions");

    // 3. Negative: Within budget -> Allowed
    let violation = CssPerfRuleChecker::check_blur_and_filter_budget(
        "backdrop-filter: blur(16px) saturate(180%);",
        30,
        4,
        1,
        file,
    );
    assert!(violation.is_none());
}

#[test]
fn test_will_change_overuse_rule_css_perf_001() {
    let file = Path::new("src/Card.css");

    // 1. Positive: will-change with all or auto
    let v1 = CssPerfRuleChecker::check_will_change_usage(".card", "will-change: all;", 1, file);
    assert!(v1.is_some());
    assert_eq!(v1.unwrap().symbol, "will_change_wildcard");

    let v2 = CssPerfRuleChecker::check_will_change_usage(".card", "will-change: auto;", 1, file);
    assert!(v2.is_some());
    assert_eq!(v2.unwrap().symbol, "will_change_wildcard");

    // 2. Positive: Preventive will-change on static general selector
    let v3 = CssPerfRuleChecker::check_will_change_usage("button", "will-change: transform;", 1, file);
    assert!(v3.is_some());
    assert_eq!(v3.unwrap().symbol, "will_change_overuse");

    let v4 = CssPerfRuleChecker::check_will_change_usage("div", "will-change: opacity;", 1, file);
    assert!(v4.is_some());
    assert_eq!(v4.unwrap().symbol, "will_change_overuse");

    // 3. Negative: Interactive or specific class states
    let v5 = CssPerfRuleChecker::check_will_change_usage("button:hover", "will-change: transform;", 1, file);
    assert!(v5.is_none());

    let v6 = CssPerfRuleChecker::check_will_change_usage(".drawer.is-opening", "will-change: transform, opacity;", 1, file);
    assert!(v6.is_none());

    let v7 = CssPerfRuleChecker::check_will_change_usage(".slider[data-animating]", "will-change: transform;", 1, file);
    assert!(v7.is_none());
}

#[test]
fn test_reduced_motion_presence_rule_css_perf_005() {
    let file = Path::new("src/Spinner.css");

    // 1. Positive: Infinite animation without reduced-motion -> Warn
    let infinite_css = r##"
        .spinner {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    "##;
    let violations = CssPerfRuleChecker::check_reduced_motion_presence(infinite_css, file);
    assert_eq!(violations.len(), 1);
    assert_eq!(violations[0].rule_id, "CSS-PERF-005");
    assert_eq!(violations[0].symbol, "require_reduced_motion");

    // 2. Negative: Infinite animation WITH reduced-motion -> Allowed
    let accessible_css = r##"
        .spinner {
            animation: spin 1s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
            .spinner {
                animation: none;
            }
        }
    "##;
    let violations = CssPerfRuleChecker::check_reduced_motion_presence(accessible_css, file);
    assert_eq!(violations.len(), 0);

    // 3. Negative: Short non-infinite transition -> Allowed
    let short_css = r##"
        .btn {
            transition: opacity 0.2s ease;
        }
    "##;
    let violations = CssPerfRuleChecker::check_reduced_motion_presence(short_css, file);
    assert_eq!(violations.len(), 0);
}
