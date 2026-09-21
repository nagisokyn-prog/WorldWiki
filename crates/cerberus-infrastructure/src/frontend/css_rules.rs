use cerberus_domain::{compute_fingerprint, Category, CerberusConfig, Severity, Violation};

use crate::frontend::css_perf_rules::CssPerfRuleChecker;
use crate::frontend::design_system_rules::DesignSystemRuleChecker;
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
static URL_SVG_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"url\(#[^)]*\)").unwrap());
static CSS_COMMENT_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"/\*.*?\*/").unwrap());
static TS_COMMENT_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"//.*$").unwrap());
static TS_REGEX_LITERAL_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"/[^/\n\r]+/[gimsuy]*").unwrap());
static TS_STRING_LITERAL_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)"#).unwrap()
});

pub struct CssRuleChecker;

impl CssRuleChecker {
    pub fn check_sfc_styles(sfc: &VueSfc, file_path: &Path) -> Vec<Violation> {
        let mut violations = Vec::new();

        for style in &sfc.styles {
            // 1. CSS-001: Excessive inline styles in SFC without external src
            if style.src.is_none() && !style.content.trim().is_empty() {
                let active_lines: Vec<&str> = style
                    .content
                    .lines()
                    .map(|l| l.trim())
                    .filter(|l| !l.is_empty() && !l.starts_with("/*"))
                    .collect();

                if active_lines.len() > 25 {
                    let snippet = active_lines
                        .iter()
                        .take(5)
                        .copied()
                        .collect::<Vec<_>>()
                        .join("\n");
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
                        remediation: "Extract styles into styles package or external CSS file and link via <style scoped src=\"...\">.".into(),
                        fingerprint,
                    });
                }
            }

