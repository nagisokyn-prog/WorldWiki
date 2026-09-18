use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};

use crate::frontend::sfc_parser::VueSfc;
use regex::Regex;
use std::path::Path;
use std::sync::LazyLock;

static HEX_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"#(?:[0-9a-fA-F]{3,4}){1,2}\b").unwrap());
static RGB_HSL_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b(?:rgb|rgba|hsl|hsla)\s*\([^)]*\)").unwrap());
static BORDER_RADIUS_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"border-radius\s*:\s*\d+px").unwrap());

pub struct CssRuleChecker;

impl CssRuleChecker {
    pub fn check_sfc_styles(sfc: &VueSfc, file_path: &Path) -> Vec<Violation> {
        let mut violations = Vec::new();

        for style in &sfc.styles {
            // 1. CSS-001: Excessive inline styles in SFC without external src
            if style.src.is_none() && !style.content.trim().is_empty() {
                let active_lines: Vec<&str> = style.content
                    .lines()
                    .map(|l| l.trim())
                    .filter(|l| !l.is_empty() && !l.starts_with("/*"))
                    .collect();

                if active_lines.len() > 25 {
                    let snippet = active_lines.iter().take(5).copied().collect::<Vec<_>>().join("\n");
                    let fingerprint = compute_fingerprint("CSS-001", "1.0", "style", &snippet);

                    violations.push(Violation {
                        rule_id: "CSS-001".into(),
                        rule_version: "1.0".into(),
                        category: Category::Convention,
                        severity: Severity::Deny,
                        file: file_path.to_path_buf(),
                        line: style.start_line,
                        column: 1,
                        symbol: "style".into(),
                        snippet,
                        message: format!(
                            "Vue SFC contains large inline <style> ({} lines). Raw CSS blocks in SFC are prohibited.",
                            active_lines.len()
                        ),
                        remediation: "Extract styles into @worldwiki/resources/src/styles/ and link via <style scoped src=\"...\">.".into(),
                        fingerprint,
                    });
                }
            }

            // 2. CSS-004: Validate design tokens inside style content
            if !style.content.is_empty() {
                Self::validate_css_content(&style.content, file_path, style.start_line, &mut violations);
            }
        }

        violations
    }

    pub fn validate_css_file(content: &str, file_path: &Path) -> Vec<Violation> {
        let mut violations = Vec::new();

        // CSS-002: Check mirroring stylesheet taxonomy in @worldwiki/resources
        let path_str = file_path.to_string_lossy().replace('\\', "/");
        if path_str.contains("packages/resources/src/styles") {
            let is_valid_taxonomy = path_str.contains("styles/tokens")
                || path_str.contains("styles/components")
                || path_str.contains("styles/features")
                || path_str.contains("styles/base")
                || path_str.contains("styles/views")
                || path_str.ends_with("index.css")
                || path_str.ends_with("styles.css");

            if !is_valid_taxonomy {
                let fingerprint = compute_fingerprint("CSS-002", "1.0", "stylesheet_taxonomy", &path_str);
                violations.push(Violation {
                    rule_id: "CSS-002".into(),
                    rule_version: "1.0".into(),
                    category: Category::Convention,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: 1,
                    column: 1,
                    symbol: "stylesheet_taxonomy".into(),
                    snippet: path_str.clone(),
                    message: "Orphan or misplaced stylesheet outside standard design taxonomy.".into(),
                    remediation: "Place stylesheet into styles/tokens/, styles/components/, or styles/features/ matching component structure.".into(),
                    fingerprint,
                });
            }
        }

        Self::validate_css_content(content, file_path, 1, &mut violations);
        violations
    }


