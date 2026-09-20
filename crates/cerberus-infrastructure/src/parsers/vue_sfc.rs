use crate::frontend::css_rules::CssRuleChecker;
use crate::frontend::lifecycle_rules::LifecycleRuleChecker;
use crate::frontend::sfc_parser::VueSfcParser;
use crate::frontend::vue_rules::VueRuleChecker;
use crate::metrics::SlocCalculator;
use cerberus_domain::{compute_fingerprint, Category, CerberusConfig, Severity, Violation};
use cerberus_ports::AstParserPort;

use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Default)]
pub struct VueSfcParserAdapter {
    pub config: Option<CerberusConfig>,
}

impl VueSfcParserAdapter {
    pub fn new() -> Self {
        Self { config: None }
    }

    pub fn with_config(config: Option<CerberusConfig>) -> Self {
        Self { config }
    }
}

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
                violations.extend(crate::frontend::fsd_rules::FsdRulesChecker::check_source_with_config(
                    &content,
                    path,
                    self.config.as_ref(),
                ));

                // Check SFC SLOC limits (warn: 150, deny: 250)
                let sloc = SlocCalculator::count_sloc(&content, path);
                Self::check_sloc_limits(path, sloc, 150, 250, &mut violations);
            }
            "css" => {
                violations.extend(CssRuleChecker::validate_css_file(&content, path));
            }
            "ts" | "js" => {
                violations.extend(LifecycleRuleChecker::check_typescript_file(&content, path));
                violations.extend(crate::frontend::fsd_rules::FsdRulesChecker::check_source_with_config(
                    &content,
                    path,
                    self.config.as_ref(),
                ));

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
        let adapter = VueSfcParserAdapter::new();
        assert!(adapter.can_parse(Path::new("Component.vue")));
        assert!(adapter.can_parse(Path::new("styles.css")));
        assert!(adapter.can_parse(Path::new("useHook.ts")));
        assert!(adapter.can_parse(Path::new("legacy.js")));
        assert!(!adapter.can_parse(Path::new("main.rs")));
        assert!(!adapter.can_parse(Path::new("no_ext")));

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

        // 3. TS test (regular & composable)
        let ts_path = temp.path().join("hook.ts");
        fs::write(&ts_path, "export function useOk() {}").unwrap();
        let ts_res = adapter.parse_file(&ts_path, "spa").unwrap();
        assert_eq!(ts_res.len(), 0);

        // 4. JS test
        let js_path = temp.path().join("legacy.js");
        fs::write(&js_path, "console.log('test');").unwrap();
        let js_res = adapter.parse_file(&js_path, "spa").unwrap();
        assert_eq!(js_res.len(), 0);

        // 5. Unsupported extension branch
        let txt_path = temp.path().join("doc.txt");
        fs::write(&txt_path, "plain text").unwrap();
        let txt_res = adapter.parse_file(&txt_path, "spa").unwrap();
        assert_eq!(txt_res.len(), 0);

        // 6. Missing file
        let missing = temp.path().join("missing.vue");
        assert!(adapter.parse_file(&missing, "spa").is_err());
    }

    #[test]
    fn test_vue_sfc_sloc_limits() {
        let adapter = VueSfcParserAdapter::with_config(None);
        let temp = tempdir().unwrap();

        // 1. SFC Deny SLOC (> 250)
        let mut large_vue = String::from("<template>\n<div>\n");
        for _ in 0..300 {
            large_vue.push_str("<span>Row</span>\n");
        }
        large_vue.push_str("</div>\n</template>\n");
        let vue_path = temp.path().join("Heavy.vue");
        fs::write(&vue_path, large_vue).unwrap();
        let violations_deny = adapter.parse_file(&vue_path, "spa").unwrap();
        assert!(violations_deny.iter().any(|v| v.rule_id == "ARCH-031" && v.severity == Severity::Deny));

        // 2. SFC Warn SLOC (151..250)
        let mut warn_vue = String::from("<template>\n<div>\n");
        for _ in 0..160 {
            warn_vue.push_str("<span>Row</span>\n");
        }
        warn_vue.push_str("</div>\n</template>\n");
        let warn_vue_path = temp.path().join("Warn.vue");
        fs::write(&warn_vue_path, warn_vue).unwrap();
        let violations_warn = adapter.parse_file(&warn_vue_path, "spa").unwrap();
        assert!(violations_warn.iter().any(|v| v.rule_id == "ARCH-031" && v.severity == Severity::Warn));

        // 3. Regular TS Warn (> 300) & Deny (> 500)
        let mut warn_ts = String::new();
        for _ in 0..320 {
            warn_ts.push_str("export const x = 1;\n");
        }
        let warn_ts_path = temp.path().join("service.ts");
        fs::write(&warn_ts_path, warn_ts).unwrap();
        let ts_warn_res = adapter.parse_file(&warn_ts_path, "spa").unwrap();
        assert!(ts_warn_res.iter().any(|v| v.rule_id == "ARCH-031" && v.severity == Severity::Warn));
    }
}
