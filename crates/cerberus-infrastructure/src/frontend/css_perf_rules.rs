use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};
use regex::Regex;
use std::path::Path;
use std::sync::LazyLock;

static TRANSITION_ALL_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\btransition\s*:\s*(?:all|inherit|initial)\b").unwrap());

static BLUR_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\bblur\s*\(\s*(\d+(?:\.\d+)?)\s*(?:px|rem|em)?\s*\)").unwrap());

static FILTER_FN_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\b(?:blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|opacity|saturate|sepia)\s*\(").unwrap());

static WILL_CHANGE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\bwill-change\s*:\s*([^;]+)").unwrap());

static LAYOUT_PROPERTIES: &[&str] = &[
    "width", "height", "min-width", "max-width", "min-height", "max-height",
    "margin", "margin-top", "margin-bottom", "margin-left", "margin-right",
    "padding", "padding-top", "padding-bottom", "padding-left", "padding-right",
    "top", "left", "right", "bottom", "box-shadow"
];

static INFINITE_ANIMATION_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\banimation(?:-iteration-count)?\s*:[^;]*\binfinite\b").unwrap());

static LONG_ANIMATION_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\b(?:animation|transition)(?:-duration)?\s*:[^;]*\b(?:[4-9]\d{2}|\d{4,})m?s\b").unwrap());

pub struct CssPerfRuleChecker;

impl CssPerfRuleChecker {
    /// PERF-004: Проверка запрета wildcard `transition: all`
    pub fn check_transition_all(
        declaration: &str,
        line_idx: usize,
        file_path: &Path,
    ) -> Option<Violation> {
        let trimmed = declaration.trim();
        if TRANSITION_ALL_RE.is_match(trimmed) {
            let fingerprint = compute_fingerprint("CSS-PERF-004", "1.0", "no_transition_all", trimmed);
            return Some(Violation {
                rule_id: "CSS-PERF-004".into(),
                rule_version: "1.0".into(),
                category: Category::Performance,
                severity: Severity::Deny,
                file: file_path.to_path_buf(),
                line: line_idx,
                column: 1,
                symbol: "no_transition_all".into(),
                snippet: trimmed.to_string(),
                message: "Wildcard `transition: all` detected. This causes layout recalculation on every animated property.".into(),
                remediation: "Explicitly declare animated properties (e.g. `transition: opacity 0.2s, transform 0.2s`).".into(),
                fingerprint,
            });
        }
        None
    }

    /// PERF-003: Проверка композиторных анимаций (запрет анимации layout-свойств)
    pub fn check_compositor_animation(
        declaration: &str,
        is_in_keyframes: bool,
        line_idx: usize,
        file_path: &Path,
    ) -> Option<Violation> {
        let trimmed = declaration.trim().to_lowercase();
        
        for &prop in LAYOUT_PROPERTIES {
            let is_matched = if is_in_keyframes {
                trimmed.starts_with(prop) && trimmed[prop.len()..].trim_start().starts_with(':')
            } else if trimmed.starts_with("transition") {
                trimmed.contains(prop)
            } else {
                false
            };

            if is_matched {
                let (severity, symbol, msg) = if is_in_keyframes {
                    (
                        Severity::Deny,
                        "compositor_keyframes_layout",
                        format!("Non-composited layout property `{}` animated in @keyframes causes continuous CPU/GPU main-thread reflows.", prop),
                    )
                } else {
                    (
                        Severity::Warn,
                        "compositor_transition_layout",
                        format!("Layout/paint property `{}` in transition triggers expensive layout recalculations.", prop),
                    )
                };

                let fingerprint = compute_fingerprint("CSS-PERF-003", "1.0", symbol, declaration.trim());
                return Some(Violation {
                    rule_id: "CSS-PERF-003".into(),
                    rule_version: "1.0".into(),
                    category: Category::Performance,
                    severity,
                    file: file_path.to_path_buf(),
                    line: line_idx,
                    column: 1,
                    symbol: symbol.into(),
                    snippet: declaration.trim().to_string(),
                    message: msg,
                    remediation: "Animate compositor-only properties (`transform`, `opacity`) or use pseudo-elements.".into(),
                    fingerprint,
                });
            }
        }

        None
    }

    /// PERF-002: Порог сложности фильтров и размытия (backdrop-filter / filter)
    pub fn check_blur_and_filter_budget(
        declaration: &str,
        max_blur_px: u32,
        max_fns: usize,
        line_idx: usize,
        file_path: &Path,
    ) -> Option<Violation> {
        let trimmed = declaration.trim();
        let lower = trimmed.to_lowercase();

        if !lower.contains("filter") && !lower.contains("backdrop-filter") {
            return None;
        }

        // 1. Проверка радиуса размытия
        for cap in BLUR_RE.captures_iter(trimmed) {
            if let Some(val_match) = cap.get(1) {
                if let Ok(val) = val_match.as_str().parse::<f64>() {
                    if val > max_blur_px as f64 {
                        let fingerprint = compute_fingerprint("CSS-PERF-002", "1.0", "excessive_blur_radius", trimmed);
                        return Some(Violation {
                            rule_id: "CSS-PERF-002".into(),
                            rule_version: "1.0".into(),
                            category: Category::Performance,
                            severity: Severity::Warn,
                            file: file_path.to_path_buf(),
                            line: line_idx,
                            column: 1,
                            symbol: "excessive_blur_radius".into(),
                            snippet: trimmed.to_string(),
                            message: format!(
                                "Blur radius {:.0}px exceeds performance budget (max: {}px). High blur causes severe GPU fill-rate drop on mobile/integrated GPUs.",
                                val, max_blur_px
                            ),
                            remediation: format!("Reduce blur radius to <= {}px.", max_blur_px),
                            fingerprint,
                        });
                    }
                }
            }
        }

        // 2. Проверка количества вложенных функций фильтра
        let fn_count = FILTER_FN_RE.find_iter(trimmed).count();
        if fn_count > max_fns {
            let fingerprint = compute_fingerprint("CSS-PERF-002", "1.0", "excessive_filter_functions", trimmed);
            return Some(Violation {
                rule_id: "CSS-PERF-002".into(),
                rule_version: "1.0".into(),
                category: Category::Performance,
                severity: Severity::Warn,
                file: file_path.to_path_buf(),
                line: line_idx,
                column: 1,
                symbol: "excessive_filter_functions".into(),
                snippet: trimmed.to_string(),
                message: format!(
                    "Filter contains {} chained functions, exceeding budget (max: {}). Chained filters require multiple GPU render passes.",
                    fn_count, max_fns
                ),
                remediation: format!("Simplify filter chain to at most {} functions.", max_fns),
                fingerprint,
            });
        }

        None
    }

    /// PERF-001: Бюджет слоев композитинга и злоупотребление will-change
    pub fn check_will_change_usage(
        selector: &str,
        declaration: &str,
        line_idx: usize,
        file_path: &Path,
    ) -> Option<Violation> {
        let trimmed = declaration.trim();
        if let Some(cap) = WILL_CHANGE_RE.captures(trimmed) {
            let val = cap.get(1).map(|m| m.as_str().trim().to_lowercase()).unwrap_or_default();
            
            // 1. Запрет all / auto
            if val == "all" || val == "auto" {
                let fingerprint = compute_fingerprint("CSS-PERF-001", "1.0", "will_change_wildcard", trimmed);
                return Some(Violation {
                    rule_id: "CSS-PERF-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::Performance,
                    severity: Severity::Warn,
                    file: file_path.to_path_buf(),
                    line: line_idx,
                    column: 1,
                    symbol: "will_change_wildcard".into(),
                    snippet: trimmed.to_string(),
                    message: format!("`will-change: {}` forces premature GPU layer promotion for all properties.", val),
                    remediation: "Specify only target properties: `will-change: transform, opacity;`.".into(),
                    fingerprint,
                });
            }

            // 2. Превентивный will-change на общих статических селекторах
            let sel_lower = selector.trim().to_lowercase();
            let is_interactive = sel_lower.contains(":hover")
                || sel_lower.contains(":active")
                || sel_lower.contains(":focus")
                || sel_lower.contains(".is-")
                || sel_lower.contains("[data-");

            let is_general_selector = sel_lower == "*"
                || sel_lower == "div"
                || sel_lower == "p"
                || sel_lower == "button"
                || sel_lower == "a"
                || sel_lower == "span"
                || sel_lower == "body"
                || sel_lower == ".item"
                || sel_lower == ".card";

            if is_general_selector && !is_interactive {
                let fingerprint = compute_fingerprint("CSS-PERF-001", "1.0", "will_change_overuse", trimmed);
                return Some(Violation {
                    rule_id: "CSS-PERF-001".into(),
                    rule_version: "1.0".into(),
                    category: Category::Performance,
                    severity: Severity::Warn,
                    file: file_path.to_path_buf(),
                    line: line_idx,
                    column: 1,
                    symbol: "will_change_overuse".into(),
                    snippet: format!("{} {{ {} }}", selector.trim(), trimmed),
                    message: format!("Preventive `will-change` on static selector `{}` causes layer explosion and VRAM exhaustion.", selector.trim()),
                    remediation: "Apply `will-change` conditionally during active animation states (:hover, .is-animating).".into(),
                    fingerprint,
                });
            }
        }

        None
    }

    /// PERF-005: Доступность для тяжелых анимаций (prefers-reduced-motion)
    pub fn check_reduced_motion_presence(
        css_content: &str,
        file_path: &Path,
    ) -> Vec<Violation> {
        let mut violations = Vec::new();
        let has_infinite = INFINITE_ANIMATION_RE.is_match(css_content);
        let has_long = LONG_ANIMATION_RE.is_match(css_content);

        if has_infinite || has_long {
            let has_reduced_motion = css_content.contains("prefers-reduced-motion");
            if !has_reduced_motion {
                let snippet = if has_infinite { "animation: ... infinite" } else { "animation duration > 300ms" };
                let fingerprint = compute_fingerprint("CSS-PERF-005", "1.0", "require_reduced_motion", snippet);
                violations.push(Violation {
                    rule_id: "CSS-PERF-005".into(),
                    rule_version: "1.0".into(),
                    category: Category::Performance,
                    severity: Severity::Warn,
                    file: file_path.to_path_buf(),
                    line: 1,
                    column: 1,
                    symbol: "require_reduced_motion".into(),
                    snippet: snippet.to_string(),
                    message: "Continuous or long animations present without `@media (prefers-reduced-motion: reduce)` accessibility override.".into(),
                    remediation: "Add `@media (prefers-reduced-motion: reduce) { ... }` to respect vestibular motion preferences.".into(),
                    fingerprint,
                });
            }
        }

        violations
    }
}