            // 2. CSS-004: Validate design tokens inside style content
            if !style.content.is_empty() {
                Self::validate_css_content(
                    &style.content,
                    file_path,
                    style.start_line,
                    None,
                    &mut violations,
                );
            }
        }

        violations
    }

    pub fn validate_css_file(content: &str, file_path: &Path) -> Vec<Violation> {
        Self::validate_css_file_with_config(content, file_path, None)
    }

    pub fn validate_css_file_with_config(
        content: &str,
        file_path: &Path,
        config: Option<&CerberusConfig>,
    ) -> Vec<Violation> {
        let mut violations = Vec::new();

        // CSS-002: Check mirroring stylesheet taxonomy
        let path_str = file_path.to_string_lossy().replace('\\', "/");
        if path_str.contains("/styles/") || path_str.contains("src/styles") {
            let is_valid_taxonomy = path_str.contains("styles/tokens")
                || path_str.contains("styles/components")
                || path_str.contains("styles/features")
                || path_str.contains("styles/base")
                || path_str.contains("styles/views")
                || path_str.ends_with("index.css")
                || path_str.ends_with("styles.css");

            if !is_valid_taxonomy {
                let fingerprint =
                    compute_fingerprint("CSS-002", "1.0", "stylesheet_taxonomy", &path_str);
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

        Self::validate_css_content(content, file_path, 1, config, &mut violations);
        violations
    }

    fn validate_css_content(
        content: &str,
        file_path: &Path,
        start_line_offset: usize,
        config: Option<&CerberusConfig>,
        violations: &mut Vec<Violation>,
    ) {
        let is_token_file = is_token_path(file_path, config);

        let (max_blur_px, max_filter_fns) = if let Some(cfg) = config {
            if let Some(perf) = &cfg.css_perf {
                (perf.max_blur_radius_px, perf.max_filter_functions)
            } else {
                (30, 4)
            }
        } else {
            (30, 4)
        };

        let primitive_prefixes = if let Some(cfg) = config {
            if let Some(tokens) = &cfg.design_tokens {
                tokens.primitive_prefixes.clone()
            } else {
                cerberus_domain::DesignTokensConfig::default().primitive_prefixes
            }
        } else {
            cerberus_domain::DesignTokensConfig::default().primitive_prefixes
        };

        // Check PERF-005: prefers-reduced-motion presence across stylesheet
        violations.extend(CssPerfRuleChecker::check_reduced_motion_presence(
            content, file_path,
        ));

        let mut current_selector = String::new();
        let mut in_keyframes = false;

        for (idx, line) in content.lines().enumerate() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("/*") || trimmed.starts_with("//") {
                continue;
            }

            // Внутри файлов tokens/ объявление CSS переменных (--var: ...) является легитимным определением токенов
            if is_token_file && trimmed.starts_with("--") {
                continue;
            }

            let current_line = start_line_offset + idx;

            // Стриппаем инлайн-комментарии перед проверкой правил
            let line_no_comments = CSS_COMMENT_RE.replace_all(trimmed, "").to_string();
            let line_clean = line_no_comments.trim();
            if line_clean.is_empty() {
                continue;
            }

            // Отслеживание контекста селектора и @keyframes
            let open_braces = line_clean.chars().filter(|&c| c == '{').count();
            let close_braces = line_clean.chars().filter(|&c| c == '}').count();

            if line_clean.contains("@keyframes") {
                in_keyframes = open_braces > close_braces;
            } else if in_keyframes && close_braces >= open_braces {
                in_keyframes = false;
            }

            if line_clean.ends_with('{') {
                let sel_part = line_clean.trim_end_matches('{').trim();
                current_selector = sel_part.to_string();
            }
            if close_braces > 0 {
                current_selector.clear();
            }

            // DS-002: Запрет локальных переопределений тем
            if let Some(v) = DesignSystemRuleChecker::check_local_theme_override(
                line_clean,
                is_token_file,
                current_line,
                file_path,
            ) {
                violations.push(v);
            }

            // DS-001: Запрет прямого использования спектральных (Tier-1) токенов
            violations.extend(DesignSystemRuleChecker::check_primitive_token_usage(
                line_clean,
                &primitive_prefixes,
                is_token_file,
                current_line,
                file_path,
            ));

            // PERF-004: Запрет transition: all
            if let Some(v) =
                CssPerfRuleChecker::check_transition_all(line_clean, current_line, file_path)
            {
                violations.push(v);
            }

            // PERF-003: Проверка композиторных анимаций
            if let Some(v) = CssPerfRuleChecker::check_compositor_animation(
                line_clean,
                in_keyframes,
                current_line,
                file_path,
            ) {
                violations.push(v);
            }

            // PERF-002: Бюджет размытия и фильтров
            if let Some(v) = CssPerfRuleChecker::check_blur_and_filter_budget(
                line_clean,
                max_blur_px,
                max_filter_fns,
                current_line,
                file_path,
            ) {
                violations.push(v);
            }

            // PERF-001: will-change overuse
            if let Some(v) = CssPerfRuleChecker::check_will_change_usage(
                &current_selector,
                line_clean,
                current_line,
                file_path,
            ) {
                violations.push(v);
            }

            // DS-003: Таксономия ролей токенов (color vs background)
            if let Some((prop, val)) = line_clean.split_once(':') {
                if let Some(v) = DesignSystemRuleChecker::check_token_role_taxonomy(
                    prop,
                    val.trim_end_matches(';'),
                    current_line,
                    file_path,
                ) {
                    violations.push(v);
                }
            }

            // Исключаем SVG-ссылки вида url(#gradient) из проверки Hex
            let line_no_svg_url = URL_SVG_RE.replace_all(line_clean, "").to_string();

            // Check Hex colors
            if HEX_RE.is_match(&line_no_svg_url) {
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
            if RGB_HSL_RE.is_match(line_clean) {
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
                    remediation:
                        "Use semantic design tokens from design system CSS Custom Properties."
                            .into(),
                    fingerprint,
                });
            }

            // Check hardcoded pixel border-radius
            if BORDER_RADIUS_RE.is_match(line_clean) {
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

            // Check CSS-006: !important abuse (только в активном коде, не в комментариях)
            if line_clean.contains("!important") {
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

    pub fn check_typescript_colors(
        content: &str,
        file_path: &Path,
        config: Option<&CerberusConfig>,
    ) -> Vec<Violation> {
        let mut violations = Vec::new();

        if is_token_path(file_path, config) {
            return violations;
        }

        for (idx, line) in content.lines().enumerate() {
            let trimmed = line.trim();
            if trimmed.is_empty()
                || trimmed.starts_with("//")
                || trimmed.starts_with("/*")
                || trimmed.starts_with("*")
            {
                continue;
            }

            // 1. Стриппаем строчные комментарии
            let line_no_comment = TS_COMMENT_RE.replace(trimmed, "").to_string();
            // 2. Стриппаем RegExp-литералы (например, /\brgba?\(/)
            let line_no_regex = TS_REGEX_LITERAL_RE
                .replace_all(&line_no_comment, "")
                .to_string();

            // 3. Ищем только внутри строковых литералов
            for cap in TS_STRING_LITERAL_RE.find_iter(&line_no_regex) {
                let str_val = cap.as_str();

                // Игнорируем ключевые слова семантики
                if str_val.contains("transparent") || str_val.contains("currentColor") {
                    continue;
                }

                // Игнорируем SVG ссылки url(#...)
                let str_no_svg = URL_SVG_RE.replace_all(str_val, "").to_string();

                let hex_matches = HEX_RE.is_match(&str_no_svg);
                let rgb_matches = RGB_HSL_RE.is_match(str_val);

                if hex_matches || rgb_matches {
                    let symbol = if hex_matches {
                        "ts_color_hex"
                    } else {
                        "ts_color_rgb_hsl"
                    };
                    let fingerprint = compute_fingerprint("CSS-005", "1.0", symbol, str_val);
                    violations.push(Violation {
                        rule_id: "CSS-005".into(),
                        rule_version: "1.0".into(),
                        category: Category::Convention,
                        severity: Severity::Deny,
                        file: file_path.to_path_buf(),
                        line: idx + 1,
                        column: 1,
                        symbol: symbol.into(),
                        snippet: trimmed.to_string(),
                        message: format!(
                            "Raw color literal {} detected inside TypeScript logic. Use semantic variants (e.g. variant: 'morning') or CSS custom properties.",
                            str_val
                        ),
                        remediation: "Extract color to CSS custom properties or return a semantic string variant to bind via data-* attributes.".into(),
                        fingerprint,
                    });
                }
            }
        }

        violations
    }
}

fn is_token_path(file_path: &Path, config: Option<&CerberusConfig>) -> bool {
    let path_str = file_path.to_string_lossy().replace('\\', "/");
    if let Some(cfg) = config {
        if let Some(tokens_cfg) = &cfg.design_tokens {
            for pattern in &tokens_cfg.tokens_roots {
                let clean_pat = pattern
                    .trim_end_matches("/**")
                    .trim_end_matches("/*")
                    .trim_start_matches("./")
                    .replace('\\', "/");
                if path_str.contains(&clean_pat) {
                    return true;
                }
            }
        }
    }
    path_str.contains("tokens")
        || path_str.ends_with(".spec.ts")
        || path_str.ends_with(".test.ts")
        || path_str.ends_with(".spec.js")
        || path_str.ends_with(".test.js")
        || path_str.contains("__tests__")
        || path_str.ends_with(".stories.ts")
        || path_str.ends_with(".stories.js")
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
