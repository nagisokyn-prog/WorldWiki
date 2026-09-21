use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};
use regex::Regex;
use std::path::Path;
use std::sync::LazyLock;

static VAR_EXTRACT_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"var\(\s*(--[a-zA-Z0-9_-]+)").unwrap());

static LOCAL_THEME_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)(?:html\[data-theme|body\.(?:dark|light)|@media\s*\(\s*prefers-color-scheme)").unwrap());

pub struct DesignSystemRuleChecker;

impl DesignSystemRuleChecker {
    /// DS-003: Проверка таксономии ролей токенов (color: vs background:)
    pub fn check_token_role_taxonomy(
        property: &str,
        value: &str,
        line_idx: usize,
        file_path: &Path,
    ) -> Option<Violation> {
        let prop = property.trim().to_lowercase();
        let val = value.trim().to_lowercase();

        for cap in VAR_EXTRACT_RE.captures_iter(&val) {
            let var_name = cap.get(1).map(|m| m.as_str()).unwrap_or("");

            // 1. Текстовое свойство color: не должно использовать фоновые токены
            if prop == "color" {
                let is_bg_token = var_name.starts_with("--bg-")
                    || var_name.starts_with("--surface-")
                    || var_name.starts_with("--color-bg-");

                if is_bg_token {
                    let snippet = format!("{}: var({})", property.trim(), var_name);
                    let fingerprint = compute_fingerprint("DS-003", "1.0", "token_role_mismatch_text", &snippet);
                    return Some(Violation {
                        rule_id: "DS-003".into(),
                        rule_version: "1.0".into(),
                        category: Category::Convention,
                        severity: Severity::Deny,
                        file: file_path.to_path_buf(),
                        line: line_idx,
                        column: 1,
                        symbol: "token_role_mismatch_text".into(),
                        snippet,
                        message: format!(
                            "Background token `{}` used in text `color` property. This breaks contrast ratio on theme inversion.",
                            var_name
                        ),
                        remediation: "Use semantic text/foreground token (e.g. `var(--text-main)`, `var(--text-muted)`).".into(),
                        fingerprint,
                    });
                }
            }

            // 2. Фоновые свойства background / background-color не должны использовать текстовые токены
            if prop == "background" || prop == "background-color" {
                let is_text_token = var_name.starts_with("--text-")
                    || var_name.starts_with("--fg-")
                    || var_name.starts_with("--color-text-")
                    || var_name.starts_with("--color-fg-");

                if is_text_token {
                    let snippet = format!("{}: var({})", property.trim(), var_name);
                    let fingerprint = compute_fingerprint("DS-003", "1.0", "token_role_mismatch_bg", &snippet);
                    return Some(Violation {
                        rule_id: "DS-003".into(),
                        rule_version: "1.0".into(),
                        category: Category::Convention,
                        severity: Severity::Deny,
                        file: file_path.to_path_buf(),
                        line: line_idx,
                        column: 1,
                        symbol: "token_role_mismatch_bg".into(),
                        snippet,
                        message: format!(
                            "Text token `{}` used in `{}` property. This breaks contrast ratio on theme inversion.",
                            var_name, property.trim()
                        ),
                        remediation: "Use semantic background/surface token (e.g. `var(--bg-main)`, `var(--bg-card)`).".into(),
                        fingerprint,
                    });
                }
            }
        }

        None
    }

    /// DS-001: Запрет спектральных (Tier-1 Primitive) токенов напрямую в компонентах
    pub fn check_primitive_token_usage(
        declaration: &str,
        primitive_prefixes: &[String],
        is_token_declaration_file: bool,
        line_idx: usize,
        file_path: &Path,
    ) -> Vec<Violation> {
        let mut violations = Vec::new();
        if is_token_declaration_file {
            return violations;
        }

        let trimmed = declaration.trim();
        for cap in VAR_EXTRACT_RE.captures_iter(trimmed) {
            let var_name = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            
            for prefix in primitive_prefixes {
                if var_name.starts_with(prefix) {
                    let snippet = format!("var({})", var_name);
                    let fingerprint = compute_fingerprint("DS-001", "1.0", "primitive_spectral_token", &snippet);
                    violations.push(Violation {
                        rule_id: "DS-001".into(),
                        rule_version: "1.0".into(),
                        category: Category::Convention,
                        severity: Severity::Deny,
                        file: file_path.to_path_buf(),
                        line: line_idx,
                        column: 1,
                        symbol: "primitive_spectral_token".into(),
                        snippet: trimmed.to_string(),
                        message: format!(
                            "Direct use of Tier-1 primitive spectral token `{}` in component styles is prohibited.",
                            var_name
                        ),
                        remediation: "Use Tier-2 semantic alias role tokens (e.g. `var(--accent)`, `var(--bg-primary)`).".into(),
                        fingerprint,
                    });
                    break;
                }
            }
        }

        violations
    }

    /// DS-002: Запрет локальных переопределений тем в листовых CSS
    pub fn check_local_theme_override(
        selector_or_at_rule: &str,
        is_token_declaration_file: bool,
        line_idx: usize,
        file_path: &Path,
    ) -> Option<Violation> {
        if is_token_declaration_file {
            return None;
        }

        let trimmed = selector_or_at_rule.trim();
        if LOCAL_THEME_RE.is_match(trimmed) {
            let fingerprint = compute_fingerprint("DS-002", "1.0", "local_theme_override", trimmed);
            return Some(Violation {
                rule_id: "DS-002".into(),
                rule_version: "1.0".into(),
                category: Category::Convention,
                severity: Severity::Deny,
                file: file_path.to_path_buf(),
                line: line_idx,
                column: 1,
                symbol: "local_theme_override".into(),
                snippet: trimmed.to_string(),
                message: "Local theme override detected in component stylesheet. Themes must be managed centrally via token declarations.".into(),
                remediation: "Define theme variations exclusively inside global tokens roots files.".into(),
                fingerprint,
            });
        }

        None
    }
}
