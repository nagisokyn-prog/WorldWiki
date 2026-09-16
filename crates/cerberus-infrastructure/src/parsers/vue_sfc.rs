use crate::frontend::css_rules::CssRuleChecker;
use crate::frontend::lifecycle_rules::LifecycleRuleChecker;
use crate::frontend::sfc_parser::VueSfcParser;
use crate::frontend::vue_rules::VueRuleChecker;
use crate::metrics::SlocCalculator;
use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};
use cerberus_ports::AstParserPort;

use std::fs;
use std::path::Path;

pub struct VueSfcParserAdapter;

impl AstParserPort for VueSfcParserAdapter {
    fn can_parse(&self, path: &Path) -> bool {
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        matches!(ext, "vue" | "css" | "ts" | "js")
    }

    fn parse_file(&self, path: &Path, _crate_name: &str) -> Result<Vec<Violation>, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Could not read file {}: {}", path.display(), e))?;

        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        let mut violations = Vec::new();

        match ext {
            "vue" => {
                let sfc = VueSfcParser::parse(&content);
                violations.extend(VueRuleChecker::check(&sfc, path));
                violations.extend(CssRuleChecker::check_sfc_styles(&sfc, path));

                // Check SFC SLOC limits (warn: 150, deny: 250)
                let sloc = SlocCalculator::count_sloc(&content, path);
                Self::check_sloc_limits(path, sloc, 150, 250, &mut violations);
            }
            "css" => {
                violations.extend(CssRuleChecker::validate_css_file(&content, path));
            }
            "ts" | "js" => {
                violations.extend(LifecycleRuleChecker::check_typescript_file(&content, path));

                let sloc = SlocCalculator::count_sloc(&content, path);
                let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
                let (warn_sloc, deny_sloc) = if filename.starts_with("use") {
                    (250, 450) // Composables limit
                } else {
                    (300, 500)
                };
                Self::check_sloc_limits(path, sloc, warn_sloc, deny_sloc, &mut violations);
            }
            _ => {}
        }

        Ok(violations)
    }
}

impl VueSfcParserAdapter {
    fn check_sloc_limits(
        path: &Path,
        sloc: usize,
        warn_sloc: usize,
        deny_sloc: usize,
        violations: &mut Vec<Violation>,
    ) {
        if sloc > deny_sloc {
            let snippet = format!("SLOC: {} (deny limit: {})", sloc, deny_sloc);
            let fingerprint = compute_fingerprint("ARCH-031", "1.0", "component", &snippet);
            violations.push(Violation {
                rule_id: "ARCH-031".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Deny,
                file: path.to_path_buf(),
                line: 1,
                column: 1,
                symbol: "component".into(),
                snippet,
                message: format!(
                    "Frontend file SLOC ({}) exceeds strict limit ({})",
                    sloc, deny_sloc
                ),
                remediation: "Decompose into atomic subcomponents and companion composable hooks.".into(),
                fingerprint,
            });
        } else if sloc > warn_sloc {
            let snippet = format!("SLOC: {} (warn limit: {})", sloc, warn_sloc);
            let fingerprint = compute_fingerprint("ARCH-031", "1.0", "component", &snippet);
            violations.push(Violation {
                rule_id: "ARCH-031".into(),
                rule_version: "1.0".into(),
                category: Category::Architecture,
                severity: Severity::Warn,
                file: path.to_path_buf(),
                line: 1,
                column: 1,
                symbol: "component".into(),
                snippet,
                message: format!(
                    "Frontend file SLOC ({}) exceeds recommended limit ({})",
                    sloc, warn_sloc
                ),
                remediation: "Consider extracting helper subcomponents or composable functions.".into(),
                fingerprint,
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_vue_sfc_parser_adapter_can_parse_and_parse_files() {
        let adapter = VueSfcParserAdapter;
        assert!(adapter.can_parse(Path::new("Component.vue")));
        assert!(adapter.can_parse(Path::new("styles.css")));
        assert!(adapter.can_parse(Path::new("useHook.ts")));
        assert!(adapter.can_parse(Path::new("legacy.js")));
        assert!(!adapter.can_parse(Path::new("main.rs")));

        let temp = tempdir().unwrap();

        // 1. Vue SFC test
        let vue_path = temp.path().join("App.vue");
        fs::write(
            &vue_path,
            "<template><div>Hello</div></template><script setup>const x = 1;</script>",
        )
        .unwrap();
        let vue_res = adapter.parse_file(&vue_path, "spa").unwrap();
        assert_eq!(vue_res.len(), 0);

        // 2. CSS test
        let css_path = temp.path().join("app.css");
        fs::write(&css_path, "body { color: var(--color-text-primary); }").unwrap();
        let css_res = adapter.parse_file(&css_path, "spa").unwrap();
        assert_eq!(css_res.len(), 0);

        // 3. TS test
        let ts_path = temp.path().join("hook.ts");
        fs::write(&ts_path, "export function useOk() {}").unwrap();
        let ts_res = adapter.parse_file(&ts_path, "spa").unwrap();
        assert_eq!(ts_res.len(), 0);

        // 4. Missing file
        let missing = temp.path().join("missing.vue");
        assert!(adapter.parse_file(&missing, "spa").is_err());
    }

    #[test]
    fn test_vue_sfc_sloc_limits() {
        let adapter = VueSfcParserAdapter;
        let temp = tempdir().unwrap();

        let mut large_vue = String::from("<template>\n<div>\n");
        for _ in 0..300 {
            large_vue.push_str("<span>Row</span>\n");
        }
        large_vue.push_str("</div>\n</template>\n");

        let vue_path = temp.path().join("Heavy.vue");
        fs::write(&vue_path, large_vue).unwrap();

        let violations = adapter.parse_file(&vue_path, "spa").unwrap();
        assert!(violations.iter().any(|v| v.rule_id == "ARCH-031"));
    }
}