    fn validate_css_content(
        content: &str,
        file_path: &Path,
        start_line_offset: usize,
        violations: &mut Vec<Violation>,
    ) {
        for (idx, line) in content.lines().enumerate() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("/*") || trimmed.starts_with("//") {
                continue;
            }

            let current_line = start_line_offset + idx;

            // Check Hex colors
            if HEX_RE.is_match(trimmed) {
                let fingerprint = compute_fingerprint("CSS-004", "1.0", "color_hex", trimmed);
                violations.push(Violation {
                    rule_id: "CSS-004".into(),
                    rule_version: "1.0".into(),
                    category: Category::Convention,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: current_line,
                    column: 1,
                    symbol: "color_hex".into(),
                    snippet: trimmed.to_string(),
                    message: "Hardcoded hex color found in stylesheet.".into(),
                    remediation: "Replace hardcoded hex color with CSS Custom Property (e.g., var(--color-text-primary)).".into(),
                    fingerprint,
                });
            }

            // Check RGB/RGBA/HSL
            if RGB_HSL_RE.is_match(trimmed) {
                let fingerprint = compute_fingerprint("CSS-004", "1.0", "color_rgb_hsl", trimmed);
                violations.push(Violation {
                    rule_id: "CSS-004".into(),
                    rule_version: "1.0".into(),
                    category: Category::Convention,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: current_line,
                    column: 1,
                    symbol: "color_rgb_hsl".into(),
                    snippet: trimmed.to_string(),
                    message: "Direct rgb()/rgba()/hsl() call found in stylesheet.".into(),
                    remediation: "Use semantic design tokens from design system CSS Custom Properties.".into(),
                    fingerprint,
                });
            }

            // Check hardcoded pixel border-radius
            if BORDER_RADIUS_RE.is_match(trimmed) {
                let fingerprint = compute_fingerprint("CSS-004", "1.0", "border_radius", trimmed);
                violations.push(Violation {
                    rule_id: "CSS-004".into(),
                    rule_version: "1.0".into(),
                    category: Category::Convention,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: current_line,
                    column: 1,
                    symbol: "border_radius".into(),
                    snippet: trimmed.to_string(),
                    message: "Hardcoded pixel border-radius found in stylesheet.".into(),
                    remediation: "Use design token var(--border-radius-sm), var(--border-radius-md), or var(--border-radius-lg).".into(),
                    fingerprint,
                });
            }

            // Check CSS-006: !important abuse
            if trimmed.contains("!important") {
                let fingerprint = compute_fingerprint("CSS-006", "1.0", "important_abuse", trimmed);
                violations.push(Violation {
                    rule_id: "CSS-006".into(),
                    rule_version: "1.0".into(),
                    category: Category::Convention,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: current_line,
                    column: 1,
                    symbol: "important_abuse".into(),
                    snippet: trimmed.to_string(),
                    message: "Use of !important in stylesheet breaks CSS cascade specificity.".into(),
                    remediation: "Refactor CSS selector specificity or component structure instead of using !important.".into(),
                    fingerprint,
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::frontend::sfc_parser::VueStyleBlock;

    #[test]
    fn test_css_rule_checker_bloated_inline_style_css001() {
        let lines = vec![".btn { margin: 0; }"; 30];
        let sfc = VueSfc {
            styles: vec![VueStyleBlock {
                content: lines.join("\n"),
                src: None,
                scoped: true,
                start_line: 10,
            }],
            ..Default::default()
        };

        let violations = CssRuleChecker::check_sfc_styles(&sfc, Path::new("src/Button.vue"));
        assert!(violations.iter().any(|v| v.rule_id == "CSS-001"));
    }

    #[test]
    fn test_css_rule_checker_hex_and_rgb_css004() {
        let css = r#"
            .box {
                color: #ff00ff;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 8px;
            }
        "#;
        let violations = CssRuleChecker::validate_css_file(css, Path::new("src/styles.css"));
        assert_eq!(violations.len(), 3);
        assert!(violations.iter().all(|v| v.rule_id == "CSS-004"));
    }

    #[test]
    fn test_css_taxonomy_css002() {
        let invalid_taxonomy = Path::new("packages/resources/src/styles/random/bad.css");
        let violations = CssRuleChecker::validate_css_file("/* comment */", invalid_taxonomy);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "CSS-002");
    }
}

