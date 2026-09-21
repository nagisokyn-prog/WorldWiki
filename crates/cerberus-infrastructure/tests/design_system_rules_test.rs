use cerberus_domain::Severity;
use cerberus_infrastructure::DesignSystemRuleChecker;
use std::path::Path;

#[test]
fn test_token_role_taxonomy_rule_ds_003() {
    let file = Path::new("src/Button.css");

    // 1. Positive: Background token in text `color` property -> Deny
    let v1 = DesignSystemRuleChecker::check_token_role_taxonomy(
        "color",
        "var(--bg-primary)",
        1,
        file,
    );
    assert!(v1.is_some());
    let r1 = v1.unwrap();
    assert_eq!(r1.rule_id, "DS-003");
    assert_eq!(r1.severity, Severity::Deny);
    assert_eq!(r1.symbol, "token_role_mismatch_text");
    assert!(r1.message.contains("--bg-primary"));

    let v2 = DesignSystemRuleChecker::check_token_role_taxonomy(
        "color",
        "var(--surface-elevated)",
        2,
        file,
    );
    assert!(v2.is_some());
    assert_eq!(v2.unwrap().symbol, "token_role_mismatch_text");

    // 2. Positive: Text token in `background` or `background-color` -> Deny
    let v3 = DesignSystemRuleChecker::check_token_role_taxonomy(
        "background-color",
        "var(--text-main)",
        3,
        file,
    );
    assert!(v3.is_some());
    let r3 = v3.unwrap();
    assert_eq!(r3.rule_id, "DS-003");
    assert_eq!(r3.symbol, "token_role_mismatch_bg");

    let v4 = DesignSystemRuleChecker::check_token_role_taxonomy(
        "background",
        "var(--color-fg-muted)",
        4,
        file,
    );
    assert!(v4.is_some());
    assert_eq!(v4.unwrap().symbol, "token_role_mismatch_bg");

    // 3. Negative: Proper semantic alignment -> Allowed
    assert!(DesignSystemRuleChecker::check_token_role_taxonomy("color", "var(--text-main)", 5, file).is_none());
    assert!(DesignSystemRuleChecker::check_token_role_taxonomy("color", "var(--accent-text)", 6, file).is_none());
    assert!(DesignSystemRuleChecker::check_token_role_taxonomy("background", "var(--bg-card)", 7, file).is_none());
    assert!(DesignSystemRuleChecker::check_token_role_taxonomy("background-color", "var(--surface-ground)", 8, file).is_none());
}

#[test]
fn test_primitive_token_usage_rule_ds_001() {
    let component_file = Path::new("packages/resources/src/styles/components/Button.css");
    let token_file = Path::new("packages/resources/src/styles/tokens/palette.css");
    let prefixes = vec![
        "--blue-".into(),
        "--slate-".into(),
        "--red-".into(),
        "--gray-".into(),
    ];

    // 1. Positive: Direct Tier-1 spectral token in component stylesheet -> Deny
    let violations = DesignSystemRuleChecker::check_primitive_token_usage(
        "color: var(--blue-500); background: var(--slate-900);",
        &prefixes,
        false,
        1,
        component_file,
    );
    assert_eq!(violations.len(), 2);
    assert_eq!(violations[0].rule_id, "DS-001");
    assert_eq!(violations[0].symbol, "primitive_spectral_token");
    assert_eq!(violations[0].severity, Severity::Deny);

    // 2. Negative: Semantic Tier-2/Tier-3 tokens in component stylesheet -> Allowed
    let allowed_violations = DesignSystemRuleChecker::check_primitive_token_usage(
        "color: var(--text-main); background: var(--bg-card); border-color: var(--accent);",
        &prefixes,
        false,
        1,
        component_file,
    );
    assert_eq!(allowed_violations.len(), 0);

    // 3. Negative: Inside token declaration file, primitive tokens are allowed definitions -> Allowed
    let token_decl_violations = DesignSystemRuleChecker::check_primitive_token_usage(
        "--accent-primary: var(--blue-500);",
        &prefixes,
        true,
        1,
        token_file,
    );
    assert_eq!(token_decl_violations.len(), 0);
}

#[test]
fn test_local_theme_override_rule_ds_002() {
    let component_file = Path::new("packages/resources/src/styles/features/Sidebar.css");
    let token_file = Path::new("packages/resources/src/styles/tokens/theme-dark.css");

    // 1. Positive: Local theme selector in leaf component -> Deny
    let v1 = DesignSystemRuleChecker::check_local_theme_override(
        "html[data-theme=\"dark\"] .sidebar {",
        false,
        1,
        component_file,
    );
    assert!(v1.is_some());
    let r1 = v1.unwrap();
    assert_eq!(r1.rule_id, "DS-002");
    assert_eq!(r1.severity, Severity::Deny);
    assert_eq!(r1.symbol, "local_theme_override");

    let v2 = DesignSystemRuleChecker::check_local_theme_override(
        "body.dark .sidebar-item {",
        false,
        2,
        component_file,
    );
    assert!(v2.is_some());
    assert_eq!(v2.unwrap().symbol, "local_theme_override");

    let v3 = DesignSystemRuleChecker::check_local_theme_override(
        "@media (prefers-color-scheme: dark) {",
        false,
        3,
        component_file,
    );
    assert!(v3.is_some());
    assert_eq!(v3.unwrap().symbol, "local_theme_override");

    // 2. Negative: Inside token root files, theme overrides are legitimate declaration sites -> Allowed
    let v_token = DesignSystemRuleChecker::check_local_theme_override(
        "html[data-theme=\"dark\"] {",
        true,
        1,
        token_file,
    );
    assert!(v_token.is_none());

    // 3. Negative: Standard component selectors -> Allowed
    let v_normal = DesignSystemRuleChecker::check_local_theme_override(
        ".sidebar-item.is-active {",
        false,
        1,
        component_file,
    );
    assert!(v_normal.is_none());
}
